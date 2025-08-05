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
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    order: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    purchaseOrder: {
      aggregate: vi.fn(),
    },
    stockMovement: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    item: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    customer: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    supplier: {
      count: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
    },
    warehouse: {
      findUnique: vi.fn(),
    },
    shipment: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    receipt: {
      findMany: vi.fn(),
    },
    location: {
      findMany: vi.fn(),
    },
    purchaseOrderItem: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
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

describe('Analytics Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all mock implementations to avoid interference between tests
    mockPrisma.inventory.aggregate.mockReset();
    mockPrisma.inventory.findMany.mockReset();
    mockPrisma.order.count.mockReset();
    mockPrisma.order.aggregate.mockReset();
    mockPrisma.order.findMany.mockReset();
    mockPrisma.purchaseOrder.aggregate.mockReset();
    mockPrisma.stockMovement.groupBy.mockReset();
    mockPrisma.stockMovement.aggregate.mockReset();
    mockPrisma.stockMovement.count.mockReset();
    mockPrisma.stockMovement.findMany.mockReset();
    mockPrisma.item.count.mockReset();
    mockPrisma.item.findMany.mockReset();
    mockPrisma.customer.count.mockReset();
    mockPrisma.customer.findMany.mockReset();
    mockPrisma.supplier.count.mockReset();
    mockPrisma.orderItem.findMany.mockReset();
    mockPrisma.warehouse.findUnique.mockReset();
    mockPrisma.shipment.count.mockReset();
    mockPrisma.shipment.findMany.mockReset();
    mockPrisma.receipt.findMany.mockReset();
    mockPrisma.location.findMany.mockReset();
    mockPrisma.purchaseOrderItem.findMany.mockReset();
    mockPrisma.$queryRaw.mockReset();

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

  describe('dashboard', () => {
    it('should return dashboard analytics for default period', async () => {
      // Mock inventory metrics
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: {
          qtyOnHand: 1000,
          qtyReserved: 100,
          qtyInTransit: 50,
        },
      });

      // Mock inventory value
      mockPrisma.inventory.findMany.mockResolvedValue([
        {
          qtyOnHand: 100,
          item: { defaultPrice: 50 },
        },
        {
          qtyOnHand: 200,
          item: { defaultPrice: 25 },
        },
      ]);

      // Mock sales metrics
      mockPrisma.order.count.mockResolvedValue(15);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: {
          grandTotal: 10000,
        },
      });

      // Mock purchase metrics
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _count: 5,
        _sum: {
          total: 5000,
        },
      });

      // Mock stock movements
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'INBOUND', _count: 10, _sum: { qty: 500 } },
        { movementType: 'OUTBOUND', _count: 20, _sum: { qty: 400 } },
        { movementType: 'ADJUSTMENT', _count: 2, _sum: { qty: 10 } },
      ]);

      // Mock counts
      mockPrisma.item.count.mockResolvedValueOnce(0); // Low stock
      mockPrisma.item.count.mockResolvedValueOnce(50); // Active items
      mockPrisma.customer.count.mockResolvedValue(25);
      mockPrisma.supplier.count.mockResolvedValue(10);

      const result = await caller.analytics.dashboard({});

      expect(result.period.label).toBe('last30days');
      expect(result.inventory.totalOnHand).toBe(1000);
      expect(result.inventory.totalAvailable).toBe(900);
      expect(result.inventory.totalValue).toBe(10000); // (100*50) + (200*25)
      expect(result.sales.orderCount).toBe(15);
      expect(result.sales.totalRevenue).toBe(10000);
      expect(result.sales.avgOrderValue).toBeCloseTo(666.67, 2);
      expect(result.purchases.orderCount).toBe(5);
      expect(result.operations.receipts).toBe(10);
      expect(result.operations.shipments).toBe(20);
      expect(result.entities.activeItems).toBe(50);
    });

    it('should filter by warehouse', async () => {
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: {
          qtyOnHand: 500,
          qtyReserved: 50,
          qtyInTransit: 0,
        },
      });

      mockPrisma.inventory.findMany.mockResolvedValue([]);

      // Add missing mocks
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { grandTotal: null },
      });
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { total: null },
      });
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.supplier.count.mockResolvedValue(0);

      await caller.analytics.dashboard({
        includeAllWarehouses: false,
        warehouseIds: [testId('wh1'), testId('wh2')],
      });

      expect(mockPrisma.inventory.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: {
              warehouseId: { in: [testId('wh1'), testId('wh2')] },
            },
          }),
        })
      );
    });

    it('should filter by categories', async () => {
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: {
          qtyOnHand: 300,
          qtyReserved: 30,
          qtyInTransit: 0,
        },
      });

      mockPrisma.inventory.findMany.mockResolvedValue([]);

      // Add missing mocks
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { grandTotal: null },
      });
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { total: null },
      });
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.supplier.count.mockResolvedValue(0);

      await caller.analytics.dashboard({
        categoryIds: [testId('cat1'), testId('cat2')],
      });

      expect(mockPrisma.inventory.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            item: {
              categoryId: { in: [testId('cat1'), testId('cat2')] },
            },
          }),
        })
      );
    });

    it('should handle custom date range', async () => {
      const customFrom = new Date('2024-01-01');
      const customTo = new Date('2024-01-31');

      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: {
          qtyOnHand: 0,
          qtyReserved: 0,
          qtyInTransit: 0,
        },
      });

      mockPrisma.inventory.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: {
          grandTotal: null,
        },
      });
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { total: null },
      });
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.supplier.count.mockResolvedValue(0);

      const result = await caller.analytics.dashboard({
        period: 'custom',
        customFrom,
        customTo,
      });

      expect(result.period.from).toEqual(customFrom);
      expect(result.period.to).toEqual(customTo);
    });

    it('should require organization context', async () => {
      const noOrgCaller = await createDirectCaller({
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: undefined },
      });

      await expect(noOrgCaller.analytics.dashboard({})).rejects.toThrow('No organization selected');
    });
  });

  describe('trends', () => {
    it('should calculate sales trends by day', async () => {
      const mockOrders = [
        {
          id: testId('order1'),
          orderDate: new Date('2024-01-15'),
          customerId: testId('cust1'),
          items: [
            {
              totalPrice: 100,
              qtyOrdered: 2,
              item: { id: testId('item1') },
            },
          ],
        },
        {
          id: testId('order2'),
          orderDate: new Date('2024-01-15'),
          customerId: testId('cust2'),
          items: [
            {
              totalPrice: 200,
              qtyOrdered: 1,
              item: { id: testId('item2') },
            },
          ],
        },
        {
          id: testId('order3'),
          orderDate: new Date('2024-01-16'),
          customerId: testId('cust1'),
          items: [
            {
              totalPrice: 150,
              qtyOrdered: 3,
              item: { id: testId('item1') },
            },
          ],
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await caller.analytics.trends({
        period: 'custom',
        customFrom: new Date('2024-01-15'),
        customTo: new Date('2024-01-16'),
        groupBy: 'day',
        metric: 'revenue',
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].period).toBe('2024-01-15');
      expect(result.data[0].value).toBe(300); // 100 + 200
      expect(result.data[1].period).toBe('2024-01-16');
      expect(result.data[1].value).toBe(150);
      expect(result.summary.total).toBe(450);
      expect(result.summary.average).toBe(225);
    });

    it('should calculate trends by different metrics', async () => {
      const mockOrders = [
        {
          id: testId('order1'),
          orderDate: new Date('2024-01-01'),
          customerId: testId('cust1'),
          items: [
            {
              totalPrice: 100,
              qtyOrdered: 5,
              item: { id: testId('item1') },
            },
          ],
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      // Test quantity metric
      const quantityResult = await caller.analytics.trends({
        metric: 'quantity',
      });

      expect(quantityResult.data[0].value).toBe(5);

      // Test orders metric
      const ordersResult = await caller.analytics.trends({
        metric: 'orders',
      });

      expect(ordersResult.data[0].value).toBe(1);

      // Test customers metric
      const customersResult = await caller.analytics.trends({
        metric: 'customers',
      });

      expect(customersResult.data[0].value).toBe(1);
    });

    it('should filter by items', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await caller.analytics.trends({
        itemIds: [testId('item1'), testId('item2')],
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            items: expect.objectContaining({
              where: expect.objectContaining({
                itemId: { in: [testId('item1'), testId('item2')] },
              }),
            }),
          }),
        })
      );
    });
  });

  describe('kpis', () => {
    it('should calculate inventory turnover', async () => {
      // Mock outbound movements
      mockPrisma.stockMovement.aggregate.mockResolvedValueOnce({
        _sum: {
          qty: 365, // 365 units shipped in 30 days
        },
      });

      // Mock average inventory
      mockPrisma.inventory.aggregate.mockResolvedValueOnce({
        _avg: {
          qtyOnHand: 100,
        },
      });

      const result = await caller.analytics.kpis({
        kpiTypes: ['inventoryTurnover'],
        period: 'last30days',
      });

      expect(result.kpis.inventoryTurnover).toBeDefined();
      expect(result.kpis.inventoryTurnover.value).toBeGreaterThan(40); // Should be a reasonable high value
      expect(result.kpis.inventoryTurnover.status).toBe('good');
    });

    it('should calculate stock accuracy', async () => {
      // Mock adjustments count
      mockPrisma.stockMovement.count.mockResolvedValueOnce(5); // 5 adjustments
      mockPrisma.stockMovement.count.mockResolvedValueOnce(500); // 500 total movements

      const result = await caller.analytics.kpis({
        kpiTypes: ['stockAccuracy'],
      });

      expect(result.kpis.stockAccuracy).toBeDefined();
      expect(result.kpis.stockAccuracy.value).toBe(99); // (495/500) * 100
      expect(result.kpis.stockAccuracy.status).toBe('good');
    });

    it('should calculate order fulfillment rate', async () => {
      mockPrisma.order.count.mockResolvedValueOnce(100); // Total orders
      mockPrisma.order.count.mockResolvedValueOnce(95); // Fulfilled orders

      const result = await caller.analytics.kpis({
        kpiTypes: ['orderFulfillmentRate'],
      });

      expect(result.kpis.orderFulfillmentRate).toBeDefined();
      expect(result.kpis.orderFulfillmentRate.value).toBe(95);
      expect(result.kpis.orderFulfillmentRate.status).toBe('good');
    });

    it('should calculate on-time delivery rate', async () => {
      const mockShipments = [
        {
          updatedAt: new Date('2024-01-15'),
          expectedDelivery: new Date('2024-01-16'),
          status: 'DELIVERED',
        },
        {
          updatedAt: new Date('2024-01-20'),
          expectedDelivery: new Date('2024-01-19'),
          status: 'DELIVERED',
        },
      ];

      mockPrisma.shipment.findMany.mockResolvedValue(mockShipments);

      const result = await caller.analytics.kpis({
        kpiTypes: ['onTimeDeliveryRate'],
      });

      expect(result.kpis.onTimeDeliveryRate).toBeDefined();
      expect(result.kpis.onTimeDeliveryRate.value).toBe(50); // 1 of 2 on time
      expect(result.kpis.onTimeDeliveryRate.status).toBe('poor');
    });

    it('should return all default KPIs when not specified', async () => {
      // Mock all required data
      mockPrisma.stockMovement.aggregate.mockResolvedValue({
        _sum: { qty: 0 },
      });
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _avg: { qtyOnHand: 100 },
      });
      mockPrisma.stockMovement.count.mockResolvedValue(0);
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { grandTotal: 0 },
      });
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.receipt.findMany.mockResolvedValue([]);

      const result = await caller.analytics.kpis({});

      expect(Object.keys(result.kpis)).toHaveLength(6);
      expect(result.kpis).toHaveProperty('inventoryTurnover');
      expect(result.kpis).toHaveProperty('stockAccuracy');
      expect(result.kpis).toHaveProperty('orderFulfillmentRate');
      expect(result.kpis).toHaveProperty('onTimeDeliveryRate');
      expect(result.kpis).toHaveProperty('supplierPerformance');
      expect(result.kpis).toHaveProperty('grossMargin');
    });
  });

  describe('predictions', () => {
    it('should predict demand based on historical sales', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Test Item',
          isActive: true,
          category: { name: 'Electronics' },
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);

      // Mock historical sales data
      mockPrisma.$queryRaw.mockResolvedValue([
        { orderDate: new Date('2024-01-01'), _sum: 10 },
        { orderDate: new Date('2024-01-02'), _sum: 12 },
        { orderDate: new Date('2024-01-03'), _sum: 15 },
        { orderDate: new Date('2024-01-04'), _sum: 11 },
        { orderDate: new Date('2024-01-05'), _sum: 14 },
      ]);

      const result = await caller.analytics.predictions({
        predictionType: 'demand',
        horizonDays: 7,
        itemIds: [testId('item1')],
      });

      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0].type).toBe('demand');
      expect(result.predictions[0].prediction.value).toBeGreaterThan(0);
      expect(result.predictions[0].historicalData.dataPoints).toBe(5);
    });

    it('should predict stockout risk', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Test Item',
          isActive: true,
          category: { name: 'Electronics' },
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);

      // Mock current inventory
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: {
          qtyOnHand: 50,
          qtyReserved: 10,
        },
      });

      // Mock usage data
      mockPrisma.stockMovement.aggregate.mockResolvedValue({
        _sum: {
          qty: 900, // 900 units in 90 days = 10/day
        },
        _count: 90,
      });

      const result = await caller.analytics.predictions({
        predictionType: 'stockout',
        horizonDays: 7,
      });

      expect(result.predictions[0].type).toBe('stockout');
      expect(result.predictions[0].prediction.daysUntilStockout).toBe(4); // 40 available / 10 per day
      expect(result.predictions[0].prediction.probability).toBeGreaterThan(0);
      expect(result.predictions[0].prediction.riskLevel).toBe('medium');
    });

    it('should calculate reorder recommendations', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Test Item',
          isActive: true,
          category: { name: 'Electronics' },
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);

      // Mock recent purchase orders
      mockPrisma.purchaseOrderItem.findMany.mockResolvedValue([
        {
          itemId: testId('item1'),
          purchaseOrder: {
            orderDate: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-08'),
            status: 'RECEIVED',
          },
        },
      ]);

      // Mock usage
      mockPrisma.stockMovement.aggregate.mockResolvedValue({
        _sum: {
          qty: 900,
        },
      });

      // Mock current stock
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: {
          qtyOnHand: 50,
          qtyReserved: 0,
        },
      });

      const result = await caller.analytics.predictions({
        predictionType: 'reorder',
      });

      expect(result.predictions[0].type).toBe('reorder');
      expect(result.predictions[0].prediction.shouldReorder).toBe(true);
      expect(result.predictions[0].prediction.reorderPoint).toBeGreaterThan(0);
      expect(result.predictions[0].prediction.reorderQuantity).toBeGreaterThan(0);
    });
  });

  describe('anomalies', () => {
    it('should detect price anomalies', async () => {
      const mockOrderItems = [
        // Normal prices
        ...Array(10)
          .fill(null)
          .map((_, i) => ({
            id: testId(`oi${i}`),
            itemId: testId('item1'),
            unitPrice: 100,
            item: { id: testId('item1'), sku: 'ITEM-001', name: 'Test Item' },
            order: { orderNumber: `ORD-00${i}`, orderDate: new Date() },
          })),
        // Anomalous price
        {
          id: testId('oi-anomaly'),
          itemId: testId('item1'),
          unitPrice: 500, // 5x normal price
          item: { id: testId('item1'), sku: 'ITEM-001', name: 'Test Item' },
          order: { orderNumber: 'ORD-999', orderDate: new Date() },
        },
      ];

      mockPrisma.orderItem.findMany.mockResolvedValue(mockOrderItems);

      const result = await caller.analytics.anomalies({
        anomalyType: 'price',
        sensitivity: 'medium',
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].type).toBe('price');
      expect(result.anomalies[0].details.anomalousPrice).toBe(500);
      expect(result.anomalies[0].severity).toBeDefined();
    });

    it('should detect quantity anomalies', async () => {
      const mockMovements = [
        // Normal quantities
        ...Array(10)
          .fill(null)
          .map((_, i) => ({
            id: testId(`sm${i}`),
            itemId: testId('item1'),
            movementType: 'OUTBOUND',
            qty: 10,
            movedAt: new Date(),
            item: { id: testId('item1'), sku: 'ITEM-001', name: 'Test Item' },
          })),
        // Anomalous quantity
        {
          id: testId('sm-anomaly'),
          itemId: testId('item1'),
          movementType: 'OUTBOUND',
          qty: 100, // 10x normal
          movedAt: new Date(),
          item: { id: testId('item1'), sku: 'ITEM-001', name: 'Test Item' },
        },
      ];

      mockPrisma.stockMovement.findMany.mockResolvedValue(mockMovements);

      const result = await caller.analytics.anomalies({
        anomalyType: 'quantity',
        sensitivity: 'high',
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].type).toBe('quantity');
      expect(result.anomalies[0].details.anomalousQuantity).toBe(100);
    });

    it('should detect customer ordering pattern anomalies', async () => {
      const mockCustomers = [
        {
          id: testId('cust1'),
          companyName: 'Test Company',
          email: 'test@example.com',
        },
      ];

      const mockOrders = [
        { id: testId('o1'), customerId: testId('cust1'), orderDate: new Date('2024-01-01') },
        { id: testId('o2'), customerId: testId('cust1'), orderDate: new Date('2024-01-08') },
        { id: testId('o3'), customerId: testId('cust1'), orderDate: new Date('2024-01-15') },
        // Last order was 45 days ago (unusual gap)
      ];

      mockPrisma.customer.findMany.mockResolvedValue(mockCustomers);
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await caller.analytics.anomalies({
        anomalyType: 'pattern',
        lookbackDays: 60,
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.anomalies[0].type).toBe('pattern');
      expect(result.anomalies[0].details.pattern).toBe('delayed_order');
      expect(result.anomalies[0].customer).toBeDefined();
    });
  });

  describe('warehouseAnalytics', () => {
    it('should return warehouse performance analytics', async () => {
      const mockWarehouse = {
        id: testId('wh1'),
        name: 'Main Warehouse',
        locations: [
          {
            id: testId('loc1'),
            name: 'A-1-1',
            maxCapacity: 100,
            inventory: [
              {
                qtyOnHand: 50,
                item: { defaultPrice: 10 },
              },
            ],
          },
          {
            id: testId('loc2'),
            name: 'A-1-2',
            maxCapacity: 100,
            inventory: [],
          },
        ],
      };

      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.location.findMany.mockResolvedValue([
        { id: testId('loc1') },
        { id: testId('loc2') },
      ]);

      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'INBOUND', _count: 10, _sum: { qty: 100 } },
        { movementType: 'OUTBOUND', _count: 20, _sum: { qty: 150 } },
      ]);

      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: testId('item1'),
          sku: 'ITEM-001',
          name: 'Test Item',
          movement_count: BigInt(15),
          total_quantity: BigInt(75),
        },
      ]);

      mockPrisma.shipment.count.mockResolvedValue(30);

      const result = await caller.analytics.warehouseAnalytics({
        warehouseId: testId('wh1'),
      });

      expect(result.warehouse.name).toBe('Main Warehouse');
      expect(result.space.totalLocations).toBe(2);
      expect(result.space.occupiedLocations).toBe(1);
      expect(result.space.utilizationRate).toBe(50);
      expect(result.inventory.totalValue).toBe(500); // 50 * 10
      expect(result.movements).toHaveLength(2);
      expect(result.efficiency.topMovedItems).toHaveLength(1);
    });

    it('should throw NOT_FOUND for non-existent warehouse', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        caller.analytics.warehouseAnalytics({
          warehouseId: testId('nonexistent'),
        })
      ).rejects.toThrow('Warehouse not found');
    });
  });
});
