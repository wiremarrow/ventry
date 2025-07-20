# Ventry Testing Guide

A comprehensive guide to testing philosophy, practices, and patterns for the Ventry inventory management system.

## Table of Contents
- [Testing Philosophy](#testing-philosophy)
- [Testing Stack](#testing-stack)
- [Test Types & Strategy](#test-types--strategy)
- [Test Structure & Organization](#test-structure--organization)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage Requirements](#test-coverage-requirements)
- [CI/CD Integration](#cicd-integration)
- [Debugging Tests](#debugging-tests)
- [Common Issues & Solutions](#common-issues--solutions)
- [Best Practices](#best-practices)

## Testing Philosophy

Ventry follows a comprehensive testing strategy that emphasizes:

1. **Quality Over Quantity**: Well-written tests that actually catch bugs, not just hit coverage metrics
2. **Fast Feedback**: Unit tests run in milliseconds, integration tests in seconds
3. **Real-World Testing**: Integration tests use real PostgreSQL, E2E tests use real browsers
4. **Developer Experience**: Easy to write, easy to run, easy to debug
5. **CI/CD Confidence**: Every merge to main is production-ready

## Testing Stack

| Test Type | Framework | Purpose | Speed |
|-----------|-----------|---------|-------|
| **Unit Tests** | Vitest + TypeScript | Test business logic in isolation | Fast (< 5s) |
| **Integration Tests** | Vitest + PostgreSQL | Test database operations | Medium (< 30s) |
| **E2E Tests** | Playwright | Test user workflows | Slow (< 5m per browser) |
| **Coverage** | Vitest Coverage | Track test completeness | Automatic |

### Key Technologies
- **Vitest**: Modern, fast test runner with native TypeScript support
- **Playwright**: Cross-browser E2E testing with video recording
- **PostgreSQL 16**: Real database for integration testing
- **Docker**: Consistent test environments
- **GitHub Actions**: Automated CI/CD with 12 required checks

## Test Types & Strategy

### Unit Tests (`*.test.ts`)
Test individual functions, components, and tRPC procedures in isolation.

**When to Use:**
- Testing pure functions and utilities
- Testing tRPC procedures with mocked dependencies
- Testing React components with mocked data
- Testing business logic without external dependencies

**Characteristics:**
- Fast execution (milliseconds)
- No database or network calls
- Extensive use of mocks
- Run frequently during development

### Integration Tests (`*.integration.test.ts`)
Test interactions between components with real database operations.

**When to Use:**
- Testing tRPC procedures with real database
- Testing complex queries and transactions
- Testing data integrity and constraints
- Testing multi-step workflows

**Characteristics:**
- Uses isolated `ventry_integration_test` database
- Real PostgreSQL operations
- Moderate execution time (seconds)
- Clean database state between tests

### E2E Tests (`e2e/*.spec.ts`)
Test complete user workflows through the browser.

**When to Use:**
- Testing critical user journeys
- Testing authentication flows
- Testing multi-page workflows
- Testing browser-specific behavior

**Characteristics:**
- Real browser automation
- Full application stack
- Slowest execution time
- Video recording on failure

## Test Structure & Organization

```
ventry/
├── apps/
│   ├── backend/
│   │   └── src/
│   │       ├── routers/
│   │       │   ├── items.ts
│   │       │   ├── items.test.ts              # Unit tests
│   │       │   └── items.integration.test.ts  # Integration tests
│   │       ├── services/
│   │       │   ├── auth-service.ts
│   │       │   └── auth-service.test.ts
│   │       └── test-utils/                    # Shared test utilities
│   │           ├── trpc-test-client.ts
│   │           ├── test-data.ts
│   │           └── test-db-helpers.ts
│   ├── web/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── item-list.tsx
│   │       │   └── item-list.test.tsx
│   │       └── __tests__/                     # Grouped tests
│   └── e2e/
│       ├── tests/
│       │   ├── auth.spec.ts
│       │   ├── inventory.spec.ts
│       │   └── orders.spec.ts
│       ├── fixtures/
│       │   └── test-data.ts
│       └── playwright.config.ts
└── packages/
    ├── database/
    │   └── prisma/
    │       └── schema.prisma
    └── shared/
        └── src/
            ├── utils.ts
            └── utils.test.ts
```

### Naming Conventions

| File Type | Pattern | Example |
|-----------|---------|---------|
| Unit Tests | `*.test.ts(x)` | `auth-service.test.ts` |
| Integration Tests | `*.integration.test.ts` | `items.integration.test.ts` |
| E2E Tests | `*.spec.ts` | `inventory.spec.ts` |
| Test Utilities | `test-*.ts` or `*-test-*.ts` | `test-data.ts`, `trpc-test-client.ts` |

## Running Tests

### Quick Reference

```bash
# ALL TESTS (Run before PR)
pnpm lint                    # ESLint validation
pnpm typecheck              # TypeScript strict mode
pnpm test                   # Unit tests only (excludes integration)
pnpm test:integration       # Integration tests with PostgreSQL
pnpm test:e2e              # E2E tests (all browsers)
pnpm build                 # Production build

# BACKEND-SPECIFIC
pnpm --filter @ventry/backend test:cov          # Unit tests with coverage
pnpm --filter @ventry/backend test:integration  # Integration tests
pnpm --filter @ventry/backend test:watch        # Watch mode

# FRONTEND-SPECIFIC
pnpm --filter @ventry/web test                  # Component tests
pnpm --filter @ventry/web test:watch            # Watch mode

# E2E TESTS
pnpm test:e2e              # Run all E2E tests
pnpm test:e2e:ui           # Interactive UI mode
pnpm test:e2e:debug        # Debug mode with inspector
```

### Database Setup for Testing

```bash
# One-time setup: Create integration test database
DATABASE_URL="postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test" \
  pnpm --filter @ventry/database db:push

# Start PostgreSQL (required for integration tests)
./tools/scripts/switch-db.sh start

# Check database status
./tools/scripts/switch-db.sh status
```

### Running Specific Tests

```bash
# Run specific test file
pnpm vitest run src/routers/items.test.ts

# Run tests matching pattern
pnpm vitest run -t "should create item"

# Run single E2E test
pnpm playwright test auth.spec.ts

# Run E2E for specific browser
pnpm playwright test --project=chromium
```

## Writing Tests

### Unit Test Pattern (tRPC Router)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import type { PrismaClient } from '@ventry/database';

describe('Items Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockPrisma: {
    item: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    organization: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mock Prisma
    mockPrisma = {
      item: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: 'org-1' }),
      },
    };

    // Create authenticated caller
    caller = await createDirectCaller({
      user: { 
        id: 'user-1', 
        email: 'test@example.com',
        organizationId: 'org-1',
      },
      prisma: mockPrisma as unknown as PrismaClient,
    });
  });

  describe('list', () => {
    it('should return paginated items', async () => {
      const mockItems = [
        { id: '1', name: 'Item 1', sku: 'SKU001' },
        { id: '2', name: 'Item 2', sku: 'SKU002' },
      ];
      
      mockPrisma.item.findMany.mockResolvedValue(mockItems);

      const result = await caller.items.list({
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('should filter items by search term', async () => {
      const result = await caller.items.list({
        search: 'widget',
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            OR: expect.arrayContaining([
              { name: { contains: 'widget', mode: 'insensitive' } },
              { sku: { contains: 'widget', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });
  });

  describe('create', () => {
    it('should create new item', async () => {
      const newItem = {
        name: 'New Item',
        sku: 'NEW001',
        description: 'Test item',
      };

      mockPrisma.item.create.mockResolvedValue({
        id: 'new-1',
        ...newItem,
        organizationId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await caller.items.create(newItem);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe(newItem.name);
      expect(mockPrisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...newItem,
          organizationId: 'org-1',
        }),
      });
    });

    it('should throw on duplicate SKU', async () => {
      mockPrisma.item.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`sku`)')
      );

      await expect(
        caller.items.create({ name: 'Item', sku: 'EXISTING' })
      ).rejects.toThrow('already exists');
    });
  });
});
```

### Integration Test Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createIntegrationContext } from '../test-utils/trpc-test-client.js';
import { appRouter } from '../routers/app.js';
import { prisma } from '@ventry/database';
import { cleanDatabase } from '../test-utils/test-db-helpers.js';

describe('Items Router - Integration', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should create and retrieve item', async () => {
    // Create test organization and user
    const org = await prisma.organization.create({
      data: { name: 'Test Org' },
    });

    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        organizationId: org.id,
      },
    });

    // Create authenticated context
    const ctx = await createIntegrationContext();
    ctx.user = { id: user.id, email: user.email, organizationId: org.id };
    
    const caller = appRouter.createCaller(ctx);

    // Create item
    const created = await caller.items.create({
      name: 'Integration Test Item',
      sku: 'INT001',
      description: 'Created in integration test',
    });

    expect(created.id).toBeDefined();
    expect(created.organizationId).toBe(org.id);

    // Retrieve and verify
    const retrieved = await caller.items.getById({ id: created.id });
    expect(retrieved).toEqual(created);

    // Verify in database
    const dbItem = await prisma.item.findUnique({
      where: { id: created.id },
    });
    expect(dbItem).toBeTruthy();
    expect(dbItem?.name).toBe('Integration Test Item');
  });

  it('should enforce organization boundaries', async () => {
    // Create two organizations
    const [org1, org2] = await Promise.all([
      prisma.organization.create({ data: { name: 'Org 1' } }),
      prisma.organization.create({ data: { name: 'Org 2' } }),
    ]);

    // Create item in org1
    const item = await prisma.item.create({
      data: {
        name: 'Org1 Item',
        sku: 'ORG1-001',
        organizationId: org1.id,
      },
    });

    // Create user in org2
    const user2 = await prisma.user.create({
      data: {
        email: 'user2@example.com',
        firstName: 'User',
        lastName: 'Two',
        organizationId: org2.id,
      },
    });

    // Try to access org1's item as org2 user
    const ctx = await createIntegrationContext();
    ctx.user = { id: user2.id, email: user2.email, organizationId: org2.id };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.items.getById({ id: item.id })
    ).rejects.toThrow('not found');
  });
});
```

### Component Test Pattern

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ItemList } from './item-list';
import { trpc } from '@/lib/trpc';

// Mock tRPC
vi.mock('@/lib/trpc', () => ({
  trpc: {
    items: {
      list: {
        useQuery: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
    },
    useUtils: vi.fn(() => ({
      items: {
        list: {
          invalidate: vi.fn(),
        },
      },
    })),
  },
}));

describe('ItemList', () => {
  const mockItems = {
    items: [
      { id: '1', name: 'Item 1', sku: 'SKU001', qtyOnHand: 10 },
      { id: '2', name: 'Item 2', sku: 'SKU002', qtyOnHand: 20 },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render items', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: mockItems,
      isLoading: false,
      error: null,
    } as any);

    render(<ItemList />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('SKU001')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<ItemList />);

    expect(screen.getByTestId('items-skeleton')).toBeInTheDocument();
  });

  it('should handle delete', async () => {
    const deleteMutation = vi.fn();
    const invalidate = vi.fn();

    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: mockItems,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(trpc.items.delete.useMutation).mockReturnValue({
      mutate: deleteMutation,
    } as any);

    vi.mocked(trpc.useUtils).mockReturnValue({
      items: {
        list: {
          invalidate,
        },
      },
    } as any);

    render(<ItemList />);

    // Click delete button
    const deleteButton = screen.getAllByTestId('delete-button')[0];
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByText('Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteMutation).toHaveBeenCalledWith({ id: '1' });
    });
  });
});
```

### E2E Test Pattern

```typescript
import { test, expect } from '@playwright/test';
import { login, logout } from '../fixtures/auth-helpers';

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@ventry.com', 'password123');
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should create new item', async ({ page }) => {
    // Navigate to items
    await page.goto('/inventory/items');
    
    // Click add button
    await page.click('button:has-text("Add Item")');

    // Fill form
    await page.fill('input[name="name"]', 'E2E Test Item');
    await page.fill('input[name="sku"]', 'E2E-001');
    await page.fill('textarea[name="description"]', 'Created by E2E test');
    
    // Select category
    await page.click('[data-testid="category-select"]');
    await page.click('text=Electronics');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success toast
    await expect(page.locator('text=Item created successfully')).toBeVisible();

    // Verify item appears in list
    await expect(page.locator('td:has-text("E2E Test Item")')).toBeVisible();
    await expect(page.locator('td:has-text("E2E-001")')).toBeVisible();
  });

  test('should search and filter items', async ({ page }) => {
    await page.goto('/inventory/items');

    // Search by name
    await page.fill('input[placeholder="Search items..."]', 'widget');
    await page.waitForTimeout(500); // Debounce delay

    // Verify filtered results
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3); // Assuming 3 widgets in test data

    // Clear search
    await page.fill('input[placeholder="Search items..."]', '');
    
    // Filter by category
    await page.click('[data-testid="category-filter"]');
    await page.click('text=Electronics');

    // Verify filtered results
    await expect(rows.first()).toContainText('Electronics');
  });

  test('should handle stock adjustments', async ({ page }) => {
    await page.goto('/inventory/items');

    // Click on first item
    await page.click('tbody tr:first-child');

    // Click adjust stock button
    await page.click('button:has-text("Adjust Stock")');

    // Fill adjustment form
    await page.fill('input[name="quantity"]', '50');
    await page.selectOption('select[name="type"]', 'add');
    await page.fill('textarea[name="reason"]', 'Received shipment');

    // Submit
    await page.click('button:has-text("Confirm Adjustment")');

    // Verify success
    await expect(page.locator('text=Stock adjusted successfully')).toBeVisible();
    
    // Verify new quantity is reflected
    await expect(page.locator('[data-testid="qty-on-hand"]')).toContainText('150');
  });
});
```

## Test Coverage Requirements

### Coverage Thresholds

```json
{
  "test": {
    "coverage": {
      "thresholds": {
        "statements": 80,
        "branches": 75,
        "functions": 80,
        "lines": 80
      }
    }
  }
}
```

### Running Coverage Reports

```bash
# Generate coverage report
pnpm --filter @ventry/backend test:cov

# View HTML report
open coverage/index.html

# CI coverage upload
# Automatically handled by GitHub Actions
```

### What to Test

**High Priority (Must Test):**
- Business logic and calculations
- Data validation and transformation
- Error handling and edge cases
- Security boundaries (authorization)
- Critical user workflows

**Medium Priority (Should Test):**
- Data formatting and display logic
- Complex UI interactions
- API integrations
- Performance-critical code

**Low Priority (Nice to Have):**
- Simple getters/setters
- Trivial UI components
- Third-party library wrappers
- Configuration files

## CI/CD Integration

### Required Status Checks

All 12 checks must pass before merging:

1. **Documentation Check** - README.md/TODO.md updates required
2. **Lint and Type Check** - Code quality validation
3. **Unit Tests** - Fast isolated tests
4. **PostgreSQL Integration Tests** - Database operation tests
5. **E2E Tests - chromium (1)** - Chrome browser, shard 1/2
6. **E2E Tests - chromium (2)** - Chrome browser, shard 2/2
7. **E2E Tests - firefox (1)** - Firefox browser, shard 1/2
8. **E2E Tests - firefox (2)** - Firefox browser, shard 2/2
9. **E2E Tests - webkit (1)** - Safari browser, shard 1/2
10. **E2E Tests - webkit (2)** - Safari browser, shard 2/2
11. **Build** - Production build validation
12. **Coverage Gate** - Coverage threshold enforcement

### Test Execution in CI

```yaml
# Parallel execution matrix
Unit Tests:         2 minutes
Integration Tests:  3 minutes  
E2E Tests:         6 jobs × 5 minutes = 10 minutes total
Total CI Time:     ~10-12 minutes
```

### Test Artifacts

- **Coverage Reports**: Uploaded to Codecov
- **E2E Videos**: Saved on test failure
- **Test Results**: XML reports for all test types
- **Performance Metrics**: Test execution times

## Debugging Tests

### Vitest Debugging

```bash
# Run with Node inspector
node --inspect ./node_modules/.bin/vitest run

# VS Code debugging
# 1. Add breakpoint in test
# 2. Open JavaScript Debug Terminal
# 3. Run: pnpm test:watch

# Run single test with logs
DEBUG=* pnpm vitest run path/to/test.ts
```

### Playwright Debugging

```bash
# Interactive mode with Playwright Inspector
pnpm test:e2e:debug

# Headed mode (see browser)
pnpm playwright test --headed

# Slow motion for debugging
pnpm playwright test --headed --slow-mo=1000

# Generate trace for failed tests
pnpm playwright test --trace on

# View trace
pnpm playwright show-trace trace.zip
```

### Common Debugging Techniques

1. **Add Console Logs**
   ```typescript
   console.log('Current state:', { user, items });
   ```

2. **Use Debugger Statements**
   ```typescript
   debugger; // Breaks when inspector attached
   ```

3. **Increase Timeouts**
   ```typescript
   test('slow test', async () => {
     // Increase timeout for this test
   }, 30000);
   ```

4. **Take Screenshots (E2E)**
   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```

## Common Issues & Solutions

### Authentication Issues

**Problem**: "Signed cookie string must be provided"
```typescript
// ❌ Wrong - Reading signed cookie directly
const token = request.cookies['auth-token'];

// ✅ Correct - Unsign cookie first
const authCookie = request.cookies['auth-token'];
const token = authCookie ? request.unsignCookie(authCookie)?.value : undefined;
```

**Problem**: E2E tests fail after login
```bash
# Solution: Ensure proxy is configured
# Check NEXT_PUBLIC_API_URL=/api/trpc in .env
# Restart frontend server if using reuseExistingServer
```

### Database Issues

**Problem**: "Authentication failed against database server"
```bash
# Start PostgreSQL
./tools/scripts/switch-db.sh start

# Verify connection
psql -h localhost -p 5487 -U ventry -d ventry_dev
```

**Problem**: "Foreign key constraint violated"
```typescript
// Ensure proper test data setup order
const org = await prisma.organization.create(...);
const user = await prisma.user.create({ organizationId: org.id, ... });
const item = await prisma.item.create({ organizationId: org.id, ... });
```

### Test Isolation Issues

**Problem**: Tests pass individually but fail together
```typescript
// ✅ Clean database between tests
beforeEach(async () => {
  await cleanDatabase();
});

// ✅ Clear all mocks
beforeEach(() => {
  vi.clearAllMocks();
});

// ✅ Reset module state
beforeEach(() => {
  vi.resetModules();
});
```

### Performance Issues

**Problem**: Tests running slowly
```bash
# Run tests in parallel
pnpm vitest run --pool=threads --poolOptions.threads.singleThread=false

# Use test.concurrent for independent tests
test.concurrent('test 1', async () => { ... });
test.concurrent('test 2', async () => { ... });
```

## Best Practices

### General Testing Principles

1. **Test Behavior, Not Implementation**
   ```typescript
   // ❌ Testing implementation details
   expect(component.state.isLoading).toBe(true);
   
   // ✅ Testing behavior
   expect(screen.getByTestId('loading-spinner')).toBeVisible();
   ```

2. **Use Descriptive Test Names**
   ```typescript
   // ❌ Vague name
   it('should work', () => {});
   
   // ✅ Descriptive name
   it('should return 404 when item does not exist', () => {});
   ```

3. **Follow AAA Pattern**
   ```typescript
   it('should calculate total price', () => {
     // Arrange
     const items = [{ price: 10 }, { price: 20 }];
     
     // Act
     const total = calculateTotal(items);
     
     // Assert
     expect(total).toBe(30);
   });
   ```

4. **Keep Tests Independent**
   ```typescript
   // ❌ Dependent on test order
   let sharedUser;
   it('should create user', () => {
     sharedUser = createUser();
   });
   it('should update user', () => {
     updateUser(sharedUser); // Depends on previous test
   });
   
   // ✅ Independent tests
   it('should update user', () => {
     const user = createUser();
     updateUser(user);
   });
   ```

### Unit Testing Best Practices

1. **Mock at the Right Level**
   - Mock external dependencies (database, APIs)
   - Don't mock the thing you're testing
   - Keep mocks simple and focused

2. **Test Edge Cases**
   - Null/undefined inputs
   - Empty arrays/strings
   - Maximum/minimum values
   - Error conditions

3. **Use Test Data Builders**
   ```typescript
   function createTestItem(overrides = {}) {
     return {
       id: 'test-1',
       name: 'Test Item',
       sku: 'TEST001',
       qtyOnHand: 100,
       ...overrides,
     };
   }
   ```

### Integration Testing Best Practices

1. **Use Transactions for Cleanup**
   ```typescript
   beforeEach(async () => {
     await prisma.$transaction([
       prisma.stockMovement.deleteMany(),
       prisma.item.deleteMany(),
       prisma.user.deleteMany(),
       prisma.organization.deleteMany(),
     ]);
   });
   ```

2. **Test Real Scenarios**
   - Multi-step workflows
   - Concurrent operations
   - Transaction rollbacks
   - Constraint violations

3. **Verify Side Effects**
   ```typescript
   // Don't just check the return value
   const result = await caller.items.create(data);
   
   // Also verify database state
   const dbItem = await prisma.item.findUnique({ where: { id: result.id } });
   expect(dbItem).toBeTruthy();
   
   // And audit logs
   const auditLog = await prisma.auditLog.findFirst({
     where: { entityId: result.id }
   });
   expect(auditLog?.action).toBe('CREATE');
   ```

### E2E Testing Best Practices

1. **Use Data Attributes**
   ```typescript
   // ❌ Brittle selector
   await page.click('.btn-primary:nth-child(2)');
   
   // ✅ Stable selector
   await page.click('[data-testid="submit-button"]');
   ```

2. **Wait for Elements Properly**
   ```typescript
   // ❌ Fixed timeout
   await page.waitForTimeout(2000);
   
   // ✅ Wait for specific condition
   await page.waitForSelector('[data-testid="success-message"]');
   ```

3. **Test User Journeys**
   ```typescript
   test('complete order workflow', async ({ page }) => {
     await login(page);
     await navigateToProducts(page);
     await addToCart(page, 'Widget Pro');
     await checkout(page);
     await verifyOrderConfirmation(page);
   });
   ```

4. **Handle Flaky Tests**
   ```typescript
   // Retry flaky operations
   await expect(async () => {
     await page.click('button:has-text("Save")');
     await expect(page.locator('.success-toast')).toBeVisible();
   }).toPass({
     intervals: [1000, 2000, 5000],
     timeout: 10000,
   });
   ```

### Performance Testing

1. **Monitor Test Duration**
   ```typescript
   test('should load quickly', async () => {
     const start = performance.now();
     await loadDashboard();
     const duration = performance.now() - start;
     
     expect(duration).toBeLessThan(1000); // 1 second
   });
   ```

2. **Test with Realistic Data**
   ```typescript
   it('should handle large datasets', async () => {
     // Create 1000 items
     const items = Array.from({ length: 1000 }, (_, i) => 
       createTestItem({ id: `item-${i}` })
     );
     
     const result = await processItems(items);
     expect(result.duration).toBeLessThan(5000);
   });
   ```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [tRPC Testing Guide](https://trpc.io/docs/testing)
- [PostgreSQL Testing Best Practices](https://www.postgresql.org/docs/current/regress.html)

## Quick Checklist

Before submitting a PR, ensure:

- [ ] All tests pass: `pnpm test && pnpm test:integration && pnpm test:e2e`
- [ ] Coverage thresholds met: `pnpm test:cov`
- [ ] No console.log statements in tests
- [ ] Tests are independent and can run in any order
- [ ] New features have corresponding tests
- [ ] E2E tests cover critical user paths
- [ ] Integration tests verify database operations
- [ ] Test names clearly describe what they test
- [ ] No hardcoded test data that might break
- [ ] Proper cleanup in beforeEach/afterEach hooks