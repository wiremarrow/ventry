import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    order: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
    },
    inventory: {
      aggregate: vi.fn(),
    },
    shipment: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    shipmentItem: {
      create: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
    serialNumber: {
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  return { 
    prisma: mockPrisma,
    Prisma: {
      OrderWhereInput: {},
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
  order: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  orderItem: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  customer: {
    findFirst: vi.fn(),
  },
  item: {
    findUnique: vi.fn(),
  },
  inventory: {
    aggregate: vi.fn(),
  },
  shipment: {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  shipmentItem: {
    create: vi.fn(),
  },
  stockMovement: {
    create: vi.fn(),
  },
  serialNumber: {
    updateMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  organizationMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  }),
};

describe('Orders Router', () => {
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
    
    // Default authenticated user with organization context
    const authenticatedUser = {
      ...mockAuthenticatedUser,
      organizationId: testId('org'),
      organizationRole: 'ADMIN',
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list orders with pagination', async () => {
      const mockOrders = [
        {
          id: testId('order1'),
          orderNumber: 'ORD-202401-00001',
          orderDate: new Date(),
          status: 'PENDING',
          customerId: testId('cust1'),
          customer: {
            id: testId('cust1'),
            customerCode: 'CUST001',
            companyName: 'Test Company',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
          _count: {
            items: 2,
            shipments: 0,
          },
          items: [
            {
              id: testId('item1'),
              qtyOrdered: 10,
              qtyAllocated: 0,
              qtyShipped: 0,
              totalPrice: 100,
            },
            {
              id: testId('item2'),
              qtyOrdered: 5,
              qtyAllocated: 0,
              qtyShipped: 0,
              totalPrice: 50,
            },
          ],
          subtotal: 150,
          discountTotal: 0,
          taxTotal: 15,
          shippingTotal: 10,
          grandTotal: 175,
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await caller.orders.list({
        page: 1,
        limit: 20,
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].orderNumber).toBe('ORD-202401-00001');
      expect(result.orders[0].itemCount).toBe(2);
      expect(result.orders[0].total).toBe(150);
      expect(result.orders[0].fulfillmentRate).toBe(0);
      expect(result.orders[0].hasBackorders).toBe(true);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter orders by search term', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await caller.orders.list({
        search: 'ORD-202401',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            OR: expect.arrayContaining([
              { orderNumber: { contains: 'ORD-202401', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter orders by status', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await caller.orders.list({
        status: 'SHIPPED',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            status: 'SHIPPED',
          }),
        })
      );
    });

    it('should filter overdue orders', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await caller.orders.list({
        isOverdue: true,
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            AND: [
              { requestedShipDate: { lt: expect.any(Date) } },
              { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
            ],
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

      await expect(noOrgCaller.orders.list({ page: 1, limit: 20 })).rejects.toThrow('No organization selected');
    });
  });

  describe('get', () => {
    it('should get order with full details', async () => {
      const mockOrder = {
        id: testId('order1'),
        orderNumber: 'ORD-202401-00001',
        organizationId: testId('org'),
        customer: {
          addresses: [],
        },
        items: [
          {
            qtyOrdered: 10,
            qtyAllocated: 5,
            qtyShipped: 3,
            item: {
              category: {},
              unitOfMeasure: {},
            },
          },
        ],
        shipments: [],
        payments: [],
        grandTotal: 175,
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await caller.orders.get({ id: testId('order1') });

      expect(result.id).toBe(testId('order1'));
      expect(result.metrics).toBeDefined();
      expect(result.metrics.itemCount).toBe(1);
      expect(result.metrics.totalQuantity).toBe(10);
      expect(result.metrics.allocatedQuantity).toBe(5);
      expect(result.metrics.shippedQuantity).toBe(3);
      expect(result.metrics.backorderedQuantity).toBe(7);
      expect(result.metrics.fulfillmentRate).toBe(30);
      expect(result.metrics.paymentStatus.total).toBe(175);
      expect(result.metrics.paymentStatus.paid).toBe(0);
      expect(result.metrics.paymentStatus.balance).toBe(175);
    });

    it('should throw NOT_FOUND when order does not exist', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        caller.orders.get({ id: testId('nonexistent') })
      ).rejects.toThrow('Order not found');
    });

    it('should only return orders from the user organization', async () => {
      // Mock the order to be found
      mockPrisma.order.findFirst.mockResolvedValue({
        id: testId('order1'),
        orderNumber: 'ORD-202401-00001',
        organizationId: testId('org'),
        customer: { addresses: [] },
        items: [],
        shipments: [],
        payments: [],
        grandTotal: 0,
      });

      await caller.orders.get({ id: testId('order1') });

      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: testId('order1'),
            organizationId: testId('org'),
          },
        })
      );
    });
  });

  describe('create', () => {
    it('should create order with items', async () => {
      const mockCustomer = {
        id: testId('cust1'),
        customerCode: 'CUST001',
        organizationId: testId('org'),
      };

      const newOrder = {
        id: testId('neworder'),
        orderNumber: 'ORD-202401-00002',
        orderDate: new Date(),
        status: 'PENDING',
        subtotal: 200,
        taxTotal: 20,
        discountTotal: 10,
        grandTotal: 210,
      };

      mockPrisma.customer.findFirst.mockResolvedValue(mockCustomer);
      mockPrisma.order.count.mockResolvedValue(1);
      mockPrisma.order.create.mockResolvedValue(newOrder);

      const result = await caller.orders.create({
        customerId: testId('cust1'),
        items: [
          {
            itemId: testId('item1'),
            qtyOrdered: 10,
            unitPrice: 10,
            discountPct: 5,
            taxRate: 10,
          },
          {
            itemId: testId('item2'),
            qtyOrdered: 5,
            unitPrice: 20,
            discountPct: 0,
            taxRate: 10,
          },
        ],
      });

      expect(result.id).toBe(testId('neworder'));
      expect(result.orderNumber).toBe('ORD-202401-00002');
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: testId('cust1'),
            organizationId: testId('org'),
            status: 'PENDING',
            createdById: mockAuthenticatedUser.id,
          }),
        })
      );
    });

    it('should throw NOT_FOUND when customer does not exist', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        caller.orders.create({
          customerId: testId('nonexistent'),
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 10,
              unitPrice: 10,
            },
          ],
        })
      ).rejects.toThrow('Customer not found');
    });

    it('should calculate order totals correctly', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({ id: testId('cust1') });
      mockPrisma.order.count.mockResolvedValue(0);

      await caller.orders.create({
        customerId: testId('cust1'),
        items: [
          {
            itemId: testId('item1'),
            qtyOrdered: 10,
            unitPrice: 10,
            discountPct: 10, // 10% discount
            taxRate: 5, // 5% tax
          },
        ],
      });

      // Verify the calculations
      // Line total: 10 * 10 = 100
      // Discount: 100 * 0.1 = 10
      // Subtotal after discount: 100 - 10 = 90
      // Tax: 90 * 0.05 = 4.5
      // Total: 90 + 4.5 = 94.5

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 100,
            discountTotal: 10,
            taxTotal: 4.5,
            grandTotal: 94.5,
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update order details', async () => {
      const currentOrder = {
        id: testId('order1'),
        status: 'PENDING',
        items: [],
      };

      const updatedOrder = {
        ...currentOrder,
        customerId: testId('cust2'),
        notes: 'Updated notes',
      };

      mockPrisma.order.findUnique.mockResolvedValue(currentOrder);
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      const result = await caller.orders.update({
        id: testId('order1'),
        customerId: testId('cust2'),
        notes: 'Updated notes',
      });

      expect(result.customerId).toBe(testId('cust2'));
      expect(result.notes).toBe('Updated notes');
    });

    it('should throw error when updating shipped order', async () => {
      const shippedOrder = {
        id: testId('order1'),
        status: 'SHIPPED',
        items: [],
      };

      mockPrisma.order.findUnique.mockResolvedValue(shippedOrder);

      await expect(
        caller.orders.update({
          id: testId('order1'),
          notes: 'Try to update',
        })
      ).rejects.toThrow('Cannot update order in SHIPPED status');
    });

    it('should throw NOT_FOUND when order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        caller.orders.update({
          id: testId('nonexistent'),
          notes: 'Update',
        })
      ).rejects.toThrow('Order not found');
    });
  });

  describe('updateStatus', () => {
    it('should update order status with valid transition', async () => {
      const currentOrder = {
        id: testId('order1'),
        status: 'PENDING',
        items: [],
      };

      const updatedOrder = {
        ...currentOrder,
        status: 'CONFIRMED',
      };

      mockPrisma.order.findUnique.mockResolvedValue(currentOrder);
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      const result = await caller.orders.updateStatus({
        id: testId('order1'),
        status: 'CONFIRMED',
      });

      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw error for invalid status transition', async () => {
      const currentOrder = {
        id: testId('order1'),
        status: 'PENDING',
        items: [],
      };

      mockPrisma.order.findUnique.mockResolvedValue(currentOrder);

      await expect(
        caller.orders.updateStatus({
          id: testId('order1'),
          status: 'DELIVERED', // Cannot go from PENDING to DELIVERED directly
        })
      ).rejects.toThrow('Cannot transition from PENDING to DELIVERED');
    });

    it('should not allow status change from DELIVERED', async () => {
      const deliveredOrder = {
        id: testId('order1'),
        status: 'DELIVERED',
        items: [],
      };

      mockPrisma.order.findUnique.mockResolvedValue(deliveredOrder);

      await expect(
        caller.orders.updateStatus({
          id: testId('order1'),
          status: 'PENDING',
        })
      ).rejects.toThrow('Cannot transition from DELIVERED to PENDING');
    });
  });

  describe('cancel', () => {
    it('should cancel order with reason', async () => {
      const cancelledOrder = {
        id: testId('order1'),
        status: 'CANCELLED',
        notes: 'Cancellation reason: Customer request. Additional notes: No longer needed',
      };

      mockPrisma.order.update.mockResolvedValue(cancelledOrder);

      const result = await caller.orders.cancel({
        id: testId('order1'),
        reason: 'Customer request',
        notes: 'No longer needed',
      });

      expect(result.status).toBe('CANCELLED');
      expect(result.notes).toContain('Customer request');
      expect(result.notes).toContain('No longer needed');
    });
  });

  describe('items.add', () => {
    it('should add item to order', async () => {
      const order = {
        id: testId('order1'),
        status: 'PENDING',
        organizationId: testId('org'),
      };

      const newItem = {
        id: testId('newitem'),
        orderId: testId('order1'),
        itemId: testId('item1'),
        qtyOrdered: 5,
        unitPrice: 20,
        totalPrice: 110,
        item: {
          category: {},
          unitOfMeasure: {},
        },
      };

      mockPrisma.order.findFirst.mockResolvedValue(order);
      mockPrisma.orderItem.findFirst.mockResolvedValue(null); // No existing item
      mockPrisma.orderItem.create.mockResolvedValue(newItem);

      const result = await caller.orders.items.add({
        orderId: testId('order1'),
        itemId: testId('item1'),
        qtyOrdered: 5,
        unitPrice: 20,
        discountPct: 0,
        taxRate: 10,
      });

      expect(result.id).toBe(testId('newitem'));
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testId('order1') },
          data: expect.objectContaining({
            subtotal: { increment: 100 }, // 5 * 20
            discountTotal: { increment: 0 },
            taxTotal: { increment: 10 }, // 100 * 0.1
            grandTotal: { increment: 110 }, // 100 + 10
          }),
        })
      );
    });

    it('should throw error when adding duplicate item', async () => {
      const order = {
        id: testId('order1'),
        status: 'PENDING',
        organizationId: testId('org'),
      };

      mockPrisma.order.findFirst.mockResolvedValue(order);
      mockPrisma.orderItem.findFirst.mockResolvedValue({ id: testId('existing') });

      await expect(
        caller.orders.items.add({
          orderId: testId('order1'),
          itemId: testId('item1'),
          qtyOrdered: 5,
          unitPrice: 20,
        })
      ).rejects.toThrow('Item already exists in order. Use update instead.');
    });

    it('should throw error when adding to shipped order', async () => {
      const order = {
        id: testId('order1'),
        status: 'SHIPPED',
        organizationId: testId('org'),
      };

      mockPrisma.order.findFirst.mockResolvedValue(order);

      await expect(
        caller.orders.items.add({
          orderId: testId('order1'),
          itemId: testId('item1'),
          qtyOrdered: 5,
          unitPrice: 20,
        })
      ).rejects.toThrow('Cannot add items to order in SHIPPED status');
    });
  });

  describe('items.update', () => {
    it('should update order item quantity', async () => {
      const currentItem = {
        id: testId('item1'),
        orderId: testId('order1'),
        qtyOrdered: 5,
        unitPrice: 20,
        discountPct: 0,
        taxRate: 10,
        totalPrice: 110,
        order: {
          status: 'PENDING',
        },
      };

      const updatedItem = {
        ...currentItem,
        qtyOrdered: 10,
        totalPrice: 220,
      };

      mockPrisma.orderItem.findFirst.mockResolvedValue(currentItem);
      mockPrisma.orderItem.update.mockResolvedValue(updatedItem);

      const result = await caller.orders.items.update({
        id: testId('item1'),
        qtyOrdered: 10,
      });

      expect(result.qtyOrdered).toBe(10);
    });

    it('should throw error when updating item in shipped order', async () => {
      const currentItem = {
        id: testId('item1'),
        order: {
          status: 'SHIPPED',
        },
      };

      mockPrisma.orderItem.findFirst.mockResolvedValue(currentItem);

      await expect(
        caller.orders.items.update({
          id: testId('item1'),
          qtyOrdered: 10,
        })
      ).rejects.toThrow('Cannot update items in order with SHIPPED status');
    });
  });

  describe('items.remove', () => {
    it('should remove item from order', async () => {
      const item = {
        id: testId('item1'),
        orderId: testId('order1'),
        qtyOrdered: 5,
        qtyShipped: 0,
        unitPrice: 20,
        discountPct: 0,
        taxRate: 10,
        totalPrice: 110,
        order: {
          status: 'PENDING',
        },
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(item);

      const result = await caller.orders.items.remove({ id: testId('item1') });

      expect(result.success).toBe(true);
      expect(mockPrisma.orderItem.delete).toHaveBeenCalledWith({
        where: { id: testId('item1') },
      });
    });

    it('should throw error when removing shipped item', async () => {
      const item = {
        id: testId('item1'),
        qtyShipped: 3,
        order: {
          status: 'PENDING',
        },
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(item);

      await expect(
        caller.orders.items.remove({ id: testId('item1') })
      ).rejects.toThrow('Cannot remove item that has been partially shipped');
    });
  });

  describe('checkAvailability', () => {
    it('should check item availability in warehouse', async () => {
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: {
          qtyOnHand: 100,
          qtyReserved: 20,
        },
      });

      mockPrisma.item.findUnique.mockResolvedValue({
        sku: 'ITEM001',
        name: 'Test Item',
      });

      const result = await caller.orders.checkAvailability({
        items: [
          { itemId: testId('item1'), qty: 50 },
          { itemId: testId('item2'), qty: 100 },
        ],
        warehouseId: testId('warehouse1'),
      });

      expect(result.availability).toHaveLength(2);
      expect(result.availability[0].canFulfill).toBe(true); // 80 available >= 50 requested
      expect(result.availability[0].qtyAvailable).toBe(80);
      expect(result.availability[0].shortage).toBe(0);
      
      expect(result.availability[1].canFulfill).toBe(false); // 80 available < 100 requested
      expect(result.availability[1].shortage).toBe(20);
      
      expect(result.summary.canFulfillOrder).toBe(false);
      expect(result.summary.availableItems).toBe(1);
      expect(result.summary.partialItems).toBe(1); // Item 2 has 80 available but needs 100, so it's partial
      expect(result.summary.unavailableItems).toBe(0); // No items have 0 availability
    });
  });

  describe('calculateTotals', () => {
    it('should calculate order totals correctly', async () => {
      const result = await caller.orders.calculateTotals({
        items: [
          {
            qty: 10,
            unitPrice: 10,
            discountPct: 10,
            taxRate: 5,
          },
          {
            qty: 5,
            unitPrice: 20,
            discountPct: 0,
            taxRate: 10,
          },
        ],
        shippingCost: 15,
        additionalDiscount: 5,
      });

      // Item 1: 10 * 10 = 100, discount 10, tax 4.5, total 94.5
      // Item 2: 5 * 20 = 100, discount 0, tax 10, total 110
      // Subtotal: 200, Item discounts: 10, Additional discount: 9.5 (5% of 190)
      // Tax total: 14.5, Shipping: 15
      // Grand total: 190 - 9.5 + 14.5 + 15 = 210

      expect(result.summary.subtotal).toBe(200);
      expect(result.summary.totalDiscount).toBe(19.5);
      expect(result.summary.totalTax).toBe(14.5);
      expect(result.summary.shippingCost).toBe(15);
      expect(result.summary.total).toBe(210);
      expect(result.summary.itemCount).toBe(2);
      expect(result.summary.totalQuantity).toBe(15);
    });
  });

  describe('createShipment', () => {
    it('should create shipment for order', async () => {
      const order = {
        id: testId('order1'),
        status: 'CONFIRMED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('orderitem1'),
            itemId: testId('item1'),
            qtyOrdered: 10,
            qtyShipped: 0,
          },
        ],
      };

      const newShipment = {
        id: testId('ship1'),
        orderId: testId('order1'),
        shipmentNumber: 'SHIP-2024-000001',
        shipDate: new Date(),
        status: 'IN_TRANSIT',
      };

      mockPrisma.order.findFirst.mockResolvedValue(order);
      mockPrisma.order.findUnique.mockResolvedValue({ ...order, items: order.items });
      mockPrisma.shipment.count.mockResolvedValue(0);
      mockPrisma.shipment.create.mockResolvedValue(newShipment);

      const result = await caller.orders.createShipment({
        orderId: testId('order1'),
        carrierName: 'FedEx',
        items: [
          {
            orderItemId: testId('orderitem1'),
            qtyShipped: 5,
          },
        ],
      });

      expect(result.id).toBe(testId('ship1'));
      expect(result.shipmentNumber).toBe('SHIP-2024-000001');
      expect(mockPrisma.orderItem.update).toHaveBeenCalledWith({
        where: { id: testId('orderitem1') },
        data: {
          qtyShipped: { increment: 5 },
        },
      });
    });

    it('should throw error when shipping more than ordered', async () => {
      const order = {
        id: testId('order1'),
        status: 'CONFIRMED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('orderitem1'),
            itemId: testId('item1'),
            qtyOrdered: 10,
            qtyShipped: 8,
          },
        ],
      };

      mockPrisma.order.findFirst.mockResolvedValue(order);

      await expect(
        caller.orders.createShipment({
          orderId: testId('order1'),
          carrierName: 'FedEx',
          items: [
            {
              orderItemId: testId('orderitem1'),
              qtyShipped: 5, // 8 already shipped + 5 > 10 ordered
            },
          ],
        })
      ).rejects.toThrow('Cannot ship 5 units. Only 2 remaining to ship.');
    });

    it('should update order status to SHIPPED when fully shipped', async () => {
      const order = {
        id: testId('order1'),
        status: 'CONFIRMED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('orderitem1'),
            itemId: testId('item1'),
            qtyOrdered: 10,
            qtyShipped: 0,
          },
        ],
      };

      const fullyShippedOrder = {
        ...order,
        items: [
          {
            ...order.items[0],
            qtyShipped: 10,
          },
        ],
      };

      mockPrisma.order.findFirst.mockResolvedValue(order);
      mockPrisma.order.findUnique
        .mockResolvedValueOnce(order) // First call in validation
        .mockResolvedValueOnce(fullyShippedOrder); // Second call after update
      mockPrisma.shipment.count.mockResolvedValue(0);
      mockPrisma.shipment.create.mockResolvedValue({
        id: testId('ship1'),
        shipmentNumber: 'SHIP-2024-000001',
      });

      await caller.orders.createShipment({
        orderId: testId('order1'),
        carrierName: 'FedEx',
        items: [
          {
            orderItemId: testId('orderitem1'),
            qtyShipped: 10,
          },
        ],
      });

      // The update happens inside the transaction, so check the transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // We can also verify that the order.update mock was invoked with the correct arguments
      // by checking the calls made within the transaction
      const transactionFn = mockPrisma.$transaction.mock.calls[0][0];
      // Execute the transaction function to verify the update call
      await transactionFn(mockPrisma);
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: testId('order1') },
        data: { status: 'SHIPPED' },
      });
    });
  });

  describe('getShipments', () => {
    it('should get shipments for order', async () => {
      const mockShipments = [
        {
          id: testId('ship1'),
          orderId: testId('order1'),
          shipmentNumber: 'SHIP-2024-000001',
          shipDate: new Date(),
          items: [],
        },
      ];

      mockPrisma.shipment.findMany.mockResolvedValue(mockShipments);

      const result = await caller.orders.getShipments({ orderId: testId('order1') });

      expect(result).toHaveLength(1);
      expect(result[0].shipmentNumber).toBe('SHIP-2024-000001');
      expect(mockPrisma.shipment.findMany).toHaveBeenCalledWith({
        where: { orderId: testId('order1') },
        include: expect.any(Object),
        orderBy: { shipDate: 'desc' },
      });
    });
  });

  describe('export', () => {
    it('should export orders as CSV', async () => {
      const mockOrders = [
        {
          orderNumber: 'ORD-202401-00001',
          orderDate: new Date('2024-01-01'),
          status: 'PENDING',
          customer: {
            customerCode: 'CUST001',
            companyName: 'Test Company',
            firstName: 'John',
            lastName: 'Doe',
          },
          subtotal: 100,
          discountTotal: 10,
          taxTotal: 9,
          shippingTotal: 5,
          grandTotal: 104,
          requestedShipDate: new Date('2024-01-15'),
          notes: 'Test order',
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await caller.orders.export({
        filters: { page: 1, limit: 100 },
        format: 'csv',
        includeItems: false,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        orderNumber: 'ORD-202401-00001',
        status: 'PENDING',
        customerCode: 'CUST001',
        customerName: 'Test Company',
        total: 104,
      });
      expect(result.format).toBe('csv');
      expect(result.count).toBe(1);
    });

    it('should export orders with items', async () => {
      const mockOrders = [
        {
          orderNumber: 'ORD-202401-00001',
          orderDate: new Date('2024-01-01'),
          status: 'PENDING',
          customer: {
            customerCode: 'CUST001',
            companyName: 'Test Company',
          },
          items: [
            {
              item: {
                sku: 'ITEM001',
                name: 'Test Item 1',
              },
              qtyOrdered: 10,
              qtyShipped: 5,
              unitPrice: 10,
              totalPrice: 100,
            },
            {
              item: {
                sku: 'ITEM002',
                name: 'Test Item 2',
              },
              qtyOrdered: 5,
              qtyShipped: 0,
              unitPrice: 20,
              totalPrice: 100,
            },
          ],
          subtotal: 200,
          discountTotal: 0,
          taxTotal: 20,
          shippingTotal: 10,
          grandTotal: 230,
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await caller.orders.export({
        filters: { page: 1, limit: 100 },
        format: 'csv',
        includeItems: true,
      });

      expect(result.data).toHaveLength(2); // One row per item
      expect(result.data[0].itemSku).toBe('ITEM001');
      expect(result.data[0].itemName).toBe('Test Item 1');
      expect(result.data[0].qtyOrdered).toBe(10);
      expect(result.data[1].itemSku).toBe('ITEM002');
      expect(result.data[1].itemName).toBe('Test Item 2');
    });
  });
});