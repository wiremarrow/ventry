import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';
import { prisma as mockPrisma } from '@ventry/database';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    inventory: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    item: {
      findMany: vi.fn(),
    },
    itemCategory: {
      findUnique: vi.fn(),
    },
    warehouse: {
      findUnique: vi.fn(),
    },
    receiptItem: {
      findMany: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    purchaseOrder: {
      findMany: vi.fn(),
    },
    purchaseOrderItem: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    return: {
      findMany: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
    supplier: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  // Set up transaction mock
  mockPrisma.$transaction.mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  });
  
  return {
    prisma: mockPrisma,
    Prisma: {},
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

describe('Reports Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset all mock implementations to avoid interference between tests
    mockPrisma.inventory.findMany.mockReset();
    mockPrisma.inventory.groupBy.mockReset();
    mockPrisma.inventory.aggregate.mockReset();
    mockPrisma.item.findMany.mockReset();
    mockPrisma.itemCategory.findUnique.mockReset();
    mockPrisma.warehouse.findUnique.mockReset();
    mockPrisma.receiptItem.findMany.mockReset();
    mockPrisma.stockMovement.findMany.mockReset();
    mockPrisma.stockMovement.groupBy.mockReset();
    mockPrisma.stockMovement.aggregate.mockReset();
    mockPrisma.stockMovement.count.mockReset();
    mockPrisma.order.findMany.mockReset();
    mockPrisma.orderItem.findMany.mockReset();
    mockPrisma.orderItem.aggregate.mockReset();
    mockPrisma.purchaseOrder.findMany.mockReset();
    mockPrisma.purchaseOrderItem.findMany.mockReset();
    mockPrisma.purchaseOrderItem.aggregate.mockReset();
    mockPrisma.return.findMany.mockReset();
    mockPrisma.customer.findMany.mockReset();
    mockPrisma.supplier.findMany.mockReset();
    mockPrisma.auditLog.create.mockReset();
    
    // Create a proper mock response object
    mockRes = {
      setCookie: vi.fn(),
      clearCookie: vi.fn(),
      header: vi.fn(),
    };
    
    // Default authenticated user with organization context
    const authenticatedUser = {
      ...mockAuthenticatedUser,
      organizationId: testId('org'),
      organizationRole: 'ADMIN',
      role: 'ADMIN',
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('inventoryValuation', () => {
    it('should calculate inventory valuation with AVERAGE method', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          qtyOnHand: 100,
          item: {
            id: testId('item1'),
            sku: 'ITEM-001',
            name: 'Test Item 1',
            defaultCost: '50.00',
            category: { name: 'Electronics' },
          },
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: null,
        },
      ];

      const mockReceipts = [
        {
          itemId: testId('item1'),
          unitCost: '45.00',
          qtyReceived: 50,
          receipt: { receivedDate: new Date('2024-01-01') },
        },
        {
          itemId: testId('item1'),
          unitCost: '48.00',
          qtyReceived: 50,
          receipt: { receivedDate: new Date('2024-01-15') },
        },
      ];

      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);
      mockPrisma.receiptItem.findMany.mockResolvedValue(mockReceipts);

      const result = await caller.reports.inventoryValuation({
        asOfDate: new Date('2024-01-31'),
        valuationMethod: 'AVERAGE',
        groupBy: 'item',
      });

      expect(result.valuationMethod).toBe('AVERAGE');
      expect(result.summary.totalItems).toBe(1);
      expect(result.summary.totalQuantity).toBe(100);
      // Average cost = (45*50 + 48*50) / 100 = 46.5
      expect(result.summary.totalValue).toBe(4650); // 100 * 46.5
      expect(result.data[0].unitCost).toBe(46.5);
    });

    it('should calculate valuation with FIFO method', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          qtyOnHand: 75,
          item: {
            id: testId('item1'),
            sku: 'ITEM-001',
            name: 'Test Item',
            defaultCost: '50.00',
            category: { name: 'Electronics' },
          },
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: null,
        },
      ];

      const mockReceipts = [
        {
          itemId: testId('item1'),
          unitCost: '40.00',
          qtyReceived: 50,
          receipt: { receivedDate: new Date('2024-01-01') },
        },
        {
          itemId: testId('item1'),
          unitCost: '45.00',
          qtyReceived: 50,
          receipt: { receivedDate: new Date('2024-01-15') },
        },
      ];

      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);
      mockPrisma.receiptItem.findMany.mockResolvedValue(mockReceipts);

      const result = await caller.reports.inventoryValuation({
        valuationMethod: 'FIFO',
        groupBy: 'item',
      });

      // FIFO: First 50 @ $40, next 25 @ $45 = 2000 + 1125 = 3125
      expect(result.data[0].totalValue).toBe(3125);
      expect(result.data[0].unitCost).toBeCloseTo(41.67, 2); // 3125 / 75
    });

    it('should group by category', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          qtyOnHand: 50,
          item: {
            id: testId('item1'),
            sku: 'ITEM-001',
            name: 'Item 1',
            defaultCost: '10.00',
            category: { name: 'Electronics' },
          },
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: null,
        },
        {
          id: testId('inv2'),
          itemId: testId('item2'),
          qtyOnHand: 30,
          item: {
            id: testId('item2'),
            sku: 'ITEM-002',
            name: 'Item 2',
            defaultCost: '20.00',
            category: { name: 'Electronics' },
          },
          location: {
            code: 'A-1-2',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: null,
        },
      ];

      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);
      mockPrisma.receiptItem.findMany.mockResolvedValue([]);

      const result = await caller.reports.inventoryValuation({
        groupBy: 'category',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].category).toBe('Electronics');
      expect(result.data[0].totalValue).toBe(1100); // (50*10) + (30*20)
      expect(result.data[0].totalQuantity).toBe(80);
    });

    it('should filter by warehouse', async () => {
      mockPrisma.inventory.findMany.mockResolvedValue([]);
      mockPrisma.receiptItem.findMany.mockResolvedValue([]);

      await caller.reports.inventoryValuation({
        includeAllWarehouses: false,
        warehouseIds: [testId('wh1'), testId('wh2')],
      });

      expect(mockPrisma.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: {
              warehouseId: { in: [testId('wh1'), testId('wh2')] },
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

      await expect(noOrgCaller.reports.inventoryValuation({})).rejects.toThrow('No organization selected');
    });
  });

  describe('stockMovement', () => {
    it('should generate stock movement report', async () => {
      const mockMovements = [
        {
          id: testId('sm1'),
          itemId: testId('item1'),
          movementType: 'INBOUND',
          qty: 100,
          movedAt: new Date('2024-01-15'),
          fromLocation: null,
          toLocation: {
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          movedBy: { firstName: 'John', lastName: 'Doe' },
        },
        {
          id: testId('sm2'),
          itemId: testId('item1'),
          movementType: 'OUTBOUND',
          qty: 50,
          movedAt: new Date('2024-01-20'),
          fromLocation: {
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          toLocation: null,
          movedBy: { firstName: 'Jane', lastName: 'Smith' },
        },
      ];

      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Test Item',
          category: { name: 'Electronics' },
        },
      ];

      mockPrisma.stockMovement.findMany.mockResolvedValue(mockMovements);
      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { itemId: testId('item1'), _sum: { qty: 100 } },
      ]);
      mockPrisma.inventory.groupBy.mockResolvedValue([
        { itemId: testId('item1'), _sum: { qtyOnHand: 50 } },
      ]);

      const result = await caller.reports.stockMovement({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
      });

      expect(result.summary.totalMovements).toBe(2);
      expect(result.summary.byType).toHaveLength(2);
      expect(result.itemMovements).toHaveLength(1);
      expect(result.itemMovements[0].receipts).toBe(100);
      expect(result.itemMovements[0].shipments).toBe(50);
      expect(result.itemMovements[0].netChange).toBe(50);
    });

    it('should filter by movement types', async () => {
      mockPrisma.stockMovement.findMany.mockResolvedValue([]);
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.inventory.groupBy.mockResolvedValue([]);

      await caller.reports.stockMovement({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        movementTypes: ['INBOUND', 'OUTBOUND'],
      });

      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            movementType: { in: ['INBOUND', 'OUTBOUND'] },
          }),
        })
      );
    });

    it('should include movement details when requested', async () => {
      const mockMovements = [
        {
          id: testId('sm1'),
          itemId: testId('item1'),
          movementType: 'INBOUND',
          qty: 100,
          movedAt: new Date('2024-01-15'),
          fromLocation: null,
          toLocation: { code: 'A-1-1', warehouse: { name: 'Main' } },
          movedBy: { firstName: 'John', lastName: 'Doe' },
        },
      ];

      mockPrisma.stockMovement.findMany.mockResolvedValue(mockMovements);
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.inventory.groupBy.mockResolvedValue([]);

      const result = await caller.reports.stockMovement({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        includeDetails: true,
      });

      expect(result.details).toBeDefined();
      expect(result.details).toEqual(mockMovements);
    });
  });

  describe('lowStockAlert', () => {
    it('should identify low stock items', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Test Item',
          isActive: true,
          reorderPoint: 50,
          reorderQty: 100,
          category: { name: 'Electronics' },
          inventory: [
            {
              qtyOnHand: 20,
              qtyReserved: 5,
              location: {
                code: 'A-1-1',
                warehouse: { name: 'Main Warehouse' },
              },
            },
          ],
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.stockMovement.aggregate.mockResolvedValue({
        _sum: { qty: 300 }, // 10 per day average
        _count: 30,
      });
      mockPrisma.purchaseOrderItem.aggregate.mockResolvedValue({
        _sum: { qtyOrdered: 0 },
      });

      const result = await caller.reports.lowStockAlert({
        daysOfSupply: 30,
      });

      expect(result.summary.totalItems).toBe(1);
      expect(result.items[0].status).toBe('CRITICAL'); // Only 1.5 days of supply
      expect(result.items[0].usage.avgDailyUsage).toBe(10);
      expect(result.items[0].usage.daysOfSupplyRemaining).toBe(2); // 15 available / 10 per day
      expect(result.items[0].ordering.suggestedReorderQty).toBeGreaterThan(0);
    });

    it('should identify out of stock items', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Out of Stock Item',
          isActive: true,
          reorderPoint: 50,
          reorderQty: 100,
          category: { name: 'Electronics' },
          inventory: [
            {
              qtyOnHand: 0,
              qtyReserved: 0,
              location: {
                code: 'A-1-1',
                warehouse: { name: 'Main' },
              },
            },
          ],
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.stockMovement.aggregate.mockResolvedValue({
        _sum: { qty: 300 },
        _count: 30,
      });
      mockPrisma.purchaseOrderItem.aggregate.mockResolvedValue({
        _sum: { qtyOrdered: 0 },
      });

      const result = await caller.reports.lowStockAlert({});

      expect(result.items[0].status).toBe('OUT_OF_STOCK');
      expect(result.items[0].usage.daysOfSupplyRemaining).toBe(0);
      expect(result.summary.outOfStock).toBe(1);
    });

    it('should include sufficient stock when requested', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Well Stocked Item',
          isActive: true,
          reorderPoint: 50,
          reorderQty: 100,
          category: { name: 'Electronics' },
          inventory: [
            {
              qtyOnHand: 500,
              qtyReserved: 0,
              location: {
                code: 'A-1-1',
                warehouse: { name: 'Main' },
              },
            },
          ],
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.stockMovement.aggregate.mockResolvedValue({
        _sum: { qty: 30 }, // 1 per day
        _count: 30,
      });
      mockPrisma.purchaseOrderItem.aggregate.mockResolvedValue({
        _sum: { qtyOrdered: 0 },
      });

      const result = await caller.reports.lowStockAlert({
        includeSufficientStock: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('SUFFICIENT');
      expect(result.summary.sufficient).toBe(1);
    });
  });

  describe('expiringItems', () => {
    it('should find expiring items', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          qtyOnHand: 100,
          qtyReserved: 10,
          item: {
            id: testId('item1'),
            sku: 'ITEM-001',
            name: 'Perishable Item',
            defaultCost: '10.00',
            category: { name: 'Food' },
          },
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: {
            lotNumber: 'LOT-001',
            expirationDate: new Date('2024-02-15'), // Expires in 15 days
          },
        },
        {
          id: testId('inv2'),
          itemId: testId('item2'),
          qtyOnHand: 50,
          qtyReserved: 0,
          item: {
            id: testId('item2'),
            sku: 'ITEM-002',
            name: 'Expired Item',
            defaultCost: '5.00',
            category: { name: 'Food' },
          },
          location: {
            code: 'A-1-2',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: {
            lotNumber: 'LOT-002',
            expirationDate: new Date('2023-12-31'), // Already expired
          },
        },
      ];

      // Mock date to be 2024-01-31
      vi.setSystemTime(new Date('2024-01-31'));

      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);

      const result = await caller.reports.expiringItems({
        daysAhead: 90,
        includeExpired: true,
      });

      expect(result.summary.totalItems).toBe(2);
      expect(result.summary.expired).toBe(1);
      expect(result.summary.expiringSoon).toBe(1);
      expect(result.summary.totalValue).toBe(1250); // (100*10) + (50*5)
      
      expect(result.items[0].inventory.status).toBe('EXPIRED');
      expect(result.items[1].inventory.status).toBe('EXPIRING_SOON');

      vi.useRealTimers();
    });

    it('should exclude expired items when requested', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          qtyOnHand: 100,
          qtyReserved: 0,
          item: {
            id: testId('item1'),
            sku: 'ITEM-001',
            name: 'Future Expiry',
            defaultCost: '10.00',
            category: { name: 'Food' },
          },
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main' },
          },
          lot: {
            lotNumber: 'LOT-001',
            expirationDate: new Date('2024-06-01'),
          },
        },
      ];

      vi.setSystemTime(new Date('2024-01-31'));

      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);

      const result = await caller.reports.expiringItems({
        daysAhead: 180,
        includeExpired: false,
      });

      expect(result.items).toHaveLength(1);
      expect(result.summary.expired).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('salesAnalysis', () => {
    it('should analyze sales by item', async () => {
      const mockOrders = [
        {
          id: testId('order1'),
          customerId: testId('cust1'),
          orderDate: new Date('2024-01-15'),
          subtotal: 1000,
          discountTotal: 100,
          grandTotal: 900,
          status: 'DELIVERED',
          customer: { id: testId('cust1'), companyName: 'ABC Corp' },
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 10,
              unitPrice: '100.00',
              discountPct: '10.00',
              totalPrice: '900.00',
              item: {
                id: testId('item1'),
                sku: 'ITEM-001',
                name: 'Product 1',
                category: { name: 'Electronics' },
              },
            },
          ],
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.return.findMany.mockResolvedValue([]);

      const result = await caller.reports.salesAnalysis({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        groupByItem: true,
        groupByCustomer: false,
      });

      expect(result.summary.totalOrders).toBe(1);
      expect(result.summary.totalQuantity).toBe(10);
      expect(result.summary.netRevenue).toBe(900);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].item.sku).toBe('ITEM-001');
      expect(result.data[0].quantitySold).toBe(10);
      expect(result.data[0].netRevenue).toBe(900);
    });

    it('should analyze sales by customer', async () => {
      const mockOrders = [
        {
          id: testId('order1'),
          customerId: testId('cust1'),
          orderDate: new Date('2024-01-15'),
          subtotal: 1000,
          discountTotal: 100,
          grandTotal: 900,
          status: 'DELIVERED',
          customer: {
            id: testId('cust1'),
            companyName: 'ABC Corp',
            email: 'abc@example.com',
          },
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 10,
              unitPrice: '100.00',
              totalPrice: '900.00',
              item: { id: testId('item1') },
            },
          ],
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.return.findMany.mockResolvedValue([]);

      const result = await caller.reports.salesAnalysis({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        groupByItem: false,
        groupByCustomer: true,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].customer.name).toBe('ABC Corp');
      expect(result.data[0].orderCount).toBe(1);
      expect(result.data[0].netRevenue).toBe(900);
      expect(result.data[0].avgOrderValue).toBe(900);
    });

    it('should include returns when requested', async () => {
      const mockOrders = [
        {
          id: testId('order1'),
          customerId: testId('cust1'),
          orderDate: new Date('2024-01-15'),
          subtotal: 1000,
          grandTotal: 1000,
          status: 'DELIVERED',
          customer: { id: testId('cust1') },
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 10,
              unitPrice: '100.00',
              totalPrice: '1000.00',
              discountPct: '0',
              item: {
                id: testId('item1'),
                sku: 'ITEM-001',
                name: 'Product 1',
                category: null,
              },
            },
          ],
        },
      ];

      const mockReturns = [
        {
          id: testId('ret1'),
          customerId: testId('cust1'),
          createdAt: new Date('2024-01-20'),
          order: {
            customer: { id: testId('cust1') },
          },
          items: [
            {
              itemId: testId('item1'),
              qtyReturned: 2,
              refundAmount: '200.00',
              item: { id: testId('item1') },
            },
          ],
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.return.findMany.mockResolvedValue(mockReturns);

      const result = await caller.reports.salesAnalysis({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        groupByItem: true,
        includeReturns: true,
      });

      expect(result.data[0].returnQuantity).toBe(2);
      expect(result.data[0].returnRate).toBe(20); // 2/10 * 100
      expect(result.summary.returnCount).toBe(1);
    });
  });

  describe('purchaseAnalysis', () => {
    it('should analyze purchases by supplier', async () => {
      const mockPOs = [
        {
          id: testId('po1'),
          supplierId: testId('supp1'),
          orderDate: new Date('2024-01-15'),
          expectedDate: new Date('2024-01-20'),
          total: '5000.00',
          status: 'RECEIVED',
          supplier: {
            id: testId('supp1'),
            name: 'Supplier ABC',
            email: 'supplier@example.com',
          },
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 100,
              unitCost: '50.00',
              totalCost: '5000.00',
              item: {
                id: testId('item1'),
                sku: 'ITEM-001',
                name: 'Product 1',
                category: { name: 'Electronics' },
              },
            },
          ],
          receipts: [
            {
              receivedDate: new Date('2024-01-19'),
              items: [
                {
                  itemId: testId('item1'),
                  qtyReceived: 100,
                },
              ],
            },
          ],
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPOs);

      const result = await caller.reports.purchaseAnalysis({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        groupBySupplier: true,
        groupByItem: false,
      });

      expect(result.summary.totalPOs).toBe(1);
      expect(result.summary.totalAmount).toBe(5000);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].supplier.name).toBe('Supplier ABC');
      expect(result.data[0].fulfillmentRate).toBe(100);
      expect(result.data[0].onTimeRate).toBe(100); // Delivered before expected date
    });

    it('should analyze purchases by item', async () => {
      const mockPOs = [
        {
          id: testId('po1'),
          supplierId: testId('supp1'),
          orderDate: new Date('2024-01-15'),
          total: '5000.00',
          status: 'APPROVED',
          supplier: { id: testId('supp1') },
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 100,
              unitCost: '50.00',
              totalCost: '5000.00',
              item: {
                id: testId('item1'),
                sku: 'ITEM-001',
                name: 'Product 1',
                category: { name: 'Electronics' },
              },
            },
          ],
          receipts: [],
        },
        {
          id: testId('po2'),
          supplierId: testId('supp2'),
          orderDate: new Date('2024-01-20'),
          total: '3000.00',
          status: 'APPROVED',
          supplier: { id: testId('supp2') },
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 50,
              unitCost: '60.00',
              totalCost: '3000.00',
              item: {
                id: testId('item1'),
                sku: 'ITEM-001',
                name: 'Product 1',
                category: { name: 'Electronics' },
              },
            },
          ],
          receipts: [],
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPOs);

      const result = await caller.reports.purchaseAnalysis({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        groupBySupplier: false,
        groupByItem: true,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].item.sku).toBe('ITEM-001');
      expect(result.data[0].orderedQuantity).toBe(150);
      expect(result.data[0].totalAmount).toBe(8000);
      expect(result.data[0].avgUnitPrice).toBeCloseTo(53.33, 2); // 8000/150
      expect(result.data[0].minUnitPrice).toBe(50);
      expect(result.data[0].maxUnitPrice).toBe(60);
      expect(result.data[0].supplierCount).toBe(2);
    });
  });

  describe('profitability', () => {
    it('should calculate item profitability', async () => {
      const mockOrders = [
        {
          id: testId('order1'),
          customerId: testId('cust1'),
          orderDate: new Date('2024-01-15'),
          status: 'DELIVERED',
          customer: { id: testId('cust1') },
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 10,
              unitPrice: '100.00',
              totalPrice: '1000.00',
              item: {
                id: testId('item1'),
                sku: 'ITEM-001',
                name: 'Product 1',
                defaultCost: '60.00',
                category: { name: 'Electronics' },
              },
            },
          ],
        },
      ];

      const mockReceipts = [
        {
          itemId: testId('item1'),
          unitCost: '55.00',
          qtyReceived: 50,
          receipt: { receivedDate: new Date('2024-01-01') },
        },
        {
          itemId: testId('item1'),
          unitCost: '58.00',
          qtyReceived: 50,
          receipt: { receivedDate: new Date('2024-01-10') },
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.receiptItem.findMany.mockResolvedValue(mockReceipts);

      const result = await caller.reports.profitability({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        includeIndirectCosts: true,
        indirectCostPercentage: 15,
      });

      expect(result.summary.totalRevenue).toBe(1000);
      // Average cost = (55*50 + 58*50) / 100 = 56.5
      // COGS = 10 * 56.5 = 565
      expect(result.summary.totalCOGS).toBe(565);
      expect(result.summary.totalGrossProfit).toBe(435);
      expect(result.summary.totalIndirectCosts).toBe(150); // 15% of 1000
      expect(result.summary.totalNetProfit).toBe(285);
      
      expect(result.byItem[0].grossMargin).toBe(43.5); // 435/1000 * 100
      expect(result.byItem[0].netMargin).toBeCloseTo(28.5, 1); // 285/1000 * 100
    });

    it('should identify top and bottom performers', async () => {
      const mockOrders = [
        {
          id: testId('order1'),
          customerId: testId('cust1'),
          orderDate: new Date('2024-01-15'),
          status: 'DELIVERED',
          customer: { id: testId('cust1') },
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 10,
              unitPrice: '100.00',
              totalPrice: '1000.00',
              item: {
                id: testId('item1'),
                sku: 'PROFITABLE',
                name: 'Profitable Item',
                defaultCost: '30.00',
                category: null,
              },
            },
            {
              itemId: testId('item2'),
              qtyOrdered: 5,
              unitPrice: '50.00',
              totalPrice: '250.00',
              item: {
                id: testId('item2'),
                sku: 'UNPROFITABLE',
                name: 'Loss Making Item',
                defaultCost: '60.00',
                category: null,
              },
            },
          ],
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.receiptItem.findMany.mockResolvedValue([]);

      const result = await caller.reports.profitability({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
      });

      expect(result.topPerformers).toHaveLength(2);
      expect(result.topPerformers[0].item.sku).toBe('PROFITABLE');
      expect(result.topPerformers[0].netProfit).toBe(700); // 1000 - 300

      expect(result.bottomPerformers).toHaveLength(1);
      expect(result.bottomPerformers[0].item.sku).toBe('UNPROFITABLE');
      expect(result.bottomPerformers[0].netProfit).toBe(-50); // 250 - 300
    });
  });

  describe('inventoryTurnover', () => {
    it('should calculate turnover using COGS method', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Fast Moving Item',
          isActive: true,
          defaultCost: '50.00',
          category: { name: 'Electronics' },
          inventory: [
            {
              qtyOnHand: 100,
            },
          ],
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.stockMovement.aggregate
        .mockResolvedValueOnce({ _sum: { qty: 100 } }) // Beginning inventory
        .mockResolvedValueOnce({ _sum: { qty: 1200 } }); // Shipments in period

      const result = await caller.reports.inventoryTurnover({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        method: 'COGS',
      });

      expect(result.method).toBe('COGS');
      expect(result.items).toHaveLength(1);
      
      // Average inventory = (100 + 100) / 2 = 100
      // COGS = 1200 * 50 = 60000
      // Annualized COGS = 60000 * (365/31) = 706451.61
      // Turnover = 706451.61 / 5000 = 141.29
      expect(result.items[0].turnover.rate).toBeGreaterThan(100);
      expect(result.items[0].turnover.performance).toBe('VERY_FAST');
    });

    it('should calculate turnover using SALES method', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Test Item',
          isActive: true,
          defaultCost: '50.00',
          category: { name: 'Electronics' },
          inventory: [
            {
              qtyOnHand: 100,
            },
          ],
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.stockMovement.aggregate.mockResolvedValue({ _sum: { qty: 100 } });
      mockPrisma.orderItem.aggregate.mockResolvedValue({
        _sum: {
          totalPrice: '10000.00',
          qtyOrdered: 100,
        },
      });

      const result = await caller.reports.inventoryTurnover({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
        method: 'SALES',
      });

      expect(result.method).toBe('SALES');
      expect(result.items[0].turnover.rate).toBeGreaterThan(0);
    });

    it('should classify slow moving items', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'SLOW-001',
          name: 'Slow Moving Item',
          isActive: true,
          defaultCost: '100.00',
          category: { name: 'Electronics' },
          inventory: [
            {
              qtyOnHand: 1000,
            },
          ],
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.stockMovement.aggregate
        .mockResolvedValueOnce({ _sum: { qty: 1000 } }) // Beginning inventory
        .mockResolvedValueOnce({ _sum: { qty: 50 } }); // Very few shipments

      const result = await caller.reports.inventoryTurnover({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
        method: 'COGS',
      });

      expect(result.items[0].turnover.performance).toBe('SLOW_MOVING');
      expect(result.items[0].turnover.rate).toBeLessThan(2);
    });
  });

  describe('forecast', () => {
    it('should generate demand forecast', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Test Item',
          isActive: true,
          category: { name: 'Electronics' },
        },
      ];

      const mockOrders = [
        {
          id: testId('order1'),
          orderDate: new Date('2024-01-15'),
          status: 'DELIVERED',
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 10,
            },
          ],
        },
        {
          id: testId('order2'),
          orderDate: new Date('2024-01-20'),
          status: 'DELIVERED',
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 15,
            },
          ],
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: {
          qtyOnHand: 50,
          qtyReserved: 10,
        },
      });

      const result = await caller.reports.forecast({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        forecastHorizon: 30,
        confidenceLevel: 0.95,
      });

      expect(result.forecasts).toHaveLength(1);
      expect(result.forecasts[0].forecast.confidenceLevel).toBe(95);
      expect(result.forecasts[0].forecast.daily).toBeGreaterThan(0);
      expect(result.forecasts[0].forecast.upperBound).toBeGreaterThan(result.forecasts[0].forecast.lowerBound);
      expect(result.forecasts[0].recommendation.reorderNeeded).toBeDefined();
    });

    it('should identify stockout risk', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'High Demand Item',
          isActive: true,
          category: { name: 'Electronics' },
        },
      ];

      const mockOrders = Array.from({ length: 30 }, (_, i) => ({
        id: testId(`order${i}`),
        orderDate: new Date(`2024-01-${i + 1}`),
        status: 'DELIVERED',
        items: [
          {
            itemId: testId('item1'),
            qtyOrdered: 20, // High daily demand
          },
        ],
      }));

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: {
          qtyOnHand: 100, // Only 5 days of supply
          qtyReserved: 0,
        },
      });

      const result = await caller.reports.forecast({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        forecastHorizon: 30,
      });

      expect(result.forecasts[0].inventory.stockoutRisk).toBe('HIGH');
      expect(result.forecasts[0].inventory.daysOfSupply).toBeLessThan(30);
      expect(result.forecasts[0].recommendation.reorderNeeded).toBe(true);
      expect(result.summary.itemsAtRisk).toBe(1);
    });
  });

  describe('custom', () => {
    it('should execute custom report query', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Test Item 1',
          organizationId: testId('org'),
        },
        {
          id: testId('item2'),
          sku: 'ITEM-002',
          name: 'Test Item 2',
          organizationId: testId('org'),
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);

      const result = await caller.reports.custom({
        name: 'Active Items Report',
        description: 'List of all active items',
        query: {
          table: 'items',
          limit: 10,
        },
      });

      expect(result.report.name).toBe('Active Items Report');
      expect(result.data).toHaveLength(2);
      expect(result.rowCount).toBe(2);
    });

    it('should apply aggregations to custom report', async () => {
      const mockOrders = [
        {
          customerId: testId('cust1'),
          grandTotal: 100,
          organizationId: testId('org'),
        },
        {
          customerId: testId('cust1'),
          grandTotal: 200,
          organizationId: testId('org'),
        },
        {
          customerId: testId('cust2'),
          grandTotal: 150,
          organizationId: testId('org'),
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await caller.reports.custom({
        name: 'Customer Sales Summary',
        query: {
          table: 'orders',
          groupBy: ['customerId'],
          aggregations: [
            {
              field: 'grandTotal',
              function: 'sum',
              alias: 'totalSales',
            },
            {
              field: 'grandTotal',
              function: 'count',
              alias: 'orderCount',
            },
          ],
        },
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].totalSales).toBe(300); // 100 + 200
      expect(result.data[0].orderCount).toBe(2);
      expect(result.data[1].totalSales).toBe(150);
      expect(result.data[1].orderCount).toBe(1);
    });

    it('should enforce organization context in custom reports', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);

      await caller.reports.custom({
        name: 'Test Report',
        query: {
          table: 'items',
          filters: { isActive: true },
        },
      });

      expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            isActive: true,
          }),
        })
      );
    });
  });

  describe('export', () => {
    it('should export report', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await caller.reports.export({
        reportType: 'inventoryValuation',
        parameters: {
          asOfDate: new Date(),
          valuationMethod: 'AVERAGE',
        },
        format: 'csv',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('exported as csv');
      expect(result.downloadUrl).toBeDefined();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tableName: 'reports',
            action: 'CREATE',
            userId: mockAuthenticatedUser.id,
          }),
        })
      );
    });

    it('should support different export formats', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({});

      const formats = ['csv', 'json', 'pdf', 'excel'] as const;

      for (const format of formats) {
        const result = await caller.reports.export({
          reportType: 'salesAnalysis',
          parameters: {
            dateFrom: new Date('2024-01-01'),
            dateTo: new Date('2024-01-31'),
          },
          format,
        });

        expect(result.downloadUrl).toContain(`.${format}`);
      }
    });
  });
});