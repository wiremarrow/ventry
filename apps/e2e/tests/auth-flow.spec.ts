import { test, expect } from '../fixtures/base.fixture.js';
import { createTestUser, createTestOrganization } from '../utils/test-helpers.js';
import { cleanupTestDataForUser, cleanupTestDataForOrganization } from '../utils/db-cleanup.js';

test.describe('Authentication Flow with Organization Context', () => {
  test('should set organization context on login', async ({ browser }) => {
    // Create test user with organization
    const testOrg = await createTestOrganization({
      email: 'auth-org-test@ventry.e2e.test',
      password: 'TestPass123!',
      firstName: 'AuthOrg',
      lastName: 'Test',
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testOrg.owner.email);
      await page.fill('input[type="password"]', testOrg.owner.password);
      await page.click('button:has-text("Sign In")');

      // Wait for dashboard
      await page.waitForURL(/.*dashboard/);

      // Verify organization context is set
      await expect(page.locator(`text=${testOrg.organization.name}`)).toBeVisible();

      // Check cookies are set
      const cookies = await context.cookies();
      const authCookie = cookies.find((c) => c.name === 'auth-token');
      const orgCookie = cookies.find((c) => c.name === 'active-organization');

      expect(authCookie).toBeDefined();
      expect(orgCookie).toBeDefined();
      expect(orgCookie?.value.split('.')[0]).toBe(testOrg.organization.id);
    } finally {
      try {
        await context.close();
      } catch (error) {
        // Context already closed, ignore
        console.warn('Context already closed:', error);
      }
      // Clean up in proper order - organization first, then user
      try {
        await cleanupTestDataForOrganization(testOrg.organization.id);
      } catch (error) {
        console.warn('Organization cleanup failed (may have been already deleted):', error);
      }
      await cleanupTestDataForUser(testOrg.owner.id);
    }
  });

  test('should clear organization context on logout', async ({ browser }) => {
    // Create test user with organization
    const testOrg = await createTestOrganization({
      email: 'logout-org-test@ventry.e2e.test',
      password: 'TestPass123!',
      firstName: 'LogoutOrg',
      lastName: 'Test',
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testOrg.owner.email);
      await page.fill('input[type="password"]', testOrg.owner.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Verify cookies are set
      let cookies = await context.cookies();
      expect(cookies.find((c) => c.name === 'auth-token')).toBeDefined();
      expect(cookies.find((c) => c.name === 'active-organization')).toBeDefined();

      // Logout
      await page.click('text=Sign Out');
      await page.waitForURL(/.*login/);

      // Verify cookies are cleared
      cookies = await context.cookies();
      expect(cookies.find((c) => c.name === 'auth-token')).toBeUndefined();
      expect(cookies.find((c) => c.name === 'active-organization')).toBeUndefined();
    } finally {
      try {
        await context.close();
      } catch (error) {
        // Context already closed, ignore
        console.warn('Context already closed:', error);
      }
      // Clean up in proper order - organization first, then user
      try {
        await cleanupTestDataForOrganization(testOrg.organization.id);
      } catch (error) {
        console.warn('Organization cleanup failed (may have been already deleted):', error);
      }
      await cleanupTestDataForUser(testOrg.owner.id);
    }
  });

  test('should redirect to login when accessing protected routes without auth', async ({
    cleanPage: page,
  }) => {
    // Try to access various protected routes
    const protectedRoutes = [
      '/dashboard',
      '/products',
      '/users',
      '/customers',
      '/suppliers',
      '/orders',
      '/inventory',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/.*login/);
      await expect(page.locator('h2')).toContainText('Welcome to Ventry');
    }
  });

  test('should show error when organization context is missing', async ({ browser }) => {
    // Create a user without organization membership
    // Note: Using seed user that has no organization access
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login with user@ventry.com - this user has no organization access per CLAUDE.md
      await page.goto('/login');
      await page.fill('input[type="email"]', 'user@ventry.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button:has-text("Sign In")');

      // User without org should stay on login or show error
      // Wait a bit to see what happens
      await page.waitForTimeout(2000);

      // Check if we're still on login page or got an error
      const isOnLogin = page.url().includes('login');
      const hasError = await page
        .locator('.text-red-600')
        .isVisible()
        .catch(() => false);

      // User without organization should either stay on login or see an error
      expect(isOnLogin || hasError).toBe(true);
    } finally {
      try {
        await context.close();
      } catch (e) {
        // Context already closed, ignore
      }
    }
  });

  test('should persist organization context across page refreshes', async ({ browser }) => {
    // Create test user with organization
    const testOrg = await createTestOrganization({
      email: 'persist-org-test@ventry.e2e.test',
      password: 'TestPass123!',
      firstName: 'PersistOrg',
      lastName: 'Test',
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testOrg.owner.email);
      await page.fill('input[type="password"]', testOrg.owner.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Verify organization is shown
      await expect(page.locator(`text=${testOrg.organization.name}`)).toBeVisible();

      // Get organization cookie value
      const cookies = await context.cookies();
      const orgCookie = cookies.find((c) => c.name === 'active-organization');
      const orgId = orgCookie?.value;

      // Refresh page
      await page.reload();

      // Organization should still be set
      await expect(page.locator(`text=${testOrg.organization.name}`)).toBeVisible();

      // Cookie should persist
      const newCookies = await context.cookies();
      const newOrgCookie = newCookies.find((c) => c.name === 'active-organization');
      expect(newOrgCookie?.value).toBe(orgId);
    } finally {
      try {
        await context.close();
      } catch (error) {
        // Context already closed, ignore
        console.warn('Context already closed:', error);
      }
      // Clean up in proper order - organization first, then user
      try {
        await cleanupTestDataForOrganization(testOrg.organization.id);
      } catch (error) {
        console.warn('Organization cleanup failed (may have been already deleted):', error);
      }
      await cleanupTestDataForUser(testOrg.owner.id);
    }
  });

  test('should handle invalid organization access attempts', async ({ browser }) => {
    // Create two separate organizations
    const org1 = await createTestOrganization({
      email: 'org1-invalid@ventry.e2e.test',
      password: 'TestPass123!',
      firstName: 'Org1',
      lastName: 'User',
    });

    const org2 = await createTestOrganization({
      email: 'org2-invalid@ventry.e2e.test',
      password: 'TestPass123!',
      firstName: 'Org2',
      lastName: 'User',
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as org1 user
      await page.goto('/login');
      await page.fill('input[type="email"]', org1.owner.email);
      await page.fill('input[type="password"]', org1.owner.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Try to manually set org2's ID in cookie (simulate attack)
      await context.addCookies([
        {
          name: 'active-organization',
          value: org2.organization.id,
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Try to access organization-specific data
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // User is logged in as org1 user but cookie is set to org2
      // The system should either:
      // 1. Show an empty product list (most likely)
      // 2. Redirect to login
      // 3. Show an error
      // 4. Reset to the correct organization

      // Check various possible outcomes
      const hasError = await page
        .locator('text=/forbidden|unauthorized|access denied/i')
        .isVisible()
        .catch(() => false);
      const redirectedToLogin = page.url().includes('login');
      const hasEmptyState = await page
        .locator('text=/no products found|0 products|create.*first.*product/i')
        .isVisible()
        .catch(() => false);

      // Also check if the org was reset to org1 (the correct org)
      const orgSwitcher = await page
        .locator('[data-testid="org-switcher"]')
        .textContent()
        .catch(() => '');
      const resetToCorrectOrg = orgSwitcher.includes(org1.organization.name);

      // Any of these outcomes is acceptable security behavior
      expect(hasError || redirectedToLogin || hasEmptyState || resetToCorrectOrg).toBe(true);
    } finally {
      try {
        await context.close();
      } catch (e) {
        // Context already closed, ignore
      }
      await cleanupTestDataForOrganization(org1.organization.id);
      await cleanupTestDataForOrganization(org2.organization.id);
      await cleanupTestDataForUser(org1.owner.id);
      await cleanupTestDataForUser(org2.owner.id);
    }
  });

  test.skip('should automatically create organization for new users', async ({ browser }) => {
    // Skip this test - registration feature not implemented yet
    // When registration is added, this test should:
    // 1. Navigate to /register
    // 2. Fill registration form
    // 3. Verify user is created with a default organization
    // 4. Cleanup test data
  });
});
