import { expect } from '@playwright/test';
import { prisma, Role } from '@ventry/database';
import bcrypt from 'bcryptjs';
import { seedTestInventory } from './seed-inventory.js';

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

export async function createTestUser(
  overrides: Partial<TestUserData> = {}
): Promise<TestUserData & { id: string }> {
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

// Create test organization with owner
export async function createTestOrganization(ownerData?: Partial<TestUserData>) {
  const testId = generateTestId();

  // Create owner user
  const owner = await createTestUser({
    email: generateTestEmail('owner'),
    username: `owner-${testId}`,
    role: 'USER', // System role
    firstName: 'Owner',
    lastName: 'Test',
    ...ownerData,
  });

  // Create organization
  const organization = await prisma.organization.create({
    data: {
      name: `Test Org ${testId}`,
      slug: `test-org-${testId}`,
      members: {
        create: {
          userId: owner.id,
          role: 'OWNER',
        },
      },
    },
  });

  return {
    organization,
    owner,
  };
}

// Create user with multiple organization memberships
export async function createMultiOrgTestUser(orgCount: number = 2) {
  const testId = generateTestId();

  // Create user
  const user = await createTestUser({
    email: generateTestEmail('multiorg'),
    username: `multiorg-${testId}`,
    role: 'USER',
    firstName: 'MultiOrg',
    lastName: 'User',
  });

  // Create organizations and add user as member
  const organizations = [];
  for (let i = 0; i < orgCount; i++) {
    const org = await prisma.organization.create({
      data: {
        name: `Org ${i + 1} ${testId}`,
        slug: `org-${i + 1}-${testId}`,
        members: {
          create: {
            userId: user.id,
            role: i === 0 ? 'ADMIN' : 'MEMBER', // Admin in first org, member in others
          },
        },
      },
    });
    organizations.push(org);
  }

  return {
    user,
    organizations,
  };
}

// Add user to organization
export async function addUserToOrganization(
  userId: string,
  organizationId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER'
) {
  const membership = await prisma.organizationMember.create({
    data: {
      userId,
      organizationId,
      role,
    },
  });

  return membership;
}

// Test product creation
export async function createTestProduct(overrides: Record<string, any> = {}): Promise<any> {
  const testId = generateTestId();

  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error('No organization found for testing');
  }

  // Ensure we have a test category
  let category = await prisma.itemCategory.findFirst({
    where: {
      organizationId: organization.id,
      name: 'E2E Test Category',
    },
  });

  if (!category) {
    category = await prisma.itemCategory.create({
      data: {
        name: 'E2E Test Category',
        description: 'Category for E2E tests',
        organizationId: organization.id,
      },
    });
  }

  // Get or create unit of measure
  let uom = await prisma.unitOfMeasure.findFirst({
    where: { organizationId: organization.id },
  });
  if (!uom) {
    uom = await prisma.unitOfMeasure.create({
      data: {
        code: 'EA',
        description: 'Each',
        isBase: true,
        conversionFactorToBase: 1,
        organizationId: organization.id,
      },
    });
  }

  const product = await prisma.item.create({
    data: {
      sku: `TEST-${testId}`,
      name: `Test Product ${testId}`,
      description: 'Product created for E2E testing',
      categoryId: category.id,
      uomId: uom.id,
      defaultPrice: 99.99,
      defaultCost: 50.0,
      organizationId: organization.id,
      ...overrides,
    },
  });

  return product;
}

// Test inventory creation
export async function createTestInventory(
  itemId: string,
  locationId: string,
  quantity: number = 100
) {
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error('No organization found for testing');
  }

  const inventory = await prisma.inventory.create({
    data: {
      itemId,
      locationId,
      qtyOnHand: quantity,
      qtyReserved: 0,
      organizationId: organization.id,
    },
  });

  return inventory;
}

// Get or create test location
export async function getTestLocation() {
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error('No organization found for testing');
  }

  // First get or create a warehouse
  let warehouse = await prisma.warehouse.findFirst({
    where: { organizationId: organization.id },
  });

  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        code: 'E2E-WH',
        name: 'E2E Test Warehouse',
        organizationId: organization.id,
        line1: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'US',
      },
    });
  }

  let location = await prisma.location.findFirst({
    where: { code: 'E2E-LOC' },
  });

  if (!location) {
    location = await prisma.location.create({
      data: {
        code: 'E2E-LOC',
        description: 'E2E Test Location',
        organizationId: organization.id,
        warehouseId: warehouse.id,
      },
    });
  }

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
      json: { email, password },
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  const data = (await response.json()) as { result: { data: { json: { success: boolean } } } };
  return data.result.data.json.success;
}

// Login helper for Playwright pages with hydration handling
export async function loginWithPage(page: any, email: string, password: string) {
  // Navigate to login page
  await navigateWithRetry(page, '/login');

  // Wait for network to settle (ensures JavaScript is loaded)
  await page.waitForLoadState('networkidle');

  // Get form elements using locators
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const signInButton = page.locator('button:has-text("Sign In")');

  // Ensure form elements are visible and enabled
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(signInButton).toBeVisible();

  // Fill form fields
  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Try to submit the form - use keyboard as it's more reliable
  await passwordInput.press('Enter');

  // Wait for navigation with retry logic
  try {
    await page.waitForURL(/.*dashboard/, { timeout: 10000 });
  } catch (error) {
    // If navigation fails, try clicking the button as fallback
    await signInButton.click();

    try {
      await page.waitForURL(/.*dashboard/, { timeout: 5000 });
    } catch (retryError) {
      // If still fails, check what's on the page
      const pageUrl = page.url();

      // Check for any error messages
      const errorText = await page
        .locator('[role="alert"], .error, .text-red-500, .text-destructive')
        .textContent()
        .catch(() => null);

      // Check if form was submitted as GET (hydration issue)
      if (pageUrl.includes('email=') && pageUrl.includes('password=')) {
        throw new Error('Form submitted as GET - React hydration issue detected. URL: ' + pageUrl);
      }

      throw new Error(
        `Login failed. Still on: ${pageUrl}. Error: ${errorText || 'No error message found'}`
      );
    }
  }
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

// Navigate with retry for connection errors
export async function navigateWithRetry(page: any, url: string, maxRetries: number = 3) {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      return; // Success
    } catch (error: any) {
      lastError = error;

      // Only retry on connection errors
      if (
        error.message?.includes('ERR_SOCKET_NOT_CONNECTED') ||
        error.message?.includes('ERR_CONNECTION_REFUSED') ||
        error.message?.includes('ERR_CONNECTION_RESET')
      ) {
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await page.waitForTimeout(1000 * attempt);
          continue;
        }
      }

      // For other errors or final attempt, throw immediately
      throw error;
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error('Navigation failed after retries');
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

// Switch organization context
export async function switchOrganization(page: any, organizationId: string) {
  // Click on organization switcher
  await page.click('[data-testid="org-switcher"]');

  // Click on the organization option
  await page.click(`[data-org-id="${organizationId}"]`);

  // Wait for page to reload/update
  await page.waitForLoadState('networkidle');
}

// Verify data isolation between organizations
export async function verifyOrganizationIsolation(
  page: any,
  expectedOrgName: string,
  unexpectedOrgName: string
) {
  // Should see expected org name
  await expect(page.locator('text=' + expectedOrgName)).toBeVisible();

  // Should NOT see other org name
  await expect(page.locator('text=' + unexpectedOrgName)).not.toBeVisible();
}

// Create test data for organization
export async function createOrgTestData(organizationId: string) {
  // Create category
  const category = await prisma.itemCategory.create({
    data: {
      name: `Test Category ${generateTestId()}`,
      description: 'E2E Test Category',
      organizationId,
    },
  });

  // Create unit of measure
  const unitOfMeasure = await prisma.unitOfMeasure.create({
    data: {
      code: `UOM-${generateTestId()}`,
      description: 'E2E Test Unit',
      organizationId,
      isBase: true,
    },
  });

  // Create items
  const item = await prisma.item.create({
    data: {
      name: `Test Item ${generateTestId()}`,
      sku: `SKU-${generateTestId()}`,
      description: 'E2E Test Item',
      categoryId: category.id,
      uomId: unitOfMeasure.id,
      organizationId,
      defaultCost: 50.0,
      defaultPrice: 99.99,
      isActive: true,
      reorderPoint: 10,
      reorderQty: 50,
    },
  });

  // Create customer
  const customer = await prisma.customer.create({
    data: {
      customerCode: `CUST-${generateTestId()}`,
      companyName: `Test Customer ${generateTestId()}`,
      email: generateTestEmail('customer'),
      phone: '555-0123',
      organizationId,
    },
  });

  // Create supplier
  const supplier = await prisma.supplier.create({
    data: {
      supplierCode: `SUPP-${generateTestId()}`,
      name: `Test Supplier ${generateTestId()}`,
      email: generateTestEmail('supplier'),
      phone: '555-0456',
      organizationId,
      leadTimeDays: 7,
      line1: '456 Supplier Ave',
      city: 'Supply City',
      state: 'SC',
      postalCode: '54321',
      country: 'USA',
    },
  });

  return {
    category,
    item,
    customer,
    supplier,
  };
}
