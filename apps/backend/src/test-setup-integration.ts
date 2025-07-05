// Integration test setup with real PostgreSQL database
import 'reflect-metadata';

// Environment variables for integration tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-integration';
process.env.JWT_EXPIRES_IN = '1h';

// Use development database for integration tests (same as dev)
process.env.DATABASE_URL = 'postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev?schema=public';

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};