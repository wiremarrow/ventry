/**
 * RLS (Row-Level Security) Service
 *
 * This service provides secure methods for managing RLS context in PostgreSQL.
 * It includes input validation, parameterized queries, and audit logging.
 */

import { Prisma, type PrismaClient } from '@ventry/database';
import { createLogger } from '../logger.js';
import { RLS_ERRORS, RLS_AUDIT_EVENTS, RLS_METRICS } from './constants.js';
import {
  type RLSContext,
  type ValidatedRLSContext,
  type RLSBypassContext,
  type RLSOperationResult,
  type RLSAuditEntry,
  validateRLSContext,
  isBypassContext,
} from './types.js';

const logger = createLogger('rls-service');

/**
 * Sets PostgreSQL session variables for RLS context
 * Uses a SECURITY DEFINER function to prevent SQL injection
 */
export async function setRLSContext(
  tx: Pick<PrismaClient, '$executeRaw'>,
  context: ValidatedRLSContext
): Promise<void> {
  const startTime = Date.now();

  try {
    // Use the secure database function with parameterized query
    // The function validates CUID format at the database level
    await tx.$executeRaw`SELECT set_rls_context(${context.organizationId}, ${context.userId})`;

    const duration = Date.now() - startTime;
    logger.debug(
      {
        organizationId: context.organizationId,
        userId: context.userId,
        durationMs: duration,
      },
      'RLS context set successfully'
    );

    // Record metrics
    recordMetric(RLS_METRICS.CONTEXT_SET_DURATION, duration);
  } catch (error) {
    // Handle specific database errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2010' && error.message.includes('data_exception')) {
        logger.error(
          {
            error,
            context,
          },
          'Invalid RLS context format'
        );
        throw new Error(RLS_ERRORS.INVALID_ORG_ID);
      }
    }

    logger.error(
      {
        error,
        context,
      },
      'Failed to set RLS context'
    );
    throw new Error(RLS_ERRORS.SESSION_VAR_FAILED);
  }
}

/**
 * Clears RLS context (for cleanup)
 */
export async function clearRLSContext(tx: Pick<PrismaClient, '$executeRaw'>): Promise<void> {
  try {
    // Use the secure database function to clear context
    await tx.$executeRaw`SELECT clear_rls_context()`;

    logger.debug('RLS context cleared');
  } catch (error) {
    logger.error({ error }, 'Failed to clear RLS context');
    // Don't throw - this is cleanup
  }
}

/**
 * Executes a database operation with RLS context
 */
export async function withRLS<T>(
  prisma: PrismaClient,
  context: RLSContext,
  operation: (
    tx: Omit<
      PrismaClient,
      '$on' | '$connect' | '$disconnect' | '$use' | '$transaction' | '$extends'
    >
  ) => Promise<T>
): Promise<RLSOperationResult<T>> {
  const startTime = Date.now();
  const timings = {
    contextSetMs: 0,
    queryMs: 0,
    totalMs: 0,
  };

  try {
    // Validate the context
    const validatedContext = validateRLSContext(context);

    // Handle bypass case
    if (isBypassContext(validatedContext)) {
      await auditRLSBypass(validatedContext);

      const queryStart = Date.now();
      const data = await prisma.$transaction(async (tx) => await operation(tx));
      timings.queryMs = Date.now() - queryStart;
      timings.totalMs = Date.now() - startTime;

      return {
        data,
        timing: timings,
        context: {
          bypassed: true,
        },
      };
    }

    // Normal RLS case
    const data = await prisma.$transaction(async (tx) => {
      const contextStart = Date.now();
      await setRLSContext(tx, validatedContext);
      timings.contextSetMs = Date.now() - contextStart;

      const queryStart = Date.now();
      const result = await operation(tx);
      timings.queryMs = Date.now() - queryStart;

      return result;
    });

    timings.totalMs = Date.now() - startTime;

    return {
      data,
      timing: timings,
      context: {
        organizationId: validatedContext.organizationId,
        userId: validatedContext.userId,
        bypassed: false,
      },
    };
  } catch (error) {
    logger.error(
      {
        error,
        context,
        duration: Date.now() - startTime,
      },
      'RLS operation failed'
    );
    throw error;
  }
}

/**
 * Audits RLS bypass operations
 */
async function auditRLSBypass(context: RLSBypassContext): Promise<void> {
  const auditEntry: RLSAuditEntry = {
    timestamp: new Date(),
    event: RLS_AUDIT_EVENTS.BYPASS_GRANTED,
    userId: context.auditUserId,
    bypassReason: context.bypassReason,
    success: true,
  };

  logger.warn(auditEntry, 'RLS bypass granted - this should be rare in production');

  // Record metric
  recordMetric(RLS_METRICS.BYPASS_COUNT, 1);

  // In production, you might want to send this to an audit service
  // await auditService.log(auditEntry);
}

/**
 * Records a metric (placeholder - implement with your metrics service)
 */
function recordMetric(metric: string, value: number): void {
  // TODO: Implement with your metrics service (e.g., Prometheus, DataDog)
  logger.debug({ metric, value }, 'Metric recorded');
}

/**
 * Creates a function to get RLS context from request
 */
export function createRLSContextGetter(
  getOrgId: () => string | undefined,
  getUserId: () => string | undefined
): () => RLSContext {
  return () => {
    const organizationId = getOrgId();
    const userId = getUserId();

    if (!organizationId) {
      return { bypassRLS: true, bypassReason: 'No organization context' };
    }

    return {
      organizationId,
      userId,
      bypassRLS: false,
    };
  };
}

/**
 * Validates that RLS is properly configured in the database
 */
export async function validateRLSConfiguration(prisma: PrismaClient): Promise<boolean> {
  try {
    // Check if our secure RLS functions exist
    const functions = await prisma.$queryRaw<Array<{ routine_name: string }>>`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_type = 'FUNCTION' 
      AND routine_schema = 'public'
      AND routine_name = ANY(ARRAY['set_rls_context', 'clear_rls_context', 'get_rls_context', 'current_organization_id', 'current_user_id'])
    `;

    const requiredFunctions = ['set_rls_context', 'clear_rls_context', 'get_rls_context'];
    const foundFunctions = functions.map((f) => f.routine_name);
    const missingFunctions = requiredFunctions.filter((f) => !foundFunctions.includes(f));

    if (missingFunctions.length > 0) {
      logger.error(
        { missingFunctions, foundFunctions },
        'Required RLS functions not found in database'
      );
      return false;
    }

    // Test that the functions work correctly
    try {
      await prisma.$transaction(async (tx) => {
        // Test setting context with valid CUID
        await tx.$queryRaw`SELECT set_rls_context(${'cjld2cjxh0000qzrmn831i7rn'}, ${'cjld2cjxh0001qzrmn831i7ro'})`;

        // Test getting context
        const context = await tx.$queryRaw<Array<{ organization_id: string; user_id: string }>>`
          SELECT * FROM get_rls_context()
        `;

        if (context.length === 0 || context[0].organization_id !== 'cjld2cjxh0000qzrmn831i7rn') {
          throw new Error('RLS context verification failed');
        }

        // Test clearing context
        await tx.$queryRaw`SELECT clear_rls_context()`;
      });
    } catch (error) {
      logger.error({ error }, 'RLS function test failed');
      return false;
    }

    // Check if RLS is enabled on critical tables
    const rlsEnabled = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
      SELECT c.relname, c.relrowsecurity 
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname = ANY(ARRAY['items', 'orders', 'inventory'])
    `;

    const disabledTables = rlsEnabled.filter((t) => !t.relrowsecurity);
    if (disabledTables.length > 0) {
      logger.error(
        { tables: disabledTables.map((t) => t.relname) },
        'RLS not enabled on critical tables'
      );
      return false;
    }

    logger.info('RLS configuration validated successfully');
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to validate RLS configuration');
    return false;
  }
}
