import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PrismaClient } from '@ventry/database';
import { appRouter } from '../../index.js';
import { createIntegrationContext, cleanupDatabase } from '../../test-utils/integration-helpers.js';

describe('Inventory Router Integration Tests', () => {
  let prisma: PrismaClient;
  let caller: ReturnType<typeof appRouter.createCaller>;
  let testOrganization: any;
  let testWarehouse: any;
  let testLocation: any;
  let testCategory: any;
  let testItem: any;
  let testInventory: any;

  beforeAll(async () => {
    const ctx = await createIntegrationContext();
    prisma = ctx.prisma;
    caller = appRouter.createCaller(ctx);

    // Create test data
    testOrganization = await prisma.organization.create({
      data: {
        name: 'Test Inventory Org',
        slug: 'test-inventory-org',
      },
    });

    testCategory = await prisma.itemCategory.create({
      data: {
        name: 'Test Category',
        organizationId: testOrganization.id,
      },
    });

    testWarehouse = await prisma.warehouse.create({
      data: {
        name: 'Test Warehouse',
        code: 'TW001',
        organizationId: testOrganization.id,
      },
    });

    testLocation = await prisma.location.create({
      data: {
        code: 'A-1-1',
        name: 'Test Location',
        warehouseId: testWarehouse.id,
      },
    });

    testItem = await prisma.item.create({
      data: {
        sku: 'TEST-SKU-001',
        name: 'Test Item',
        organizationId: testOrganization.id,
        categoryId: testCategory.id,
      },
    });

    testInventory = await prisma.inventory.create({
      data: {
        itemId: testItem.id,
        locationId: testLocation.id,
        qtyOnHand: 100,
        qtyReserved: 20,
        qtyAvailable: 80,
      },
    });

    // Update context with organization
    ctx.user.organizationId = testOrganization.id;
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
  });

  beforeEach(async () => {
    // Reset inventory quantities
    await prisma.inventory.update({
      where: { id: testInventory.id },
      data: {
        qtyOnHand: 100,
        qtyReserved: 20,
        qtyAvailable: 80,
      },
    });
  });

  describe('list', () => {
    it('should list inventory items', async () => {
      const result = await caller.inventory.list({
        page: 1,
        limit: 10,
      });

      expect(result.inventoryItems).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.inventoryItems[0]).toMatchObject({
        id: testInventory.id,
        qtyOnHand: 100,
        qtyReserved: 20,
        qtyAvailable: 80,
        item: {
          id: testItem.id,
          name: 'Test Item',
          sku: 'TEST-SKU-001',
        },
        location: {
          id: testLocation.id,
          name: 'Test Location',
          warehouse: {
            id: testWarehouse.id,
            name: 'Test Warehouse',
          },
        },
      });
    });

    it('should filter by warehouse', async () => {
      // Create another warehouse with inventory
      const otherWarehouse = await prisma.warehouse.create({
        data: {
          name: 'Other Warehouse',
          code: 'OW001',
          organizationId: testOrganization.id,
        },
      });

      const otherLocation = await prisma.location.create({
        data: {
          code: 'B-1-1',
          name: 'Other Location',
          warehouseId: otherWarehouse.id,
        },
      });

      await prisma.inventory.create({
        data: {
          itemId: testItem.id,
          locationId: otherLocation.id,
          qtyOnHand: 50,
          qtyReserved: 0,
          qtyAvailable: 50,
        },
      });

      // Filter by first warehouse
      const result = await caller.inventory.list({
        page: 1,
        limit: 10,
        warehouseId: testWarehouse.id,
      });

      expect(result.inventoryItems).toHaveLength(1);
      expect(result.inventoryItems[0].location.warehouse.id).toBe(testWarehouse.id);
    });

    it('should filter by search term', async () => {
      const result = await caller.inventory.list({
        page: 1,
        limit: 10,
        search: 'Test Item',
      });

      expect(result.inventoryItems).toHaveLength(1);
      expect(result.inventoryItems[0].item.name).toBe('Test Item');

      // Search by SKU
      const skuResult = await caller.inventory.list({
        page: 1,
        limit: 10,
        search: 'TEST-SKU',
      });

      expect(skuResult.inventoryItems).toHaveLength(1);
      expect(skuResult.inventoryItems[0].item.sku).toBe('TEST-SKU-001');
    });

    it('should filter low stock items', async () => {
      // Update item with reorder point
      await prisma.item.update({
        where: { id: testItem.id },
        data: { reorderPoint: 150 }, // Higher than current stock
      });

      const result = await caller.inventory.list({
        page: 1,
        limit: 10,
        lowStockOnly: true,
      });

      expect(result.inventoryItems).toHaveLength(1);
      expect(result.inventoryItems[0].qtyOnHand).toBe(100);
      expect(result.inventoryItems[0].item.reorderPoint).toBe(150);
    });

    it('should paginate results', async () => {
      // Create more inventory items
      for (let i = 2; i <= 15; i++) {
        const item = await prisma.item.create({
          data: {
            sku: `TEST-SKU-${i.toString().padStart(3, '0')}`,
            name: `Test Item ${i}`,
            organizationId: testOrganization.id,
            categoryId: testCategory.id,
          },
        });

        await prisma.inventory.create({
          data: {
            itemId: item.id,
            locationId: testLocation.id,
            qtyOnHand: i * 10,
            qtyReserved: 0,
            qtyAvailable: i * 10,
          },
        });
      }

      // Get first page
      const page1 = await caller.inventory.list({
        page: 1,
        limit: 10,
      });

      expect(page1.inventoryItems).toHaveLength(10);
      expect(page1.totalCount).toBe(15);
      expect(page1.totalPages).toBe(2);

      // Get second page
      const page2 = await caller.inventory.list({
        page: 2,
        limit: 10,
      });

      expect(page2.inventoryItems).toHaveLength(5);
      expect(page2.page).toBe(2);
    });
  });

  describe('adjustStock', () => {
    it('should increase stock with positive adjustment', async () => {
      const result = await caller.inventory.adjustStock({
        inventoryId: testInventory.id,
        adjustment: 50,
        reason: 'Stock received',
      });

      expect(result.qtyOnHand).toBe(150);
      expect(result.qtyAvailable).toBe(130); // 150 - 20 reserved

      // Verify stock movement was created
      const movement = await prisma.stockMovement.findFirst({
        where: { inventoryId: testInventory.id },
        orderBy: { movedAt: 'desc' },
      });

      expect(movement).toMatchObject({
        qty: 50,
        movementType: 'ADJUSTMENT',
        notes: 'Stock received',
      });
    });

    it('should decrease stock with negative adjustment', async () => {
      const result = await caller.inventory.adjustStock({
        inventoryId: testInventory.id,
        adjustment: -30,
        reason: 'Damaged goods',
      });

      expect(result.qtyOnHand).toBe(70);
      expect(result.qtyAvailable).toBe(50); // 70 - 20 reserved

      // Verify stock movement was created
      const movement = await prisma.stockMovement.findFirst({
        where: { inventoryId: testInventory.id },
        orderBy: { movedAt: 'desc' },
      });

      expect(movement).toMatchObject({
        qty: -30,
        movementType: 'ADJUSTMENT',
        notes: 'Damaged goods',
      });
    });

    it('should not allow negative stock', async () => {
      await expect(
        caller.inventory.adjustStock({
          inventoryId: testInventory.id,
          adjustment: -150, // More than current stock
          reason: 'Test',
        })
      ).rejects.toThrow(/insufficient stock/i);
    });

    it('should create stock adjustment record', async () => {
      await caller.inventory.adjustStock({
        inventoryId: testInventory.id,
        adjustment: 25,
        reason: 'Cycle count correction',
      });

      const adjustment = await prisma.stockAdjustment.findFirst({
        where: { inventoryId: testInventory.id },
        orderBy: { adjustedAt: 'desc' },
      });

      expect(adjustment).toMatchObject({
        qtyBefore: 100,
        qtyAfter: 125,
        reason: 'Cycle count correction',
      });
    });

    it('should handle concurrent adjustments correctly', async () => {
      // Make multiple concurrent adjustments
      const adjustments = await Promise.all([
        caller.inventory.adjustStock({
          inventoryId: testInventory.id,
          adjustment: 10,
          reason: 'Adjustment 1',
        }),
        caller.inventory.adjustStock({
          inventoryId: testInventory.id,
          adjustment: 20,
          reason: 'Adjustment 2',
        }),
        caller.inventory.adjustStock({
          inventoryId: testInventory.id,
          adjustment: -5,
          reason: 'Adjustment 3',
        }),
      ]);

      // Final stock should be 100 + 10 + 20 - 5 = 125
      const finalInventory = await prisma.inventory.findUnique({
        where: { id: testInventory.id },
      });

      expect(finalInventory?.qtyOnHand).toBe(125);
      expect(finalInventory?.qtyAvailable).toBe(105); // 125 - 20 reserved
    });
  });

  describe('getStockHistory', () => {
    it('should return stock movements for an inventory item', async () => {
      // Create some stock movements
      await caller.inventory.adjustStock({
        inventoryId: testInventory.id,
        adjustment: 20,
        reason: 'Received shipment',
      });

      await caller.inventory.adjustStock({
        inventoryId: testInventory.id,
        adjustment: -10,
        reason: 'Sales order',
      });

      const history = await caller.inventory.getStockHistory({
        inventoryId: testInventory.id,
        limit: 10,
      });

      expect(history.movements).toHaveLength(2);
      expect(history.movements[0].qty).toBe(-10);
      expect(history.movements[0].notes).toBe('Sales order');
      expect(history.movements[1].qty).toBe(20);
      expect(history.movements[1].notes).toBe('Received shipment');
    });
  });
});