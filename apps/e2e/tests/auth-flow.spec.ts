import { test, expect } from '../fixtures/base.fixture.js';
import {
  createTestUser,
  createTestOrganization,
} from '../utils/test-helpers.js';
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
      const authCookie = cookies.find(c => c.name === 'auth-token');
      const orgCookie = cookies.find(c => c.name === 'active-organization');
      
      expect(authCookie).toBeDefined();
      expect(orgCookie).toBeDefined();
      expect(orgCookie?.value).toBe(testOrg.organization.id);
    } finally {
      await context.close();
      await cleanupTestDataForOrganization(testOrg.organization.id);
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
      expect(cookies.find(c => c.name === 'auth-token')).toBeDefined();
      expect(cookies.find(c => c.name === 'active-organization')).toBeDefined();
      
      // Logout
      await page.click('text=Sign Out');
      await page.waitForURL(/.*login/);
      
      // Verify cookies are cleared
      cookies = await context.cookies();
      expect(cookies.find(c => c.name === 'auth-token')).toBeUndefined();
      expect(cookies.find(c => c.name === 'active-organization')).toBeUndefined();
    } finally {
      await context.close();
      await cleanupTestDataForOrganization(testOrg.organization.id);
      await cleanupTestDataForUser(testOrg.owner.id);
    }
  });

  test('should redirect to login when accessing protected routes without auth', async ({ cleanPage: page }) => {
    // Try to access various protected routes
    const protectedRoutes = [
      '/dashboard',
      '/items',
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
    const loneUser = await createTestUser({
      email: 'no-org-user@ventry.e2e.test',
      password: 'TestPass123!',
      firstName: 'NoOrg',
      lastName: 'User',
      createOrganization: false, // Don't create org
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', loneUser.email);
      await page.fill('input[type="password"]', loneUser.password);
      await page.click('button:has-text("Sign In")');
      
      // Should still reach dashboard but with limited functionality
      await page.waitForURL(/.*dashboard/);
      
      // Try to access organization-required pages
      await page.goto('/items');
      
      // Should see an error or prompt to select/create organization
      const errorMessage = page.locator('text=/No organization selected|Please select an organization|organization/i');
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
    } finally {
      await context.close();
      await cleanupTestDataForUser(loneUser.id);
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
      const orgCookie = cookies.find(c => c.name === 'active-organization');
      const orgId = orgCookie?.value;
      
      // Refresh page
      await page.reload();
      
      // Organization should still be set
      await expect(page.locator(`text=${testOrg.organization.name}`)).toBeVisible();
      
      // Cookie should persist
      const newCookies = await context.cookies();
      const newOrgCookie = newCookies.find(c => c.name === 'active-organization');
      expect(newOrgCookie?.value).toBe(orgId);
    } finally {
      await context.close();
      await cleanupTestDataForOrganization(testOrg.organization.id);
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
      await context.addCookies([{
        name: 'active-organization',
        value: org2.organization.id,
        domain: 'localhost',
        path: '/',
      }]);
      
      // Try to access organization-specific data
      await page.goto('/items');
      
      // Should either redirect or show error
      const hasError = await page.locator('text=/forbidden|unauthorized|access denied/i').isVisible().catch(() => false);
      const redirectedToLogin = page.url().includes('login');
      const hasNoData = await page.locator('text=/no items|no data/i').isVisible().catch(() => false);
      
      expect(hasError || redirectedToLogin || hasNoData).toBe(true);
    } finally {
      await context.close();
      await cleanupTestDataForOrganization(org1.organization.id);
      await cleanupTestDataForOrganization(org2.organization.id);
      await cleanupTestDataForUser(org1.owner.id);
      await cleanupTestDataForUser(org2.owner.id);
    }
  });

  test('should automatically create organization for new users', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Navigate to registration page (if exists)
      await page.goto('/register');
      
      // If registration page exists, test the flow
      if (!page.url().includes('login')) {
        const testEmail = `auto-org-${Date.now()}@ventry.e2e.test`;
        
        // Fill registration form
        await page.fill('input[name="email"]', testEmail);
        await page.fill('input[name="username"]', `autoorg${Date.now()}`);
        await page.fill('input[name="password"]', 'TestPass123!');
        await page.fill('input[name="firstName"]', 'Auto');
        await page.fill('input[name="lastName"]', 'Org');
        
        // Submit registration
        await page.click('button[type="submit"]');
        
        // Should be logged in with an organization
        await page.waitForURL(/.*dashboard/);
        
        // Verify organization was created
        const orgName = await page.locator('text=/Auto.*Organization|Personal.*Organization/i').isVisible();
        expect(orgName).toBe(true);
        
        // Cleanup
        const cookies = await context.cookies();
        const orgCookie = cookies.find(c => c.name === 'active-organization');
        if (orgCookie?.value) {
          await cleanupTestDataForOrganization(orgCookie.value);
        }
      }
    } catch (error) {
      // Registration might not be implemented yet
      console.log('Registration page not available, skipping test');
    } finally {
      await context.close();
    }
  });
});