import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.integration.spec.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      // Fallback database URL for integration tests
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test',
    }
  }
});