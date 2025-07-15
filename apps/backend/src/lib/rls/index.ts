/**
 * RLS (Row-Level Security) Module
 * 
 * This module provides a comprehensive, type-safe implementation of
 * Row-Level Security for multi-tenant applications using Prisma and PostgreSQL.
 */

// Export constants
export * from './constants.js';

// Export types
export type {
  RLSContext,
  ValidatedRLSContext,
  RLSBypassContext,
  AnyRLSContext,
  RLSOperationResult,
  RLSAuditEntry,
} from './types.js';

// Export validation functions
export {
  cuidSchema,
  rlsContextSchema,
  validatedRLSContextSchema,
  rlsBypassContextSchema,
  isValidatedContext,
  isBypassContext,
  validateRLSContext,
  sanitizeSessionValue,
} from './types.js';

// Export service functions
export {
  setRLSContext,
  clearRLSContext,
  withRLS,
  createRLSContextGetter,
  validateRLSConfiguration,
} from './rls-service.js';

// Export proxy
export { createRLSProxy } from './rls-proxy.js';

// Export transaction manager
export {
  executeRLSTransaction,
  createRLSRetryStrategy,
  createPoolAwareTransactionExecutor,
  type RLSTransactionOptions,
} from './transaction-manager.js';

// Re-export the old functions for backward compatibility (deprecated)
import { createLogger } from '../logger.js';
import type { PrismaClient } from '@ventry/database';
import { withRLS as withRLSNew } from './rls-service.js';
import type { RLSContext } from './types.js';

const logger = createLogger('rls-compatibility');

/**
 * @deprecated Use createRLSProxy from './rls-proxy.js' instead
 */
export function createRLSMiddleware(_getContext: () => RLSContext) {
  logger.warn('createRLSMiddleware is deprecated. Use createRLSProxy instead.');
  // Return a no-op middleware for compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (params: any, next: any) => next(params);
}

/**
 * @deprecated Use withRLS from './rls-service.js' instead
 */
export async function withRLSLegacy<T>(
  prisma: PrismaClient,
  context: RLSContext,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  logger.warn('Legacy withRLS function called. Consider using the new API.');
  const result = await withRLSNew(prisma, context, callback);
  return result.data;
}

/**
 * @deprecated Use proper RLS service methods instead
 */
export async function bypassRLS<T>(
  prisma: PrismaClient,
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  logger.warn('bypassRLS is deprecated. Use withRLS with bypassRLS context instead.');
  const result = await withRLSNew(
    prisma,
    { bypassRLS: true, bypassReason: 'Legacy bypass function' },
    async () => callback(prisma)
  );
  return result.data;
}