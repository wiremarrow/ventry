import { Page } from '@playwright/test';

/**
 * Helper functions for authentication in E2E tests
 */

export async function authenticateUser(page: Page) {
  // Default to admin user for backwards compatibility
  await loginAsAdmin(page);
}

export async function loginAsAdmin(page: Page) {
  await login(page, 'admin@ventry.com', 'password123');
}

export async function loginAsManager(page: Page) {
  await login(page, 'manager@ventry.com', 'password123');
}

export async function loginAsUser(page: Page) {
  await login(page, 'user@ventry.com', 'password123');
}

async function login(page: Page, email: string, password: string) {
  // Navigate to login page
  await page.goto('/login');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Fill in login form
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);

  // Submit form
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for navigation to complete
  await page.waitForURL('**/dashboard', { timeout: 30000 });

  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
}

export async function logout(page: Page) {
  // Click on user menu
  await page.getByRole('button', { name: /Open user menu/i }).click();

  // Click logout
  await page.getByRole('menuitem', { name: 'Log out' }).click();

  // Wait for redirect to login page
  await page.waitForURL('**/login');
}
