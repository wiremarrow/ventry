import { PrismaClient } from '@ventry/database';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('rls-test-helpers-minimal');

/**
 * Minimal RLS test helpers that assume RLS infrastructure already exists
 * These helpers do not perform any DDL operations and are safe for use with limited database roles
 */

/**
 * Sets the RLS context for the current database session
 * This should be called within a transaction to ensure proper isolation
 */
export async function setRLSContext(
  prisma: PrismaClient,
  organizationId: string | null,
  userId: string | null
) {
  try {
    await prisma.$executeRaw`SELECT set_rls_context(${organizationId}, ${userId})`;
    logger.debug({ organizationId, userId }, 'RLS context set');
  } catch (error) {
    logger.error({ error, organizationId, userId }, 'Failed to set RLS context');
    throw error;
  }
}

/**
 * Verifies that RLS is enabled on a table
 */
export async function verifyRLSEnabled(prisma: PrismaClient, tableName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`
      SELECT relrowsecurity 
      FROM pg_class 
      WHERE relname = ${tableName} 
      AND relnamespace = 'public'::regnamespace
    `;

    return result[0]?.relrowsecurity === true;
  } catch (error) {
    logger.error({ error, tableName }, 'Failed to verify RLS status');
    return false;
  }
}

/**
 * Gets the current RLS context from the database session
 */
export async function getCurrentRLSContext(prisma: PrismaClient): Promise<{
  organizationId: string | null;
  userId: string | null;
}> {
  try {
    const result = await prisma.$queryRaw<
      Array<{ organization_id: string | null; user_id: string | null }>
    >`
      SELECT 
        current_organization_id() as organization_id,
        current_user_id() as user_id
    `;

    return {
      organizationId: result[0]?.organization_id || null,
      userId: result[0]?.user_id || null,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get current RLS context');
    return { organizationId: null, userId: null };
  }
}

/**
 * Test helper to verify that a query respects RLS policies
 * Returns true if the query only returns rows for the current organization
 */
export async function verifyRLSFiltering<T extends { organizationId: string }>(
  items: T[],
  expectedOrganizationId: string
): boolean {
  return items.every((item) => item.organizationId === expectedOrganizationId);
}

/**
 * Creates a test context for RLS testing
 * This assumes the database already has RLS enabled and policies in place
 */
export function createRLSTestContext(prisma: PrismaClient, organizationId: string, userId: string) {
  return {
    async runWithContext<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx) => {
        // Set the RLS context for this transaction
        await tx.$executeRaw`SELECT set_rls_context(${organizationId}, ${userId})`;

        // Run the test function
        return fn(tx);
      });
    },
  };
}
