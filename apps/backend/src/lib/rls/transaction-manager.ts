/**
 * RLS Transaction Manager
 * 
 * Manages database transactions with RLS context, ensuring proper
 * isolation, rollback strategies, and connection pool awareness.
 */

import { Prisma, type PrismaClient } from '@ventry/database';
import { createLogger } from '../logger.js';
import { setRLSContext, clearRLSContext } from './rls-service.js';
import {
  type RLSContext,
  type ValidatedRLSContext,
  type RLSOperationResult,
  validateRLSContext,
  isValidatedContext,
  isBypassContext,
} from './types.js';
import { RLS_ERRORS } from './constants.js';

const logger = createLogger('rls-transaction-manager');

/**
 * Transaction options with RLS support
 */
export interface RLSTransactionOptions {
  /** Max wait time for transaction */
  maxWait?: number;
  /** Timeout for transaction */
  timeout?: number;
  /** Isolation level for transaction */
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /** Whether to clear RLS context after transaction */
  clearContextAfter?: boolean;
  /** Whether to validate RLS policies during transaction */
  validatePolicies?: boolean;
  /** Custom error handler for RLS violations */
  onRLSViolation?: (error: Error) => void;
}

/**
 * Executes a transaction with RLS context management
 */
export async function executeRLSTransaction<T>(
  prisma: PrismaClient,
  context: RLSContext,
  fn: (tx: Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$use' | '$transaction' | '$extends'>) => Promise<T>,
  options?: RLSTransactionOptions
): Promise<RLSOperationResult<T>> {
  const startTime = Date.now();
  const timings = {
    contextSetMs: 0,
    queryMs: 0,
    totalMs: 0,
  };

  try {
    // Validate context
    const validatedContext = validateRLSContext(context);

    // Execute transaction
    const result = await prisma.$transaction(
      async (tx) => {
        try {
          // Set RLS context if not bypassing
          if (isValidatedContext(validatedContext)) {
            const contextStart = Date.now();
            await setRLSContext(tx, validatedContext);
            timings.contextSetMs = Date.now() - contextStart;

            logger.debug(
              {
                organizationId: validatedContext.organizationId,
                userId: validatedContext.userId,
                contextSetMs: timings.contextSetMs,
              },
              'RLS context set for transaction'
            );
          }

          // Execute the transaction function
          const queryStart = Date.now();
          const data = await fn(tx);
          timings.queryMs = Date.now() - queryStart;

          // Clear context if requested
          if (options?.clearContextAfter && isValidatedContext(validatedContext)) {
            await clearRLSContext(tx);
          }

          return data;
        } catch (error) {
          // Handle RLS policy violations
          if (isRLSPolicyViolation(error)) {
            logger.error(
              {
                error,
                context: validatedContext,
              },
              'RLS policy violation in transaction'
            );

            if (options?.onRLSViolation) {
              options.onRLSViolation(error as Error);
            }

            throw new Error(RLS_ERRORS.POLICY_VIOLATION);
          }

          throw error;
        }
      },
      {
        maxWait: options?.maxWait,
        timeout: options?.timeout,
        isolationLevel: options?.isolationLevel,
      }
    );

    timings.totalMs = Date.now() - startTime;

    return {
      data: result,
      timing: timings,
      context: {
        organizationId: isValidatedContext(validatedContext)
          ? validatedContext.organizationId
          : undefined,
        userId: isValidatedContext(validatedContext)
          ? validatedContext.userId
          : isBypassContext(validatedContext)
          ? (validatedContext as any).auditUserId
          : undefined,
        bypassed: isBypassContext(validatedContext),
      },
    };
  } catch (error) {
    logger.error(
      {
        error,
        context,
        duration: Date.now() - startTime,
      },
      'RLS transaction failed'
    );
    throw error;
  }
}

/**
 * Creates a transaction retry strategy for RLS operations
 */
export function createRLSRetryStrategy(
  maxRetries: number = 3,
  backoffMs: number = 100
): <T>(
  fn: () => Promise<T>
) => Promise<T> {
  return async function retry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry RLS policy violations
        if (isRLSPolicyViolation(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!isRetryableError(error)) {
          throw error;
        }

        // Calculate backoff with jitter
        const backoff = backoffMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * backoff * 0.1;
        const delay = backoff + jitter;

        logger.debug(
          {
            attempt,
            maxRetries,
            delay,
            error: lastError.message,
          },
          'Retrying RLS transaction after error'
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  };
}

/**
 * Checks if an error is an RLS policy violation
 */
function isRLSPolicyViolation(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('row-level security') ||
      message.includes('policy') ||
      message.includes('permission denied') ||
      (error as any).code === '42501' // PostgreSQL insufficient_privilege
    );
  }
  return false;
}

/**
 * Checks if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const code = (error as any).code;

    // PostgreSQL error codes that are retryable
    const retryableCodes = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '55P03', // lock_not_available
      '57P01', // admin_shutdown
      '57P02', // crash_shutdown
      '57P03', // cannot_connect_now
      '58000', // system_error
      '58030', // io_error
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
    ];

    return (
      retryableCodes.includes(code) ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('deadlock')
    );
  }
  return false;
}

/**
 * Creates a connection pool aware transaction executor
 */
export function createPoolAwareTransactionExecutor(
  prisma: PrismaClient,
  poolConfig: {
    maxConnections: number;
    connectionTimeout: number;
  }
): <T>(
  context: RLSContext,
  fn: (tx: Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$use' | '$transaction' | '$extends'>) => Promise<T>,
  options?: RLSTransactionOptions
) => Promise<RLSOperationResult<T>> {
  let activeConnections = 0;

  return async function execute<T>(
    context: RLSContext,
    fn: (tx: Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$use' | '$transaction' | '$extends'>) => Promise<T>,
    options?: RLSTransactionOptions
  ): Promise<RLSOperationResult<T>> {
    // Check if pool is exhausted
    if (activeConnections >= poolConfig.maxConnections) {
      logger.warn(
        {
          activeConnections,
          maxConnections: poolConfig.maxConnections,
        },
        'Connection pool near capacity'
      );
    }

    activeConnections++;
    try {
      return await executeRLSTransaction(
        prisma,
        context,
        fn,
        {
          ...options,
          timeout: options?.timeout ?? poolConfig.connectionTimeout,
        }
      );
    } finally {
      activeConnections--;
    }
  };
}