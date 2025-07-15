import { Prisma } from '@ventry/database';
import type { PrismaClient } from '@ventry/database';
import { createLogger } from './logger.js';
import { z } from 'zod';

const logger = createLogger('rls-middleware');

/**
 * RLS (Row-Level Security) Context Schema
 * Validates the context before applying to database
 */
const RLSContextSchema = z.object({
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  bypassRLS: z.boolean().optional().default(false),
});

export type RLSContext = z.infer<typeof RLSContextSchema>;

/**
 * Error class for RLS-related errors
 */
export class RLSError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'RLSError';
  }
}

/**
 * Validates and sanitizes RLS context
 */
function validateContext(context: unknown): RLSContext {
  try {
    return RLSContextSchema.parse(context);
  } catch (error) {
    throw new RLSError('Invalid RLS context', 'INVALID_CONTEXT');
  }
}

/**
 * Sets PostgreSQL session variables for RLS in a safe way
 */
async function setSessionVariables(
  tx: Prisma.TransactionClient,
  context: RLSContext
): Promise<void> {
  try {
    if (context.organizationId) {
      // Use parameterized query to prevent SQL injection
      await tx.$executeRawUnsafe(
        'SELECT set_config($1, $2, true)',
        'app.current_organization_id',
        context.organizationId
      );
    }
    
    if (context.userId) {
      await tx.$executeRawUnsafe(
        'SELECT set_config($1, $2, true)',
        'app.current_user_id',
        context.userId
      );
    }
    
    logger.debug({
      organizationId: context.organizationId,
      userId: context.userId,
    }, 'RLS session variables set');
  } catch (error) {
    logger.error({ error, context }, 'Failed to set RLS session variables');
    throw new RLSError('Failed to set RLS context', 'SESSION_VAR_ERROR');
  }
}

/**
 * Wraps a Prisma operation with RLS context
 * Ensures all queries within the callback are executed with proper RLS
 */
export async function withRLS<T>(
  prisma: PrismaClient,
  context: unknown,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const validatedContext = validateContext(context);
  
  if (validatedContext.bypassRLS || !validatedContext.organizationId) {
    logger.debug({ bypassRLS: validatedContext.bypassRLS }, 'Bypassing RLS');
    return prisma.$transaction(callback);
  }
  
  return prisma.$transaction(async (tx) => {
    await setSessionVariables(tx, validatedContext);
    return callback(tx);
  }, {
    // Ensure RLS context is isolated to this transaction
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}

/**
 * Type-safe proxy handler for Prisma models
 */
type PrismaModelProxy<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : T[K];
};

/**
 * Creates a type-safe Prisma proxy that automatically applies RLS
 */
export function createRLSProxy(
  prisma: PrismaClient,
  getContext: () => unknown
): PrismaClient {
  const handler: ProxyHandler<PrismaClient> = {
    get(target, prop: string | symbol) {
      const original = target[prop as keyof PrismaClient];
      
      // Handle special Prisma client methods
      if (prop === '$transaction') {
        return createTransactionProxy(target, getContext);
      }
      
      if (prop === '$connect' || prop === '$disconnect' || prop === '$on' || prop === '$use') {
        return original;
      }
      
      // Handle model proxies
      if (isModel(target, prop)) {
        return createModelProxy(target, prop as string, getContext);
      }
      
      return original;
    },
  };
  
  return new Proxy(prisma, handler);
}

/**
 * Creates a proxy for the $transaction method
 */
function createTransactionProxy(
  prisma: PrismaClient,
  getContext: () => unknown
) {
  return async function transaction(...args: unknown[]) {
    const context = validateContext(getContext());
    
    if (context.bypassRLS || !context.organizationId) {
      return (prisma.$transaction as any)(...args);
    }
    
    // Handle callback-style transactions
    if (typeof args[0] === 'function') {
      const callback = args[0] as (tx: Prisma.TransactionClient) => Promise<unknown>;
      
      return prisma.$transaction(async (tx) => {
        await setSessionVariables(tx, context);
        return callback(tx);
      }, args[1] as any);
    }
    
    // Handle array-style transactions
    return (prisma.$transaction as any)(...args);
  };
}

/**
 * Creates a proxy for Prisma model operations
 */
function createModelProxy(
  prisma: PrismaClient,
  modelName: string,
  getContext: () => unknown
): PrismaModelProxy<any> {
  const model = (prisma as any)[modelName];
  
  return new Proxy(model, {
    get(target, method: string | symbol) {
      const original = target[method];
      
      if (typeof original !== 'function') {
        return original;
      }
      
      return async function (...args: unknown[]) {
        const context = validateContext(getContext());
        
        if (context.bypassRLS || !context.organizationId) {
          return original.apply(target, args);
        }
        
        return withRLS(prisma, context, async (tx) => {
          const txModel = (tx as any)[modelName];
          return txModel[method].apply(txModel, args);
        });
      };
    },
  });
}

/**
 * Type guard to check if a property is a Prisma model
 */
function isModel(prisma: PrismaClient, prop: string | symbol): boolean {
  if (typeof prop !== 'string') return false;
  
  const value = (prisma as any)[prop];
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.findMany === 'function' &&
    typeof value.create === 'function'
  );
}

/**
 * System operation wrapper that bypasses RLS
 * Use with extreme caution - only for administrative tasks
 */
export async function withSystemPrivileges<T>(
  prisma: PrismaClient,
  operation: string,
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  logger.warn({ operation }, 'Executing operation with system privileges (RLS bypassed)');
  
  try {
    const result = await callback(prisma);
    logger.info({ operation }, 'System operation completed successfully');
    return result;
  } catch (error) {
    logger.error({ operation, error }, 'System operation failed');
    throw error;
  }
}