import { prisma, Role } from '@ventry/database';
import bcrypt from 'bcryptjs';
import { seedTestInventory } from './seed-inventory';

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
  createOrganization?: boolean;
  seedInventory?: boolean;
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

  // Create organization if requested
  if (userData.createOrganization) {
    const org = await prisma.organization.create({
      data: {
        name: `Test Org ${testId}`,
        slug: `test-org-${testId}`,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });

    // Seed inventory data if requested
    if (userData.seedInventory) {
      await seedTestInventory(org.id);
    }
  }

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
export async function createTestProduct(userId: string, overrides: Record<string, any> = {}): Promise<any> {
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

// Login helper - authenticates user and returns success status
// Authentication token is automatically set as httpOnly cookie by backend
export async function loginUser(email: string, password: string): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060';
  
  const response = await fetch(`${baseUrl}/trpc/auth.login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important for receiving cookies
    body: JSON.stringify({ 
      json: { email, password }
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  const data = await response.json() as { result: { data: { json: { success: boolean } } } };
  return data.result.data.json.success;
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

// Clear authentication state (cookies only)
export async function clearAuthState(page: any) {
  // Clear cookies since auth is JWT-based via tRPC
  const context = page.context();
  await context.clearCookies();
}

// Clear all browser storage (for test cleanup only, not auth)
export async function clearBrowserStorage(page: any) {
  // Clear auth state first
  await clearAuthState(page);
  
  // Clear browser storage for test isolation (non-auth data)
  // Safely handle localStorage access
  try {
    await page.evaluate(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.clear();
        }
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.clear();
        }
      } catch (e) {
        // Ignore storage access errors
      }
    });
  } catch (error) {
    // Ignore page evaluation errors
  }
}

// Take screenshot on failure
export async function screenshotOnFailure(page: any, testName: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `e2e/screenshots/${testName}-${timestamp}.png`,
    fullPage: true,
  });
}