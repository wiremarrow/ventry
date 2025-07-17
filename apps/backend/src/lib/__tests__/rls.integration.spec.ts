import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma as basePrisma } from '@ventry/database';
import { createRLSProxy, withRLS, type RLSContext } from '../rls-middleware.js';
import { randomUUID } from 'crypto';
import { verifyRLSEnabled } from '../../test-utils/rls-test-helpers-minimal.js';

// Test data
const org1Id = randomUUID();
const org2Id = randomUUID();
const user1Id = randomUUID();
const user2Id = randomUUID();
const categoryId = randomUUID();
const uomId = randomUUID();

describe('Row-Level Security (RLS) Integration Tests', () => {
  beforeAll(async () => {
    // Verify RLS is enabled (should be enabled by migrations)
    const rlsEnabled = await verifyRLSEnabled(basePrisma, 'items');
    if (!rlsEnabled) {
      console.warn('RLS is not enabled on items table. Tests may not work correctly.');
    }
    
    // Clean up any existing test data
    await basePrisma.item.deleteMany({
      where: {
        sku: {
          in: ['ORG1-ITEM1', 'ORG1-ITEM2', 'ORG2-ITEM1', 'ORG1-ITEM3'],
        },
      },
    });
    
    await basePrisma.itemCategory.deleteMany({
      where: {
        name: {
          in: ['Test Category', 'Test Category 2'],
        },
      },
    });
    
    await basePrisma.unitOfMeasure.deleteMany({
      where: {
        organizationId: {
          in: [org1Id, org2Id],
        },
      },
    });
    
    await basePrisma.organizationMember.deleteMany({
      where: {
        organizationId: {
          in: [org1Id, org2Id],
        },
      },
    });
    
    await basePrisma.user.deleteMany({
      where: {
        id: {
          in: [user1Id, user2Id],
        },
      },
    });
    
    await basePrisma.organization.deleteMany({
      where: {
        id: {
          in: [org1Id, org2Id],
        },
      },
    });
    
    // Create test organizations
    await basePrisma.organization.createMany({
      data: [
        {
          id: org1Id,
          name: 'Test Org 1',
          slug: 'test-org-1',
        },
        {
          id: org2Id,
          name: 'Test Org 2',
          slug: 'test-org-2',
        },
      ],
    });

    // Create test category and UOM (required for items)
    await basePrisma.itemCategory.create({
      data: {
        id: categoryId,
        organizationId: org1Id,
        name: 'Test Category',
      },
    });

    await basePrisma.unitOfMeasure.create({
      data: {
        id: uomId,
        organizationId: org1Id,
        code: 'PC',
        description: 'Piece',
      },
    });

    // Create test users
    await basePrisma.user.createMany({
      data: [
        {
          id: user1Id,
          email: 'rls-user1@test.com',
          username: 'rlsuser1',
          firstName: 'RLS',
          lastName: 'User1',
          password: 'hashed-password',
        },
        {
          id: user2Id,
          email: 'rls-user2@test.com',
          username: 'rlsuser2',
          firstName: 'RLS',
          lastName: 'User2',
          password: 'hashed-password',
        },
      ],
    });

    // Create organization memberships
    await basePrisma.organizationMember.createMany({
      data: [
        {
          organizationId: org1Id,
          userId: user1Id,
          role: 'ADMIN',
        },
        {
          organizationId: org2Id,
          userId: user2Id,
          role: 'ADMIN',
        },
      ],
    });

    // Create test items for each organization
    await basePrisma.item.createMany({
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
    const category2Id = randomUUID();
    const uom2Id = randomUUID();
    
    await basePrisma.itemCategory.create({
      data: {
        id: category2Id,
        organizationId: org2Id,
        name: 'Test Category 2',
      },
    });

    await basePrisma.unitOfMeasure.create({
      data: {
        id: uom2Id,
        organizationId: org2Id,
        code: 'PC',
        description: 'Piece',
      },
    });

    await basePrisma.item.create({
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
    await basePrisma.item.deleteMany({
      where: {
        sku: {
          in: ['ORG1-ITEM1', 'ORG1-ITEM2', 'ORG2-ITEM1', 'ORG1-ITEM3'],
        },
      },
    });
    
    await basePrisma.itemCategory.deleteMany({
      where: {
        id: categoryId,
      },
    });
    
    await basePrisma.unitOfMeasure.deleteMany({
      where: {
        id: uomId,
      },
    });
    
    await basePrisma.organizationMember.deleteMany({
      where: {
        organizationId: {
          in: [org1Id, org2Id],
        },
      },
    });
    
    await basePrisma.user.deleteMany({
      where: {
        id: {
          in: [user1Id, user2Id],
        },
      },
    });
    
    await basePrisma.organization.deleteMany({
      where: {
        id: {
          in: [org1Id, org2Id],
        },
      },
    });
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
      };

      const items = await withRLS(basePrisma, context, async (tx) => {
        return tx.item.findMany({
          orderBy: { sku: 'asc' },
        });
      });

      expect(items).toHaveLength(2);
      expect(items[0].sku).toBe('ORG1-ITEM1');
      expect(items[1].sku).toBe('ORG1-ITEM2');
    });

    it('should not return items from other organizations', async () => {
      // Set context for org2
      const context: RLSContext = {
        userId: user2Id,
        organizationId: org2Id,
      };

      const items = await withRLS(basePrisma, context, async (tx) => {
        return tx.item.findMany({
          orderBy: { sku: 'asc' },
        });
      });

      expect(items).toHaveLength(1);
      expect(items[0].sku).toBe('ORG2-ITEM1');
    });

    it('should return empty results when no organization context is set', async () => {
      // No organization context
      const context: RLSContext = {
        userId: user1Id,
      };

      const items = await withRLS(basePrisma, context, async (tx) => {
        return tx.item.findMany();
      });

      expect(items).toHaveLength(0);
    });
  });

  describe('RLS Proxy', () => {
    it('should automatically apply RLS context through proxy', async () => {
      const context: RLSContext = {
        userId: user1Id,
        organizationId: org1Id,
      };

      const rlsPrisma = createRLSProxy(basePrisma, () => context);
      
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
      };

      const rlsPrisma = createRLSProxy(basePrisma, () => context);
      
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
      };

      const rlsPrisma = createRLSProxy(basePrisma, () => context);
      
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
      };

      const items = await withRLS(basePrisma, context, async (tx) => {
        return tx.$queryRaw`SELECT * FROM items ORDER BY sku`;
      });

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
      };

      const rlsPrisma = createRLSProxy(basePrisma, () => context);
      
      const items = await rlsPrisma.item.findMany({
        orderBy: { sku: 'asc' },
      });

      // Should return all items when RLS is bypassed
      expect(items).toHaveLength(3);
    });
  });

  describe('Transaction isolation', () => {
    it('should maintain RLS context within transactions', async () => {
      const context: RLSContext = {
        userId: user1Id,
        organizationId: org1Id,
      };

      const rlsPrisma = createRLSProxy(basePrisma, () => context);
      
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
      await basePrisma.item.delete({
        where: { id: result.newItem.id },
      });
    });
  });
});