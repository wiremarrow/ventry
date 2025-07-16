// Integration test setup with real PostgreSQL database
import 'reflect-metadata';

// Environment variables for integration tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.COOKIE_SECRET = 'test-cookie-secret-for-integration-testing';

// Worker-specific database configuration for true test isolation
function setupWorkerDatabase() {
  // Get worker ID (Vitest uses VITEST_WORKER_ID, Jest uses JEST_WORKER_ID)
  const workerId = process.env.VITEST_WORKER_ID || process.env.JEST_WORKER_ID;
  
  if (process.env.DATABASE_URL_BASE && workerId) {
    // CI environment: construct worker-specific database URL
    const workerDbUrl = `${process.env.DATABASE_URL_BASE}_worker_${workerId}`;
    process.env.DATABASE_URL = workerDbUrl;
    console.log(`🚀 Integration Tests Worker ${workerId}: Using database:`, workerDbUrl.replace(/\/\/.*@/, '//***@'));
  } else if (process.env.DATABASE_URL_BASE) {
    // CI environment but no worker ID - use single database
    const singleDbUrl = `${process.env.DATABASE_URL_BASE}_worker_1`;
    process.env.DATABASE_URL = singleDbUrl;
    console.log('🚀 Integration Tests: Using CI database (single worker):', singleDbUrl.replace(/\/\/.*@/, '//***@'));
  } else if (process.env.DATABASE_URL) {
    // Single database provided (environment override)
    console.log('🚀 Integration Tests: Using environment-provided database:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@'));
  } else {
    // Local development fallback - use non-superuser role for proper RLS testing
    process.env.DATABASE_URL = 'postgresql://ventry_app:ventry_app_password@localhost:5487/ventry_integration_test';
    console.log('🔧 Integration Tests: Using local development database fallback with app role');
  }
}

setupWorkerDatabase();

// Note: Console logging enabled for integration tests to show worker assignment and debugging information