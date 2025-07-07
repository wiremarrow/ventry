// Integration test setup with real PostgreSQL database
import 'reflect-metadata';

// Environment variables for integration tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-integration';
process.env.JWT_EXPIRES_IN = '1h';

// Enterprise-grade database configuration:
// - Respect CI-provided DATABASE_URL (for dynamic test databases)
// - Fallback to local development database only when not set
// - This enables the enterprise database strategy in CI while maintaining local dev workflow
if (!process.env.DATABASE_URL) {
  // Local development fallback - only used when DATABASE_URL is not provided by CI/environment
  process.env.DATABASE_URL = 'postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev?schema=public';
  console.log('🔧 Integration Tests: Using local development database fallback');
} else {
  console.log('🚀 Integration Tests: Using environment-provided database:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@'));
}

// Note: Console logging enabled for integration tests to show factory operations and debugging information