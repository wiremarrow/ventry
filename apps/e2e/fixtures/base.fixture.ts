import { test as base, Page } from '@playwright/test';
import { createTestUser, TestUserData, clearAuthState } from '../utils/test-helpers';
import { cleanupTestDataForUser } from '../utils/db-cleanup';

/**
 * Custom test fixtures for E2E tests
 *
 * Provides authenticated pages and automatic cleanup for test isolation.
 */

export interface TestUser extends TestUserData {
  id: string;
}

export interface TestFixtures {
  // Authenticated pages for different roles
  adminPage: Page;
  managerPage: Page;
  userPage: Page;

  // Test users
  testAdmin: TestUser;
  testManager: TestUser;
  testUser: TestUser;

  // Unauthenticated page with cleanup
  cleanPage: Page;
}

export const test = base.extend<TestFixtures>({
  // Create test users for the entire test file
  testAdmin: async ({}, use) => {
    const admin = await createTestUser({
      email: `admin-${Date.now()}@ventry.e2e.test`,
      username: `admin-${Date.now()}`,
      role: 'ADMIN',
      firstName: 'Test',
      lastName: 'Admin',
    });

    await use(admin);

    // Cleanup after test
    await cleanupTestDataForUser(admin.id);
  },

  testManager: async ({}, use) => {
    const manager = await createTestUser({
      email: `manager-${Date.now()}@ventry.e2e.test`,
      username: `manager-${Date.now()}`,
      role: 'MANAGER',
      firstName: 'Test',
      lastName: 'Manager',
    });

    await use(manager);

    // Cleanup after test
    await cleanupTestDataForUser(manager.id);
  },

  testUser: async ({}, use) => {
    const user = await createTestUser({
      email: `user-${Date.now()}@ventry.e2e.test`,
      username: `user-${Date.now()}`,
      role: 'USER',
      firstName: 'Test',
      lastName: 'User',
    });

    await use(user);

    // Cleanup after test
    await cleanupTestDataForUser(user.id);
  },

  // Admin authenticated page
  adminPage: async ({ browser, testAdmin }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Clear authentication state
    await clearAuthState(page);

    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', testAdmin.email);
    await page.fill('input[type="password"]', testAdmin.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/.*dashboard/);

    await use(page);

    // Cleanup
    await context.close();
  },

  // Manager authenticated page
  managerPage: async ({ browser, testManager }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Clear authentication state
    await clearAuthState(page);

    // Login as manager
    await page.goto('/login');
    await page.fill('input[type="email"]', testManager.email);
    await page.fill('input[type="password"]', testManager.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/.*dashboard/);

    await use(page);

    // Cleanup
    await context.close();
  },

  // Regular user authenticated page
  userPage: async ({ browser, testUser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Clear authentication state
    await clearAuthState(page);

    // Login as user
    await page.goto('/login');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/.*dashboard/);

    await use(page);

    // Cleanup
    await context.close();
  },

  // Clean page with storage cleared
  cleanPage: async ({ page }, use) => {
    // Navigate to a page first to ensure DOM is available
    await page.goto('/login');

    // Clear authentication state before test
    await clearAuthState(page);

    await use(page);

    // Clear authentication state after test
    await clearAuthState(page);
  },
});

// Helper to create authenticated context without fixture
export async function createAuthenticatedPage(
  browser: any,
  role: 'ADMIN' | 'MANAGER' | 'USER' = 'USER'
): Promise<{ page: Page; user: TestUser; cleanup: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create test user
  const user = await createTestUser({
    email: `${role.toLowerCase()}-${Date.now()}@ventry.e2e.test`,
    username: `${role.toLowerCase()}-${Date.now()}`,
    role,
    firstName: 'Test',
    lastName: role,
  });

  // Clear authentication state and login
  await clearAuthState(page);
  await page.goto('/login');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);

  // Cleanup function
  const cleanup = async () => {
    await clearAuthState(page);
    await context.close();
    await cleanupTestDataForUser(user.id);
  };

  return { page, user, cleanup };
}

// Re-export expect from Playwright
export { expect } from '@playwright/test';
