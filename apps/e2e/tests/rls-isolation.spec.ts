import { test, expect } from '../fixtures/base.fixture.js';
import {
  createTestOrganization,
  createOrgTestData,
  navigateWithRetry,
  loginWithPage,
} from '../utils/test-helpers.js';
import { cleanupTestDataForUser, cleanupTestDataForOrganization } from '../utils/db-cleanup.js';

test.describe('Row-Level Security (RLS) Isolation', () => {
  let org1: any;
  let org2: any;
  let org1Data: any;
  let org2Data: any;

  test.beforeAll(async () => {
    // Create two separate organizations with test data
    const orgSetup1 = await createTestOrganization({
      email: 'alice@techstart.e2e.test',
      password: 'TestPass123!',
      firstName: 'Alice',
      lastName: 'TechStart',
    });
    org1 = orgSetup1;

    const orgSetup2 = await createTestOrganization({
      email: 'charlie@globalretail.e2e.test',
      password: 'TestPass123!',
      firstName: 'Charlie',
      lastName: 'GlobalRetail',
    });
    org2 = orgSetup2;

    // Create test data for each organization
    org1Data = await createOrgTestData(org1.organization.id);
    org2Data = await createOrgTestData(org2.organization.id);
  });

  test.afterAll(async () => {
    // Cleanup test data
    await cleanupTestDataForOrganization(org1.organization.id);
    await cleanupTestDataForOrganization(org2.organization.id);
    await cleanupTestDataForUser(org1.owner.id);
    await cleanupTestDataForUser(org2.owner.id);
  });

  test('users page should only show organization members', async ({ browser }) => {
    // Test with Organization 1 user
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    try {
      // Login as org1 owner with retry for connection issues
      await navigateWithRetry(page1, '/login');
      
      // Wait for network to settle (ensures JavaScript is loaded)
      await page1.waitForLoadState('networkidle');
      
      // Wait for form to be ready and interactive
      const emailInput = page1.locator('input[type="email"]');
      const passwordInput = page1.locator('input[type="password"]');
      const signInButton = page1.locator('button:has-text("Sign In")');
      
      // Ensure form elements are visible and enabled
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(signInButton).toBeVisible();
      
      // Fill form fields
      await emailInput.fill(org1.owner.email);
      await passwordInput.fill(org1.owner.password);
      
      // Try to submit the form - use keyboard as it's more reliable
      await passwordInput.press('Enter');
      
      // Wait for navigation with better error handling
      try {
        await page1.waitForURL(/.*dashboard/, { timeout: 10000 });
      } catch (error) {
        // If navigation fails, try clicking the button as fallback
        await signInButton.click();
        
        try {
          await page1.waitForURL(/.*dashboard/, { timeout: 5000 });
        } catch (retryError) {
          // If still fails, check what's on the page
          const pageUrl = page1.url();
          
          // Check for any error messages
          const errorText = await page1.locator('[role="alert"], .error, .text-red-500, .text-destructive').textContent().catch(() => null);
          
          console.log('Login failed for user:', org1.owner.email);
          console.log('Current URL:', pageUrl);
          console.log('Error message:', errorText);
          
          // Check if form was submitted as GET (hydration issue)
          if (pageUrl.includes('email=') && pageUrl.includes('password=')) {
            console.log('Form submitted as GET - React hydration issue detected');
          }
          
          // Take a screenshot for debugging
          await page1.screenshot({ path: `test-results/login-failure-${Date.now()}.png` });
          
          throw new Error(`Login failed. Still on: ${pageUrl}. Error: ${errorText || 'No error message found'}`);
        }
      }

      // Navigate to users page
      await page1.goto('/users');
      await page1.waitForLoadState('networkidle');

      // Should see org1 owner
      await expect(page1.locator(`text=${org1.owner.email}`)).toBeVisible();
      
      // Should NOT see org2 owner
      await expect(page1.locator(`text=${org2.owner.email}`)).not.toBeVisible();

      // Check that we only see users from this organization
      // Count the rows in the users table (excluding header)
      const userRows = await page1.locator('table tbody tr').count();
      expect(userRows).toBe(1); // Only the owner
    } finally {
      await context1.close();
    }

    // Test with Organization 2 user
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    try {
      // Login as org2 owner with retry for connection issues
      await navigateWithRetry(page2, '/login');
      
      // Wait for network to settle (ensures JavaScript is loaded)
      await page2.waitForLoadState('networkidle');
      
      // Wait for form to be ready and interactive
      const emailInput = page2.locator('input[type="email"]');
      const passwordInput = page2.locator('input[type="password"]');
      const signInButton = page2.locator('button:has-text("Sign In")');
      
      // Ensure form elements are visible and enabled
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(signInButton).toBeVisible();
      
      // Fill form fields
      await emailInput.fill(org2.owner.email);
      await passwordInput.fill(org2.owner.password);
      
      // Try to submit the form - use keyboard as it's more reliable
      await passwordInput.press('Enter');
      
      // Wait for navigation with better error handling
      try {
        await page2.waitForURL(/.*dashboard/, { timeout: 10000 });
      } catch (error) {
        // If navigation fails, try clicking the button as fallback
        await signInButton.click();
        
        try {
          await page2.waitForURL(/.*dashboard/, { timeout: 5000 });
        } catch (retryError) {
          // If still fails, check what's on the page
          const pageUrl = page2.url();
          
          // Check for any error messages
          const errorText = await page2.locator('[role="alert"], .error, .text-red-500, .text-destructive').textContent().catch(() => null);
          
          console.log('Login failed for user:', org2.owner.email);
          console.log('Current URL:', pageUrl);
          console.log('Error message:', errorText);
          
          // Check if form was submitted as GET (hydration issue)
          if (pageUrl.includes('email=') && pageUrl.includes('password=')) {
            console.log('Form submitted as GET - React hydration issue detected');
          }
          
          // Take a screenshot for debugging
          await page2.screenshot({ path: `test-results/login-failure-${Date.now()}.png` });
          
          throw new Error(`Login failed. Still on: ${pageUrl}. Error: ${errorText || 'No error message found'}`);
        }
      }

      // Navigate to users page
      await page2.goto('/users');
      await page2.waitForLoadState('networkidle');

      // Should see org2 owner
      await expect(page2.locator(`text=${org2.owner.email}`)).toBeVisible();
      
      // Should NOT see org1 owner
      await expect(page2.locator(`text=${org1.owner.email}`)).not.toBeVisible();
    } finally {
      await context2.close();
    }
  });

  test('items/products page should only show organization items', async ({ browser }) => {
    // Test with Organization 1 user
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as org1 owner
      await loginWithPage(page, org1.owner.email, org1.owner.password);

      // Navigate to products page (items are displayed as products)
      await page.goto('/products');
      await page.waitForLoadState('networkidle');
      
      // Wait for the table to be visible
      await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
      
      // Add a small delay to ensure data is loaded
      await page.waitForTimeout(1000);

      // Should see org1 item (use contains for flexible matching)
      await expect(page.getByText(org1Data.item.name, { exact: false })).toBeVisible();
      await expect(page.getByText(org1Data.item.sku, { exact: false })).toBeVisible();
      
      // Should NOT see org2 item
      await expect(page.getByText(org2Data.item.name, { exact: false })).not.toBeVisible();
      await expect(page.getByText(org2Data.item.sku, { exact: false })).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('customers page should only show organization customers', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as org1 owner
      await loginWithPage(page, org1.owner.email, org1.owner.password);

      // Navigate to customers page
      await page.goto('/customers');
      await page.waitForLoadState('networkidle');
      
      // Wait for the customers table/list to be visible
      await page.waitForSelector('table, [role="table"], .customers-list', { state: 'visible', timeout: 10000 });
      
      // Add a small delay to ensure data is loaded
      await page.waitForTimeout(1000);

      // Should see org1 customer (use contains for flexible matching)
      await expect(page.getByText(org1Data.customer.companyName, { exact: false })).toBeVisible();
      
      // Should NOT see org2 customer
      await expect(page.getByText(org2Data.customer.companyName, { exact: false })).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('suppliers page should only show organization suppliers', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as org2 owner
      await loginWithPage(page, org2.owner.email, org2.owner.password);

      // Navigate to suppliers page
      await page.goto('/suppliers');
      await page.waitForLoadState('networkidle');
      
      // Wait for the suppliers table/list to be visible
      await page.waitForSelector('table, [role="table"], .suppliers-list', { state: 'visible', timeout: 10000 });
      
      // Add a small delay to ensure data is loaded
      await page.waitForTimeout(1000);

      // Should see org2 supplier (use contains for flexible matching)
      await expect(page.getByText(org2Data.supplier.name, { exact: false })).toBeVisible();
      
      // Should NOT see org1 supplier
      await expect(page.getByText(org1Data.supplier.name, { exact: false })).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('direct API calls should respect organization context', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as org1 owner
      await loginWithPage(page, org1.owner.email, org1.owner.password);

      // Make direct API call to list items (use GET for query procedures)
      const response = await page.evaluate(async () => {
        const params = new URLSearchParams({
          input: JSON.stringify({ json: { page: 1, limit: 50 } })
        });
        const res = await fetch(`/api/trpc/items.list?${params}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        return res.json();
      });

      // Verify only org1 items are returned
      // Check if response has the expected structure
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('data');
      
      const items = response.result?.data?.json?.items || response.result?.data?.items || [];
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe(org1Data.item.name);
      expect(items[0].organizationId).toBe(org1.organization.id);
    } finally {
      await context.close();
    }
  });

  test('should prevent access to other organization data via direct IDs', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as org1 owner
      await loginWithPage(page, org1.owner.email, org1.owner.password);

      // Try to access org2's item directly via API
      const response = await page.evaluate(async (itemId) => {
        const res = await fetch('/api/trpc/items.getById', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            json: { id: itemId }
          }),
        });
        return { status: res.status, data: await res.json() };
      }, org2Data.item.id);

      // Should get an error or not found
      expect(response.status).not.toBe(200);
      expect(response.data.error).toBeDefined();
    } finally {
      await context.close();
    }
  });

  test('dashboard should show organization-specific metrics', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as org1 owner
      await loginWithPage(page, org1.owner.email, org1.owner.password);

      // Check dashboard shows correct organization name
      await expect(page.locator(`text=${org1.organization.name}`)).toBeVisible();
      
      // Dashboard should show organization-specific data
      // Look for the stats cards that show counts
      await page.waitForLoadState('networkidle');
      
      // Verify we're in the right organization context
      const orgName = await page.locator('text=' + org1.organization.name).isVisible();
      expect(orgName).toBe(true)
    } finally {
      await context.close();
    }
  });

  test('navigation should not leak organization data', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login as org1 owner
      await loginWithPage(page, org1.owner.email, org1.owner.password);

      // Navigate through multiple pages
      const pagesToCheck = ['/products', '/customers', '/suppliers', '/orders', '/inventory'];
      
      for (const pageUrl of pagesToCheck) {
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');
        
        // Should never see org2's organization name on any page
        await expect(page.locator(`text=${org2.organization.name}`)).not.toBeVisible();
      }
    } finally {
      await context.close();
    }
  });
});