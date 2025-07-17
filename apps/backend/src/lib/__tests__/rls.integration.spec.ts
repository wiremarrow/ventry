import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRLSProxy, withRLS, type RLSContext } from '../rls/index.js';
import { verifyRLSEnabled } from '../../test-utils/rls-test-helpers-minimal.js';
import { createTestConnections } from '../../test-utils/dual-connection.js';
import type { PrismaClient } from '@ventry/database';

// Test data - will be populated with DB-generated IDs
let org1Id: string;
let org2Id: string;
let user1Id: string;
let user2Id: string;
let categoryId: string;
let category2Id: string;
let uomId: string;
let uom2Id: string;

describe('Row-Level Security (RLS) Integration Tests', () => {
  let adminPrisma: PrismaClient;
  let appPrisma: PrismaClient;

  beforeAll(async () => {
    // Create dual connections
    const connections = createTestConnections();
    adminPrisma = connections.adminPrisma;
    appPrisma = connections.appPrisma;

    // Verify RLS is enabled (should be enabled by migrations)
    const rlsEnabled = await verifyRLSEnabled(adminPrisma, 'items');
    if (!rlsEnabled) {
      console.warn('RLS is not enabled on items table. Tests may not work correctly.');
    }
    
    // Clean up any existing test data
    await adminPrisma.item.deleteMany({
      where: {
        sku: {
          in: ['ORG1-ITEM1', 'ORG1-ITEM2', 'ORG2-ITEM1', 'ORG1-ITEM3'],
        },
      },
    });
    
    await adminPrisma.itemCategory.deleteMany({
      where: {
        name: {
          in: ['Test Category', 'Test Category 2'],
        },
      },
    });
    
    await adminPrisma.unitOfMeasure.deleteMany({
      where: {
        code: {
          in: ['PC', 'PC2'],
        },
      },
    });
    
    await adminPrisma.organizationMember.deleteMany({});
    await adminPrisma.user.deleteMany({
      where: {
        email: {
          in: ['rls-user1@test.com', 'rls-user2@test.com'],
        },
      },
    });
    await adminPrisma.organization.deleteMany({
      where: {
        slug: {
          in: ['test-org-1', 'test-org-2'],
        },
      },
    });
    
    // Create test organizations
    const org1 = await adminPrisma.organization.create({
      data: {
        name: 'Test Org 1',
        slug: 'test-org-1',
      },
    });
    org1Id = org1.id;
    
    const org2 = await adminPrisma.organization.create({
      data: {
        name: 'Test Org 2',
        slug: 'test-org-2',
      },
    });
    org2Id = org2.id;

    // Create test category and UOM (required for items)
    const category = await adminPrisma.itemCategory.create({
      data: {
        organizationId: org1Id,
        name: 'Test Category',
      },
    });
    categoryId = category.id;

    const uom = await adminPrisma.unitOfMeasure.create({
      data: {
        organizationId: org1Id,
        code: 'PC',
        description: 'Piece',
      },
    });
    uomId = uom.id;

    // Create test users
    const user1 = await adminPrisma.user.create({
      data: {
        email: 'rls-user1@test.com',
        username: 'rlsuser1',
        firstName: 'RLS',
        lastName: 'User1',
        password: 'hashed-password',
      },
    });
    user1Id = user1.id;
    
    const user2 = await adminPrisma.user.create({
      data: {
        email: 'rls-user2@test.com',
        username: 'rlsuser2',
        firstName: 'RLS',
        lastName: 'User2',
        password: 'hashed-password',
      },
    });
    user2Id = user2.id;

    // Create organization memberships
    await adminPrisma.organizationMember.create({
      data: {
        organizationId: org1Id,
        userId: user1Id,
        role: 'ADMIN',
      },
    });
    
    await adminPrisma.organizationMember.create({
      data: {
        organizationId: org2Id,
        userId: user2Id,
        role: 'ADMIN',
      },
    });

    // Create test items for each organization
    await adminPrisma.item.createMany({
      data: [
        {
          organizationId: org1Id,
          sku: 'ORG1-ITEM1',
          name: 'Org 1 Item 1',
          categoryId: categoryId,
          uomId: uomId,
        },
        {
          organizationId: org1Id,
          sku: 'ORG1-ITEM2',
          name: 'Org 1 Item 2',
          categoryId: categoryId,
          uomId: uomId,
        },
      ],
    });

    // Create category and UOM for org2
    const category2 = await adminPrisma.itemCategory.create({
      data: {
        organizationId: org2Id,
        name: 'Test Category 2',
      },
    });
    category2Id = category2.id;

    const uom2 = await adminPrisma.unitOfMeasure.create({
      data: {
        organizationId: org2Id,
        code: 'PC2',
        description: 'Piece 2',
      },
    });
    uom2Id = uom2.id;

    await adminPrisma.item.create({
      data: {
        organizationId: org2Id,
        sku: 'ORG2-ITEM1',
        name: 'Org 2 Item 1',
        categoryId: category2Id,
        uomId: uom2Id,
      },
    });

    // RLS should already be enabled by migrations
  });

  afterAll(async () => {
    // Clean up test data
    await adminPrisma.item.deleteMany({
      where: {
        sku: {
          in: ['ORG1-ITEM1', 'ORG1-ITEM2', 'ORG2-ITEM1', 'ORG1-ITEM3'],
        },
      },
    });
    
    await adminPrisma.itemCategory.deleteMany({
      where: {
        name: {
          in: ['Test Category', 'Test Category 2'],
        },
      },
    });
    
    await adminPrisma.unitOfMeasure.deleteMany({
      where: {
        code: {
          in: ['PC', 'PC2'],
        },
      },
    });
    
    await adminPrisma.organizationMember.deleteMany({});
    
    await adminPrisma.user.deleteMany({
      where: {
        email: {
          in: ['rls-user1@test.com', 'rls-user2@test.com'],
        },
      },
    });
    
    await adminPrisma.organization.deleteMany({
      where: {
        slug: {
          in: ['test-org-1', 'test-org-2'],
        },
      },
    });
    
    // Disconnect both connections
    await adminPrisma.$disconnect();
    await appPrisma.$disconnect();
  });

  beforeEach(async () => {
    // Session variables are reset per transaction automatically
  });

  describe('Direct RLS queries', () => {
    it('should only return items from the current organization', async () => {
      // Set context for org1
      const context: RLSContext = {
        userId: user1Id,
        organizationId: org1Id,
        bypassRLS: false,
      };

      const result = await withRLS(appPrisma, context, async (tx) => {
        return tx.item.findMany({
          orderBy: { sku: 'asc' },
        });
      });
      const items = result.data;

      expect(items).toHaveLength(2);
      expect(items[0].sku).toBe('ORG1-ITEM1');
      expect(items[1].sku).toBe('ORG1-ITEM2');
    });

    it('should not return items from other organizations', async () => {
      // Set context for org2
      const context: RLSContext = {
        userId: user2Id,
        organizationId: org2Id,
        bypassRLS: false,
      };

      const result = await withRLS(appPrisma, context, async (tx) => {
        return tx.item.findMany({
          orderBy: { sku: 'asc' },
        });
      });
      const items = result.data;

      expect(items).toHaveLength(1);
      expect(items[0].sku).toBe('ORG2-ITEM1');
    });

    it('should throw error when no organization context is set', async () => {
      // No organization context
      const context: RLSContext = {
        userId: user1Id,
        bypassRLS: false,
      };

      await expect(
        withRLS(appPrisma, context, async (tx) => {
          return tx.item.findMany();
        })
      ).rejects.toThrow('Organization context is required for this operation');
    });
  });

  describe('RLS Proxy', () => {
    it('should automatically apply RLS context through proxy', async () => {
      const context: RLSContext = {
        userId: user1Id,
        organizationId: org1Id,
        bypassRLS: false,
      };

      const rlsPrisma = createRLSProxy(appPrisma, () => context);
      
      const items = await rlsPrisma.item.findMany({
        orderBy: { sku: 'asc' },
      });

      expect(items).toHaveLength(2);
      expect(items.every(item => item.organizationId === org1Id)).toBe(true);
    });

    it('should prevent cross-organization updates', async () => {
      const context: RLSContext = {
        userId: user1Id,
        organizationId: org1Id,
        bypassRLS: false,
      };

      const rlsPrisma = createRLSProxy(appPrisma, () => context);
      
      // Try to update an item from org2 while context is org1
      const result = await rlsPrisma.item.updateMany({
        where: { sku: 'ORG2-ITEM1' },
        data: { name: 'Hacked Item' },
      });

      expect(result.count).toBe(0); // Should not update any items
    });

    it('should prevent cross-organization deletes', async () => {
      const context: RLSContext = {
        userId: user2Id,
        organizationId: org2Id,
        bypassRLS: false,
      };

      const rlsPrisma = createRLSProxy(appPrisma, () => context);
      
      // Try to delete items from org1 while context is org2
      const result = await rlsPrisma.item.deleteMany({
        where: { sku: { in: ['ORG1-ITEM1', 'ORG1-ITEM2'] } },
      });

      expect(result.count).toBe(0); // Should not delete any items
    });
  });

  describe('Raw queries with RLS', () => {
    it('should apply RLS to raw queries', async () => {
      const context: RLSContext = {
        userId: user1Id,
        organizationId: org1Id,
        bypassRLS: false,
      };

      const result = await withRLS(appPrisma, context, async (tx) => {
        return tx.$queryRaw`SELECT * FROM items ORDER BY sku`;
      });
      const items = result.data;

      expect(items).toHaveLength(2);
      expect(items[0].sku).toBe('ORG1-ITEM1');
      expect(items[1].sku).toBe('ORG1-ITEM2');
    });
  });

  describe('Bypass RLS', () => {
    it('should bypass RLS when explicitly requested', async () => {
      const context: RLSContext = {
        userId: user1Id,
        organizationId: org1Id,
        bypassRLS: true,
        bypassReason: 'Admin operation for testing bypass functionality',
      };

      // Use admin connection to test bypass (app connection cannot bypass RLS at DB level)
      const result = await withRLS(adminPrisma, context, async (tx) => {
        return tx.item.findMany({
          orderBy: { sku: 'asc' },
        });
      });
      const items = result.data;

      // Should return all items when RLS is bypassed
      expect(items).toHaveLength(3);
      expect(result.context.bypassed).toBe(true);
    });
  });

  describe('Transaction isolation', () => {
    it('should maintain RLS context within transactions', async () => {
      const context: RLSContext = {
        userId: user1Id,
        organizationId: org1Id,
        bypassRLS: false,
      };

      const rlsPrisma = createRLSProxy(appPrisma, () => context);
      
      const result = await rlsPrisma.$transaction(async (tx) => {
        // Create a new item
        const newItem = await tx.item.create({
          data: {
            organizationId: org1Id,
            sku: 'ORG1-ITEM3',
            name: 'Org 1 Item 3',
            categoryId: categoryId,
            uomId: uomId,
          },
        });

        // Query all items
        const allItems = await tx.item.findMany({
          orderBy: { sku: 'asc' },
        });

        return { newItem, allItems };
      });

      expect(result.allItems).toHaveLength(3); // Should include the new item
      expect(result.allItems.every(item => item.organizationId === org1Id)).toBe(true);

      // Clean up
      await adminPrisma.item.delete({
        where: { id: result.newItem.id },
      });
    });
  });
});