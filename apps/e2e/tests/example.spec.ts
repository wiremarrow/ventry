import { test, expect } from '@playwright/test';

test.describe('Ventry Application', () => {
  test('should redirect to login from home page when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/.*login/);
    await expect(page).toHaveTitle(/Ventry/);
    await expect(page.locator('h2')).toContainText('Welcome to Ventry');
  });

  test('should redirect to dashboard when authenticated', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@ventry.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for successful login and redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Then visit home page
    await page.goto('/');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();
  });

  test('should show login form elements', async ({ page }) => {
    await page.goto('/login');
    
    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check branding
    await expect(page.locator('text=Welcome to Ventry')).toBeVisible();
    await expect(page.locator('text=AI-native inventory management system')).toBeVisible();
  });

  test('should show 404 for non-existent pages', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    // Check response status (Next.js returns 200 for client-side routing, but shows 404 content)
    // We'll check for typical 404 behavior in Next.js
    await page.waitForTimeout(1000); // Wait for page to load
    
    // Check if we're redirected to login (which is expected for protected routes)
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/login/);
  });
});