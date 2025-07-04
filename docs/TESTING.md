# Testing Guide

Ventry uses a comprehensive testing strategy with Jest for unit tests and Playwright for E2E tests.

## Testing Stack

- **Unit Tests**: Jest with TypeScript support
- **E2E Tests**: Playwright for browser automation
- **Coverage**: Built-in with Jest
- **CI Integration**: Automated testing on every PR

## Running Tests

### Unit Tests (Jest)

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for a specific package
pnpm --filter @ventry/backend test
pnpm --filter @ventry/web test
```

### E2E Tests (Playwright)

```bash
# Install Playwright browsers (first time only)
pnpm playwright:install

# Run all E2E tests
pnpm test:e2e

# Run E2E tests with UI mode (interactive)
pnpm test:e2e:ui

# Run E2E tests in debug mode
pnpm test:e2e:debug

# Run specific test file
pnpm playwright test e2e/tests/auth.spec.ts

# Run tests for specific browser
pnpm playwright test --project=chromium
pnpm playwright test --project=firefox
pnpm playwright test --project=webkit
```

## Writing Tests

### Unit Test Example

```typescript
// product.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductService],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a product', async () => {
    const product = await service.create({
      name: 'Test Product',
      sku: 'TEST-001',
      price: 99.99,
    });
    
    expect(product).toHaveProperty('id');
    expect(product.name).toBe('Test Product');
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

Tests run automatically on:
- Every push to `main`
- Every pull request
- Nightly schedule (E2E tests)

### Test Reports

- **Unit test coverage**: Uploaded to Codecov
- **E2E test results**: Available as artifacts
- **Playwright report**: Published to GitHub Pages

## Debugging Tests

### Jest Debugging

```bash
# Run specific test file
pnpm jest src/products/product.service.spec.ts

# Run tests matching pattern
pnpm jest --testNamePattern="should create"

# Debug in VS Code
# Add breakpoint and use "Jest: Debug" command
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
    
    const responseTime = await page.evaluate(() => performance.timing.loadEventEnd - performance.timing.navigationStart);
    expect(responseTime).toBeLessThan(3000); // 3 seconds
    
    await context.close();
  });

  await Promise.all(promises);
});
```

## Database Testing

### SQLite for Tests

Tests use SQLite by default for speed:

```typescript
// In test setup
process.env.DATABASE_URL = 'file:./test.db';

// Clean between tests
beforeEach(async () => {
  await prisma.$executeRaw`DELETE FROM products`;
});
```

### Test Data Management

```typescript
// e2e/fixtures/seed.ts
export async function seedTestData() {
  await prisma.user.create({
    data: testUser.admin,
  });
  
  await prisma.product.createMany({
    data: testProducts,
  });
}

// Use in tests
test.beforeAll(async () => {
  await seedTestData();
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

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library](https://testing-library.com/)
- [VS Code Jest Extension](https://marketplace.visualstudio.com/items?itemName=Orta.vscode-jest)
- [Playwright VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)