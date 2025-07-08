# E2E Testing Guide

## Overview

This directory contains end-to-end tests for the Ventry application using Playwright. The tests are designed with proper isolation to ensure reliability and prevent race conditions.

## Test Architecture

### Key Principles
1. **Test Isolation**: Each test creates its own test data and cleans up after itself
2. **No Shared State**: Tests don't rely on shared users or data
3. **Clean Browser State**: Browser storage is cleared between tests
4. **Database Cleanup**: Test data is identified by `.e2e.test` email suffix

### Directory Structure
```
e2e/
├── fixtures/          # Custom Playwright fixtures
│   └── base.fixture.ts   # Authenticated pages and test users
├── utils/             # Test utilities
│   ├── test-helpers.ts   # User creation, test data factories
│   └── db-cleanup.ts     # Database cleanup functions
├── tests/             # Test files
│   ├── auth.spec.ts      # Authentication tests
│   ├── dashboard.spec.ts # Dashboard tests
│   └── navigation.spec.ts # Navigation tests
├── global-setup.ts    # Runs before all tests
└── global-teardown.ts # Runs after all tests
```

## Writing Tests

### Using Test Fixtures

```typescript
import { test, expect } from '../fixtures/base.fixture';

// Use authenticated pages
test('admin can access admin features', async ({ adminPage }) => {
  // adminPage is already logged in as an admin
  await adminPage.goto('/admin/users');
  await expect(adminPage.locator('h1')).toContainText('User Management');
});

// Use clean page (no authentication)
test('public page test', async ({ cleanPage }) => {
  await cleanPage.goto('/about');
  // cleanPage has cleared browser storage
});
```

### Creating Test Data

```typescript
import { createTestUser, createTestProduct } from '../utils/test-helpers';
import { cleanupTestDataForUser } from '../utils/db-cleanup';

test('product creation', async ({ browser }) => {
  const testUser = await createTestUser({ role: 'MANAGER' });
  
  try {
    // Your test logic here
    const product = await createTestProduct(testUser.id);
    // Test with the product
  } finally {
    // Always cleanup
    await cleanupTestDataForUser(testUser.id);
  }
});
```

### Test Patterns

1. **Always use unique test data**
   ```typescript
   const email = `test-${Date.now()}@ventry.e2e.test`;
   ```

2. **Clean up in finally blocks**
   ```typescript
   try {
     // Test logic
   } finally {
     await cleanup();
   }
   ```

3. **Clear browser state**
   ```typescript
   await clearBrowserStorage(page);
   ```

## Running Tests

### Local Development
```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e auth.spec.ts

# Run in headed mode (see browser)
pnpm test:e2e --headed

# Debug mode
pnpm test:e2e --debug
```

### Prerequisites
1. Database must be running: `./tools/scripts/switch-db.sh start`
2. Seed data must exist: `pnpm db:seed`
3. Backend and frontend servers will be started automatically

### CI Environment
- Tests run with single worker to prevent race conditions
- Each job gets its own database
- Automatic cleanup after tests

## Debugging

### View Test Reports
```bash
pnpm exec playwright show-report e2e/playwright-report
```

### Check Database State
The global setup logs database statistics before and after cleanup:
- Total users (including test users)
- Total products (including test products)

### Common Issues

1. **"Required seed user not found"**
   - Run `pnpm db:seed` to create seed data

2. **"Database connection failed"**
   - Ensure PostgreSQL is running: `./tools/scripts/switch-db.sh start`

3. **"Port already in use"**
   - Check for running dev servers: `lsof -i :6060` and `lsof -i :6061`

## Best Practices

1. **Never use production user emails** - Always use `.e2e.test` suffix
2. **Don't modify seed data** - Create your own test data
3. **Use fixtures for common patterns** - Reduces code duplication
4. **Keep tests independent** - Each test should work in isolation
5. **Clean up after tests** - Prevent test data accumulation

## CI/CD Integration

The E2E tests are integrated into the CI pipeline with:
- Automatic database setup per test job
- Test sharding for parallel execution
- Screenshot and video capture on failure
- Artifact upload for debugging