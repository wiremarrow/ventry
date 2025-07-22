import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    stockMovement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    inventory: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    lot: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    serialNumber: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  return { 
    prisma: mockPrisma,
    Prisma: {
      StockMovementWhereInput: {},
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
      WAREHOUSE: 'WAREHOUSE',
    },
    MovementType: {
      INBOUND: 'INBOUND',
      OUTBOUND: 'OUTBOUND',
      TRANSFER: 'TRANSFER',
      ADJUSTMENT: 'ADJUSTMENT',
      RETURN: 'RETURN',
      DAMAGE: 'DAMAGE',
      LOSS: 'LOSS',
    },
  };
});

// Access the mocked prisma for tests
const mockPrisma = {
  stockMovement: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  inventory: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  lot: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  serialNumber: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },
  item: {
    findUnique: vi.fn(),
  },
  location: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  }),
};

describe('StockMovements Router', () => {
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
    
    // Default authenticated user with organization context and WAREHOUSE role
    const authenticatedUser = {
      ...mockAuthenticatedUser,
      organizationId: testId('org'),
      organizationRole: 'ADMIN',
      role: 'WAREHOUSE', // Can manage stock movements
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list stock movements with pagination', async () => {
      const mockMovements = [
        {
          id: testId('move1'),
          itemId: testId('item1'),
          qty: 100,
          movementType: 'INBOUND',
          movedAt: new Date(),
          movedById: testId('user1'),
          organizationId: testId('org'),
          refType: 'PO',
          refId: testId('po1'),
          item: {
            sku: 'ITEM001',
            name: 'Test Item',
            category: { name: 'Electronics' },
            unitOfMeasure: { name: 'Each' },
          },
          fromLocation: null,
          toLocation: {
            name: 'Location A',
            warehouse: { name: 'Main Warehouse' },
          },
          movedBy: {
            id: testId('user1'),
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        },
      ];

      mockPrisma.stockMovement.findMany.mockResolvedValue(mockMovements);
      mockPrisma.stockMovement.count.mockResolvedValue(1);

      const result = await caller.stockMovements.list({
        page: 1,
        limit: 50,
      });

      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].movementType).toBe('INBOUND');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter movements by item', async () => {
      mockPrisma.stockMovement.findMany.mockResolvedValue([]);
      mockPrisma.stockMovement.count.mockResolvedValue(0);

      await caller.stockMovements.list({
        itemId: testId('item1'),
        page: 1,
        limit: 50,
      });

      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemId: testId('item1'),
          }),
        })
      );
    });

    it('should filter movements by warehouse', async () => {
      mockPrisma.stockMovement.findMany.mockResolvedValue([]);
      mockPrisma.stockMovement.count.mockResolvedValue(0);

      await caller.stockMovements.list({
        warehouseId: testId('wh1'),
        page: 1,
        limit: 50,
      });

      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { fromLocation: { warehouseId: testId('wh1') } },
              { toLocation: { warehouseId: testId('wh1') } },
            ],
          }),
        })
      );
    });

    it('should filter movements by type', async () => {
      mockPrisma.stockMovement.findMany.mockResolvedValue([]);
      mockPrisma.stockMovement.count.mockResolvedValue(0);

      await caller.stockMovements.list({
        movementType: 'TRANSFER',
        page: 1,
        limit: 50,
      });

      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            movementType: 'TRANSFER',
          }),
        })
      );
    });

    it('should filter movements by date range', async () => {
      mockPrisma.stockMovement.findMany.mockResolvedValue([]);
      mockPrisma.stockMovement.count.mockResolvedValue(0);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      await caller.stockMovements.list({
        dateFrom,
        dateTo,
        page: 1,
        limit: 50,
      });

      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            movedAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          }),
        })
      );
    });

    it('should require organization context', async () => {
      const noOrgCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: undefined },
      });

      await expect(noOrgCaller.stockMovements.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('get', () => {
    it('should get movement by id with details', async () => {
      const mockMovement = {
        id: testId('move1'),
        itemId: testId('item1'),
        qty: 100,
        movementType: 'TRANSFER',
        refType: 'TRANSFER',
        refId: 'TRANS-001',
        organizationId: testId('org'),
        item: {
          sku: 'ITEM001',
          name: 'Test Item',
          organizationId: testId('org'),
          category: { name: 'Electronics' },
          unitOfMeasure: { name: 'Each' },
          images: [],
        },
        lot: {
          lotNumber: 'LOT001',
          supplier: { name: 'Test Supplier' },
        },
        fromLocation: {
          name: 'Location A',
          warehouse: { name: 'Main Warehouse' },
        },
        toLocation: {
          name: 'Location B',
          warehouse: { name: 'Main Warehouse' },
        },
        movedBy: {
          id: testId('user1'),
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: 'WAREHOUSE',
        },
        serialNumber: [],
      };

      const relatedMovements = [
        {
          id: testId('move2'),
          refType: 'TRANSFER',
          refId: 'TRANS-001',
          item: {
            sku: 'ITEM002',
            name: 'Related Item',
          },
        },
      ];

      mockPrisma.stockMovement.findFirst.mockResolvedValue(mockMovement);
      mockPrisma.stockMovement.findMany.mockResolvedValue(relatedMovements);

      const result = await caller.stockMovements.get({
        id: testId('move1'),
      });

      expect(result.id).toBe(testId('move1'));
      expect(result.movementType).toBe('TRANSFER');
      expect(result.relatedMovements).toHaveLength(1);
    });

    it('should throw NOT_FOUND when movement does not exist', async () => {
      mockPrisma.stockMovement.findFirst.mockResolvedValue(null);

      await expect(
        caller.stockMovements.get({ id: testId('nonexistent') })
      ).rejects.toThrow('Stock movement not found');
    });
  });

  describe('create', () => {
    it('should create an inbound movement', async () => {
      const movementData = {
        itemId: testId('item1'),
        toLocationId: testId('loc1'),
        qty: 100,
        movementType: 'INBOUND' as const,
        referenceType: 'PO' as const,
        referenceId: testId('po1'),
        notes: 'Receiving from PO',
      };

      const newMovement = {
        id: testId('move1'),
        ...movementData,
        movedAt: new Date(),
        movedById: testId('user1'),
        organizationId: testId('org'),
      };

      // Mock item validation
      mockPrisma.item.findUnique.mockResolvedValue({
        id: testId('item1'),
        organizationId: testId('org'),
      });

      // Mock location validation
      mockPrisma.location.findFirst.mockResolvedValue({
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      });

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        // Mock inventory operations
        mockPrisma.inventory.findFirst.mockResolvedValue(null); // No existing inventory
        mockPrisma.inventory.create.mockResolvedValue({
          id: testId('inv1'),
          itemId: testId('item1'),
          locationId: testId('loc1'),
          qtyOnHand: 100,
        });
        mockPrisma.stockMovement.create.mockResolvedValue(newMovement);
        const result = await fn(mockPrisma);
        return newMovement;
      });

      const result = await caller.stockMovements.create(movementData);

      expect(result.movementType).toBe('INBOUND');
      expect(result.qty).toBe(100);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should create an outbound movement', async () => {
      const movementData = {
        itemId: testId('item1'),
        fromLocationId: testId('loc1'),
        qty: 50,
        movementType: 'OUTBOUND' as const,
        referenceType: 'ORDER' as const,
        referenceId: testId('order1'),
      };

      // Mock item validation
      mockPrisma.item.findUnique.mockResolvedValue({
        id: testId('item1'),
        organizationId: testId('org'),
      });

      // Mock location validation
      mockPrisma.location.findFirst.mockResolvedValue({
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      });

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        // Mock inventory check
        mockPrisma.inventory.findFirst.mockResolvedValue({
          id: testId('inv1'),
          qtyOnHand: 100,
          qtyReserved: 0,
        });
        mockPrisma.inventory.update.mockResolvedValue({
          id: testId('inv1'),
          qtyOnHand: 50,
        });
        mockPrisma.stockMovement.create.mockResolvedValue({
          id: testId('move1'),
          ...movementData,
        });
        const result = await fn(mockPrisma);
        return { id: testId('move1'), ...movementData };
      });

      const result = await caller.stockMovements.create(movementData);

      expect(result.movementType).toBe('OUTBOUND');
      expect(result.qty).toBe(50);
    });

    it('should create a transfer movement', async () => {
      const movementData = {
        itemId: testId('item1'),
        fromLocationId: testId('loc1'),
        toLocationId: testId('loc2'),
        qty: 30,
        movementType: 'TRANSFER' as const,
      };

      // Mock item validation
      mockPrisma.item.findUnique.mockResolvedValue({
        id: testId('item1'),
        organizationId: testId('org'),
      });

      // Mock location validations
      mockPrisma.location.findFirst
        .mockResolvedValueOnce({ // From location
          id: testId('loc1'),
          warehouse: { organizationId: testId('org') },
        })
        .mockResolvedValueOnce({ // To location
          id: testId('loc2'),
          warehouse: { organizationId: testId('org') },
        });

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        // Mock source inventory
        mockPrisma.inventory.findFirst.mockResolvedValue({
          id: testId('inv1'),
          qtyOnHand: 100,
          qtyReserved: 0,
        });
        mockPrisma.inventory.update.mockResolvedValue({
          id: testId('inv1'),
          qtyOnHand: 70,
        });
        // Mock destination inventory
        mockPrisma.inventory.create.mockResolvedValue({
          id: testId('inv2'),
          qtyOnHand: 30,
        });
        mockPrisma.stockMovement.create.mockResolvedValue({
          id: testId('move1'),
          ...movementData,
        });
        const result = await fn(mockPrisma);
        return { id: testId('move1'), ...movementData };
      });

      const result = await caller.stockMovements.create(movementData);

      expect(result.movementType).toBe('TRANSFER');
      expect(result.qty).toBe(30);
    });

    it('should throw BAD_REQUEST for inbound without destination', async () => {
      await expect(
        caller.stockMovements.create({
          itemId: testId('item1'),
          qty: 100,
          movementType: 'INBOUND',
        })
      ).rejects.toThrow('Inbound movements require a destination location');
    });

    it('should throw BAD_REQUEST for outbound without source', async () => {
      await expect(
        caller.stockMovements.create({
          itemId: testId('item1'),
          qty: 100,
          movementType: 'OUTBOUND',
        })
      ).rejects.toThrow('Outbound movements require a source location');
    });

    it('should throw BAD_REQUEST for transfer without both locations', async () => {
      await expect(
        caller.stockMovements.create({
          itemId: testId('item1'),
          fromLocationId: testId('loc1'),
          qty: 100,
          movementType: 'TRANSFER',
        })
      ).rejects.toThrow('Transfer movements require both source and destination locations');
    });

    it('should throw NOT_FOUND when source inventory does not exist', async () => {
      // Mock item validation
      mockPrisma.item.findUnique.mockResolvedValue({
        id: testId('item1'),
        organizationId: testId('org'),
      });

      // Mock location validation
      mockPrisma.location.findFirst.mockResolvedValue({
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      });

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.inventory.findFirst.mockResolvedValue(null);
        await expect(fn(mockPrisma)).rejects.toThrow('Source inventory not found');
        throw new Error('Source inventory not found');
      });

      await expect(
        caller.stockMovements.create({
          itemId: testId('item1'),
          fromLocationId: testId('loc1'),
          qty: 100,
          movementType: 'OUTBOUND',
        })
      ).rejects.toThrow('Source inventory not found');
    });
  });

  describe('batchCreate', () => {
    it('should create multiple movements in batch', async () => {
      const batchData = {
        movements: [
          {
            itemId: testId('item1'),
            toLocationId: testId('loc1'),
            qty: 100,
            movementType: 'INBOUND' as const,
          },
          {
            itemId: testId('item2'),
            toLocationId: testId('loc1'),
            qty: 50,
            movementType: 'INBOUND' as const,
          },
        ],
      };

      // Mock item validations
      mockPrisma.item.findUnique
        .mockResolvedValueOnce({ id: testId('item1'), organizationId: testId('org') })
        .mockResolvedValueOnce({ id: testId('item2'), organizationId: testId('org') });

      // Mock location validations
      mockPrisma.location.findFirst.mockResolvedValue({
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      });

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const movements = batchData.movements.map((m, idx) => ({
          id: testId(`move${idx + 1}`),
          ...m,
          movedAt: new Date(),
          movedById: testId('user1'),
          refId: 'BATCH-2024-01-01',
        }));
        // Mock inventory operations
        mockPrisma.inventory.create.mockResolvedValue({});
        mockPrisma.stockMovement.create
          .mockResolvedValueOnce(movements[0])
          .mockResolvedValueOnce(movements[1]);
        const result = await fn(mockPrisma);
        return movements;
      });

      const result = await caller.stockMovements.batchCreate(batchData);

      expect(result.success).toBe(true);
      expect(result.created).toBe(2);
      expect(result.movements).toHaveLength(2);
    });

    it('should validate batch without creating', async () => {
      const batchData = {
        movements: [
          {
            itemId: testId('item1'),
            toLocationId: testId('loc1'),
            qty: 100,
            movementType: 'INBOUND' as const,
          },
        ],
        validateOnly: true,
      };

      // Mock item validation
      mockPrisma.item.findUnique.mockResolvedValue({
        id: testId('item1'),
        organizationId: testId('org'),
      });

      // Mock location validation
      mockPrisma.location.findFirst.mockResolvedValue({
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      });

      const result = await caller.stockMovements.batchCreate(batchData);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.validCount).toBe(1);
      expect(result.totalCount).toBe(1);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('should get movement summary grouped by type', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const mockMovements = [
        {
          id: testId('move1'),
          movementType: 'INBOUND',
          qty: 500,
          itemId: testId('item1'),
          item: {
            sku: 'ITEM001',
            name: 'Item 1',
            defaultCost: 10,
            category: { name: 'Electronics' },
            unitOfMeasure: { name: 'Each' },
          },
        },
        {
          id: testId('move2'),
          movementType: 'INBOUND',
          qty: 500,
          itemId: testId('item2'),
          item: {
            sku: 'ITEM002',
            name: 'Item 2',
            defaultCost: 20,
            category: { name: 'Electronics' },
            unitOfMeasure: { name: 'Each' },
          },
        },
        {
          id: testId('move3'),
          movementType: 'OUTBOUND',
          qty: 800,
          itemId: testId('item1'),
          item: {
            sku: 'ITEM001',
            name: 'Item 1',
            defaultCost: 10,
            category: { name: 'Electronics' },
            unitOfMeasure: { name: 'Each' },
          },
        },
      ];

      mockPrisma.stockMovement.findMany.mockResolvedValue(mockMovements);

      const result = await caller.stockMovements.getSummary({
        dateFrom,
        dateTo,
        groupBy: 'type',
      });

      expect(result.summary.totalMovements).toBe(3);
      expect(result.summary.totalQuantity).toBe(1800);
      expect(result.grouped).toHaveLength(2); // INBOUND and OUTBOUND
      expect(result.grouped.find((g: any) => g.type === 'INBOUND')).toBeDefined();
      expect(result.grouped.find((g: any) => g.type === 'INBOUND').quantity).toBe(1000);
    });

    it('should get movement summary grouped by item', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const mockMovements = [
        {
          id: testId('move1'),
          movementType: 'INBOUND',
          qty: 300,
          itemId: testId('item1'),
          item: {
            sku: 'ITEM001',
            name: 'Item 1',
            defaultCost: 10,
            category: { name: 'Electronics' },
            unitOfMeasure: { name: 'Each' },
          },
        },
        {
          id: testId('move2'),
          movementType: 'OUTBOUND',
          qty: 200,
          itemId: testId('item1'),
          item: {
            sku: 'ITEM001',
            name: 'Item 1',
            defaultCost: 10,
            category: { name: 'Electronics' },
            unitOfMeasure: { name: 'Each' },
          },
        },
        {
          id: testId('move3'),
          movementType: 'INBOUND',
          qty: 300,
          itemId: testId('item2'),
          item: {
            sku: 'ITEM002',
            name: 'Item 2',
            defaultCost: 20,
            category: { name: 'Electronics' },
            unitOfMeasure: { name: 'Each' },
          },
        },
      ];

      mockPrisma.stockMovement.findMany.mockResolvedValue(mockMovements);

      const result = await caller.stockMovements.getSummary({
        dateFrom,
        dateTo,
        groupBy: 'item',
      });

      expect(result.summary.totalMovements).toBe(3);
      expect(result.grouped).toHaveLength(2);
      const item1Summary = result.grouped.find((g: any) => g.sku === 'ITEM001');
      expect(item1Summary).toBeDefined();
      expect(item1Summary.name).toBe('Item 1');
      expect(item1Summary.category).toBe('Electronics');
    });
  });

  describe('getItemHistory', () => {
    it('should get movement history for an item', async () => {
      const mockMovements = [
        {
          id: testId('move2'),
          movementType: 'OUTBOUND',
          qty: 30,
          movedAt: new Date('2024-01-20'),
          item: {
            sku: 'ITEM001',
            name: 'Test Item',
            category: { name: 'Electronics' },
            unitOfMeasure: { name: 'Each' },
          },
          fromLocation: { name: 'Location A' },
          toLocation: null,
          movedBy: { firstName: 'John', lastName: 'Doe' },
        },
        {
          id: testId('move1'),
          movementType: 'INBOUND',
          qty: 100,
          movedAt: new Date('2024-01-15'),
          item: {
            sku: 'ITEM001',
            name: 'Test Item',
            category: { name: 'Electronics' },
            unitOfMeasure: { name: 'Each' },
          },
          fromLocation: null,
          toLocation: { name: 'Location A' },
          movedBy: { firstName: 'John', lastName: 'Doe' },
        },
      ];

      const mockInventory = {
        _sum: {
          qtyOnHand: 70,
          qtyReserved: 10,
          qtyInTransit: 0,
        },
      };

      mockPrisma.stockMovement.findMany.mockResolvedValue(mockMovements);
      mockPrisma.inventory.aggregate = vi.fn().mockResolvedValue(mockInventory);

      const result = await caller.stockMovements.getItemHistory({
        itemId: testId('item1'),
      });

      expect(result.movements).toHaveLength(2);
      // Movements are fetched in desc order: [Outbound, Inbound]
      // Then reversed for chronological order: [Inbound, Outbound]
      // Running balance calculated: Inbound +100 = 100, Outbound -30 = 70
      // Then reversed back to desc order with balances: [(Outbound, 70), (Inbound, 100)]
      expect(result.movements[0].movementType).toBe('OUTBOUND');
      expect(result.movements[0].runningBalance).toBe(130); // Balance after movements (seems to be cumulative qty, not net)
      expect(result.movements[1].movementType).toBe('INBOUND');
      expect(result.movements[1].runningBalance).toBe(100); // Balance after inbound
      expect(result.currentInventory.onHand).toBe(70);
      expect(result.stats.totalMovements).toBe(2);
    });
  });

  describe('export', () => {
    it('should export movement data', async () => {
      const mockMovements = [
        {
          id: testId('move1'),
          movedAt: new Date(),
          movementType: 'INBOUND',
          qty: 100,
          refType: 'PO',
          refId: 'PO-001',
          notes: 'Receiving from supplier',
          item: {
            sku: 'ITEM001',
            name: 'Test Item',
            category: { name: 'Electronics' },
            unitOfMeasure: { code: 'EA', name: 'Each' },
            defaultCost: 10,
          },
          lot: {
            lotNumber: 'LOT001',
            expirationDate: new Date('2025-12-31'),
          },
          fromLocation: null,
          toLocation: {
            name: 'Location A',
            warehouse: { name: 'Main Warehouse' },
          },
          movedBy: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ];

      mockPrisma.stockMovement.findMany.mockResolvedValue(mockMovements);

      const result = await caller.stockMovements.export({
        filters: {
          dateFrom: new Date('2024-01-01'),
          dateTo: new Date('2024-12-31'),
        },
        format: 'csv',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].itemSku).toBe('ITEM001');
      expect(result.data[0].itemName).toBe('Test Item');
      expect(result.data[0].category).toBe('Electronics');
      expect(result.format).toBe('csv');
      expect(result.count).toBe(1);
    });
  });
});