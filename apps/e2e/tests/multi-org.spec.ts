import { test, expect } from '../fixtures/base.fixture.js';
import {
  createTestOrganization,
  createMultiOrgTestUser,
  addUserToOrganization,
  createOrgTestData,
} from '../utils/test-helpers.js';
import { cleanupTestDataForUser, cleanupTestDataForOrganization } from '../utils/db-cleanup.js';

test.describe('Multi-Organization Management', () => {
  let multiOrgSetup: any;
  let org1Data: any;
  let org2Data: any;
  let sharedUser: any;

  test.beforeAll(async () => {
    // Create a user with access to multiple organizations
    multiOrgSetup = await createMultiOrgTestUser(2);
    
    // Create test data for each organization
    org1Data = await createOrgTestData(
      multiOrgSetup.organizations[0].id
    );
    org2Data = await createOrgTestData(
      multiOrgSetup.organizations[1].id
    );

    // Create a shared user who belongs to both organizations
    const sharedUserSetup = await createTestOrganization({
      email: 'bob@shared.e2e.test',
      password: 'TestPass123!',
      firstName: 'Bob',
      lastName: 'SharedUser',
    });
    sharedUser = sharedUserSetup.owner;

    // Add shared user to the second organization
    await addUserToOrganization(
      sharedUser.id,
      multiOrgSetup.organizations[1].id,
      'MEMBER'
    );
  });

  test.afterAll(async () => {
    // Cleanup test data
    for (const org of multiOrgSetup.organizations) {
      await cleanupTestDataForOrganization(org.id);
    }
    await cleanupTestDataForUser(multiOrgSetup.user.id);
    await cleanupTestDataForUser(sharedUser.id);
  });

  test('should show organization switcher for multi-org users', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as multi-org user
      await page.goto('/login');
      await page.fill('input[type="email"]', multiOrgSetup.user.email);
      await page.fill('input[type="password"]', multiOrgSetup.user.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Should see organization switcher
      const orgSwitcher = page.locator('[data-testid="org-switcher"], button:has-text("Organization")');
      await expect(orgSwitcher).toBeVisible();

      // Click to open organization menu
      await orgSwitcher.click();

      // Should see both organizations
      await expect(page.locator(`text=${multiOrgSetup.organizations[0].name}`)).toBeVisible();
      await expect(page.locator(`text=${multiOrgSetup.organizations[1].name}`)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('should switch data context when changing organizations', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as multi-org user
      await page.goto('/login');
      await page.fill('input[type="email"]', multiOrgSetup.user.email);
      await page.fill('input[type="password"]', multiOrgSetup.user.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Navigate to items page - should see org1 items by default
      await page.goto('/items');
      await page.waitForLoadState('networkidle');
      
      // Should see org1 item
      await expect(page.locator(`text=${org1Data.item.name}`)).toBeVisible();
      
      // Should NOT see org2 item
      await expect(page.locator(`text=${org2Data.item.name}`)).not.toBeVisible();

      // Switch to organization 2
      const orgSwitcher = page.locator('[data-testid="org-switcher"], button:has-text("Organization")');
      await orgSwitcher.click();
      await page.click(`text=${multiOrgSetup.organizations[1].name}`);
      await page.waitForLoadState('networkidle');

      // Now should see org2 item
      await expect(page.locator(`text=${org2Data.item.name}`)).toBeVisible();
      
      // Should NOT see org1 item anymore
      await expect(page.locator(`text=${org1Data.item.name}`)).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('should maintain organization context across page navigation', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as multi-org user
      await page.goto('/login');
      await page.fill('input[type="email"]', multiOrgSetup.user.email);
      await page.fill('input[type="password"]', multiOrgSetup.user.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Switch to organization 2
      const orgSwitcher = page.locator('[data-testid="org-switcher"], button:has-text("Organization")');
      await orgSwitcher.click();
      await page.click(`text=${multiOrgSetup.organizations[1].name}`);
      await page.waitForLoadState('networkidle');

      // Navigate through multiple pages
      const pages = ['/items', '/customers', '/suppliers'];
      
      for (const pageUrl of pages) {
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');
        
        // Should consistently see org2 data
        if (pageUrl === '/items') {
          await expect(page.locator(`text=${org2Data.item.name}`)).toBeVisible();
          await expect(page.locator(`text=${org1Data.item.name}`)).not.toBeVisible();
        } else if (pageUrl === '/customers') {
          await expect(page.locator(`text=${org2Data.customer.name}`)).toBeVisible();
          await expect(page.locator(`text=${org1Data.customer.name}`)).not.toBeVisible();
        } else if (pageUrl === '/suppliers') {
          await expect(page.locator(`text=${org2Data.supplier.name}`)).toBeVisible();
          await expect(page.locator(`text=${org1Data.supplier.name}`)).not.toBeVisible();
        }
      }
    } finally {
      await context.close();
    }
  });

  test('should respect organization-specific roles', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as multi-org user (ADMIN in org1, MEMBER in org2)
      await page.goto('/login');
      await page.fill('input[type="email"]', multiOrgSetup.user.email);
      await page.fill('input[type="password"]', multiOrgSetup.user.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // In org1 (ADMIN role) - should see admin features
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      
      // Should be able to access users page as admin
      await expect(page.locator('h1:has-text("Organization Users")')).toBeVisible();

      // Switch to org2 (MEMBER role)
      const orgSwitcher = page.locator('[data-testid="org-switcher"], button:has-text("Organization")');
      await orgSwitcher.click();
      await page.click(`text=${multiOrgSetup.organizations[1].name}`);
      await page.waitForLoadState('networkidle');

      // Try to access users page as member - might have limited access
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      
      // Verify we can still see the page but may have limited actions
      await expect(page.locator('h1:has-text("Organization Users")')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('should handle organization switching with shared users', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as shared user
      await page.goto('/login');
      await page.fill('input[type="email"]', sharedUser.email);
      await page.fill('input[type="password"]', sharedUser.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Should have access to organization switcher
      const orgSwitcher = page.locator('[data-testid="org-switcher"], button:has-text("Organization")');
      await expect(orgSwitcher).toBeVisible();

      // Open switcher and verify both organizations are available
      await orgSwitcher.click();
      
      // Should see both organizations (own org and the one they were added to)
      const orgOptions = await page.locator('[role="menuitem"], [role="option"]').count();
      expect(orgOptions).toBeGreaterThanOrEqual(2);
    } finally {
      await context.close();
    }
  });

  test('should persist organization selection across sessions', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login and switch to org2
      await page.goto('/login');
      await page.fill('input[type="email"]', multiOrgSetup.user.email);
      await page.fill('input[type="password"]', multiOrgSetup.user.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Switch to organization 2
      const orgSwitcher = page.locator('[data-testid="org-switcher"], button:has-text("Organization")');
      await orgSwitcher.click();
      await page.click(`text=${multiOrgSetup.organizations[1].name}`);
      await page.waitForLoadState('networkidle');

      // Navigate to items to verify org2 context
      await page.goto('/items');
      await expect(page.locator(`text=${org2Data.item.name}`)).toBeVisible();

      // Logout
      await page.click('text=Sign Out');
      await page.waitForURL(/.*login/);

      // Login again
      await page.fill('input[type="email"]', multiOrgSetup.user.email);
      await page.fill('input[type="password"]', multiOrgSetup.user.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Should still be in org2 context
      await page.goto('/items');
      await page.waitForLoadState('networkidle');
      await expect(page.locator(`text=${org2Data.item.name}`)).toBeVisible();
      await expect(page.locator(`text=${org1Data.item.name}`)).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('should handle API calls with correct organization context', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as multi-org user
      await page.goto('/login');
      await page.fill('input[type="email"]', multiOrgSetup.user.email);
      await page.fill('input[type="password"]', multiOrgSetup.user.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Make API call in org1 context
      let response = await page.evaluate(async () => {
        const res = await fetch('/api/trpc/items.list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            json: { page: 1, limit: 50 }
          }),
        });
        return res.json();
      });

      // Should get org1 items
      let items = response.result.data.json.items;
      expect(items).toHaveLength(1);
      expect(items[0].organizationId).toBe(multiOrgSetup.organizations[0].id);

      // Switch to org2
      const orgSwitcher = page.locator('[data-testid="org-switcher"], button:has-text("Organization")');
      await orgSwitcher.click();
      await page.click(`text=${multiOrgSetup.organizations[1].name}`);
      await page.waitForLoadState('networkidle');

      // Make API call in org2 context
      response = await page.evaluate(async () => {
        const res = await fetch('/api/trpc/items.list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            json: { page: 1, limit: 50 }
          }),
        });
        return res.json();
      });

      // Should get org2 items
      items = response.result.data.json.items;
      expect(items).toHaveLength(1);
      expect(items[0].organizationId).toBe(multiOrgSetup.organizations[1].id);
    } finally {
      await context.close();
    }
  });
});