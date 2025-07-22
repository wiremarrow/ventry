import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@ventry/database';
import { createTestConnections } from '../../test-utils/dual-connection.js';
import { createTestSetup } from '../../test-utils/test-db-helpers.js';
import { itemsRouter } from '../items.js';
import { appRouter } from '../app.js';
import { createId } from '@paralleldrive/cuid2';
import { createRLSProxy } from '../../lib/rls/index.js';

describe('Items Router Integration Tests', () => {
  let adminPrisma: PrismaClient;
  let appPrisma: PrismaClient;
  let caller: ReturnType<typeof appRouter.createCaller>;
  let organizationId: string;
  let userId: string;
  let categoryId: string;
  let uomId: string;
  let supplierId: string;
  let locationId: string;

  beforeAll(async () => {
    // Set up dual connections
    const connections = createTestConnections();
    adminPrisma = connections.adminPrisma;
    appPrisma = connections.appPrisma;

    // Create test organization and user with ADMIN role
    const setup = await createTestSetup(adminPrisma, {
      orgName: 'Items Test Org',
      memberRole: 'ADMIN'
    });
    organizationId = setup.org.id;
    userId = setup.user.id;

    // Create tRPC context with RLS
    const rlsContext = {
      userId,
      organizationId,
      bypassRLS: false
    };
    
    // Convert database user to AuthenticatedUser type
    const authenticatedUser = {
      id: setup.user.id,
      email: setup.user.email,
      username: setup.user.username,
      firstName: setup.user.firstName,
      lastName: setup.user.lastName,
      role: setup.user.role,
      isActive: setup.user.isActive,
      createdAt: setup.user.createdAt.toISOString(),
      organizationId,
      organizationRole: setup.membership.role,
    };
    
    const ctx = {
      user: authenticatedUser,
      organizationId,
      prisma: createRLSProxy(appPrisma, () => rlsContext),
      req: {} as any,
      res: {} as any,
    };
    
    caller = appRouter.createCaller(ctx);

    // Create test data using admin connection
    const [category, uom, supplier, warehouse] = await Promise.all([
      adminPrisma.itemCategory.create({
        data: {
          name: 'Test Category',
          organizationId,
        },
      }),
      adminPrisma.unitOfMeasure.create({
        data: {
          code: 'EA',
          description: 'Each unit',
          isBase: true,
          conversionFactorToBase: 1,
          organizationId,
        },
      }),
      adminPrisma.supplier.create({
        data: {
          supplierCode: 'SUP001',
          name: 'Test Supplier',
          line1: '123 Supplier St',
          city: 'Supplier City',
          state: 'SC',
          postalCode: '12345',
          country: 'US',
          organizationId,
        },
      }),
      adminPrisma.warehouse.create({
        data: {
          code: `WH-ITEMS-${Date.now()}`,
          name: 'Test Warehouse',
          line1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US',
          organizationId,
        },
      }),
    ]);

    categoryId = category.id;
    uomId = uom.id;
    supplierId = supplier.id;

    // Create a location for inventory tests
    const location = await adminPrisma.location.create({
      data: {
        code: `ITEMS-TEST-${Date.now()}`,
        description: 'Test Location',
        warehouseId: warehouse.id,
        organizationId,
      },
    });
    locationId = location.id;
  });

  afterAll(async () => {
    // Clean up test data (order matters for foreign keys)
    await adminPrisma.inventory.deleteMany({ where: { item: { organizationId } } });
    await adminPrisma.priceHistory.deleteMany({ where: { item: { organizationId } } });
    await adminPrisma.item.deleteMany({ where: { organizationId } });
    await adminPrisma.location.deleteMany({ where: { warehouse: { organizationId } } });
    await adminPrisma.warehouse.deleteMany({ where: { organizationId } });
    await adminPrisma.itemCategory.deleteMany({ where: { organizationId } });
    await adminPrisma.unitOfMeasure.deleteMany({ where: { organizationId } });
    await adminPrisma.supplier.deleteMany({ where: { organizationId } });
    
    // Clean up audit logs before deleting user
    await adminPrisma.auditLog.deleteMany({ where: { userId } });
    
    // Clean up user and organization using test helper
    await adminPrisma.organizationMember.deleteMany({ where: { organizationId } });
    await adminPrisma.user.delete({ where: { id: userId } });
    await adminPrisma.organization.delete({ where: { id: organizationId } });
    
    // Disconnect both connections
    await adminPrisma.$disconnect();
    await appPrisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up items between tests
    await adminPrisma.inventory.deleteMany({ where: { item: { organizationId } } });
    await adminPrisma.priceHistory.deleteMany({ where: { item: { organizationId } } });
    await adminPrisma.item.deleteMany({ where: { organizationId } });
  });

  describe('create', () => {
    it('should create a new item', async () => {
      const input = {
        sku: 'TEST-001',
        name: 'Test Item',
        description: 'Test description',
        categoryId,
        uomId,
        defaultSupplierId: supplierId,
        defaultCost: 50,
        defaultPrice: 100,
        weightKg: 2.5,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15,
        reorderPoint: 10,
        reorderQty: 20,
        isActive: true,
      };

      const result = await caller.items.create(input);

      expect(result).toMatchObject({
        sku: 'TEST-001',
        name: 'Test Item',
        description: 'Test description',
        categoryId,
        uomId,
        organizationId,
      });

      // Verify in database using admin connection
      const dbItem = await adminPrisma.item.findUnique({
        where: { id: result.id },
      });
      expect(dbItem).toBeTruthy();
      expect(dbItem?.sku).toBe('TEST-001');
    });

    it('should create price history when defaultPrice is set', async () => {
      const input = {
        sku: 'TEST-002',
        name: 'Test Item with Price',
        categoryId,
        uomId,
        defaultPrice: 99.99,
      };

      const result = await caller.items.create(input);

      // Check price history
      const priceHistory = await adminPrisma.priceHistory.findFirst({
        where: { itemId: result.id },
      });

      expect(priceHistory).toBeTruthy();
      expect(priceHistory?.price.toNumber()).toBe(99.99);
      expect(priceHistory?.priceType).toBe('RETAIL');
    });

    it('should throw error for duplicate SKU', async () => {
      // Create first item
      await caller.items.create({
        sku: 'DUP-001',
        name: 'First Item',
        categoryId,
        uomId,
      });

      // Try to create duplicate
      await expect(
        caller.items.create({
          sku: 'DUP-001',
          name: 'Duplicate Item',
          categoryId,
          uomId,
        })
      ).rejects.toThrow('An item with this SKU already exists');
    });

    it('should create audit log', async () => {
      const result = await caller.items.create({
        sku: 'AUDIT-001',
        name: 'Audit Test Item',
        categoryId,
        uomId,
      });

      const auditLog = await adminPrisma.auditLog.findFirst({
        where: {
          tableName: 'items',
          recordPk: result.id,
          action: 'CREATE',
        },
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog?.userId).toBeTruthy();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create test items
      await Promise.all([
        caller.items.create({
          sku: 'LIST-001',
          name: 'Apple Product',
          categoryId,
          uomId,
          isActive: true,
          reorderPoint: 5,
        }),
        caller.items.create({
          sku: 'LIST-002',
          name: 'Banana Product',
          categoryId,
          uomId,
          isActive: false,
          reorderPoint: 10,
        }),
        caller.items.create({
          sku: 'LIST-003',
          name: 'Cherry Product',
          categoryId,
          uomId,
          defaultSupplierId: supplierId,
          isActive: true,
          reorderPoint: 15,
        }),
      ]);
    });

    it('should list all items with pagination', async () => {
      const result = await caller.items.list({
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(3);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
      });
    });

    it('should filter by search term', async () => {
      const result = await caller.items.list({
        search: 'apple',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Apple Product');
    });

    it('should filter by active status', async () => {
      const result = await caller.items.list({
        isActive: true,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items.every(item => item.isActive)).toBe(true);
    });

    it('should filter by supplier', async () => {
      const result = await caller.items.list({
        supplierId,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].defaultSupplierId).toBe(supplierId);
    });

    it('should include related data', async () => {
      const result = await caller.items.list({});

      const item = result.items[0];
      expect(item.category).toBeTruthy();
      expect(item.unitOfMeasure).toBeTruthy();
      expect(item._count).toBeTruthy();
    });

    it('should sort by different fields', async () => {
      const resultByName = await caller.items.list({
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(resultByName.items[0].name).toBe('Apple Product');
      expect(resultByName.items[2].name).toBe('Cherry Product');

      const resultBySku = await caller.items.list({
        sortBy: 'sku',
        sortOrder: 'desc',
      });

      expect(resultBySku.items[0].sku).toBe('LIST-003');
      expect(resultBySku.items[2].sku).toBe('LIST-001');
    });
  });

  describe('get', () => {
    it('should get single item with all related data', async () => {
      const created = await caller.items.create({
        sku: 'GET-001',
        name: 'Get Test Item',
        categoryId,
        uomId,
        defaultSupplierId: supplierId,
        defaultPrice: 100,
      });

      const result = await caller.items.get({ id: created.id });

      expect(result.id).toBe(created.id);
      expect(result.category).toBeTruthy();
      expect(result.unitOfMeasure).toBeTruthy();
      expect(result.defaultSupplier).toBeTruthy();
      expect(result.stockSummary).toEqual({
        onHand: 0,
        reserved: 0,
        available: 0,
      });
    });

    it('should throw error for non-existent item', async () => {
      // Use a valid CUID format that doesn't exist
      const nonExistentId = 'clh1234567890abcdefghijkl';
      await expect(
        caller.items.get({ id: nonExistentId })
      ).rejects.toThrow('Item not found');
    });
  });

  describe('update', () => {
    it('should update item fields', async () => {
      const created = await caller.items.create({
        sku: 'UPDATE-001',
        name: 'Original Name',
        categoryId,
        uomId,
        defaultPrice: 100,
      });

      const updated = await caller.items.update({
        id: created.id,
        name: 'Updated Name',
        defaultPrice: 150,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.defaultPrice?.toNumber()).toBe(150);
    });

    it('should update price history when price changes', async () => {
      const created = await caller.items.create({
        sku: 'PRICE-001',
        name: 'Price Test',
        categoryId,
        uomId,
        defaultPrice: 100,
      });

      await caller.items.update({
        id: created.id,
        defaultPrice: 200,
      });

      const priceHistory = await adminPrisma.priceHistory.findMany({
        where: { itemId: created.id },
        orderBy: { startDate: 'desc' },
      });

      expect(priceHistory).toHaveLength(2);
      expect(priceHistory[0].price.toNumber()).toBe(200);
      expect(priceHistory[0].endDate).toBeNull();
      expect(priceHistory[1].price.toNumber()).toBe(100);
      expect(priceHistory[1].endDate).toBeTruthy();
    });

    it('should create audit log for updates', async () => {
      const created = await caller.items.create({
        sku: 'AUDIT-UPDATE-001',
        name: 'Original',
        categoryId,
        uomId,
      });

      await caller.items.update({
        id: created.id,
        name: 'Updated',
      });

      const auditLog = await adminPrisma.auditLog.findFirst({
        where: {
          tableName: 'items',
          recordPk: created.id,
          action: 'UPDATE',
        },
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog?.beforeData).toBeTruthy();
      expect(auditLog?.afterData).toBeTruthy();
    });

    it('should prevent duplicate SKU on update', async () => {
      const [item1, item2] = await Promise.all([
        caller.items.create({
          sku: 'UNIQUE-001',
          name: 'Item 1',
          categoryId,
          uomId,
        }),
        caller.items.create({
          sku: 'UNIQUE-002',
          name: 'Item 2',
          categoryId,
          uomId,
        }),
      ]);

      await expect(
        caller.items.update({
          id: item2.id,
          sku: 'UNIQUE-001',
        })
      ).rejects.toThrow('An item with this SKU already exists');
    });
  });

  describe('delete', () => {
    it('should soft delete item', async () => {
      const created = await caller.items.create({
        sku: 'DELETE-001',
        name: 'Delete Test',
        categoryId,
        uomId,
      });

      const result = await caller.items.delete({
        id: created.id,
        reason: 'Test deletion',
      });

      expect(result.isActive).toBe(false);

      // Verify in database
      const dbItem = await adminPrisma.item.findUnique({
        where: { id: created.id },
      });
      expect(dbItem?.isActive).toBe(false);
    });

    it('should prevent deletion of items with inventory', async () => {
      const created = await caller.items.create({
        sku: 'INV-DELETE-001',
        name: 'Item with Inventory',
        categoryId,
        uomId,
      });

      // Create inventory
      await adminPrisma.inventory.create({
        data: {
          itemId: created.id,
          locationId,
          qtyOnHand: 10,
          qtyReserved: 0,
          qtyInTransit: 0,
        },
      });

      await expect(
        caller.items.delete({
          id: created.id,
          reason: 'Test deletion',
        })
      ).rejects.toThrow('Cannot delete item with active inventory');
    });
  });

  describe('duplicate', () => {
    it('should duplicate item with new SKU and name', async () => {
      const original = await caller.items.create({
        sku: 'ORIG-001',
        name: 'Original Item',
        description: 'Original description',
        categoryId,
        uomId,
        defaultPrice: 100,
        reorderPoint: 10,
      });

      const duplicated = await caller.items.duplicate({
        itemId: original.id,
        newSku: 'DUP-001',
        newName: 'Duplicated Item',
      });

      expect(duplicated.sku).toBe('DUP-001');
      expect(duplicated.name).toBe('Duplicated Item');
      expect(duplicated.description).toBe('Original description');
      expect(duplicated.categoryId).toBe(categoryId);
      expect(duplicated.defaultPrice?.toNumber()).toBe(100);
      expect(duplicated.reorderPoint).toBe(10);
    });

    it('should duplicate price history', async () => {
      const original = await caller.items.create({
        sku: 'ORIG-PRICE-001',
        name: 'Original with Price',
        categoryId,
        uomId,
        defaultPrice: 99,
      });

      const duplicated = await caller.items.duplicate({
        itemId: original.id,
        newSku: 'DUP-PRICE-001',
        newName: 'Duplicated with Price',
      });

      const priceHistory = await adminPrisma.priceHistory.findFirst({
        where: { itemId: duplicated.id },
      });

      expect(priceHistory).toBeTruthy();
      expect(priceHistory?.price.toNumber()).toBe(99);
    });
  });

  describe('archive', () => {
    it('should archive multiple items', async () => {
      const items = await Promise.all([
        caller.items.create({
          sku: 'ARCH-001',
          name: 'Archive 1',
          categoryId,
          uomId,
        }),
        caller.items.create({
          sku: 'ARCH-002',
          name: 'Archive 2',
          categoryId,
          uomId,
        }),
      ]);

      const itemIds = items.map(item => item.id);

      const result = await caller.items.archive({
        itemIds,
        reason: 'Bulk archive test',
      });

      expect(result.success).toBe(true);
      expect(result.archived).toBe(2);

      // Verify in database
      const dbItems = await adminPrisma.item.findMany({
        where: { id: { in: itemIds } },
      });

      expect(dbItems.every(item => !item.isActive)).toBe(true);
    });

    it('should prevent archiving items with inventory', async () => {
      const item = await caller.items.create({
        sku: 'ARCH-INV-001',
        name: 'Item with Inventory',
        categoryId,
        uomId,
      });

      // Create inventory
      await adminPrisma.inventory.create({
        data: {
          itemId: item.id,
          locationId,
          qtyOnHand: 5,
          qtyReserved: 0,
          qtyInTransit: 0,
        },
      });

      await expect(
        caller.items.archive({
          itemIds: [item.id],
          reason: 'Test archive',
        })
      ).rejects.toThrow('Cannot archive items with active inventory');
    });
  });

  describe('bulkImport', () => {
    it('should validate items without importing', async () => {
      const items = [
        {
          sku: 'BULK-001',
          name: 'Bulk Item 1',
          categoryId,
          uomId,
        },
        {
          sku: 'BULK-002',
          name: 'Bulk Item 2',
          categoryId,
          uomId,
        },
      ];

      const result = await caller.items.bulkImport({
        items,
        validateOnly: true,
      });

      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify items were not created
      const dbItems = await adminPrisma.item.findMany({
        where: { sku: { in: ['BULK-001', 'BULK-002'] } },
      });
      expect(dbItems).toHaveLength(0);
    });

    it('should import valid items', async () => {
      const items = [
        {
          sku: 'IMPORT-001',
          name: 'Import Item 1',
          categoryId,
          uomId,
          defaultPrice: 50,
        },
        {
          sku: 'IMPORT-002',
          name: 'Import Item 2',
          categoryId,
          uomId,
          defaultPrice: 75,
        },
      ];

      const result = await caller.items.bulkImport({
        items,
        validateOnly: false,
      });

      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(result.items).toHaveLength(2);

      // Verify items were created
      const dbItems = await adminPrisma.item.findMany({
        where: { sku: { in: ['IMPORT-001', 'IMPORT-002'] } },
      });
      expect(dbItems).toHaveLength(2);
    });

    it('should validate and report errors', async () => {
      // Create existing item
      await caller.items.create({
        sku: 'EXISTING-001',
        name: 'Existing Item',
        categoryId,
        uomId,
      });

      const items = [
        {
          sku: 'EXISTING-001', // Duplicate
          name: 'Duplicate Item',
          categoryId,
          uomId,
        },
        {
          sku: 'INVALID-001',
          name: 'Invalid Category',
          categoryId: 'clh0000000000abcdefghijkl', // Non-existent but valid CUID
          uomId,
        },
        {
          sku: 'VALID-001',
          name: 'Valid Item',
          categoryId,
          uomId,
        },
      ];

      const result = await caller.items.bulkImport({
        items,
        validateOnly: true,
      });

      expect(result.valid).toBe(false);
      expect(result.validCount).toBe(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].errors).toContain('SKU EXISTING-001 already exists');
      expect(result.errors[1].errors).toContain('Invalid category');
    });
  });

  describe('getHistory', () => {
    it('should get item history', async () => {
      const item = await caller.items.create({
        sku: 'HIST-001',
        name: 'History Test',
        categoryId,
        uomId,
      });

      // Update item to create audit log
      await caller.items.update({
        id: item.id,
        name: 'Updated History Test',
      });

      const history = await caller.items.getHistory({
        itemId: item.id,
        days: 30,
      });

      expect(history.auditLogs).toHaveLength(2); // Create and update
      expect(history.movements).toHaveLength(0);
      expect(history.adjustments).toHaveLength(0);
      expect(history.priceChanges).toHaveLength(0);
    });
  });
});