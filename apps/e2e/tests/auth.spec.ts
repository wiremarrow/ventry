import { test, expect } from '../fixtures/base.fixture.js';
import { cleanupTestDataForUser } from '../utils/db-cleanup.js';

test.describe('Authentication', () => {
  test.beforeEach(async ({ cleanPage }) => {
    await cleanPage.goto('/login');
  });

  test('should display login form', async ({ cleanPage: page }) => {
    await expect(page).toHaveTitle(/Ventry/);
    await expect(page.locator('h2')).toContainText('Welcome to Ventry');
    await expect(page.locator('text=AI-native inventory management system')).toBeVisible();

    // Check form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check demo accounts info
    await expect(page.locator('text=Demo accounts with organization access:')).toBeVisible();
    await expect(page.locator('text=admin@ventry.com')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ cleanPage: page }) => {
    await page.click('button:has-text("Sign In")');

    // Check for validation errors
    await expect(page.locator('text=Invalid email address')).toBeVisible();
    await expect(page.locator('text=Password must be at least 6 characters')).toBeVisible();
  });

  test('should show validation error for invalid email', async ({ cleanPage: page }) => {
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');

    await expect(page.locator('text=Invalid email address')).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ cleanPage: page }) => {
    // Import createTestOrganization to create user with organization
    const { createTestOrganization } = await import('../utils/test-helpers.js');
    const { cleanupTestDataForOrganization } = await import('../utils/db-cleanup.js');

    // Create a test user with organization
    const testSetup = await createTestOrganization({
      email: `login-success-${Date.now()}@ventry.e2e.test`,
      password: 'TestPassword123!',
      firstName: 'Login',
      lastName: 'Test',
    });

    try {
      // Login with the test user
      await page.fill('input[type="email"]', testSetup.owner.email);
      await page.fill('input[type="password"]', testSetup.owner.password);

      await page.click('button:has-text("Sign In")');

      // Wait for navigation to dashboard
      await page.waitForURL(/.*dashboard/, { timeout: 10000 });

      // Verify we're on the dashboard
      await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();

      // Verify user info is displayed
      await expect(
        page.locator(`text=${testSetup.owner.firstName} ${testSetup.owner.lastName}`)
      ).toBeVisible();
    } finally {
      // Cleanup test data
      await cleanupTestDataForOrganization(testSetup.organization.id);
      await cleanupTestDataForUser(testSetup.owner.id);
    }
  });

  test('should show error for invalid credentials', async ({ cleanPage: page }) => {
    // Import createTestOrganization
    const { createTestOrganization } = await import('../utils/test-helpers.js');
    const { cleanupTestDataForOrganization } = await import('../utils/db-cleanup.js');

    // Create a test user with organization
    const testSetup = await createTestOrganization({
      email: `login-fail-${Date.now()}@ventry.e2e.test`,
      password: 'CorrectPassword123!',
      firstName: 'Login',
      lastName: 'Fail',
    });

    try {
      // Try to login with wrong password
      await page.fill('input[type="email"]', testSetup.owner.email);
      await page.fill('input[type="password"]', 'WrongPassword123!');

      // Click sign in and wait for tRPC response
      await page.click('button:has-text("Sign In")');

      // Wait for error message to appear
      await page.waitForLoadState('networkidle');

      // Should show error message
      await expect(page.locator('.text-red-600').first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.text-red-600').first()).toContainText(
        /Invalid credentials|Invalid email or password|Login failed/
      );

      // Should stay on login page
      await expect(page).toHaveURL(/.*login/);
    } finally {
      // Cleanup test data
      await cleanupTestDataForOrganization(testSetup.organization.id);
      await cleanupTestDataForUser(testSetup.owner.id);
    }
  });

  test('should redirect to login when accessing protected routes', async ({ cleanPage: page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h2')).toContainText('Welcome to Ventry');
  });

  test('should clear error messages on new input', async ({ cleanPage: page }) => {
    // First trigger validation errors
    await page.click('button:has-text("Sign In")');

    // Verify errors are shown
    await expect(page.locator('text=Invalid email address')).toBeVisible();

    // Type valid email
    await page.fill('input[type="email"]', 'test@example.com');

    // Error should be cleared
    await expect(page.locator('text=Invalid email address')).not.toBeVisible();
  });

  test('should handle logout correctly', async ({ browser }) => {
    // Import createTestOrganization
    const { createTestOrganization } = await import('../utils/test-helpers.js');
    const { cleanupTestDataForOrganization } = await import('../utils/db-cleanup.js');

    // Create a test user and authenticated context
    const context = await browser.newContext();
    const page = await context.newPage();

    const testSetup = await createTestOrganization({
      email: `logout-test-${Date.now()}@ventry.e2e.test`,
      password: 'TestPassword123!',
      firstName: 'Logout',
      lastName: 'Test',
    });

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testSetup.owner.email);
      await page.fill('input[type="password"]', testSetup.owner.password);
      await page.click('button:has-text("Sign In")');

      // Wait for dashboard
      await expect(page).toHaveURL(/.*dashboard/);

      // Click logout
      await page.click('text=Sign Out');

      // Should redirect to login page
      await expect(page).toHaveURL(/.*login/);

      // Try to access dashboard again
      await page.goto('/dashboard');

      // Should redirect back to login
      await expect(page).toHaveURL(/.*login/);
    } finally {
      // Cleanup
      await context.close();
      await cleanupTestDataForOrganization(testSetup.organization.id);
      await cleanupTestDataForUser(testSetup.owner.id);
    }
  });

  test('should persist login across page refreshes', async ({ browser }) => {
    // Import createTestOrganization
    const { createTestOrganization } = await import('../utils/test-helpers.js');
    const { cleanupTestDataForOrganization } = await import('../utils/db-cleanup.js');

    // Create a test user and authenticated context
    const context = await browser.newContext();
    const page = await context.newPage();

    const testSetup = await createTestOrganization({
      email: `persist-test-${Date.now()}@ventry.e2e.test`,
      password: 'TestPassword123!',
      firstName: 'Persist',
      lastName: 'Test',
    });

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testSetup.owner.email);
      await page.fill('input[type="password"]', testSetup.owner.password);
      await page.click('button:has-text("Sign In")');

      // Wait for dashboard
      await expect(page).toHaveURL(/.*dashboard/);

      // Refresh the page
      await page.reload();

      // Should still be on dashboard
      await expect(page).toHaveURL(/.*dashboard/);
      await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();
    } finally {
      // Cleanup
      await context.close();
      await cleanupTestDataForOrganization(testSetup.organization.id);
      await cleanupTestDataForUser(testSetup.owner.id);
    }
  });
});
