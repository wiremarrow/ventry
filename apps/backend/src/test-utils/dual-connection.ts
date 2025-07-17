import { PrismaClient } from '@ventry/database';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('dual-connection');

/**
 * Creates dual database connections for testing
 * - adminPrisma: Uses superuser connection for test setup (bypasses RLS)
 * - appPrisma: Uses application role for test execution (enforces RLS)
 */
export function createTestConnections() {
  // Admin connection URL (defaults to superuser)
  const adminUrl = process.env.DATABASE_ADMIN_URL || 
    'postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test';
  
  // App connection URL (uses limited role)
  const appUrl = process.env.DATABASE_URL || 
    'postgresql://ventry_app:ventry_app_password@localhost:5487/ventry_integration_test';
  
  logger.debug('Creating dual connections for testing');
  
  const adminPrisma = new PrismaClient({
    datasources: {
      db: { url: adminUrl }
    },
    log: process.env.DEBUG === 'true' ? ['query', 'warn', 'error'] : ['error']
  });
  
  const appPrisma = new PrismaClient({
    datasources: {
      db: { url: appUrl }
    },
    log: process.env.DEBUG === 'true' ? ['query', 'warn', 'error'] : ['error']
  });
  
  return {
    adminPrisma,
    appPrisma,
    async cleanup() {
      await adminPrisma.$disconnect();
      await appPrisma.$disconnect();
    }
  };
}

/**
 * Helper to run test setup with admin connection and assertions with app connection
 */
export async function withDualConnections<T>(
  fn: (connections: { 
    adminPrisma: PrismaClient; 
    appPrisma: PrismaClient; 
  }) => Promise<T>
): Promise<T> {
  const connections = createTestConnections();
  
  try {
    return await fn(connections);
  } finally {
    await connections.cleanup();
  }
}