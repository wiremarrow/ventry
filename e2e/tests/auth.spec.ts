import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page).toHaveTitle(/Ventry/);
    await expect(page.locator('h2')).toContainText('Welcome to Ventry');
    
    // Check form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check demo accounts info
    await expect(page.locator('text=Demo accounts:')).toBeVisible();
    await expect(page.locator('text=admin@ventry.com')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.click('button:has-text("Sign In")');
    
    // Check for validation errors
    await expect(page.locator('text=Invalid email address')).toBeVisible();
    await expect(page.locator('text=Password must be at least 6 characters')).toBeVisible();
  });

  test('should show validation error for invalid email', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    
    await expect(page.locator('text=Invalid email address')).toBeVisible();
  });

  test('should successfully login with admin credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@ventry.com');
    await page.fill('input[type="password"]', 'admin123');
    
    await page.click('button:has-text("Sign In")');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Capture console logs for debugging
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      }
    });

    await page.fill('input[type="email"]', 'admin@ventry.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Use Promise.all to start waiting for API response before clicking
    const [loginResponse] = await Promise.all([
      page.waitForResponse(response => 
        response.url().includes('/api/auth/login') && 
        response.status() === 401
      ),
      page.click('button:has-text("Sign In")')
    ]);
    
    // Verify the API response
    expect(loginResponse.status()).toBe(401);
    console.log('Login API returned 401 as expected');
    
    // Wait for any potential page reload/navigation to complete
    await page.waitForLoadState('networkidle');
    
    // Check localStorage status first
    const localStorageError = await page.evaluate(() => {
      return window.localStorage.getItem('login_error');
    });
    console.log('LocalStorage error after login attempt:', localStorageError);
    
    // Wait for error to be displayed (either from state or localStorage restoration)
    await expect(page.locator('.text-red-600').first()).toBeVisible({ timeout: 15000 });
    
    // Log what error text we actually see
    const errorText = await page.locator('.text-red-600').first().textContent();
    console.log('Actual error text displayed:', errorText);
    
    // Print console logs for debugging
    console.log('Console messages:', consoleMessages);
    
    // Should show error message - use auto-retrying assertion
    await expect(page.locator('.text-red-600').first()).toBeVisible();
    await expect(page.locator('.text-red-600').first()).toContainText(/Invalid credentials|Invalid email or password|Login failed/);
    
    // Should stay on login page
    await expect(page).toHaveURL(/.*login/);
  });
});