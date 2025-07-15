/**
 * @deprecated This file is deprecated. Use './rls/index.js' instead.
 * 
 * This file is kept for backward compatibility but will be removed in a future version.
 * Please migrate to the new RLS module which provides better type safety,
 * security, and performance.
 */

import { createLogger } from './logger.js';

const logger = createLogger('rls-middleware-deprecated');

logger.warn(
  'rls-middleware.ts is deprecated. Please migrate to ./rls/index.js for improved security and type safety.'
);

// Re-export everything from the new module
export * from './rls/index.js';