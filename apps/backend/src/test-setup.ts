// Global test setup for ESM + tRPC + Vitest
import { vi } from 'vitest';

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

// Enterprise-grade database configuration for unit tests:
// - Respect any environment-provided DATABASE_URL
// - Fallback to local development database for unit tests
// - Unit tests typically use mocked database, but some may need real connection
if (!process.env.DATABASE_URL) {
  // Local development fallback - only used when DATABASE_URL is not provided by environment
  process.env.DATABASE_URL = 'postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev?schema=public';
  console.log('🔧 Unit Tests: Using local development database fallback');
} else {
  console.log('🚀 Unit Tests: Using environment-provided database:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@'));
}

// Suppress console logs during tests unless explicitly needed
if (process.env.VITEST_VERBOSE !== 'true') {
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}