/**
 * RLS (Row-Level Security) Proxy
 * 
 * This module provides a type-safe proxy for Prisma client that automatically
 * applies RLS context to all database operations.
 */

import { Prisma, type PrismaClient } from '@ventry/database';
import { createLogger } from '../logger.js';
import { withRLS } from './rls-service.js';
import { type RLSContext, validateRLSContext, isBypassContext } from './types.js';
import { RLS_ERRORS } from './constants.js';

const logger = createLogger('rls-proxy');

/**
 * Type for Prisma model operations
 */
type PrismaModelDelegate = {
  [K in keyof PrismaClient]: PrismaClient[K] extends {
    findMany: (...args: any[]) => any;
  }
    ? PrismaClient[K]
    : never;
}[keyof PrismaClient];

/**
 * Type for functions that should not be proxied
 */
type NonProxiedMethods = 
  | '$connect'
  | '$disconnect'
  | '$on'
  | '$use'
  | '$extends'
  | '$executeRaw'
  | '$executeRawUnsafe'
  | '$queryRaw'
  | '$queryRawUnsafe'
  | '$transaction'
  | '$metrics';

/**
 * Creates a type-safe RLS proxy for Prisma client
 */
export function createRLSProxy(
  prisma: PrismaClient,
  getContext: () => RLSContext
): PrismaClient {
  // Create a cache for proxied models to improve performance
  const modelProxyCache = new Map<string, any>();

  return new Proxy(prisma, {
    get(target: PrismaClient, prop: string | symbol): any {
      // Handle symbol properties
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop);
      }

      // Get the original property
      const original = Reflect.get(target, prop);

      // Skip non-function properties
      if (typeof original !== 'function' && typeof original !== 'object') {
        return original;
      }

      // Skip non-proxied methods
      if (isNonProxiedMethod(prop)) {
        // Special handling for $transaction
        if (prop === '$transaction') {
          return createTransactionProxy(target, original, getContext);
        }
        return original;
      }

      // Handle model delegates (e.g., prisma.user, prisma.item)
      if (isModelDelegate(target, prop)) {
        // Check cache first
        if (modelProxyCache.has(prop)) {
          return modelProxyCache.get(prop);
        }

        const modelProxy = createModelProxy(
          original,
          prop,
          prisma,
          getContext
        );
        modelProxyCache.set(prop, modelProxy);
        return modelProxy;
      }

      // Return original for everything else
      return original;
    },
  });
}

/**
 * Creates a proxy for Prisma model operations
 */
function createModelProxy(
  model: PrismaModelDelegate,
  modelName: string,
  prisma: PrismaClient,
  getContext: () => RLSContext
): PrismaModelDelegate {
  return new Proxy(model, {
    get(target: any, prop: string | symbol): any {
      // Handle symbol properties
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop);
      }

      const original = Reflect.get(target, prop);

      // Skip non-function properties
      if (typeof original !== 'function') {
        return original;
      }

      // Return a wrapped function that applies RLS
      return async function (this: any, ...args: any[]): Promise<any> {
        const context = getContext();
        const startTime = Date.now();

        try {
          // Validate context
          const validatedContext = validateRLSContext(context);

          // If bypassing RLS, just call the original
          if (isBypassContext(validatedContext)) {
            logger.debug(
              {
                model: modelName,
                operation: prop,
                bypassed: true,
                reason: validatedContext.bypassReason,
              },
              'RLS bypassed for operation'
            );
            return original.apply(target, args);
          }

          // Wrap in RLS context
          const result = await withRLS(
            prisma,
            validatedContext,
            async (tx) => {
              // Get the model from the transaction
              const txModel = (tx as any)[modelName];
              if (!txModel) {
                throw new Error(`Model ${modelName} not found on transaction`);
              }

              // Call the original method on the transaction model
              return txModel[prop].apply(txModel, args);
            }
          );

          logger.debug(
            {
              model: modelName,
              operation: prop,
              duration: Date.now() - startTime,
              organizationId: result.context.organizationId,
            },
            'RLS operation completed'
          );

          return result.data;
        } catch (error) {
          logger.error(
            {
              error,
              model: modelName,
              operation: prop,
              duration: Date.now() - startTime,
            },
            'RLS operation failed'
          );
          throw error;
        }
      };
    },
  });
}

/**
 * Creates a proxy for $transaction method
 */
function createTransactionProxy(
  prisma: PrismaClient,
  originalTransaction: Function,
  getContext: () => RLSContext
): Function {
  return function (this: any, ...args: any[]): Promise<any> {
    const context = getContext();

    // Handle array of promises (batch transaction)
    if (Array.isArray(args[0])) {
      logger.warn(
        'Batch transactions with RLS are not recommended. Consider using interactive transactions.'
      );
      return originalTransaction.apply(prisma, args);
    }

    // Handle interactive transaction
    if (typeof args[0] === 'function') {
      const originalCallback = args[0];
      const options = args[1];

      // Wrap the callback to set RLS context
      const wrappedCallback = async (tx: Prisma.TransactionClient) => {
        try {
          const validatedContext = validateRLSContext(context);

          // If not bypassing, set RLS context
          if (!isBypassContext(validatedContext)) {
            const { setRLSContext } = await import('./rls-service.js');
            await setRLSContext(tx, validatedContext);
          }

          // Call the original callback
          return await originalCallback(tx);
        } catch (error) {
          logger.error({ error }, 'Transaction with RLS failed');
          throw error;
        }
      };

      // Call original transaction with wrapped callback
      return originalTransaction.call(prisma, wrappedCallback, options);
    }

    // Unknown transaction type
    logger.warn('Unknown transaction type, calling without RLS');
    return originalTransaction.apply(prisma, args);
  };
}

/**
 * Checks if a property is a non-proxied method
 */
function isNonProxiedMethod(prop: string): prop is NonProxiedMethods {
  const nonProxiedMethods: NonProxiedMethods[] = [
    '$connect',
    '$disconnect',
    '$on',
    '$use',
    '$extends',
    '$executeRaw',
    '$executeRawUnsafe',
    '$queryRaw',
    '$queryRawUnsafe',
    '$transaction',
    '$metrics',
  ];
  return nonProxiedMethods.includes(prop as NonProxiedMethods);
}

/**
 * Checks if a property is a Prisma model delegate
 */
function isModelDelegate(
  prisma: PrismaClient,
  prop: string
): prop is keyof Omit<PrismaClient, NonProxiedMethods> {
  const value = (prisma as any)[prop];
  return (
    value &&
    typeof value === 'object' &&
    typeof value.findMany === 'function'
  );
}