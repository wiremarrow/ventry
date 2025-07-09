import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@ventry.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should display dashboard with stats cards', async ({ page }) => {
    // Wait for dashboard to fully load
    await page.waitForLoadState('networkidle');
    
    // Check dashboard title - use exact text match
    await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();
    await expect(page.locator('text=Overview of your inventory management system')).toBeVisible();
    
    // Wait for stats cards to load
    await page.waitForSelector('text=Total Products', { timeout: 10000 });
    
    // Check for stats cards
    await expect(page.locator('text=Total Products')).toBeVisible();
    await expect(page.locator('text=Total Locations')).toBeVisible();
    await expect(page.locator('text=Inventory Items')).toBeVisible();
    await expect(page.locator('text=Total Quantity')).toBeVisible();
    await expect(page.locator('text=Low Stock Items')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Movements' })).toBeVisible();
  });

  test('should display sidebar navigation', async ({ page }) => {
    // Check sidebar navigation items - use exact match to avoid matching quick action links
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inventory', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Products', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Categories', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Locations', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Movements', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reports', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toBeVisible();
  });

  test('should display user info in header', async ({ page }) => {
    // Check header contains user information
    await expect(page.locator('text=Admin User')).toBeVisible();
    await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();
    await expect(page.locator('text=Sign Out')).toBeVisible();
  });

  test('should display quick actions section', async ({ page }) => {
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=View Inventory')).toBeVisible();
    await expect(page.locator('text=Manage Products')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Recent Movements' })).toBeVisible();
  });

  test('should display system status section', async ({ page }) => {
    await expect(page.locator('text=System Status')).toBeVisible();
    await expect(page.locator('text=API Status')).toBeVisible();
    await expect(page.locator('text=Database')).toBeVisible();
    await expect(page.locator('text=Last Sync')).toBeVisible();
    
    // Check for online status indicators
    await expect(page.locator('text=Online')).toBeVisible();
    await expect(page.locator('text=Connected')).toBeVisible();
  });

  test('should handle logout', async ({ page }) => {
    await page.click('text=Sign Out');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h2')).toContainText('Welcome to Ventry');
  });

  test('should navigate to inventory page from quick actions', async ({ page }) => {
    await page.click('text=View Inventory');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*inventory/);
  });

  test('should navigate to products page from quick actions', async ({ page }) => {
    await page.click('text=Manage Products');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*products/);
  });

  test('should navigate to movements page from quick actions', async ({ page }) => {
    await page.getByRole('link', { name: 'Recent Movements' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*movements/);
  });
});