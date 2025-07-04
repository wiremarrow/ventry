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
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('text=Overview of your inventory management system')).toBeVisible();
    
    // Check for stats cards
    await expect(page.locator('text=Total Products')).toBeVisible();
    await expect(page.locator('text=Total Locations')).toBeVisible();
    await expect(page.locator('text=Inventory Items')).toBeVisible();
    await expect(page.locator('text=Total Quantity')).toBeVisible();
    await expect(page.locator('text=Low Stock Items')).toBeVisible();
    await expect(page.locator('text=Recent Movements')).toBeVisible();
  });

  test('should display sidebar navigation', async ({ page }) => {
    // Check sidebar navigation items
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Inventory')).toBeVisible();
    await expect(page.locator('text=Products')).toBeVisible();
    await expect(page.locator('text=Categories')).toBeVisible();
    await expect(page.locator('text=Locations')).toBeVisible();
    await expect(page.locator('text=Movements')).toBeVisible();
    await expect(page.locator('text=Reports')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();
  });

  test('should display user info in header', async ({ page }) => {
    // Check header contains user information
    await expect(page.locator('text=Admin User')).toBeVisible();
    await expect(page.locator('text=ADMIN')).toBeVisible();
    await expect(page.locator('text=Sign Out')).toBeVisible();
  });

  test('should display quick actions section', async ({ page }) => {
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=View Inventory')).toBeVisible();
    await expect(page.locator('text=Manage Products')).toBeVisible();
    await expect(page.locator('text=Recent Movements')).toBeVisible();
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
    await expect(page.locator('h2')).toContainText('Sign In to Ventry');
  });

  test('should navigate to inventory page from quick actions', async ({ page }) => {
    await page.click('text=View Inventory');
    await expect(page).toHaveURL(/.*inventory/);
  });

  test('should navigate to products page from quick actions', async ({ page }) => {
    await page.click('text=Manage Products');
    await expect(page).toHaveURL(/.*products/);
  });

  test('should navigate to movements page from quick actions', async ({ page }) => {
    await page.click('text=Recent Movements');
    await expect(page).toHaveURL(/.*movements/);
  });
});