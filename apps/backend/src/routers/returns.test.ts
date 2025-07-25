import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';
import { prisma as mockPrisma } from '@ventry/database';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    return: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    returnItem: {
      createMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
    item: {
      findMany: vi.fn(),
    },
    inventory: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    stockMovement: {
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

describe('Returns Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all mock implementations to avoid interference between tests
    mockPrisma.return.findMany.mockReset();
    mockPrisma.return.findUnique.mockReset();
    mockPrisma.return.findFirst.mockReset();
    mockPrisma.return.count.mockReset();
    mockPrisma.return.create.mockReset();
    mockPrisma.return.update.mockReset();
    mockPrisma.return.groupBy.mockReset();
    mockPrisma.returnItem.createMany.mockReset();
    mockPrisma.returnItem.aggregate.mockReset();
    mockPrisma.returnItem.groupBy.mockReset();
    mockPrisma.order.findUnique.mockReset();
    mockPrisma.item.findMany.mockReset();
    mockPrisma.inventory.findFirst.mockReset();
    mockPrisma.inventory.create.mockReset();
    mockPrisma.inventory.update.mockReset();
    mockPrisma.stockMovement.create.mockReset();

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
    it('should list returns with pagination', async () => {
      const mockReturns = [
        {
          id: testId('ret1'),
          returnNumber: 'RMA-2024-00001',
          status: 'PENDING',
          reason: 'Defective product',
          returnDate: new Date('2024-01-15'),
          items: [
            {
              id: testId('ri1'),
              itemId: testId('item1'),
              qtyReturned: 2,
              item: { id: testId('item1'), sku: 'ITEM-001', name: 'Product 1' },
            },
          ],
          order: {
            id: testId('order1'),
            orderNumber: 'ORD-2024-00001',
            customer: { id: testId('cust1'), companyName: 'ABC Corp' },
          },
          _count: { items: 1 },
        },
      ];

      mockPrisma.return.count.mockResolvedValue(1);
      mockPrisma.return.findMany.mockResolvedValue(mockReturns);
      mockPrisma.return.groupBy.mockResolvedValue([{ status: 'PENDING', _count: 1 }]);

      const result = await caller.returns.list({
        page: 1,
        limit: 20,
      });

      expect(result.returns).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.stats.pending).toBe(1);
    });

    it('should filter by search term', async () => {
      mockPrisma.return.count.mockResolvedValue(0);
      mockPrisma.return.findMany.mockResolvedValue([]);
      mockPrisma.return.groupBy.mockResolvedValue([]);

      await caller.returns.list({
        search: 'RMA-2024',
      });

      expect(mockPrisma.return.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { returnNumber: { contains: 'RMA-2024', mode: 'insensitive' } },
              { reason: { contains: 'RMA-2024', mode: 'insensitive' } },
              { notes: { contains: 'RMA-2024', mode: 'insensitive' } },
              { rmaNumber: { contains: 'RMA-2024', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.return.count.mockResolvedValue(0);
      mockPrisma.return.findMany.mockResolvedValue([]);
      mockPrisma.return.groupBy.mockResolvedValue([]);

      await caller.returns.list({
        status: 'APPROVED',
      });

      expect(mockPrisma.return.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.return.count.mockResolvedValue(0);
      mockPrisma.return.findMany.mockResolvedValue([]);
      mockPrisma.return.groupBy.mockResolvedValue([]);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      await caller.returns.list({
        dateFrom,
        dateTo,
      });

      expect(mockPrisma.return.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            returnDate: {
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

      await expect(noOrgCaller.returns.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('get', () => {
    it('should get return details', async () => {
      const mockReturn = {
        id: testId('ret1'),
        returnNumber: 'RMA-2024-00001',
        status: 'PENDING',
        reason: 'Defective product',
        items: [
          {
            id: testId('ri1'),
            itemId: testId('item1'),
            qtyReturned: 2,
            item: {
              id: testId('item1'),
              sku: 'ITEM-001',
              name: 'Product 1',
              category: { name: 'Electronics' },
            },
          },
        ],
        order: {
          id: testId('order1'),
          orderNumber: 'ORD-2024-00001',
          customer: { id: testId('cust1'), companyName: 'ABC Corp' },
          items: [],
        },
      };

      mockPrisma.return.findUnique.mockResolvedValue(mockReturn);

      const result = await caller.returns.get({ id: testId('ret1') });

      expect(result.id).toBe(testId('ret1'));
      expect(result.returnNumber).toBe('RMA-2024-00001');
      expect(result.items).toHaveLength(1);
    });

    it('should throw NOT_FOUND for non-existent return', async () => {
      mockPrisma.return.findUnique.mockResolvedValue(null);

      await expect(caller.returns.get({ id: testId('nonexistent') })).rejects.toThrow(
        'Return not found'
      );
    });
  });

  describe('create', () => {
    it('should create a new return for an order', async () => {
      const mockOrder = {
        id: testId('order1'),
        orderNumber: 'ORD-2024-00001',
        status: 'DELIVERED',
        customerId: testId('cust1'),
        customer: { id: testId('cust1'), companyName: 'ABC Corp' },
        items: [
          {
            id: testId('oi1'),
            itemId: testId('item1'),
            qtyOrdered: 10,
            item: { id: testId('item1'), sku: 'ITEM-001', name: 'Product 1' },
          },
        ],
      };

      const newReturn = {
        id: testId('ret1'),
        returnNumber: 'RMA-2024-00001',
        organizationId: testId('org'),
        customerId: testId('cust1'),
        orderId: testId('order1'),
        status: 'PENDING',
        reason: 'Defective product',
        refundAmount: 100,
        restockFee: 10,
        items: [],
        customer: { id: testId('cust1') },
        order: mockOrder,
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.returnItem.aggregate.mockResolvedValue({ _sum: { qtyReturned: 0 } });
      mockPrisma.return.count.mockResolvedValue(0);
      mockPrisma.return.create.mockResolvedValue(newReturn);
      mockPrisma.returnItem.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.return.findUnique.mockResolvedValue(newReturn);

      const result = await caller.returns.create({
        customerId: testId('cust1'),
        orderId: testId('order1'),
        reason: 'Defective product',
        refundAmount: 100,
        restockFee: 10,
        items: [
          {
            itemId: testId('item1'),
            qtyReturned: 2,
            condition: 'DEFECTIVE',
            refundAmount: 100,
          },
        ],
      });

      expect(result.returnNumber).toBe('RMA-2024-00001');
      expect(result.status).toBe('PENDING');
      expect(mockPrisma.returnItem.createMany).toHaveBeenCalled();
    });

    it('should validate order status', async () => {
      const mockOrder = {
        id: testId('order1'),
        status: 'DRAFT', // Invalid status for return
        customerId: testId('cust1'),
        items: [],
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        caller.returns.create({
          customerId: testId('cust1'),
          orderId: testId('order1'),
          reason: 'Defective',
          items: [
            {
              itemId: testId('item1'),
              qtyReturned: 1,
              condition: 'DEFECTIVE',
              refundAmount: 50,
            },
          ],
        })
      ).rejects.toThrow('Order must be confirmed or shipped to create a return');
    });

    it('should validate return quantity', async () => {
      const mockOrder = {
        id: testId('order1'),
        status: 'DELIVERED',
        customerId: testId('cust1'),
        items: [
          {
            itemId: testId('item1'),
            qtyOrdered: 5,
          },
        ],
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.returnItem.aggregate.mockResolvedValue({ _sum: { qtyReturned: 3 } }); // Already returned 3

      await expect(
        caller.returns.create({
          customerId: testId('cust1'),
          orderId: testId('order1'),
          reason: 'Defective',
          items: [
            {
              itemId: testId('item1'),
              qtyReturned: 3, // Trying to return 3 more (total 6 > 5 ordered)
              condition: 'DEFECTIVE',
              refundAmount: 150,
            },
          ],
        })
      ).rejects.toThrow('Return quantity for item');
    });

    it('should create return without order reference', async () => {
      const newReturn = {
        id: testId('ret1'),
        returnNumber: 'RMA-2024-00001',
        organizationId: testId('org'),
        customerId: testId('cust1'),
        orderId: null,
        status: 'PENDING',
        reason: 'Wrong item received',
        items: [],
        customer: { id: testId('cust1') },
        order: null,
      };

      mockPrisma.return.count.mockResolvedValue(0);
      mockPrisma.return.create.mockResolvedValue(newReturn);
      mockPrisma.returnItem.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.return.findUnique.mockResolvedValue(newReturn);

      const result = await caller.returns.create({
        customerId: testId('cust1'),
        reason: 'Wrong item received',
        items: [
          {
            itemId: testId('item1'),
            qtyReturned: 1,
            condition: 'NEW',
            refundAmount: 50,
          },
        ],
      });

      expect(result.returnNumber).toBe('RMA-2024-00001');
      expect(result.orderId).toBeNull();
    });
  });

  describe('update', () => {
    it('should update return details', async () => {
      const existingReturn = {
        id: testId('ret1'),
        status: 'PENDING',
        organizationId: testId('org'),
      };

      const updatedReturn = {
        ...existingReturn,
        status: 'APPROVED',
        notes: 'Approved for refund',
        items: [],
      };

      mockPrisma.return.findFirst.mockResolvedValue(existingReturn);
      mockPrisma.return.update.mockResolvedValue(updatedReturn);

      const result = await caller.returns.update({
        id: testId('ret1'),
        status: 'APPROVED',
        notes: 'Approved for refund',
      });

      expect(result.status).toBe('APPROVED');
      expect(result.notes).toBe('Approved for refund');
    });

    it('should not update completed returns', async () => {
      const existingReturn = {
        id: testId('ret1'),
        status: 'COMPLETED',
        organizationId: testId('org'),
      };

      mockPrisma.return.findFirst.mockResolvedValue(existingReturn);

      await expect(
        caller.returns.update({
          id: testId('ret1'),
          status: 'APPROVED',
        })
      ).rejects.toThrow('Cannot update completed or cancelled return');
    });

    it('should throw NOT_FOUND for non-existent return', async () => {
      mockPrisma.return.findFirst.mockResolvedValue(null);

      await expect(
        caller.returns.update({
          id: testId('nonexistent'),
          status: 'APPROVED',
        })
      ).rejects.toThrow('Return not found');
    });
  });

  describe('approve', () => {
    it('should approve a pending return', async () => {
      const existingReturn = {
        id: testId('ret1'),
        returnNumber: 'RMA-2024-00001',
        status: 'PENDING',
        notes: 'Original notes',
        items: [],
        order: { customer: {} },
      };

      const approvedReturn = {
        ...existingReturn,
        status: 'APPROVED',
        notes: 'Approved for refund',
        items: [],
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);
      mockPrisma.return.update.mockResolvedValue(approvedReturn);

      const result = await caller.returns.approve({
        id: testId('ret1'),
        approved: true,
        notes: 'Approved for refund',
      });

      expect(result.status).toBe('APPROVED');
      expect(mockPrisma.return.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            notes: 'Approved for refund',
          }),
        })
      );
    });

    it('should reject a pending return', async () => {
      const existingReturn = {
        id: testId('ret1'),
        status: 'PENDING',
        notes: 'Original notes',
        items: [],
        order: { customer: {} },
      };

      const rejectedReturn = {
        ...existingReturn,
        status: 'REJECTED',
        notes: 'Quality standards not met',
        items: [],
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);
      mockPrisma.return.update.mockResolvedValue(rejectedReturn);

      const result = await caller.returns.approve({
        id: testId('ret1'),
        approved: false,
        notes: 'Quality standards not met',
      });

      expect(result.status).toBe('REJECTED');
    });

    it('should require ADMIN or MANAGER role', async () => {
      const employeeCaller = await createDirectCaller({
        prisma: mockPrisma as any,
        res: mockRes,
        user: {
          ...mockAuthenticatedUser,
          organizationId: testId('org'),
          role: 'EMPLOYEE',
        },
      });

      await expect(
        employeeCaller.returns.approve({
          id: testId('ret1'),
          approved: true,
        })
      ).rejects.toThrow('Only admins and managers can approve returns');
    });

    it('should only approve pending returns', async () => {
      const existingReturn = {
        id: testId('ret1'),
        status: 'APPROVED', // Already approved
        items: [],
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);

      await expect(
        caller.returns.approve({
          id: testId('ret1'),
          approved: true,
        })
      ).rejects.toThrow('Only pending returns can be approved or rejected');
    });
  });

  describe('ship', () => {
    it('should ship an approved return', async () => {
      const existingReturn = {
        id: testId('ret1'),
        returnNumber: 'RMA-2024-00001',
        status: 'APPROVED',
      };

      const shippedReturn = {
        ...existingReturn,
        status: 'RECEIVED', // Changed to valid status
        items: [],
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);
      mockPrisma.return.update.mockResolvedValue(shippedReturn);

      const result = await caller.returns.ship({
        id: testId('ret1'),
        carrier: 'UPS',
        trackingNumber: '1Z999AA10123456784',
        shippedDate: new Date('2024-01-20'),
      });

      expect(result.status).toBe('RECEIVED');
    });

    it('should only ship approved returns', async () => {
      const existingReturn = {
        id: testId('ret1'),
        status: 'PENDING',
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);

      await expect(
        caller.returns.ship({
          id: testId('ret1'),
          carrier: 'UPS',
          trackingNumber: '1Z999AA10123456784',
        })
      ).rejects.toThrow('Return must be approved before shipping');
    });
  });

  describe('receive', () => {
    it('should receive returned items and update inventory', async () => {
      const existingReturn = {
        id: testId('ret1'),
        returnNumber: 'RMA-2024-00001',
        status: 'APPROVED',
        items: [
          {
            id: testId('ri1'),
            itemId: testId('item1'),
            qtyReturned: 5,
            lotId: null,
          },
        ],
        order: {},
      };

      const receivedReturn = {
        ...existingReturn,
        status: 'REFUNDED',
        items: [
          {
            ...existingReturn.items[0],
            item: { id: testId('item1'), sku: 'ITEM-001', name: 'Product 1' },
          },
        ],
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);
      mockPrisma.inventory.findFirst.mockResolvedValue(null); // No existing inventory
      mockPrisma.inventory.create.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.return.update.mockResolvedValue(receivedReturn);

      const result = await caller.returns.receive({
        id: testId('ret1'),
        receivedDate: new Date('2024-01-25'),
        items: [
          {
            returnItemId: testId('ri1'),
            qtyReceived: 5,
            condition: 'AS_RETURNED',
            dispositionAction: 'RETURN_TO_STOCK',
            locationId: testId('loc1'),
          },
        ],
      });

      expect(result.status).toBe('REFUNDED');
      expect(mockPrisma.inventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: testId('item1'),
            locationId: testId('loc1'),
            qtyOnHand: 5,
          }),
        })
      );
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'RETURN',
            itemId: testId('item1'),
            qty: 5,
            toLocationId: testId('loc1'),
          }),
        })
      );
    });

    it('should update existing inventory', async () => {
      const existingReturn = {
        id: testId('ret1'),
        status: 'APPROVED',
        items: [
          {
            id: testId('ri1'),
            itemId: testId('item1'),
            qtyReturned: 5,
            lotId: null,
          },
        ],
        order: {},
      };

      const existingInventory = {
        id: testId('inv1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyOnHand: 10,
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);
      mockPrisma.inventory.findFirst.mockResolvedValue(existingInventory);
      mockPrisma.inventory.update.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.return.update.mockResolvedValue({
        ...existingReturn,
        status: 'RECEIVED',
        items: [],
      });

      await caller.returns.receive({
        id: testId('ret1'),
        items: [
          {
            returnItemId: testId('ri1'),
            qtyReceived: 3,
            condition: 'AS_RETURNED',
            dispositionAction: 'RETURN_TO_STOCK',
            locationId: testId('loc1'),
          },
        ],
      });

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qtyOnHand: { increment: 3 },
          }),
        })
      );
    });

    it('should handle disposal actions', async () => {
      const existingReturn = {
        id: testId('ret1'),
        status: 'APPROVED',
        items: [
          {
            id: testId('ri1'),
            itemId: testId('item1'),
            qtyReturned: 5,
          },
        ],
        order: {},
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);
      mockPrisma.return.update.mockResolvedValue({
        ...existingReturn,
        status: 'RECEIVED',
        items: [],
      });

      await caller.returns.receive({
        id: testId('ret1'),
        items: [
          {
            returnItemId: testId('ri1'),
            qtyReceived: 5,
            condition: 'DAMAGED_FURTHER',
            dispositionAction: 'DISPOSE',
            inspectionNotes: 'Product damaged beyond repair',
          },
        ],
      });

      // Should not create inventory or stock movement for disposed items
      expect(mockPrisma.inventory.create).not.toHaveBeenCalled();
      expect(mockPrisma.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel a return', async () => {
      const existingReturn = {
        id: testId('ret1'),
        returnNumber: 'RMA-2024-00001',
        status: 'PENDING',
        notes: 'Original notes',
      };

      const cancelledReturn = {
        ...existingReturn,
        status: 'REJECTED', // Using REJECTED as CANCELLED doesn't exist
        notes: 'Customer changed mind',
        items: [],
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);
      mockPrisma.return.update.mockResolvedValue(cancelledReturn);

      const result = await caller.returns.cancel({
        id: testId('ret1'),
        reason: 'Customer changed mind',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.notes).toBe('Customer changed mind');
    });

    it('should not cancel completed returns', async () => {
      const existingReturn = {
        id: testId('ret1'),
        status: 'COMPLETED',
      };

      mockPrisma.return.findUnique.mockResolvedValue(existingReturn);

      await expect(
        caller.returns.cancel({
          id: testId('ret1'),
          reason: 'Too late',
        })
      ).rejects.toThrow('Cannot cancel completed or already cancelled return');
    });
  });

  describe('getMetrics', () => {
    it('should return return metrics', async () => {
      mockPrisma.return.groupBy
        .mockResolvedValueOnce([
          { status: 'PENDING', _count: 5 },
          { status: 'APPROVED', _count: 3 },
          { status: 'REFUNDED', _count: 10 },
        ])
        .mockResolvedValueOnce([
          { reason: 'Defective product', _count: 8 },
          { reason: 'Wrong item', _count: 5 },
          { reason: 'Damaged in shipping', _count: 5 },
        ]);

      mockPrisma.return.findMany.mockResolvedValue([
        { createdAt: new Date('2024-01-01'), returnDate: new Date('2024-01-05') },
        { createdAt: new Date('2024-01-10'), returnDate: new Date('2024-01-12') },
      ]);

      mockPrisma.returnItem.groupBy.mockResolvedValue([
        { itemId: testId('item1'), _sum: { qtyReturned: 50 } },
        { itemId: testId('item2'), _sum: { qtyReturned: 30 } },
      ]);

      mockPrisma.item.findMany.mockResolvedValue([
        { id: testId('item1'), sku: 'ITEM-001', name: 'Product 1' },
        { id: testId('item2'), sku: 'ITEM-002', name: 'Product 2' },
      ]);

      const result = await caller.returns.getMetrics({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
      });

      expect(result.summary.total).toBe(18);
      expect(result.summary.pending).toBe(5);
      expect(result.summary.approved).toBe(3);
      expect(result.summary.refunded).toBe(10);
      expect(result.summary.avgProcessingTimeDays).toBe(3); // (4+2)/2
      expect(result.byStatus['PENDING']).toBe(5);
      expect(result.byReason['Defective product']).toBe(8);
      expect(result.topReturnedItems).toHaveLength(2);
      expect(result.topReturnedItems[0].totalQuantity).toBe(50);
    });
  });

  describe('exportReturns', () => {
    it('should export returns as JSON', async () => {
      const mockReturns = [
        {
          id: testId('ret1'),
          returnNumber: 'RMA-2024-00001',
          status: 'PENDING',
          reason: 'Defective',
          createdAt: new Date('2024-01-15'),
          returnDate: new Date('2024-01-15'),
          items: [
            {
              itemId: testId('item1'),
              qtyReturned: 2,
              item: { sku: 'ITEM-001', name: 'Product 1' },
            },
          ],
          order: {
            orderNumber: 'ORD-2024-00001',
            customer: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
          },
        },
      ];

      mockPrisma.return.findMany.mockResolvedValue(mockReturns);

      const result = await caller.returns.exportReturns({
        format: 'json',
      });

      expect(result.format).toBe('json');
      expect(result.data).toEqual(mockReturns);
      expect(result.count).toBe(1);
    });

    it('should export returns as CSV', async () => {
      const mockReturns = [
        {
          returnNumber: 'RMA-2024-00001',
          status: 'PENDING',
          reason: 'Defective',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          returnDate: new Date('2024-01-15T10:00:00Z'),
          items: [{ qtyReturned: 2 }, { qtyReturned: 3 }],
          order: {
            orderNumber: 'ORD-2024-00001',
            customer: { firstName: 'John', lastName: 'Doe' },
          },
        },
      ];

      mockPrisma.return.findMany.mockResolvedValue(mockReturns);

      const result = await caller.returns.exportReturns({
        format: 'csv',
      });

      expect(result.format).toBe('csv');
      expect(result.data).toContain('Return Number,Status,Reason');
      expect(result.data).toContain('RMA-2024-00001');
      expect(result.data).toContain('John Doe');
      expect(result.data).toContain('5'); // Total quantity
      expect(result.count).toBe(1);
    });

    it('should apply filters when exporting', async () => {
      mockPrisma.return.findMany.mockResolvedValue([]);

      await caller.returns.exportReturns({
        format: 'json',
        filters: {
          status: 'APPROVED',
          dateFrom: new Date('2024-01-01'),
          dateTo: new Date('2024-01-31'),
        },
      });

      expect(mockPrisma.return.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
            createdAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            },
          }),
        })
      );
    });
  });
});
