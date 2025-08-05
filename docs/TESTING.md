# Testing Guide

Ventry uses a comprehensive testing strategy with Vitest for unit tests and Playwright for E2E tests.

## Testing Stack

- **Unit Tests**: Vitest with TypeScript support
- **Integration Tests**: PostgreSQL service containers
- **E2E Tests**: Playwright with browser matrix and sharding
- **Coverage**: Built-in with Vitest + threshold gates
- **CI Integration**: Comprehensive 13-check pipeline on every PR

## Advanced Testing Features

### Browser Matrix Testing

- **Chromium**: Primary browser for modern web standards
- **Firefox**: Gecko engine compatibility testing
- **WebKit**: Safari/iOS compatibility testing

### Test Sharding

- **Parallel Execution**: 2 shards per browser = 6 parallel E2E jobs
- **Faster CI**: Reduces E2E test time by ~50%
- **Artifact Management**: Test results and videos preserved per shard

### PostgreSQL Integration Testing

- **Real Database**: PostgreSQL 16 service container in CI
- **Health Checks**: Ensures database is ready before tests
- **Migration Testing**: Validates schema changes work correctly

## Command Reference

### Root vs Package-Specific Commands

**Root Level (via Turborepo)**

- `pnpm test` - Runs unit tests across all packages (excludes integration tests)
- `pnpm test:integration` - Runs integration tests with PostgreSQL
- `pnpm lint` - Lints all packages
- `pnpm typecheck` - Type checks all packages

**Backend Package Specific**

- `pnpm test:cov` - Unit tests with coverage (excludes integration tests)
- `pnpm test:integration` - Integration tests with PostgreSQL
- `pnpm test:watch` - Watch mode for backend unit tests

**Using Filters (from root)**

- `pnpm --filter @ventry/backend test:cov` - Backend coverage from root
- `pnpm --filter @ventry/backend test:integration` - Backend integration tests from root
- `pnpm --filter @ventry/web test` - Frontend tests from root

**💡 Pro Tips:**

- Always run `pnpm test:integration` before committing to catch database issues
- Use `pnpm test:cov` to ensure you meet the 80% coverage threshold
- Run tests in this order for CI simulation: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build`

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests (excludes integration tests)
pnpm test

# Run integration tests with PostgreSQL
pnpm test:integration

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage (backend-specific, excludes integration)
pnpm test:cov

# Run tests for a specific package
pnpm --filter @ventry/backend test              # Unit tests only
pnpm --filter @ventry/backend test:integration  # Integration tests only
pnpm --filter @ventry/backend test:cov          # Coverage report
pnpm --filter @ventry/web test                  # Frontend tests
```

### E2E Tests (Playwright)

> **🚨 IMPORTANT**: E2E tests MUST be run from the repository root directory! Running from `apps/e2e` will fail with DATABASE_URL errors.

```bash
# Install Playwright browsers (first time only)
pnpm playwright:install

# Run all E2E tests (from repository root)
pnpm test:e2e

# OR more explicitly:
pnpm --filter @ventry/e2e test

# Run E2E tests with UI mode (interactive)
pnpm test:e2e:ui

# Run E2E tests in debug mode
pnpm test:e2e:debug

# Run specific test file
pnpm --filter @ventry/e2e test -- tests/auth.spec.ts

# Run tests for specific browser
pnpm --filter @ventry/e2e test -- --project=chromium
pnpm --filter @ventry/e2e test -- --project=firefox
pnpm --filter @ventry/e2e test -- --project=webkit

# Run specific test by name
pnpm --filter @ventry/e2e test -- --grep "should display products page"

# Run tests with sharding (like CI)
pnpm playwright test --project=chromium --shard=1/2
pnpm playwright test --project=chromium --shard=2/2
pnpm playwright test --project=firefox
pnpm playwright test --project=webkit
```

## Writing Tests

### Unit Test Example

```typescript
// products.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client';
import { mockProducts, mockCategories } from '../test-utils/test-data';

describe('Products Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  const mockPrisma = {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    caller = await createDirectCaller({
      user: { id: '1', email: 'test@example.com', role: 'ADMIN' },
      prisma: mockPrisma as any,
    });
  });

  it('should list products', async () => {
    mockPrisma.product.findMany.mockResolvedValue(mockProducts);

    const result = await caller.products.list();

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Widget Pro');
  });

  it('should create a product', async () => {
    const newProduct = {
      id: '4',
      name: 'Test Product',
      sku: 'TEST-001',
      price: 99.99,
      categoryId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.product.create.mockResolvedValue(newProduct);

    const result = await caller.products.create({
      name: 'Test Product',
      sku: 'TEST-001',
      price: 99.99,
      categoryId: '1',
    });

    expect(result).toHaveProperty('id');
    expect(result.name).toBe('Test Product');
  });
});
```

### E2E Test Example

```typescript
// e2e/tests/product.spec.ts
import { test, expect } from '@playwright/test';
import { testUser, testProduct } from '../fixtures/test-data';

test.describe('Product Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', testUser.admin.email);
    await page.fill('input[type="password"]', testUser.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a new product', async ({ page }) => {
    // Navigate to products
    await page.goto('/products');
    await page.click('button:has-text("Add Product")');

    // Fill form
    await page.fill('input[name="name"]', testProduct.name);
    await page.fill('input[name="sku"]', testProduct.sku);
    await page.fill('input[name="price"]', testProduct.price.toString());

    // Submit
    await page.click('button[type="submit"]');

    // Verify
    await expect(page.locator(`text=${testProduct.name}`)).toBeVisible();
  });

  test('should search for products', async ({ page }) => {
    await page.goto('/products');

    // Search
    await page.fill('input[placeholder="Search products..."]', 'Test');
    await page.keyboard.press('Enter');

    // Verify results
    await expect(page.locator('.product-card')).toHaveCount(1);
  });
});
```

## Test Organization

```
ventry/
├── apps/
│   ├── backend/
│   │   └── src/
│   │       ├── products/
│   │       │   ├── product.service.ts
│   │       │   └── product.service.spec.ts
│   │       └── test/
│   │           └── setup.ts
│   └── web/
│       └── src/
│           ├── components/
│           │   ├── Button.tsx
│           │   └── Button.test.tsx
│           └── __tests__/
│               └── pages/
├── e2e/
│   ├── tests/
│   │   ├── auth.spec.ts
│   │   ├── inventory.spec.ts
│   │   └── ai-agents.spec.ts
│   ├── fixtures/
│   │   ├── test-data.ts
│   │   └── page-objects/
│   └── utils/
│       └── helpers.ts
└── packages/
    └── shared/
        └── src/
            ├── utils.ts
            └── utils.spec.ts
```

## Testing Best Practices

### Unit Tests

1. **Test in isolation**: Mock external dependencies
2. **Use descriptive names**: `should create product when valid data provided`
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Test edge cases**: Invalid inputs, errors, boundaries
5. **Keep tests fast**: Mock database and API calls

### E2E Tests

1. **Test user journeys**: Complete workflows, not individual elements
2. **Use data attributes**: `data-testid` for stable selectors
3. **Clean state**: Reset data between tests
4. **Parallel execution**: Tests should be independent
5. **Visual testing**: Screenshots on failure

## CI/CD Integration

### GitHub Actions

Our unified CI pipeline runs comprehensive tests on:

- Every push to `main`
- Every pull request

#### Required Status Checks (13 total)

1. **Documentation Check** - Enforces README.md/TODO.md updates
2. **Lint and Type Check** - ESLint + TypeScript validation
3. **Unit Tests** - Vitest testing on Node.js 20 LTS
4. **PostgreSQL Integration Tests** - Real database operations
5. **E2E Tests - chromium (1)** - Browser testing, shard 1 of 2
6. **E2E Tests - chromium (2)** - Browser testing, shard 2 of 2
7. **E2E Tests - firefox (1)** - Browser testing, shard 1 of 2
8. **E2E Tests - firefox (2)** - Browser testing, shard 2 of 2
9. **E2E Tests - webkit (1)** - Browser testing, shard 1 of 2
10. **E2E Tests - webkit (2)** - Browser testing, shard 2 of 2
11. **Build** - Production build validation
12. **Coverage Gate** - Test coverage threshold validation

### Test Reports

- **Unit test coverage**: Uploaded to Codecov with threshold gates
- **E2E test results**: Artifacts preserved per browser/shard
- **Test videos**: Failure recordings for debugging
- **Coverage reports**: Integrated with PR status checks

## Debugging Tests

### Vitest Debugging

```bash
# Run specific test file
pnpm vitest run src/routers/products.test.ts

# Run tests matching pattern
pnpm vitest run -t "should create"

# Run in watch mode
pnpm vitest

# Debug in VS Code
# Add breakpoint and use "Debug: JavaScript Debug Terminal"
# Then run: pnpm vitest run
```

### Playwright Debugging

```bash
# Debug mode with inspector
pnpm test:e2e:debug

# Headed mode (see browser)
pnpm playwright test --headed

# Slow motion
pnpm playwright test --headed --slow-mo=1000

# VS Code Extension
# Install "Playwright Test for VSCode"
```

## Performance Testing

### Load Testing with Playwright

```typescript
test('should handle concurrent users', async ({ page }) => {
  const promises = Array.from({ length: 10 }, async (_, i) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const responseTime = await page.evaluate(
      () => performance.timing.loadEventEnd - performance.timing.navigationStart
    );
    expect(responseTime).toBeLessThan(3000); // 3 seconds

    await context.close();
  });

  await Promise.all(promises);
});
```

## Database Testing

### PostgreSQL Integration Tests

Integration tests use PostgreSQL for real database operations:

```typescript
// In integration test setup (test-setup-integration.ts)
process.env.DATABASE_URL =
  'postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev?schema=public';

// Clean between tests
beforeEach(async () => {
  // Clean up in reverse order of dependencies
  await prisma.auditLog.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
});
```

### Test Configuration Separation

- **Unit Tests**: Use Vitest default config with `vitest.config.ts`
- **Integration Tests**: Use `vitest.integration.config.ts` with separate database
- **Proper Isolation**: Unit tests exclude `*.integration.spec.ts` files

### Test Data Management

```typescript
// Integration test data setup
const testUserData = {
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  password: 'hashedpassword',
  role: 'USER' as const,
};

const testCategoryData = {
  name: 'Electronics',
  description: 'Electronic devices',
};

// Use in integration tests
beforeEach(async () => {
  // Clean database first
  await cleanDatabase();

  // Create test user
  const user = await prisma.user.create({ data: testUserData });

  // Create test category
  const category = await prisma.category.create({ data: testCategoryData });
});
```

## Monitoring Test Health

### Flaky Test Detection

1. Tests retry 2 times on CI
2. Flaky tests are marked and tracked
3. Regular review of test stability

### Test Performance

Monitor test execution time:

- Unit tests: < 5 minutes
- E2E tests: < 15 minutes per shard
- Total CI time: < 20 minutes

## Common Testing Issues & Solutions

### Integration Test Failures

**Issue**: `Authentication failed against database server`

```bash
# Solution: Ensure PostgreSQL is running
./tools/scripts/switch-db.sh start
```

**Issue**: `Foreign key constraint violated`

```bash
# Solution: Tests are trying to create records with missing dependencies
# Check test setup creates all required parent records (users, categories, locations)
```

### Unit vs Integration Test Confusion

**Issue**: Tests run with wrong setup file

```bash
# ✅ Correct: Unit tests exclude integration tests
pnpm test                    # Uses test-setup.ts, excludes *.integration.spec.ts

# ✅ Correct: Integration tests use separate config
pnpm test:integration        # Uses jest.integration.config.js and test-setup-integration.ts
```

### Performance Issues

**Issue**: Tests running slowly

```bash
# Solution: Run tests in parallel and use appropriate test type
pnpm test                    # Fast unit tests (no database)
pnpm test:integration        # Slower integration tests (real database)
```

## E2E Testing Troubleshooting

### DATABASE_URL Not Found Error

If you see this error when running E2E tests:
```
PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL
```

**Solution**: You are running tests from the wrong directory!
- ✅ Run from repository root: `cd /path/to/ventry && pnpm test:e2e`
- ❌ Do NOT run from: `cd apps/e2e && pnpm test`

The E2E tests use `dotenv-cli` which needs the `.env` file from the repository root.

### Cookie Authentication Issues

If E2E tests fail with authentication errors after login:

1. **Ensure frontend server is restarted after proxy configuration changes**
   - The Next.js proxy configuration must be loaded for cookies to work
   - If using `reuseExistingServer: true`, stop and restart the frontend server

2. **Check that NEXT_PUBLIC_API_URL is set correctly**
   - For E2E tests: `/api/trpc` (uses proxy)
   - For direct backend access: `http://localhost:6060/trpc`

3. **Verify Next.js rewrites are configured**

   ```typescript
   // next.config.ts
   async rewrites() {
     return [{
       source: '/api/trpc/:path*',
       destination: 'http://localhost:6060/trpc/:path*',
     }];
   }
   ```

4. **Browser Cookie Restrictions**
   - Playwright doesn't store cross-origin cookies between different ports
   - Even with `Domain=localhost`, cookies won't be shared between localhost:6060 and localhost:6061
   - The proxy solution makes all requests appear same-origin

### Context Cleanup Errors

**Issue**: `Failed to find browser context` errors

```typescript
// ❌ Wrong - Don't clear cookies on closing contexts
await clearAuthState(page);
await context.close();

// ✅ Correct - Just close the context
await context.close(); // This automatically cleans up all storage
```

**Key Points**:

- Closing a browser context automatically cleans up all storage including cookies
- Don't perform operations on contexts that are about to be closed
- Each test should create its own isolated context

### Authentication Test Patterns

**Successful Login Test**:

```typescript
test('should successfully login', async ({ page }) => {
  await page.fill('input[type="email"]', testUser.email);
  await page.fill('input[type="password"]', testUser.password);
  await page.click('button:has-text("Sign In")');

  // Wait for navigation instead of checking for errors
  await page.waitForURL(/.*dashboard/, { timeout: 10000 });

  // Verify dashboard loaded
  await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();
});
```

### Common E2E Pitfalls

1. **Port Mismatch**: Ensure backend runs on 6060 and frontend on 6061
2. **Environment Variables**: Check `NEXT_PUBLIC_API_URL` in playwright.config.ts
3. **Server Startup**: Wait for both servers to be ready before tests
4. **Cookie Persistence**: Use browser contexts for isolated test sessions

## Resources

- [Vitest Documentation](https://vitest.dev/guide/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library](https://testing-library.com/)
- [VS Code Vitest Extension](https://marketplace.visualstudio.com/items?itemName=ZixuanChen.vitest-explorer)
- [Playwright VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)
