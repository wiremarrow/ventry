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

export async function cleanupTestItems() {
  // Delete test items based on SKU pattern
  const testItems = await prisma.item.findMany({
    where: {
      OR: [
        { sku: { startsWith: 'E2E-' } },
        { sku: { endsWith: '-E2E' } },
        { name: { contains: 'E2E Test' } },
      ],
    },
    select: {
      id: true,
    },
  });

  const itemIds = testItems.map(i => i.id);

  if (itemIds.length > 0) {
    // Delete stock movements for test items
    await prisma.stockMovement.deleteMany({
      where: {
        itemId: {
          in: itemIds,
        },
      },
    });

    // Delete inventory entries for test items
    await prisma.inventory.deleteMany({
      where: {
        itemId: {
          in: itemIds,
        },
      },
    });

    // Delete the items themselves
    const deletedItems = await prisma.item.deleteMany({
      where: {
        id: {
          in: itemIds,
        },
      },
    });

    console.log(`Cleaned up ${deletedItems.count} test items`);
    return deletedItems.count;
  }

  return 0;
}

export async function cleanupTestCategories() {
  // Only delete the E2E test category
  const deleted = await prisma.itemCategory.deleteMany({
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
      OR: [
        { code: 'E2E-LOC' },
        { code: { startsWith: 'E2E-' } },
        { description: { contains: 'E2E Test' } },
      ],
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
    await cleanupTestItems(); // This also cleans inventory entries and stock movements
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
    // We can't directly link items to users, so clean up based on test patterns
    const testItems = await prisma.item.findMany({
      where: {
        OR: [
          { sku: { startsWith: 'E2E-' } },
          { sku: { endsWith: '-E2E' } },
          { name: { contains: 'E2E Test' } },
        ],
      },
      select: { id: true },
    });

    const itemIds = testItems.map(i => i.id);

    if (itemIds.length > 0) {
      // Delete stock movements for test items
      await prisma.stockMovement.deleteMany({
        where: {
          itemId: {
            in: itemIds,
          },
        },
      });

      // Delete inventory entries for these items
      await prisma.inventory.deleteMany({
        where: {
          itemId: {
            in: itemIds,
          },
        },
      });

      // Delete the items
      await prisma.item.deleteMany({
        where: {
          id: {
            in: itemIds,
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
    totalItems,
    testItems,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        email: {
          endsWith: '.e2e.test',
        },
      },
    }),
    prisma.item.count(),
    prisma.item.count({
      where: {
        OR: [
          { sku: { startsWith: 'E2E-' } },
          { sku: { endsWith: '-E2E' } },
          { name: { contains: 'E2E Test' } },
        ],
      },
    }),
  ]);

  return {
    totalUsers,
    testUsers,
    totalItems,
    testItems,
  };
}

// Cleanup all data for a specific organization
export async function cleanupTestDataForOrganization(organizationId: string) {
  console.log(`🧹 Cleaning up data for organization: ${organizationId}`);
  
  try {
    // Delete in order of dependencies
    
    // Delete stock movements
    await prisma.stockMovement.deleteMany({
      where: { organizationId },
    });

    // Delete inventory
    await prisma.inventory.deleteMany({
      where: { organizationId },
    });

    // Delete order items
    await prisma.orderItem.deleteMany({
      where: { 
        order: { organizationId }
      },
    });

    // Delete orders
    await prisma.order.deleteMany({
      where: { organizationId },
    });

    // Delete purchase order items
    await prisma.purchaseOrderItem.deleteMany({
      where: {
        purchaseOrder: { organizationId }
      },
    });

    // Delete purchase orders
    await prisma.purchaseOrder.deleteMany({
      where: { organizationId },
    });

    // Delete shipment items
    await prisma.shipmentItem.deleteMany({
      where: {
        shipment: { organizationId }
      },
    });

    // Delete shipments
    await prisma.shipment.deleteMany({
      where: { organizationId },
    });

    // Delete receipt items
    await prisma.receiptItem.deleteMany({
      where: {
        receipt: { organizationId }
      },
    });

    // Delete receipts
    await prisma.receipt.deleteMany({
      where: { organizationId },
    });

    // Delete return items
    await prisma.returnItem.deleteMany({
      where: {
        return: { organizationId }
      },
    });

    // Delete returns
    await prisma.return.deleteMany({
      where: { organizationId },
    });

    // Delete customers
    await prisma.customer.deleteMany({
      where: { organizationId },
    });

    // Delete suppliers
    await prisma.supplier.deleteMany({
      where: { organizationId },
    });

    // Delete items
    await prisma.item.deleteMany({
      where: { organizationId },
    });

    // Delete item categories
    await prisma.itemCategory.deleteMany({
      where: { organizationId },
    });

    // Delete locations
    await prisma.location.deleteMany({
      where: { organizationId },
    });

    // Delete warehouses
    await prisma.warehouse.deleteMany({
      where: { organizationId },
    });

    // Delete organization members
    await prisma.organizationMember.deleteMany({
      where: { organizationId },
    });

    // Delete the organization itself
    await prisma.organization.delete({
      where: { id: organizationId },
    });

    console.log(`✅ Cleaned up organization: ${organizationId}`);
  } catch (error) {
    console.error(`❌ Error cleaning up organization ${organizationId}:`, error);
    throw error;
  }
}