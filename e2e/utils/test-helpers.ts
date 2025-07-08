import { prisma } from '@ventry/database';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

/**
 * E2E Test Helpers
 * 
 * Provides utilities for creating and managing test data in E2E tests.
 * All test emails use the `.e2e.test` suffix for easy identification and cleanup.
 */

// Generate unique test identifier
export function generateTestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Generate unique test email
export function generateTestEmail(prefix: string = 'user'): string {
  const testId = generateTestId();
  return `${prefix}-${testId}@ventry.e2e.test`;
}

// Test user creation
export interface TestUserData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export async function createTestUser(overrides: Partial<TestUserData> = {}): Promise<TestUserData & { id: string }> {
  const testId = generateTestId();
  const userData: TestUserData = {
    email: generateTestEmail('user'),
    username: `testuser-${testId}`,
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    ...overrides,
  };

  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const user = await prisma.user.create({
    data: {
      email: userData.email,
      username: userData.username,
      password: hashedPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
    },
  });

  return {
    id: user.id,
    ...userData,
  };
}

// Create test users with different roles
export async function createTestUsers() {
  const testId = generateTestId();
  
  const admin = await createTestUser({
    email: generateTestEmail('admin'),
    username: `admin-${testId}`,
    role: 'ADMIN',
    firstName: 'Admin',
    lastName: 'Test',
  });

  const manager = await createTestUser({
    email: generateTestEmail('manager'),
    username: `manager-${testId}`,
    role: 'MANAGER',
    firstName: 'Manager',
    lastName: 'Test',
  });

  const user = await createTestUser({
    email: generateTestEmail('user'),
    username: `user-${testId}`,
    role: 'USER',
    firstName: 'User',
    lastName: 'Test',
  });

  return { admin, manager, user };
}

// Test product creation
export async function createTestProduct(userId: string, overrides: any = {}) {
  const testId = generateTestId();
  
  // Ensure we have a test category
  const category = await prisma.category.upsert({
    where: { name: 'E2E Test Category' },
    update: {},
    create: {
      name: 'E2E Test Category',
      description: 'Category for E2E tests',
    },
  });

  const product = await prisma.product.create({
    data: {
      sku: `TEST-${testId}`,
      name: `Test Product ${testId}`,
      description: 'Product created for E2E testing',
      categoryId: category.id,
      unitPrice: 99.99,
      cost: 50.00,
      createdById: userId,
      updatedById: userId,
      ...overrides,
    },
  });

  return product;
}

// Test inventory creation
export async function createTestInventory(productId: string, locationId: string, quantity: number = 100) {
  const inventory = await prisma.inventoryItem.create({
    data: {
      productId,
      locationId,
      quantity,
      reorderPoint: 10,
      maxStock: 200,
    },
  });

  return inventory;
}

// Get or create test location
export async function getTestLocation() {
  const location = await prisma.location.upsert({
    where: { name: 'E2E Test Location' },
    update: {},
    create: {
      name: 'E2E Test Location',
      description: 'Location for E2E tests',
      address: '123 Test Street, E2E City',
    },
  });

  return location;
}

// Login helper - returns access token
export async function loginUser(email: string, password: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060/api';
  
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Wait for element with retry
export async function waitForElement(page: any, selector: string, options: any = {}) {
  const defaultOptions = {
    state: 'visible',
    timeout: 30000,
    ...options,
  };

  return page.waitForSelector(selector, defaultOptions);
}

// Clear all browser storage
export async function clearBrowserStorage(page: any) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Clear all cookies
  const context = page.context();
  await context.clearCookies();
}

// Take screenshot on failure
export async function screenshotOnFailure(page: any, testName: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `e2e/screenshots/${testName}-${timestamp}.png`,
    fullPage: true,
  });
}