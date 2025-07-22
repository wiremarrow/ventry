import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    inventory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    warehouse: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    lot: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    stockAdjustment: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    organizationMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    cycleCount: {
      create: vi.fn(),
    },
    cycleCountItem: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  return { 
    prisma: mockPrisma,
    Prisma: {
      InventoryWhereInput: {},
      ItemWhereInput: {},
    },
    OrganizationRole: {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    },
    UserRole: {
      ADMIN: 'ADMIN',
      MANAGER: 'MANAGER',
      EMPLOYEE: 'EMPLOYEE',
      USER: 'USER',
    },
  };
});

// Access the mocked prisma for tests
const mockPrisma = {
  inventory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
  },
  item: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  location: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  warehouse: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  lot: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  stockMovement: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  stockAdjustment: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  organizationMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  cycleCount: {
    create: vi.fn(),
  },
  cycleCountItem: {
    createMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  }),
};

describe('Inventory Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create a proper mock response object
    mockRes = {
      setCookie: vi.fn(),
      clearCookie: vi.fn(),
      header: vi.fn(),
    };
    
    // Default authenticated user with organization context and MANAGER role
    const authenticatedUser = {
      ...mockAuthenticatedUser,
      organizationId: testId('org'),
      organizationRole: 'ADMIN',
      role: 'MANAGER', // Required for inventory operations
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list inventory with pagination', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          locationId: testId('loc1'),
          qtyOnHand: 100,
          qtyReserved: 20,
          lastCountedAt: new Date(),
          item: {
            id: testId('item1'),
            name: 'Test Item',
            sku: 'ITEM001',
            reorderPoint: 50,
            category: { name: 'Category 1' },
            unitOfMeasure: { name: 'Each' },
          },
          location: {
            id: testId('loc1'),
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: null,
        },
      ];

      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);
      mockPrisma.inventory.count.mockResolvedValue(1);

      const result = await caller.inventory.list({
        page: 1,
        limit: 20,
      });

      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0].qtyOnHand).toBe(100);
      expect(result.inventory[0].qtyAvailable).toBe(80); // 100 - 20 reserved
      expect(result.inventory[0].lowStock).toBe(false); // 100 > 50 reorder point
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter inventory by search term', async () => {
      mockPrisma.inventory.findMany.mockResolvedValue([]);
      mockPrisma.inventory.count.mockResolvedValue(0);

      await caller.inventory.list({
        search: 'ITEM001',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            item: expect.objectContaining({
              organizationId: testId('org'),
              OR: expect.arrayContaining([
                { sku: { contains: 'ITEM001', mode: 'insensitive' } },
              ]),
            }),
          }),
        })
      );
    });

    it('should filter low stock items', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          qtyOnHand: 40,
          qtyReserved: 0,
          item: {
            reorderPoint: 50,
            category: {},
            unitOfMeasure: {},
          },
          location: {
            warehouse: {},
          },
          lot: null,
        },
      ];

      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);
      mockPrisma.inventory.count.mockResolvedValue(1);

      const result = await caller.inventory.list({
        lowStock: true,
        page: 1,
        limit: 20,
      });

      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0].lowStock).toBe(true);
    });

    it('should require organization context', async () => {
      const noOrgCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: undefined },
      });

      await expect(noOrgCaller.inventory.list({ page: 1, limit: 20 })).rejects.toThrow('No organization selected');
    });
  });

  describe('getByLocation', () => {
    it('should get inventory for a specific location', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          locationId: testId('loc1'),
          qtyOnHand: 100,
          qtyReserved: 0,
          item: {
            sku: 'ITEM001',
            name: 'Test Item',
            category: { name: 'Category 1' },
            unitOfMeasure: { name: 'Each' },
          },
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: null,
        },
      ];

      const mockLocation = {
        id: testId('loc1'),
        code: 'A-1-1',
        warehouseId: testId('wh1'),
        warehouse: { 
          organizationId: testId('org'),
          name: 'Main Warehouse'
        },
      };

      mockPrisma.location.findUnique.mockResolvedValue(mockLocation);
      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);

      const result = await caller.inventory.getByLocation({
        locationId: testId('loc1'),
      });

      // getByLocation doesn't return location object, just inventory with summary
      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0].locationId).toBe(testId('loc1'));
      expect(result.summary.totalItems).toBe(1);
      expect(result.summary.totalQuantity).toBe(100);
      expect(result.groupedByCategory).toBeDefined();
      expect(result.groupedByCategory['Category 1']).toHaveLength(1);
    });

    it('should return empty inventory when location has no inventory', async () => {
      mockPrisma.location.findUnique.mockResolvedValue({
        id: testId('loc2'),
        code: 'B-2-2',
        warehouseId: testId('wh1'),
        warehouse: { 
          organizationId: testId('org'),
          name: 'Main Warehouse'
        },
      });
      mockPrisma.inventory.findMany.mockResolvedValue([]);

      const result = await caller.inventory.getByLocation({
        locationId: testId('loc2'),
      });

      // getByLocation returns inventory array, not location object
      expect(result.inventory).toHaveLength(0);
      expect(result.summary.totalItems).toBe(0);
      expect(result.summary.totalQuantity).toBe(0);
    });
  });

  describe('getByItem', () => {
    it('should get inventory for a specific item across locations', async () => {
      const mockItem = {
        id: testId('item1'),
        organizationId: testId('org'),
        name: 'Test Item',
        sku: 'ITEM001',
        category: { name: 'Category 1' },
        unitOfMeasure: { name: 'Each' },
        reorderPoint: 50,
        reorderQty: 100,
        defaultCost: 10,
      };

      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          qtyOnHand: 100,
          qtyReserved: 20,
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: null,
        },
        {
          id: testId('inv2'),
          itemId: testId('item1'),
          qtyOnHand: 50,
          qtyReserved: 0,
          location: {
            code: 'B-2-1',
            warehouse: { name: 'Secondary Warehouse' },
          },
          lot: null,
        },
      ];

      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);

      const result = await caller.inventory.getByItem({
        itemId: testId('item1'),
      });

      // getByItem returns inventory array and groupedByWarehouse, not item object
      expect(result.inventory).toHaveLength(2);
      expect(result.inventory[0].itemId).toBe(testId('item1'));
      expect(result.summary.totalQuantity).toBe(150);
      expect(result.summary.totalReserved).toBe(20);
      expect(result.summary.totalAvailable).toBe(130);
    });
  });

  describe('adjust', () => {
    it('should adjust inventory count', async () => {
      const currentInventory = {
        id: testId('inv1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyOnHand: 100,
        qtyReserved: 0,
        item: {
          organizationId: testId('org'),
        },
      };

      const stockAdjustment = {
        id: testId('adj1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyBefore: 100,
        qtyAfter: 95,
        reason: 'COUNT: Physical count variance',
      };

      mockPrisma.inventory.findUnique.mockResolvedValue(currentInventory);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return stockAdjustment;
      });
      mockPrisma.inventory.update.mockResolvedValue({ ...currentInventory, qtyOnHand: 95 });
      mockPrisma.stockAdjustment.create.mockResolvedValue(stockAdjustment);

      const result = await caller.inventory.adjust({
        inventoryId: testId('inv1'),
        adjustmentType: 'COUNT',
        qty: 95, // COUNT uses absolute value
        reason: 'Physical count variance',
      });

      expect(result.success).toBe(true);
      expect(result.inventory.qtyOnHand).toBe(95);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should prevent negative inventory when not allowed', async () => {
      const currentInventory = {
        id: testId('inv1'),
        qtyOnHand: 10,
        qtyReserved: 0,
        item: {
          organizationId: testId('org'),
        },
      };

      mockPrisma.inventory.findUnique.mockResolvedValue(currentInventory);

      await expect(
        caller.inventory.adjust({
          inventoryId: testId('inv1'),
          adjustmentType: 'LOSS',
          qty: -15,
          reason: 'Lost items',
        })
      ).rejects.toThrow('Adjustment would result in negative inventory');
    });

    it('should handle positive adjustments', async () => {
      const currentInventory = {
        id: testId('inv1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyOnHand: 100,
        qtyReserved: 0,
        item: {
          organizationId: testId('org'),
        },
      };

      const stockAdjustment = {
        id: testId('adj1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyBefore: 100,
        qtyAfter: 110,
        reason: 'FOUND: Found additional items',
      };

      mockPrisma.inventory.findUnique.mockResolvedValue(currentInventory);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return stockAdjustment;
      });
      mockPrisma.inventory.update.mockResolvedValue({ ...currentInventory, qtyOnHand: 110 });
      mockPrisma.stockAdjustment.create.mockResolvedValue(stockAdjustment);

      const result = await caller.inventory.adjust({
        inventoryId: testId('inv1'),
        adjustmentType: 'FOUND',
        qty: 10,
        reason: 'Found additional items',
      });

      expect(result.inventory.qtyOnHand).toBe(110);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    it('should transfer inventory between locations', async () => {
      const fromInventory = {
        id: testId('inv1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyOnHand: 100,
        qtyReserved: 0,
        location: {
          code: 'A-1-1',
          warehouse: { code: 'WH1' },
        },
      };

      const toInventory = {
        id: testId('inv2'),
        itemId: testId('item1'),
        locationId: testId('loc2'),
        qtyOnHand: 50,
        qtyReserved: 0,
      };

      mockPrisma.item.findUnique.mockResolvedValue({
        id: testId('item1'),
        organizationId: testId('org'),
      });
      mockPrisma.location.findUnique
        .mockResolvedValueOnce({ // From location
          id: testId('loc1'),
          code: 'A-1-1',
          warehouse: { organizationId: testId('org'), code: 'WH1' },
        })
        .mockResolvedValueOnce({ // To location
          id: testId('loc2'),
          code: 'B-2-2', 
          warehouse: { organizationId: testId('org'), code: 'WH2' },
        });
      mockPrisma.inventory.findFirst
        .mockResolvedValueOnce(fromInventory) // From inventory
        .mockResolvedValueOnce(toInventory); // To inventory
      // Mock stockMovement.create to return movement with id
      const mockMovement = {
        id: testId('mov1'),
        itemId: testId('item1'),
        fromLocationId: testId('loc1'),
        toLocationId: testId('loc2'),
        qty: 20,
        movementType: 'TRANSFER',
      };
      mockPrisma.stockMovement.create.mockResolvedValue(mockMovement);
      
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return mockMovement;
      });
      mockPrisma.inventory.update
        .mockResolvedValueOnce({ ...fromInventory, qtyOnHand: 80 })
        .mockResolvedValueOnce({ ...toInventory, qtyOnHand: 70 });

      const result = await caller.inventory.transfer({
        itemId: testId('item1'),
        fromLocationId: testId('loc1'),
        toLocationId: testId('loc2'),
        qty: 20,
      });

      expect(result.success).toBe(true);
      expect(result.movementId).toBe(testId('mov1'));
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error when insufficient inventory to transfer', async () => {
      const fromInventory = {
        id: testId('inv1'),
        qtyOnHand: 10,
        qtyReserved: 5,
      };

      mockPrisma.item.findUnique.mockResolvedValue({
        id: testId('item1'),
        organizationId: testId('org'),
      });
      mockPrisma.location.findUnique.mockResolvedValue({
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      });
      mockPrisma.inventory.findFirst.mockResolvedValue(fromInventory);

      await expect(
        caller.inventory.transfer({
          itemId: testId('item1'),
          fromLocationId: testId('loc1'),
          toLocationId: testId('loc2'),
          qty: 10, // Only 5 available (10 - 5 reserved)
        })
      ).rejects.toThrow('Only 5 units available for transfer');
    });
  });

  describe('reserve', () => {
    it('should reserve inventory for an order', async () => {
      const inventory = {
        id: testId('inv1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyOnHand: 100,
        qtyReserved: 20,
        item: {
          organizationId: testId('org'),
        },
        location: {
          code: 'A-1-1',
        },
      };

      const updatedInventory = {
        ...inventory,
        qtyReserved: 30,
      };

      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return updatedInventory;
      });
      mockPrisma.inventory.update.mockResolvedValue(updatedInventory);

      const result = await caller.inventory.reserve({
        inventoryId: testId('inv1'),
        qty: 10,
        orderId: testId('order1'),
      });

      expect(result.inventory.qtyReserved).toBe(30);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error when insufficient available inventory', async () => {
      const inventory = {
        id: testId('inv1'),
        qtyOnHand: 100,
        qtyReserved: 95,
        item: {
          organizationId: testId('org'),
        },
        location: {
          code: 'A-1-1',
        },
      };

      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);

      await expect(
        caller.inventory.reserve({
          inventoryId: testId('inv1'),
          qty: 10, // Only 5 available (100 - 95)
        })
      ).rejects.toThrow('Only 5 units available for reservation');
    });
  });

  describe('release', () => {
    it('should release reserved inventory', async () => {
      const inventory = {
        id: testId('inv1'),
        qtyOnHand: 100,
        qtyReserved: 30,
        item: {
          organizationId: testId('org'),
        },
      };

      const updatedInventory = {
        ...inventory,
        qtyReserved: 20,
      };

      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return updatedInventory;
      });
      mockPrisma.inventory.update.mockResolvedValue(updatedInventory);

      const result = await caller.inventory.release({
        inventoryId: testId('inv1'),
        qty: 10,
        reason: 'Order cancelled',
      });

      expect(result.inventory.qtyReserved).toBe(20);
    });

    it('should not allow releasing more than reserved', async () => {
      const inventory = {
        id: testId('inv1'),
        qtyReserved: 5,
        item: {
          organizationId: testId('org'),
        },
      };

      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);

      await expect(
        caller.inventory.release({
          inventoryId: testId('inv1'),
          qty: 10,
          reason: 'Releasing inventory',
        })
      ).rejects.toThrow('Only 5 units are reserved');
    });
  });

  describe('getLowStock', () => {
    it('should return items below reorder point', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          name: 'Low Stock Item',
          sku: 'LOW001',
          reorderPoint: 50,
          reorderQty: 100,
          isActive: true,
          category: { name: 'Category 1' },
          unitOfMeasure: { name: 'Each' },
          defaultSupplier: null,
        },
      ];

      const mockAggregateResult = {
        _sum: {
          qtyOnHand: 40,
          qtyReserved: 0,
          qtyInTransit: 0,
        },
      };

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.inventory.aggregate.mockResolvedValue(mockAggregateResult);

      const result = await caller.inventory.getLowStock({
        warehouseId: testId('wh1'),
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].item.name).toBe('Low Stock Item');
      expect(result.items[0].stock.onHand).toBe(40);
      expect(result.items[0].item.reorderPoint).toBe(50);
      // Suggested order qty is max(reorderQty, reorderPoint - available + reorderQty)
      // available = 40, reorderPoint = 50, reorderQty = 100
      // shortfall = 50 - 40 = 10
      // suggestedOrderQty = max(100, 10 + 100) = 110
      expect(result.items[0].suggestedOrderQty).toBe(110);
      expect(result.summary.total).toBe(1);
    });

    it('should identify critical stock levels', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          name: 'Critical Stock Item',
          sku: 'CRIT001',
          reorderPoint: 50,
          reorderQty: 100,
          isActive: true,
          category: { name: 'Category 1' },
          unitOfMeasure: { name: 'Each' },
          defaultSupplier: null,
        },
      ];

      const mockAggregateResult = {
        _sum: {
          qtyOnHand: 5,
          qtyReserved: 0,
          qtyInTransit: 0,
        },
      };

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.inventory.aggregate.mockResolvedValue(mockAggregateResult);

      const result = await caller.inventory.getLowStock({});

      expect(result.items[0].stock.available).toBe(5);
      expect(result.summary.critical).toBe(0); // Critical means 0 or less available
    });
  });

  describe('getExpiring', () => {
    it('should return items expiring soon', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15); // 15 days from now

      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          qtyOnHand: 100,
          lotId: testId('lot1'),
          lot: {
            id: testId('lot1'),
            lotNumber: 'LOT001',
            expirationDate: futureDate,
          },
          item: {
            name: 'Expiring Item',
            sku: 'EXP001',
            category: { name: 'Category 1' },
            unitOfMeasure: { name: 'Each' },
            defaultCost: 10,
          },
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main' },
          },
        },
      ];

      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);

      const result = await caller.inventory.getExpiring({
        daysUntilExpiration: 30,
      });

      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0].lot.lotNumber).toBe('LOT001');
      expect(result.grouped.expiringThisMonth).toHaveLength(1);
      expect(result.grouped.expiringThisMonth[0].daysUntilExpiration).toBeLessThanOrEqual(15);
    });
  });

  describe('createCycleCount', () => {
    it('should create a cycle count', async () => {
      const mockWarehouse = {
        id: testId('wh1'),
        organizationId: testId('org'),
      };

      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          locationId: testId('loc1'),
          qtyOnHand: 100,
        },
      ];

      const mockCycleCount = {
        id: testId('cc1'),
        warehouseId: testId('wh1'),
        organizationId: testId('org'),
        status: 'PENDING',
        scheduledDate: new Date(),
        createdById: mockAuthenticatedUser.id,
      };

      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);
      // Mock location.findFirst for cycle count creation
      mockPrisma.location.findFirst.mockResolvedValue({
        id: testId('loc1'),
        code: 'A-1-1',
        warehouseId: testId('wh1'),
      });
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return {
          count: mockCycleCount,
          itemCount: 1,
        };
      });
      mockPrisma.cycleCount.create.mockResolvedValue(mockCycleCount);

      const result = await caller.inventory.createCycleCount({
        warehouseId: testId('wh1'),
        scheduledDate: new Date(),
      });

      expect(result.success).toBe(true);
      expect(result.cycleCount.id).toBe(testId('cc1'));
      expect(result.cycleCount.status).toBe('PENDING');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('getValueReport', () => {
    it('should get inventory value report', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          qtyOnHand: 100,
          qtyReserved: 20,
          item: {
            id: testId('item1'),
            name: 'Item 1',
            sku: 'ITEM001',
            defaultCost: 10,
            category: { name: 'Category 1' },
            unitOfMeasure: { name: 'Each' },
          },
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main' },
          },
          lot: null,
        },
        {
          id: testId('inv2'),
          qtyOnHand: 50,
          qtyReserved: 0,
          item: {
            id: testId('item1'), // Same item, different location
            name: 'Item 1',
            sku: 'ITEM001',
            defaultCost: 10,
            category: { name: 'Category 1' },
            unitOfMeasure: { name: 'Each' },
          },
          location: {
            code: 'B-1-1',
            warehouse: { name: 'Main' },
          },
          lot: null,
        },
      ];

      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);

      const result = await caller.inventory.getValueReport({});

      expect(result.summary.totalValue).toBe(1500); // (100 * 10) + (50 * 10)
      // totalItems counts unique items, but we only have one item at two locations
      expect(result.summary.totalItems).toBe(1); // One unique item
      expect(result.summary.totalQuantity).toBe(150);
      expect(result.grouped).toHaveLength(1); // One category
      expect(result.grouped[0].categoryName).toBe('Category 1');
      expect(result.grouped[0].totalValue).toBe(1500);
      expect(result.grouped[0].totalQuantity).toBe(150);
    });
  });
});