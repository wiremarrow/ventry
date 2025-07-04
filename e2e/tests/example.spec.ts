import { test, expect } from '@playwright/test';

test.describe('Ventry Application', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    
    // Check if the page loads with expected content
    await expect(page).toHaveTitle(/Ventry/);
    
    // Verify main navigation exists
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    
    // Click on login link/button
    await page.click('text=Login');
    
    // Verify we're on the login page
    await expect(page).toHaveURL(/.*login/);
    
    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show 404 for non-existent pages', async ({ page }) => {
    const response = await page.goto('/non-existent-page');
    
    // Check response status
    expect(response?.status()).toBe(404);
    
    // Or check for 404 content
    await expect(page.locator('text=404')).toBeVisible();
  });
});