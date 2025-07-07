// Integration test setup with real PostgreSQL database
import 'reflect-metadata';

// Environment variables for integration tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-integration';
process.env.JWT_EXPIRES_IN = '1h';

// Worker-specific database configuration for true test isolation
function setupWorkerDatabase() {
  // Get Jest worker ID (available when running with multiple workers)
  const workerId = process.env.JEST_WORKER_ID;
  
  if (process.env.DATABASE_URL_BASE && workerId) {
    // CI environment: construct worker-specific database URL
    const workerDbUrl = `${process.env.DATABASE_URL_BASE}_worker_${workerId}`;
    process.env.DATABASE_URL = workerDbUrl;
    console.log(`🚀 Integration Tests Worker ${workerId}: Using database:`, workerDbUrl.replace(/\/\/.*@/, '//***@'));
  } else if (process.env.DATABASE_URL) {
    // Single database provided (legacy or local CI)
    console.log('🚀 Integration Tests: Using environment-provided database:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@'));
  } else {
    // Local development fallback
    process.env.DATABASE_URL = 'postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev?schema=public';
    console.log('🔧 Integration Tests: Using local development database fallback');
  }
}

setupWorkerDatabase();

// Note: Console logging enabled for integration tests to show worker assignment and debugging information