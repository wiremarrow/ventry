import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';
import { prisma as mockPrisma } from '@ventry/database';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    shipment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      update: vi.fn(),
    },
    inventory: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
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

describe('Shipments Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all mock implementations to avoid interference between tests
    mockPrisma.shipment.findMany.mockReset();
    mockPrisma.shipment.findFirst.mockReset();
    mockPrisma.shipment.count.mockReset();
    mockPrisma.shipment.create.mockReset();
    mockPrisma.shipment.update.mockReset();
    mockPrisma.shipment.groupBy.mockReset();
    mockPrisma.location.findFirst.mockReset();
    mockPrisma.order.findFirst.mockReset();
    mockPrisma.order.findUnique.mockReset();
    mockPrisma.order.update.mockReset();
    mockPrisma.orderItem.update.mockReset();
    mockPrisma.inventory.findFirst.mockReset();
    mockPrisma.inventory.updateMany.mockReset();
    mockPrisma.stockMovement.create.mockReset();
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

  describe('list', () => {
    it('should list shipments with pagination', async () => {
      const mockShipments = [
        {
          id: testId('ship1'),
          shipmentNumber: 'SHP-2024-00001',
          status: 'PENDING',
          createdAt: new Date('2024-01-15'),
          items: [
            {
              id: testId('si1'),
              itemId: testId('item1'),
              qtyShipped: 5,
              item: { id: testId('item1'), sku: 'ITEM-001', name: 'Product 1' },
              orderItem: { id: testId('oi1') },
            },
          ],
          order: {
            id: testId('order1'),
            orderNumber: 'ORD-2024-00001',
            customer: { id: testId('cust1'), companyName: 'ABC Corp' },
          },
          carrier: { id: testId('car1'), name: 'UPS' },
          shippedFromLocation: {
            id: testId('loc1'),
            code: 'A-1-1',
            warehouse: { id: testId('wh1'), name: 'Main Warehouse' },
          },
          shippedBy: { id: testId('user1'), firstName: 'John', lastName: 'Doe' },
          _count: { items: 1 },
        },
      ];

      mockPrisma.shipment.count.mockResolvedValue(1);
      mockPrisma.shipment.findMany.mockResolvedValue(mockShipments);
      mockPrisma.shipment.groupBy
        .mockResolvedValueOnce([{ status: 'PENDING', _count: 1 }])
        .mockResolvedValueOnce([
          { carrierId: testId('car1'), _count: 5, _avg: { shippingCost: 25.5 } },
        ]);

      const result = await caller.shipments.list({
        page: 1,
        limit: 20,
      });

      expect(result.shipments).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.stats.pending).toBe(1);
      expect(result.stats.carrierPerformance).toHaveLength(1);
      expect(result.stats.carrierPerformance[0].avgCost).toBe(25.5);
    });

    it('should filter by search term', async () => {
      mockPrisma.shipment.count.mockResolvedValue(0);
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.groupBy.mockResolvedValue([]);

      await caller.shipments.list({
        search: 'SHP-2024',
      });

      expect(mockPrisma.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { shipmentNumber: { contains: 'SHP-2024', mode: 'insensitive' } },
              { trackingNumber: { contains: 'SHP-2024', mode: 'insensitive' } },
              { notes: { contains: 'SHP-2024', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.shipment.count.mockResolvedValue(0);
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.groupBy.mockResolvedValue([]);

      await caller.shipments.list({
        status: 'SHIPPED',
      });

      expect(mockPrisma.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SHIPPED',
          }),
        })
      );
    });

    it('should filter by warehouse', async () => {
      mockPrisma.shipment.count.mockResolvedValue(0);
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.groupBy.mockResolvedValue([]);

      await caller.shipments.list({
        warehouseId: testId('wh1'),
      });

      expect(mockPrisma.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shippedFromLocation: {
              warehouseId: testId('wh1'),
            },
          }),
        })
      );
    });

    it('should filter by customer', async () => {
      mockPrisma.shipment.count.mockResolvedValue(0);
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.groupBy.mockResolvedValue([]);

      await caller.shipments.list({
        customerId: testId('cust1'),
      });

      expect(mockPrisma.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            order: {
              customerId: testId('cust1'),
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

      await expect(noOrgCaller.shipments.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('get', () => {
    it('should get shipment details', async () => {
      const mockShipment = {
        id: testId('ship1'),
        shipmentNumber: 'SHP-2024-00001',
        status: 'PENDING',
        items: [
          {
            id: testId('si1'),
            itemId: testId('item1'),
            qtyShipped: 5,
            item: {
              id: testId('item1'),
              sku: 'ITEM-001',
              name: 'Product 1',
              category: { name: 'Electronics' },
            },
            orderItem: { id: testId('oi1') },
            lot: null,
            serialNumber: null,
          },
        ],
        order: {
          id: testId('order1'),
          orderNumber: 'ORD-2024-00001',
          customer: { id: testId('cust1'), companyName: 'ABC Corp' },
          items: [],
        },
        carrier: { id: testId('car1'), name: 'UPS' },
        shippedFromLocation: {
          id: testId('loc1'),
          code: 'A-1-1',
          warehouse: { id: testId('wh1'), name: 'Main Warehouse' },
        },
        shippedBy: { id: testId('user1'), firstName: 'John', lastName: 'Doe' },
      };

      mockPrisma.shipment.findFirst.mockResolvedValue(mockShipment);

      const result = await caller.shipments.get({ id: testId('ship1') });

      expect(result.id).toBe(testId('ship1'));
      expect(result.shipmentNumber).toBe('SHP-2024-00001');
      expect(result.items).toHaveLength(1);
    });

    it('should throw NOT_FOUND for non-existent shipment', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValue(null);

      await expect(caller.shipments.get({ id: testId('nonexistent') })).rejects.toThrow(
        'Shipment not found'
      );
    });
  });

  describe('create', () => {
    it('should create a new shipment', async () => {
      const mockLocation = {
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      };

      const mockOrder = {
        id: testId('order1'),
        orderNumber: 'ORD-2024-00001',
        status: 'CONFIRMED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('oi1'),
            itemId: testId('item1'),
            qtyOrdered: 10,
            qtyShipped: 0,
          },
        ],
      };

      const mockInventory = {
        id: testId('inv1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyOnHand: 100,
        qtyReserved: 10,
      };

      const newShipment = {
        id: testId('ship1'),
        shipmentNumber: 'SHP-2024-00001',
        orderId: testId('order1'),
        status: 'PENDING',
        items: [
          {
            id: testId('si1'),
            itemId: testId('item1'),
            qtyShipped: 5,
            item: { id: testId('item1'), sku: 'ITEM-001', name: 'Product 1' },
          },
        ],
      };

      mockPrisma.location.findFirst.mockResolvedValue(mockLocation);
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.inventory.findFirst.mockResolvedValue(mockInventory);
      mockPrisma.shipment.count.mockResolvedValue(0);
      mockPrisma.shipment.create.mockResolvedValue(newShipment);
      mockPrisma.inventory.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await caller.shipments.create({
        orderId: testId('order1'),
        locationId: testId('loc1'),
        items: [
          {
            orderItemId: testId('oi1'),
            itemId: testId('item1'),
            qtyShipped: 5,
          },
        ],
      });

      expect(result.shipmentNumber).toBe('SHP-2024-00001');
      expect(result.status).toBe('PENDING');
      expect(mockPrisma.inventory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qtyReserved: { increment: 5 },
          }),
        })
      );
    });

    it('should validate order status', async () => {
      const mockLocation = {
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      };

      const mockOrder = {
        id: testId('order1'),
        status: 'DRAFT', // Invalid status for shipping
        organizationId: testId('org'),
        items: [],
      };

      mockPrisma.location.findFirst.mockResolvedValue(mockLocation);
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(
        caller.shipments.create({
          orderId: testId('order1'),
          locationId: testId('loc1'),
          items: [
            {
              orderItemId: testId('oi1'),
              itemId: testId('item1'),
              qtyShipped: 5,
            },
          ],
        })
      ).rejects.toThrow('Order must be confirmed and allocated before shipping');
    });

    it('should validate shipping quantity', async () => {
      const mockLocation = {
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      };

      const mockOrder = {
        id: testId('order1'),
        status: 'CONFIRMED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('oi1'),
            itemId: testId('item1'),
            qtyOrdered: 10,
            qtyShipped: 8, // Already shipped 8
          },
        ],
      };

      mockPrisma.location.findFirst.mockResolvedValue(mockLocation);
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(
        caller.shipments.create({
          orderId: testId('order1'),
          locationId: testId('loc1'),
          items: [
            {
              orderItemId: testId('oi1'),
              itemId: testId('item1'),
              qtyShipped: 5, // Trying to ship 5 more (13 > 10)
            },
          ],
        })
      ).rejects.toThrow('Quantity 5 exceeds available to ship');
    });

    it('should validate inventory availability', async () => {
      const mockLocation = {
        id: testId('loc1'),
        warehouse: { organizationId: testId('org') },
      };

      const mockOrder = {
        id: testId('order1'),
        status: 'CONFIRMED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('oi1'),
            itemId: testId('item1'),
            qtyOrdered: 10,
            qtyShipped: 0,
          },
        ],
      };

      const mockInventory = {
        id: testId('inv1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyOnHand: 20,
        qtyReserved: 18, // Only 2 available
      };

      mockPrisma.location.findFirst.mockResolvedValue(mockLocation);
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
      mockPrisma.inventory.findFirst.mockResolvedValue(mockInventory);

      await expect(
        caller.shipments.create({
          orderId: testId('order1'),
          locationId: testId('loc1'),
          items: [
            {
              orderItemId: testId('oi1'),
              itemId: testId('item1'),
              qtyShipped: 5,
            },
          ],
        })
      ).rejects.toThrow('Insufficient inventory');
    });
  });

  describe('update', () => {
    it('should update shipment details', async () => {
      const existingShipment = {
        id: testId('ship1'),
        status: 'PENDING',
        organizationId: testId('org'),
      };

      const updatedShipment = {
        ...existingShipment,
        trackingNumber: '1Z999AA10123456784',
        expectedDelivery: new Date('2024-01-25'),
        items: [],
      };

      mockPrisma.shipment.findFirst.mockResolvedValue(existingShipment);
      mockPrisma.shipment.update.mockResolvedValue(updatedShipment);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await caller.shipments.update({
        id: testId('ship1'),
        trackingNumber: '1Z999AA10123456784',
        expectedDelivery: new Date('2024-01-25'),
      });

      expect(result.trackingNumber).toBe('1Z999AA10123456784');
    });

    it('should not update delivered shipments', async () => {
      const existingShipment = {
        id: testId('ship1'),
        status: 'DELIVERED',
        organizationId: testId('org'),
      };

      mockPrisma.shipment.findFirst.mockResolvedValue(existingShipment);

      await expect(
        caller.shipments.update({
          id: testId('ship1'),
          trackingNumber: '1Z999AA10123456784',
        })
      ).rejects.toThrow('Cannot update delivered or cancelled shipment');
    });

    it('should throw NOT_FOUND for non-existent shipment', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValue(null);

      await expect(
        caller.shipments.update({
          id: testId('nonexistent'),
          status: 'PACKED',
        })
      ).rejects.toThrow('Shipment not found');
    });
  });

  describe('ship', () => {
    it('should ship a pending shipment', async () => {
      const existingShipment = {
        id: testId('ship1'),
        shipmentNumber: 'SHP-2024-00001',
        status: 'PENDING',
        shippedFromLocationId: testId('loc1'),
        orderId: testId('order1'),
        items: [
          {
            id: testId('si1'),
            itemId: testId('item1'),
            qtyShipped: 5,
            orderItemId: testId('oi1'),
            lotId: null,
          },
        ],
        order: { id: testId('order1') },
      };

      const mockOrder = {
        id: testId('order1'),
        items: [
          {
            id: testId('oi1'),
            qtyOrdered: 10,
            qtyShipped: 5, // Will become 10 after this shipment
          },
        ],
      };

      const shippedShipment = {
        ...existingShipment,
        status: 'SHIPPED',
        trackingNumber: '1Z999AA10123456784',
        shippingCost: 25.5,
        shipDate: new Date(),
        items: [
          {
            ...existingShipment.items[0],
            item: { id: testId('item1'), sku: 'ITEM-001', name: 'Product 1' },
          },
        ],
      };

      mockPrisma.shipment.findFirst.mockResolvedValue(existingShipment);
      mockPrisma.inventory.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.orderItem.update.mockResolvedValue({});
      mockPrisma.shipment.update.mockResolvedValue(shippedShipment);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await caller.shipments.ship({
        id: testId('ship1'),
        trackingNumber: '1Z999AA10123456784',
        shippingCost: 25.5,
      });

      expect(result.status).toBe('SHIPPED');
      expect(result.trackingNumber).toBe('1Z999AA10123456784');

      // Verify inventory was updated
      expect(mockPrisma.inventory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qtyReserved: { decrement: 5 },
            qtyOnHand: { decrement: 5 },
          }),
        })
      );

      // Verify stock movement was created
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'OUTBOUND',
            itemId: testId('item1'),
            qty: 5,
            fromLocationId: testId('loc1'),
          }),
        })
      );

      // Verify order item was updated
      expect(mockPrisma.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qtyShipped: { increment: 5 },
          }),
        })
      );
    });

    it('should update order status when all items shipped', async () => {
      const existingShipment = {
        id: testId('ship1'),
        status: 'PENDING',
        shippedFromLocationId: testId('loc1'),
        orderId: testId('order1'),
        items: [
          {
            itemId: testId('item1'),
            qtyShipped: 5,
            orderItemId: testId('oi1'),
            lotId: null,
          },
        ],
      };

      const mockOrder = {
        id: testId('order1'),
        items: [
          {
            id: testId('oi1'),
            qtyOrdered: 10,
            qtyShipped: 10, // All shipped after update
          },
        ],
      };

      mockPrisma.shipment.findFirst.mockResolvedValue(existingShipment);
      mockPrisma.inventory.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.orderItem.update.mockResolvedValue({});
      mockPrisma.shipment.update.mockResolvedValue({
        ...existingShipment,
        status: 'SHIPPED',
        items: [],
      });
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      await caller.shipments.ship({
        id: testId('ship1'),
      });

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'SHIPPED' },
        })
      );
    });

    it('should only ship pending or packed shipments', async () => {
      const existingShipment = {
        id: testId('ship1'),
        status: 'SHIPPED', // Already shipped
        items: [],
      };

      mockPrisma.shipment.findFirst.mockResolvedValue(existingShipment);

      await expect(
        caller.shipments.ship({
          id: testId('ship1'),
        })
      ).rejects.toThrow('Shipment must be pending or packed to ship');
    });
  });

  describe('cancel', () => {
    it('should cancel a pending shipment', async () => {
      const existingShipment = {
        id: testId('ship1'),
        shipmentNumber: 'SHP-2024-00001',
        status: 'PENDING',
        shippedFromLocationId: testId('loc1'),
        notes: 'Original notes',
        items: [
          {
            itemId: testId('item1'),
            qtyShipped: 5,
            lotId: null,
          },
        ],
      };

      const cancelledShipment = {
        ...existingShipment,
        status: 'RETURNED', // Using RETURNED for cancelled
        notes: 'Original notes\nCancelled: Customer request',
        items: [
          {
            ...existingShipment.items[0],
            item: { id: testId('item1'), sku: 'ITEM-001', name: 'Product 1' },
          },
        ],
      };

      mockPrisma.shipment.findFirst.mockResolvedValue(existingShipment);
      mockPrisma.inventory.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.shipment.update.mockResolvedValue(cancelledShipment);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await caller.shipments.cancel({
        id: testId('ship1'),
        reason: 'Customer request',
      });

      expect(result.status).toBe('RETURNED');
      expect(result.notes).toContain('Cancelled: Customer request');

      // Verify inventory was released
      expect(mockPrisma.inventory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qtyReserved: { decrement: 5 },
          }),
        })
      );
    });

    it('should not cancel shipped shipments', async () => {
      const existingShipment = {
        id: testId('ship1'),
        status: 'SHIPPED',
        items: [],
      };

      mockPrisma.shipment.findFirst.mockResolvedValue(existingShipment);

      await expect(
        caller.shipments.cancel({
          id: testId('ship1'),
          reason: 'Too late',
        })
      ).rejects.toThrow('Cannot cancel shipped or delivered shipments');
    });

    it('should not cancel delivered shipments', async () => {
      const existingShipment = {
        id: testId('ship1'),
        status: 'DELIVERED',
        items: [],
      };

      mockPrisma.shipment.findFirst.mockResolvedValue(existingShipment);

      await expect(
        caller.shipments.cancel({
          id: testId('ship1'),
          reason: 'Too late',
        })
      ).rejects.toThrow('Cannot cancel shipped or delivered shipments');
    });
  });
});
