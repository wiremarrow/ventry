import { DatabaseService } from '../database/database.service';

/**
 * Test Data Factories for Integration Tests
 * 
 * These factories create test data programmatically, ensuring each test
 * is isolated and doesn't depend on external seeding or global state.
 * 
 * Usage:
 * ```typescript
 * const user = await createTestUser(prisma);
 * const category = await createTestCategory(prisma);
 * const product = await createTestProduct(prisma, { 
 *   categoryId: category.id, 
 *   createdById: user.id 
 * });
 * ```
 */

// Generate unique identifiers to avoid conflicts
const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Create a test user with unique email and username
 */
export const createTestUser = async (prisma: DatabaseService, overrides: any = {}) => {
  const uniqueId = generateUniqueId();
  
  const user = await prisma.user.create({
    data: {
      email: `test-user-${uniqueId}@example.com`,
      username: `testuser-${uniqueId}`,
      firstName: 'Test',
      lastName: 'User',
      password: 'hashedpassword123',
      role: 'USER',
      ...overrides,
    },
  });
  return user;
};

/**
 * Create a test admin user
 */
export const createTestAdmin = async (prisma: DatabaseService, overrides: any = {}) => {
  return createTestUser(prisma, {
    role: 'ADMIN',
    firstName: 'Test',
    lastName: 'Admin',
    ...overrides,
  });
};

/**
 * Create a test manager user
 */
export const createTestManager = async (prisma: DatabaseService, overrides: any = {}) => {
  return createTestUser(prisma, {
    role: 'MANAGER',
    firstName: 'Test',
    lastName: 'Manager',
    ...overrides,
  });
};

/**
 * Create a test category with unique name
 */
export const createTestCategory = async (prisma: DatabaseService, overrides: any = {}) => {
  const uniqueId = generateUniqueId();
  
  const category = await prisma.category.create({
    data: {
      name: `Test Category ${uniqueId}`,
      description: `Test category for integration testing`,
      ...overrides,
    },
  });
  return category;
};

/**
 * Create a test location with unique name
 */
export const createTestLocation = async (prisma: DatabaseService, overrides: any = {}) => {
  const uniqueId = generateUniqueId();
  
  return prisma.location.create({
    data: {
      name: `Test Location ${uniqueId}`,
      description: `Test location for integration testing`,
      address: `123 Test St, Test City, TC 12345`,
      ...overrides,
    },
  });
};

/**
 * Create a test product with required relationships
 */
export const createTestProduct = async (
  prisma: DatabaseService, 
  options: {
    categoryId: string;
    createdById: string;
    updatedById?: string;
  },
  overrides: any = {}
) => {
  const uniqueId = generateUniqueId();
  
  return prisma.product.create({
    data: {
      sku: `TEST-SKU-${uniqueId}`,
      name: `Test Product ${uniqueId}`,
      description: `Test product for integration testing`,
      categoryId: options.categoryId,
      unitPrice: 99.99,
      cost: 50.00,
      createdById: options.createdById,
      updatedById: options.updatedById || options.createdById,
      ...overrides,
    },
  });
};

/**
 * Create a test inventory item for a product at a location
 */
export const createTestInventoryItem = async (
  prisma: DatabaseService,
  options: {
    productId: string;
    locationId: string;
  },
  overrides: any = {}
) => {
  return prisma.inventoryItem.create({
    data: {
      productId: options.productId,
      locationId: options.locationId,
      quantity: 10,
      reorderPoint: 2,
      maxStock: 50,
      ...overrides,
    },
  });
};

/**
 * Create a complete test setup with user, category, location, and product
 * Useful for tests that need a full data context
 */
export const createTestDataContext = async (prisma: DatabaseService) => {
  const user = await createTestAdmin(prisma);
  const category = await createTestCategory(prisma);
  const location = await createTestLocation(prisma);
  const product = await createTestProduct(prisma, {
    categoryId: category.id,
    createdById: user.id,
  });

  return {
    user,
    category,
    location,
    product,
  };
};

/**
 * Clean up test data by deleting all records in dependency order
 * Use this sparingly - prefer transaction rollback for better performance
 */
export const cleanTestData = async (prisma: DatabaseService) => {
  try {
    // Delete in reverse dependency order
    await prisma.auditLog.deleteMany({});
    await prisma.inventoryMovement.deleteMany({});
    await prisma.inventoryItem.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.location.deleteMany({});
    await prisma.user.deleteMany({});
  } catch (error) {
    console.error('Test cleanup error:', error);
    throw error;
  }
};