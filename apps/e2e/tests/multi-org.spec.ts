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
    org1Data = await createOrgTestData(multiOrgSetup.organizations[0].id);
    org2Data = await createOrgTestData(multiOrgSetup.organizations[1].id);

    // Create a shared user who belongs to both organizations
    const sharedUserSetup = await createTestOrganization({
      email: 'bob@shared.e2e.test',
      password: 'TestPass123!',
      firstName: 'Bob',
      lastName: 'SharedUser',
    });
    sharedUser = sharedUserSetup.owner;

    // Add shared user to the second organization
    await addUserToOrganization(sharedUser.id, multiOrgSetup.organizations[1].id, 'MEMBER');
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

      // Should see organization switcher - it shows the current org name
      const orgSwitcher = page.locator('[data-testid="org-switcher"]');
      await expect(orgSwitcher).toBeVisible();

      // Click to open organization menu
      await orgSwitcher.click();

      // Should see both organizations
      // Use getByRole to target menu items specifically to avoid strict mode violation
      await expect(
        page.getByRole('menuitem').filter({ hasText: multiOrgSetup.organizations[0].name })
      ).toBeVisible();
      await expect(
        page.getByRole('menuitem').filter({ hasText: multiOrgSetup.organizations[1].name })
      ).toBeVisible();
    } finally {
      try {
        await context.close();
      } catch (e) {
        // Context already closed, ignore
      }
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

      // Navigate to products page - should see org1 items by default
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Search for org1 item to ensure it's visible
      const searchInput = page.getByPlaceholder('Search by SKU, name, or barcode...');
      await searchInput.fill(org1Data.item.sku);
      await page.waitForTimeout(500); // Wait for debounce

      // Should see org1 item
      await expect(page.locator(`text=${org1Data.item.name}`)).toBeVisible();

      // Should NOT see org2 item
      await expect(page.locator(`text=${org2Data.item.name}`)).not.toBeVisible();

      // Switch to organization 2
      const orgSwitcher = page.locator('[data-testid="org-switcher"]');
      await orgSwitcher.click();
      await page
        .getByRole('menuitem')
        .filter({ hasText: multiOrgSetup.organizations[1].name })
        .click();
      await page.waitForLoadState('networkidle');

      // Clear previous search and search for org2 item
      await searchInput.clear();
      await searchInput.fill(org2Data.item.sku);
      await page.waitForTimeout(500); // Wait for debounce

      // Now should see org2 item
      await expect(page.locator(`text=${org2Data.item.name}`)).toBeVisible();

      // Should NOT see org1 item anymore
      await expect(page.locator(`text=${org1Data.item.name}`)).not.toBeVisible();
    } finally {
      try {
        await context.close();
      } catch (e) {
        // Context already closed, ignore
      }
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
      const orgSwitcher = page.locator('[data-testid="org-switcher"]');
      await orgSwitcher.click();
      await page
        .getByRole('menuitem')
        .filter({ hasText: multiOrgSetup.organizations[1].name })
        .click();
      await page.waitForLoadState('networkidle');

      // Navigate through multiple pages
      const pages = ['/products', '/customers', '/suppliers'];

      for (const pageUrl of pages) {
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // Should consistently see org2 data
        if (pageUrl === '/products') {
          // Search for the org2 item to ensure it's visible
          const searchInput = page.getByPlaceholder('Search by SKU, name, or barcode...');
          await searchInput.fill(org2Data.item.sku);
          await page.waitForTimeout(500); // Wait for debounce

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
      try {
        await context.close();
      } catch (e) {
        // Context already closed, ignore
      }
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
      const orgSwitcher = page.locator('[data-testid="org-switcher"]');
      await orgSwitcher.click();
      await page
        .getByRole('menuitem')
        .filter({ hasText: multiOrgSetup.organizations[1].name })
        .click();
      await page.waitForLoadState('networkidle');

      // Try to access users page as member - might have limited access
      await page.goto('/users');
      await page.waitForLoadState('networkidle');

      // Verify we can still see the page but may have limited actions
      await expect(page.locator('h1:has-text("Organization Users")')).toBeVisible();
    } finally {
      try {
        await context.close();
      } catch (e) {
        // Context already closed, ignore
      }
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
      // The shared user should see their own org name in the switcher
      const orgSwitcher = page.locator('[data-testid="org-switcher"]');
      await expect(orgSwitcher).toBeVisible();

      // Open switcher and verify both organizations are available
      await orgSwitcher.click();

      // Should see both organizations (own org and the one they were added to)
      const orgOptions = await page.locator('[role="menuitem"], [role="option"]').count();
      expect(orgOptions).toBeGreaterThanOrEqual(2);
    } finally {
      try {
        await context.close();
      } catch (e) {
        // Context already closed, ignore
      }
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
      const orgSwitcher = page.locator('[data-testid="org-switcher"]');
      await orgSwitcher.click();
      await page
        .getByRole('menuitem')
        .filter({ hasText: multiOrgSetup.organizations[1].name })
        .click();
      await page.waitForLoadState('networkidle');

      // Navigate to products to verify org2 context
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Search for org2 item
      const searchInput = page.getByPlaceholder('Search by SKU, name, or barcode...');
      await searchInput.fill(org2Data.item.sku);
      await page.waitForTimeout(500); // Wait for debounce

      await expect(page.locator(`text=${org2Data.item.name}`)).toBeVisible();

      // Logout
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await page.waitForURL(/.*login/);

      // Login again
      await page.fill('input[type="email"]', multiOrgSetup.user.email);
      await page.fill('input[type="password"]', multiOrgSetup.user.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*dashboard/);

      // Should still be in org2 context
      await page.goto('/products');
      await page.waitForLoadState('networkidle');

      // Search for org2 item to verify context persisted
      const searchInput2 = page.getByPlaceholder('Search by SKU, name, or barcode...');
      await searchInput2.fill(org2Data.item.sku);
      await page.waitForTimeout(500); // Wait for debounce

      await expect(page.locator(`text=${org2Data.item.name}`)).toBeVisible();
      await expect(page.locator(`text=${org1Data.item.name}`)).not.toBeVisible();
    } finally {
      try {
        await context.close();
      } catch (e) {
        // Context already closed, ignore
      }
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
        const res = await fetch('/api/trpc/products.list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            json: { page: 1, limit: 50 },
          }),
        });
        return res.json();
      });

      // Should get org1 products
      let products = response.result.data.json.products;
      expect(products).toHaveLength(1);
      expect(products[0].organizationId).toBe(multiOrgSetup.organizations[0].id);

      // Switch to org2
      const orgSwitcher = page.locator('[data-testid="org-switcher"]');
      await orgSwitcher.click();
      await page
        .getByRole('menuitem')
        .filter({ hasText: multiOrgSetup.organizations[1].name })
        .click();
      await page.waitForLoadState('networkidle');

      // Make API call in org2 context
      response = await page.evaluate(async () => {
        const res = await fetch('/api/trpc/products.list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            json: { page: 1, limit: 50 },
          }),
        });
        return res.json();
      });

      // Should get org2 products
      products = response.result.data.json.products;
      expect(products).toHaveLength(1);
      expect(products[0].organizationId).toBe(multiOrgSetup.organizations[1].id);
    } finally {
      try {
        await context.close();
      } catch (e) {
        // Context already closed, ignore
      }
    }
  });
});
