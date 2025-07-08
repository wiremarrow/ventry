import { prisma } from '@ventry/database';

/**
 * Database Cleanup Utilities for E2E Tests
 * 
 * Provides functions to clean up test data after E2E tests.
 * Only removes data with `.e2e.test` email suffix to preserve seed data.
 */

export async function cleanupTestUsers() {
  // Delete all users with test email pattern
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: {
        endsWith: '.e2e.test',
      },
    },
  });

  console.log(`Cleaned up ${deletedUsers.count} test users`);
  return deletedUsers.count;
}

export async function cleanupTestProducts() {
  // First, get all test products (created by test users)
  const testProducts = await prisma.product.findMany({
    where: {
      createdBy: {
        email: {
          endsWith: '.e2e.test',
        },
      },
    },
    select: {
      id: true,
    },
  });

  const productIds = testProducts.map(p => p.id);

  if (productIds.length > 0) {
    // Delete inventory movements for test products
    await prisma.inventoryMovement.deleteMany({
      where: {
        productId: {
          in: productIds,
        },
      },
    });

    // Delete inventory items for test products
    await prisma.inventoryItem.deleteMany({
      where: {
        productId: {
          in: productIds,
        },
      },
    });

    // Delete the products themselves
    const deletedProducts = await prisma.product.deleteMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });

    console.log(`Cleaned up ${deletedProducts.count} test products`);
    return deletedProducts.count;
  }

  return 0;
}

export async function cleanupTestCategories() {
  // Only delete the E2E test category
  const deleted = await prisma.category.deleteMany({
    where: {
      name: 'E2E Test Category',
    },
  });

  if (deleted.count > 0) {
    console.log(`Cleaned up ${deleted.count} test categories`);
  }
  
  return deleted.count;
}

export async function cleanupTestLocations() {
  // Only delete the E2E test location
  const deleted = await prisma.location.deleteMany({
    where: {
      name: 'E2E Test Location',
    },
  });

  if (deleted.count > 0) {
    console.log(`Cleaned up ${deleted.count} test locations`);
  }
  
  return deleted.count;
}

export async function cleanupAuditLogs() {
  // Clean up audit logs created by test users
  const deleted = await prisma.auditLog.deleteMany({
    where: {
      user: {
        email: {
          endsWith: '.e2e.test',
        },
      },
    },
  });

  if (deleted.count > 0) {
    console.log(`Cleaned up ${deleted.count} audit logs`);
  }
  
  return deleted.count;
}

export async function cleanupAllTestData() {
  console.log('Starting E2E test data cleanup...');
  
  try {
    // Order matters due to foreign key constraints
    await cleanupAuditLogs();
    await cleanupTestProducts(); // This also cleans inventory items and movements
    await cleanupTestCategories();
    await cleanupTestLocations();
    await cleanupTestUsers();
    
    console.log('E2E test data cleanup completed successfully');
  } catch (error) {
    console.error('Error during test data cleanup:', error);
    throw error;
  }
}

export async function cleanupTestDataForUser(userId: string) {
  // Clean up all data created by a specific test user
  try {
    // Delete inventory movements
    await prisma.inventoryMovement.deleteMany({
      where: {
        createdById: userId,
      },
    });

    // Get products created by user
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { createdById: userId },
          { updatedById: userId },
        ],
      },
      select: { id: true },
    });

    const productIds = products.map(p => p.id);

    if (productIds.length > 0) {
      // Delete inventory items for these products
      await prisma.inventoryItem.deleteMany({
        where: {
          productId: {
            in: productIds,
          },
        },
      });

      // Delete the products
      await prisma.product.deleteMany({
        where: {
          id: {
            in: productIds,
          },
        },
      });
    }

    // Delete audit logs
    await prisma.auditLog.deleteMany({
      where: {
        userId: userId,
      },
    });

    // Finally delete the user
    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    console.log(`Cleaned up all data for user ${userId}`);
  } catch (error) {
    console.error(`Error cleaning up data for user ${userId}:`, error);
    throw error;
  }
}

// Verify seed data exists (for global setup)
export async function verifySeedDataExists() {
  const requiredUsers = [
    'admin@ventry.com',
    'manager@ventry.com',
    'user@ventry.com',
  ];

  for (const email of requiredUsers) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error(`Required seed user ${email} not found. Please run 'pnpm db:seed'`);
    }
  }

  console.log('All required seed data verified');
}

// Get database statistics (useful for debugging)
export async function getDatabaseStats() {
  const [
    totalUsers,
    testUsers,
    totalProducts,
    testProducts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        email: {
          endsWith: '.e2e.test',
        },
      },
    }),
    prisma.product.count(),
    prisma.product.count({
      where: {
        createdBy: {
          email: {
            endsWith: '.e2e.test',
          },
        },
      },
    }),
  ]);

  return {
    totalUsers,
    testUsers,
    totalProducts,
    testProducts,
  };
}