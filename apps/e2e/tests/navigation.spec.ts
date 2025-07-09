import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@ventry.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test.skip('should navigate between main sections', async ({ page }) => {
    // SKIP: These pages don't exist yet (inventory, products, categories, etc.)
    // TODO: Re-enable this test when all pages are implemented
    
    // Navigate to Inventory
    await page.getByRole('link', { name: 'Inventory', exact: true }).click();
    await expect(page).toHaveURL(/.*inventory/);
    
    // Navigate to Products  
    await page.getByRole('link', { name: 'Products', exact: true }).click();
    await expect(page).toHaveURL(/.*products/);
    
    // Navigate to Categories
    await page.getByRole('link', { name: 'Categories', exact: true }).click();
    await expect(page).toHaveURL(/.*categories/);
    
    // Navigate to Locations
    await page.getByRole('link', { name: 'Locations', exact: true }).click();
    await expect(page).toHaveURL(/.*locations/);
    
    // Navigate to Movements
    await page.getByRole('link', { name: 'Movements', exact: true }).click();
    await expect(page).toHaveURL(/.*movements/);
    
    // Navigate to Reports
    await page.getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(page).toHaveURL(/.*reports/);
    
    // Navigate to Users
    await page.getByRole('link', { name: 'Users', exact: true }).click();
    await expect(page).toHaveURL(/.*users/);
    
    // Navigate back to Dashboard
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test.skip('should highlight active navigation item', async ({ page }) => {
    // SKIP: The inventory page doesn't exist yet
    // TODO: Re-enable this test when the inventory page is implemented
    
    // Check that dashboard is active by default
    const dashboardLink = page.locator('a[href="/dashboard"]');
    await expect(dashboardLink).toHaveClass(/bg-blue-100/);
    
    // Navigate to inventory and check it becomes active
    await page.getByRole('link', { name: 'Inventory', exact: true }).click();
    const inventoryLink = page.locator('a[href="/inventory"]');
    await expect(inventoryLink).toHaveClass(/bg-blue-100/);
  });

  test('should show/hide sidebar on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Sidebar should be hidden on mobile by default
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveClass(/-translate-x-full/);
    
    // Click menu button to open sidebar
    await page.click('button[aria-label="Menu"]', { force: true });
    await expect(sidebar).toHaveClass(/translate-x-0/);
    
    // Click overlay to close sidebar
    await page.click('.bg-black.bg-opacity-50');
    await expect(sidebar).toHaveClass(/-translate-x-full/);
  });

  test('should collapse/expand sidebar on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    
    // Sidebar should be expanded by default
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveClass(/w-64/);
    
    // Click collapse button
    await page.click('button svg.lucide-chevron-left');
    await expect(sidebar).toHaveClass(/w-16/);
    
    // Click expand button
    await page.click('button svg.lucide-chevron-right');
    await expect(sidebar).toHaveClass(/w-64/);
  });

  test('should maintain responsive header', async ({ page }) => {
    // Check header elements are visible
    await expect(page.locator('text=Ventry')).toBeVisible();
    await expect(page.locator('text=Admin User')).toBeVisible();
    await expect(page.locator('text=Sign Out')).toBeVisible();
    
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Header should still be visible
    await expect(page.locator('text=Ventry')).toBeVisible();
    await expect(page.locator('text=Admin User')).toBeVisible();
    
    // Menu button should be visible on mobile
    await expect(page.locator('button svg.lucide-menu')).toBeVisible();
  });
});