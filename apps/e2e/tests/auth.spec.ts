import { test, expect } from '../fixtures/base.fixture';
import { createTestUser, clearAuthState } from '../utils/test-helpers';
import { cleanupTestDataForUser } from '../utils/db-cleanup';

test.describe('Authentication', () => {
  test.beforeEach(async ({ cleanPage }) => {
    await cleanPage.goto('/login');
  });

  test('should display login form', async ({ cleanPage: page }) => {
    await expect(page).toHaveTitle(/Ventry/);
    await expect(page.locator('h2')).toContainText('Welcome to Ventry');
    await expect(page.locator('text=AI-native inventory management system')).toBeVisible();
    
    // Check form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check demo accounts info
    await expect(page.locator('text=Demo accounts:')).toBeVisible();
    await expect(page.locator('text=admin@ventry.com')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ cleanPage: page }) => {
    await page.click('button:has-text("Sign In")');
    
    // Check for validation errors
    await expect(page.locator('text=Invalid email address')).toBeVisible();
    await expect(page.locator('text=Password must be at least 6 characters')).toBeVisible();
  });

  test('should show validation error for invalid email', async ({ cleanPage: page }) => {
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    
    await expect(page.locator('text=Invalid email address')).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ cleanPage: page }) => {
    // Create a test user for this specific test
    const testUser = await createTestUser({
      email: `login-success-${Date.now()}@ventry.e2e.test`,
      username: `logintest-${Date.now()}`,
      password: 'TestPassword123!',
    });

    try {
      // Login with the test user
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      
      await page.click('button:has-text("Sign In")');
      
      // Wait for navigation or error
      await page.waitForTimeout(2000);
      
      // Check if there's an error message
      const errorElement = page.locator('.text-red-600');
      if (await errorElement.count() > 0) {
        const errorText = await errorElement.first().innerText();
        throw new Error(`Login failed with error: ${errorText}`);
      }
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
      await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();
      
      // Verify user info is displayed
      await expect(page.locator(`text=${testUser.firstName} ${testUser.lastName}`)).toBeVisible();
    } finally {
      // Cleanup test user
      await cleanupTestDataForUser(testUser.id);
    }
  });

  test('should show error for invalid credentials', async ({ cleanPage: page }) => {
    // Create a test user for this specific test
    const testUser = await createTestUser({
      email: `login-fail-${Date.now()}@ventry.e2e.test`,
      username: `failtest-${Date.now()}`,
      password: 'CorrectPassword123!',
    });

    try {
      // Try to login with wrong password
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', 'WrongPassword123!');
      
      // Click sign in and wait for tRPC response
      await page.click('button:has-text("Sign In")');
      
      // Wait for error message to appear
      await page.waitForLoadState('networkidle');
      
      // Should show error message
      await expect(page.locator('.text-red-600').first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.text-red-600').first()).toContainText(/Invalid credentials|Invalid email or password|Login failed/);
      
      // Should stay on login page
      await expect(page).toHaveURL(/.*login/);
    } finally {
      // Cleanup test user
      await cleanupTestDataForUser(testUser.id);
    }
  });

  test('should redirect to login when accessing protected routes', async ({ cleanPage: page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h2')).toContainText('Welcome to Ventry');
  });

  test('should clear error messages on new input', async ({ cleanPage: page }) => {
    // First trigger validation errors
    await page.click('button:has-text("Sign In")');
    
    // Verify errors are shown
    await expect(page.locator('text=Invalid email address')).toBeVisible();
    
    // Type valid email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Error should be cleared
    await expect(page.locator('text=Invalid email address')).not.toBeVisible();
  });

  test('should handle logout correctly', async ({ browser }) => {
    // Create a test user and authenticated context
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const testUser = await createTestUser({
      email: `logout-test-${Date.now()}@ventry.e2e.test`,
      username: `logouttest-${Date.now()}`,
      password: 'TestPassword123!',
    });

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // Wait for dashboard
      await expect(page).toHaveURL(/.*dashboard/);
      
      // Click logout
      await page.click('text=Sign Out');
      
      // Should redirect to login page
      await expect(page).toHaveURL(/.*login/);
      
      // Try to access dashboard again
      await page.goto('/dashboard');
      
      // Should redirect back to login
      await expect(page).toHaveURL(/.*login/);
    } finally {
      // Cleanup
      await clearAuthState(page);
      await context.close();
      await cleanupTestDataForUser(testUser.id);
    }
  });

  test('should persist login across page refreshes', async ({ browser }) => {
    // Create a test user and authenticated context
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const testUser = await createTestUser({
      email: `persist-test-${Date.now()}@ventry.e2e.test`,
      username: `persisttest-${Date.now()}`,
      password: 'TestPassword123!',
    });

    try {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // Wait for dashboard
      await expect(page).toHaveURL(/.*dashboard/);
      
      // Refresh the page
      await page.reload();
      
      // Should still be on dashboard
      await expect(page).toHaveURL(/.*dashboard/);
      await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible();
    } finally {
      // Cleanup
      await clearAuthState(page);
      await context.close();
      await cleanupTestDataForUser(testUser.id);
    }
  });
});