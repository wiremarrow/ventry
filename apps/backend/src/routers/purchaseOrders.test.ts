import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    purchaseOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    purchaseOrderItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    supplier: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    inventory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
    },
    receipt: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    receiptItem: {
      create: vi.fn(),
    },
    lot: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    serialNumber: {
      createMany: vi.fn(),
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
      PurchaseOrderWhereInput: {},
      ItemWhereInput: {},
      Decimal: class Decimal {
        constructor(value: any) {
          this.value = value;
        }
        value: any;
        toNumber() {
          return Number(this.value);
        }
      },
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
    PurchaseOrderStatus: {
      DRAFT: 'DRAFT',
      SUBMITTED: 'SUBMITTED',
      APPROVED: 'APPROVED',
      PARTIAL: 'PARTIAL',
      RECEIVED: 'RECEIVED',
      CANCELLED: 'CANCELLED',
    },
    MovementType: {
      RECEIPT: 'RECEIPT',
    },
  };
});

// Access the mocked prisma for tests
const mockPrisma = {
  purchaseOrder: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  purchaseOrderItem: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  supplier: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  item: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  inventory: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
    updateMany: vi.fn(),
  },
  receipt: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  receiptItem: {
    create: vi.fn(),
  },
  lot: {
    create: vi.fn(),
    createMany: vi.fn(),
  },
  stockMovement: {
    create: vi.fn(),
    createMany: vi.fn(),
  },
  serialNumber: {
    createMany: vi.fn(),
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

describe('Purchase Orders Router', () => {
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
      role: 'WAREHOUSE', // Can manage purchase orders
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list purchase orders with pagination', async () => {
      const mockPOs = [
        {
          id: testId('po1'),
          poNumber: 'PO-2024-001',
          orderDate: new Date(),
          expectedDate: new Date(),
          status: 'APPROVED',
          organizationId: testId('org'),
          supplierId: testId('supp1'),
          total: { toNumber: () => 10000 },
          createdAt: new Date(),
          updatedAt: new Date(),
          supplier: {
            id: testId('supp1'),
            name: 'Test Supplier',
          },
          _count: {
            items: 5,
            receipts: 2,
          },
          items: [
            {
              id: testId('poi1'),
              qtyOrdered: 100,
              qtyReceived: 80,
              totalCost: { toNumber: () => 10000 },
            },
          ],
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPOs);
      mockPrisma.purchaseOrder.count.mockResolvedValue(1);
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: { toNumber: () => 50000 } },
      });

      const result = await caller.purchaseOrders.list({
        page: 1,
        limit: 20,
      });

      expect(result.purchaseOrders).toHaveLength(1);
      expect(result.purchaseOrders[0].poNumber).toBe('PO-2024-001');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter by supplier', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: { toNumber: () => 0 } },
      });

      await caller.purchaseOrders.list({
        supplierId: testId('supp1'),
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            supplierId: testId('supp1'),
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: { toNumber: () => 0 } },
      });

      await caller.purchaseOrders.list({
        status: 'APPROVED',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            status: 'APPROVED',
          }),
        })
      );
    });

    it('should filter overdue orders', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: { toNumber: () => 0 } },
      });

      await caller.purchaseOrders.list({
        isOverdue: true,
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            AND: expect.arrayContaining([
              expect.objectContaining({
                expectedDate: expect.objectContaining({
                  lt: expect.any(Date),
                }),
              }),
              expect.objectContaining({
                status: expect.objectContaining({
                  in: ['SUBMITTED', 'APPROVED'],
                }),
              }),
            ]),
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

      await expect(noOrgCaller.purchaseOrders.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('get', () => {
    it('should get purchase order by id with full details', async () => {
      const mockPO = {
        id: testId('po1'),
        poNumber: 'PO-2024-001',
        orderDate: new Date(),
        organizationId: testId('org'),
        supplierId: testId('supp1'),
        status: 'APPROVED',
        total: { toNumber: () => 10000 },
        supplier: {
          id: testId('supp1'),
          name: 'Test Supplier',
        },
        items: [
          {
            id: testId('poi1'),
            itemId: testId('item1'),
            qtyOrdered: 100,
            qtyReceived: 80,
            unitCost: { toNumber: () => 50 },
            totalCost: { toNumber: () => 5000 },
            item: {
              id: testId('item1'),
              sku: 'ITEM001',
              name: 'Test Item',
            },
          },
        ],
        receipts: [
          {
            id: testId('rec1'),
            receivedDate: new Date(),
            status: 'COMPLETED',
          },
        ],
        approvals: [],
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(mockPO);

      const result = await caller.purchaseOrders.get({
        id: testId('po1'),
      });

      expect(result.id).toBe(testId('po1'));
      expect(result.poNumber).toBe('PO-2024-001');
      expect(result.items).toHaveLength(1);
      expect(result.receipts).toHaveLength(1);
    });

    it('should throw NOT_FOUND when purchase order does not exist', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(
        caller.purchaseOrders.get({ id: testId('nonexistent') })
      ).rejects.toThrow('Purchase order not found');
    });
  });

  describe('create', () => {
    it('should create a new purchase order', async () => {
      const poData = {
        supplierId: testId('supp1'),
        expectedDate: new Date('2024-12-31'),
        paymentTerms: 'NET30',
        items: [
          {
            itemId: testId('item1'),
            qtyOrdered: 100,
            unitCost: 50,
            taxRate: 10,
          },
        ],
      };

      const mockSupplier = {
        id: testId('supp1'),
        name: 'Test Supplier',
        organizationId: testId('org'),
      };

      const mockItem = {
        id: testId('item1'),
        sku: 'ITEM001',
        name: 'Test Item',
        organizationId: testId('org'),
      };

      const newPO = {
        id: testId('po2'),
        poNumber: 'PO-2024-002',
        ...poData,
        organizationId: testId('org'),
        orderDate: new Date(),
        status: 'DRAFT',
        subTotal: { toNumber: () => 5000 },
        taxTotal: { toNumber: () => 500 },
        total: { toNumber: () => 5500 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.purchaseOrder.count.mockResolvedValue(1); // For PO number generation
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return newPO;
      });
      mockPrisma.purchaseOrder.create.mockResolvedValue(newPO);

      const result = await caller.purchaseOrders.create(poData);

      expect(result.poNumber).toBe('PO-2024-002');
      expect(result.status).toBe('DRAFT');
      expect(result.total.toNumber()).toBe(5500);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when supplier does not exist', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        caller.purchaseOrders.create({
          supplierId: testId('nonexistent'),
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 100,
              unitCost: 50,
              taxRate: 0,
            },
          ],
        })
      ).rejects.toThrow('Supplier not found');
    });

    it('should require WAREHOUSE, MANAGER or ADMIN role', async () => {
      const employeeCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'EMPLOYEE' },
      });

      await expect(
        employeeCaller.purchaseOrders.create({
          supplierId: testId('supp1'),
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 10,
              unitCost: 100,
              taxRate: 0,
            },
          ],
        })
      ).rejects.toThrow('Insufficient permissions to create purchase orders');
    });
  });

  describe('update', () => {
    it('should update an existing purchase order', async () => {
      const existingPO = {
        id: testId('po1'),
        status: 'DRAFT',
        organizationId: testId('org'),
      };

      const updatedPO = {
        ...existingPO,
        expectedDate: new Date('2024-12-31'),
        paymentTerms: 'NET45',
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(existingPO);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return updatedPO;
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue(updatedPO);

      const result = await caller.purchaseOrders.update({
        id: testId('po1'),
        expectedDate: new Date('2024-12-31'),
        paymentTerms: 'NET45',
      });

      expect(result.expectedDate).toEqual(new Date('2024-12-31'));
      expect(result.paymentTerms).toBe('NET45');
    });

    it('should prevent updating non-draft orders', async () => {
      const existingPO = {
        id: testId('po1'),
        status: 'RECEIVED',
        organizationId: testId('org'),
        items: [],
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(existingPO);

      await expect(
        caller.purchaseOrders.update({
          id: testId('po1'),
          paymentTerms: 'NET45',
        })
      ).rejects.toThrow('Cannot update purchase order in RECEIVED status');
    });
  });

  describe('submit', () => {
    it('should submit a draft purchase order', async () => {
      const draftPO = {
        id: testId('po1'),
        status: 'DRAFT',
        organizationId: testId('org'),
        items: [{ id: testId('poi1') }], // Has items
      };

      const submittedPO = {
        ...draftPO,
        status: 'SUBMITTED',
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftPO);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return submittedPO;
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue(submittedPO);

      const result = await caller.purchaseOrders.submit({
        id: testId('po1'),
      });

      expect(result.status).toBe('SUBMITTED');
    });

    it('should prevent submitting non-draft orders', async () => {
      const approvedPO = {
        id: testId('po1'),
        status: 'APPROVED',
        organizationId: testId('org'),
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(approvedPO);

      await expect(
        caller.purchaseOrders.submit({ id: testId('po1') })
      ).rejects.toThrow('Only draft purchase orders can be submitted');
    });

    it('should prevent submitting PO without items', async () => {
      const emptyPO = {
        id: testId('po1'),
        status: 'DRAFT',
        organizationId: testId('org'),
        items: [], // No items
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(emptyPO);

      await expect(
        caller.purchaseOrders.submit({ id: testId('po1') })
      ).rejects.toThrow('Cannot submit purchase order without items');
    });
  });

  describe('approve', () => {
    it('should approve a submitted purchase order', async () => {
      // Create caller with MANAGER role for approval
      const managerCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'MANAGER' },
      });

      const submittedPO = {
        id: testId('po1'),
        status: 'SUBMITTED',
        organizationId: testId('org'),
        total: { toNumber: () => 5000 },
      };

      const approvedPO = {
        ...submittedPO,
        status: 'APPROVED',
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(submittedPO);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return approvedPO;
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue(approvedPO);

      const result = await managerCaller.purchaseOrders.approve({
        poId: testId('po1'),
        action: 'APPROVE',
        notes: 'Approved for urgent requirement',
      });

      expect(result.status).toBe('APPROVED');
    });

    it('should require MANAGER or ADMIN role', async () => {
      await expect(
        caller.purchaseOrders.approve({ poId: testId('po1'), action: 'APPROVE' })
      ).rejects.toThrow('Only administrators and managers can approve purchase orders');
    });

    it('should prevent approving non-submitted orders', async () => {
      // Create caller with MANAGER role
      const managerCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'MANAGER' },
      });

      const draftPO = {
        id: testId('po1'),
        status: 'DRAFT',
        organizationId: testId('org'),
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftPO);

      await expect(
        managerCaller.purchaseOrders.approve({ poId: testId('po1'), action: 'APPROVE' })
      ).rejects.toThrow('Only submitted purchase orders can be approved');
    });
  });

  describe('reject', () => {
    it('should reject a submitted purchase order', async () => {
      // Create caller with MANAGER role
      const managerCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'MANAGER' },
      });

      const submittedPO = {
        id: testId('po1'),
        status: 'SUBMITTED',
        organizationId: testId('org'),
      };

      const rejectedPO = {
        ...submittedPO,
        status: 'DRAFT',
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(submittedPO);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return rejectedPO;
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue(rejectedPO);

      const result = await managerCaller.purchaseOrders.reject({
        id: testId('po1'),
        reason: 'Price too high',
      });

      expect(result.status).toBe('DRAFT');
    });

    it('should require a reason for rejection', async () => {
      // Create caller with MANAGER role
      const managerCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'MANAGER' },
      });

      await expect(
        managerCaller.purchaseOrders.reject({ id: testId('po1'), reason: '' })
      ).rejects.toThrow('String must contain at least 1 character(s)');
    });
  });

  describe('cancel', () => {
    it('should cancel a purchase order', async () => {
      const draftPO = {
        id: testId('po1'),
        status: 'DRAFT',
        organizationId: testId('org'),
        items: [
          {
            id: testId('poi1'),
            qtyReceived: 0,
          },
        ],
      };

      const cancelledPO = {
        ...draftPO,
        status: 'CANCELLED',
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftPO);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return cancelledPO;
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue(cancelledPO);

      const result = await caller.purchaseOrders.cancel({
        id: testId('po1'),
        reason: 'No longer needed',
      });

      expect(result.status).toBe('CANCELLED');
    });

    it('should prevent cancelling received orders', async () => {
      const receivedPO = {
        id: testId('po1'),
        status: 'RECEIVED',
        organizationId: testId('org'),
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(receivedPO);

      await expect(
        caller.purchaseOrders.cancel({ 
          id: testId('po1'),
          reason: 'Try to cancel',
        })
      ).rejects.toThrow('Cannot cancel purchase order in RECEIVED status');
    });
  });

  describe('receive', () => {
    it('should receive items from purchase order', async () => {
      const approvedPO = {
        id: testId('po1'),
        status: 'APPROVED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('poi1'),
            itemId: testId('item1'),
            qtyOrdered: 100,
            qtyReceived: 0,
            item: {
              id: testId('item1'),
              sku: 'ITEM001',
              name: 'Test Item',
            },
          },
        ],
      };

      const mockInventory = {
        id: testId('inv1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyOnHand: 50,
        qtyReserved: 0,
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(approvedPO);
      mockPrisma.inventory.findFirst.mockResolvedValue(mockInventory);
      mockPrisma.receipt.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return { ...approvedPO, status: 'RECEIVED' };
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({ ...approvedPO, status: 'RECEIVED' });
      mockPrisma.purchaseOrderItem.update.mockResolvedValue({
        ...approvedPO.items[0],
        qtyReceived: 100,
      });
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        qtyOnHand: 150,
      });

      const result = await caller.purchaseOrders.receive({
        poId: testId('po1'),
        items: [
          {
            poItemId: testId('poi1'),
            qtyReceived: 100,
            qtyRejected: 0,
            locationId: testId('loc1'),
          },
        ],
      });

      expect(result.status).toBe('RECEIVED');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should create receipt when requested', async () => {
      const approvedPO = {
        id: testId('po1'),
        status: 'APPROVED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('poi1'),
            itemId: testId('item1'),
            qtyOrdered: 100,
            qtyReceived: 0,
            item: {
              id: testId('item1'),
              sku: 'ITEM001',
              name: 'Test Item',
            },
          },
        ],
      };

      const mockInventory = {
        id: testId('inv1'),
        itemId: testId('item1'),
        locationId: testId('loc1'),
        qtyOnHand: 50,
        qtyReserved: 0,
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(approvedPO);
      mockPrisma.inventory.findFirst.mockResolvedValue(mockInventory);
      mockPrisma.receipt.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        // Mock the receipt.create inside the transaction
        mockPrisma.receipt.create.mockResolvedValue({
          id: testId('rec1'),
          receiptNumber: 'REC-2024-001',
        });
        const result = await fn(mockPrisma);
        return { ...approvedPO, status: 'RECEIVED' };
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({ ...approvedPO, status: 'RECEIVED' });
      mockPrisma.purchaseOrderItem.update.mockResolvedValue({
        ...approvedPO.items[0],
        qtyReceived: 100,
      });
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        qtyOnHand: 150,
      });

      await caller.purchaseOrders.receive({
        poId: testId('po1'),
        items: [
          {
            poItemId: testId('poi1'),
            qtyReceived: 100,
            qtyRejected: 0,
            locationId: testId('loc1'),
          },
        ],
        createReceipt: true,
      });

      expect(mockPrisma.receipt.create).toHaveBeenCalled();
    });

    it('should require approved or partial status', async () => {
      const draftPO = {
        id: testId('po1'),
        status: 'DRAFT',
        organizationId: testId('org'),
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftPO);

      await expect(
        caller.purchaseOrders.receive({
          poId: testId('po1'),
          items: [
            {
              poItemId: testId('poi1'),
              qtyReceived: 10,
              qtyRejected: 0,
              locationId: testId('loc1'),
            },
          ],
        })
      ).rejects.toThrow('Only approved purchase orders can be received');
    });
  });

  describe('duplicate', () => {
    it('should duplicate an existing purchase order', async () => {
      const originalPO = {
        id: testId('po1'),
        poNumber: 'PO-2024-001',
        supplierId: testId('supp1'),
        organizationId: testId('org'),
        paymentTerms: 'NET30',
        items: [
          {
            itemId: testId('item1'),
            qtyOrdered: 100,
            unitCost: { toNumber: () => 50 },
            taxRate: 10,
          },
        ],
      };

      const newPO = {
        id: testId('po2'),
        poNumber: 'PO-2024-002',
        supplierId: testId('supp1'),
        status: 'DRAFT',
        orderDate: new Date(),
        total: { toNumber: () => 5500 },
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(originalPO);
      mockPrisma.purchaseOrder.count.mockResolvedValue(1);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return newPO;
      });
      mockPrisma.purchaseOrder.create.mockResolvedValue(newPO);

      const result = await caller.purchaseOrders.duplicate({
        id: testId('po1'),
      });

      expect(result.poNumber).toBe('PO-2024-002');
      expect(result.status).toBe('DRAFT');
    });
  });

  describe('items sub-router', () => {
    describe('items.add', () => {
      it('should add item to purchase order', async () => {
        const draftPO = {
          id: testId('po1'),
          status: 'DRAFT',
          organizationId: testId('org'),
          subTotal: { toNumber: () => 5000 },
          taxTotal: { toNumber: () => 500 },
          total: { toNumber: () => 5500 },
        };

        const mockItem = {
          id: testId('item1'),
          sku: 'ITEM002',
          name: 'New Item',
          organizationId: testId('org'),
        };

        const newPOItem = {
          id: testId('poi2'),
          purchaseOrderId: testId('po1'),
          itemId: testId('item1'),
          qtyOrdered: 50,
          unitCost: { toNumber: () => 100 },
          taxAmount: { toNumber: () => 500 },
          totalCost: { toNumber: () => 5500 },
        };

        mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftPO);
        mockPrisma.item.findUnique.mockResolvedValue(mockItem);
        mockPrisma.purchaseOrderItem.findFirst.mockResolvedValue(null); // No duplicate
        mockPrisma.$transaction.mockImplementation(async (fn) => {
          const result = await fn(mockPrisma);
          return newPOItem;
        });
        mockPrisma.purchaseOrderItem.create.mockResolvedValue(newPOItem);

        const result = await caller.purchaseOrders.items.add({
          poId: testId('po1'),
          itemId: testId('item1'),
          qtyOrdered: 50,
          unitCost: 100,
          taxRate: 10,
        });

        expect(result.itemId).toBe(testId('item1'));
        expect(result.qtyOrdered).toBe(50);
      });

      it('should prevent adding to non-draft orders', async () => {
        const approvedPO = {
          id: testId('po1'),
          status: 'APPROVED',
          organizationId: testId('org'),
        };

        mockPrisma.purchaseOrder.findFirst.mockResolvedValue(approvedPO);

        await expect(
          caller.purchaseOrders.items.add({
            poId: testId('po1'),
            itemId: testId('item1'),
            qtyOrdered: 50,
            unitCost: 100,
            taxRate: 0,
          })
        ).rejects.toThrow('Cannot add items to purchase order in APPROVED status');
      });

      it('should prevent duplicate items', async () => {
        const draftPO = {
          id: testId('po1'),
          status: 'DRAFT',
          organizationId: testId('org'),
        };

        const mockItem = {
          id: testId('item1'),
          organizationId: testId('org'),
        };

        mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftPO);
        mockPrisma.item.findUnique.mockResolvedValue(mockItem);
        mockPrisma.purchaseOrderItem.findFirst.mockResolvedValue({ id: testId('existing') });

        await expect(
          caller.purchaseOrders.items.add({
            poId: testId('po1'),
            itemId: testId('item1'),
            qtyOrdered: 50,
            unitCost: 100,
            taxRate: 0,
          })
        ).rejects.toThrow('Item already exists in purchase order');
      });
    });

    describe('items.update', () => {
      it('should update purchase order item', async () => {
        const existingItem = {
          id: testId('poi1'),
          poId: testId('po1'),
          qtyOrdered: 100,
          qtyReceived: 0,
          unitCost: { toNumber: () => 50 },
          taxRate: 10,
          lineTotal: { toNumber: () => 5000 },
          taxAmount: { toNumber: () => 500 },
          totalCost: { toNumber: () => 5500 },
        };

        const draftPO = {
          id: testId('po1'),
          status: 'DRAFT',
          organizationId: testId('org'),
          subTotal: { toNumber: () => 5000 },
          taxTotal: { toNumber: () => 500 },
          total: { toNumber: () => 5500 },
        };

        const updatedItem = {
          ...existingItem,
          qtyOrdered: 150,
          lineTotal: { toNumber: () => 7500 },
          taxAmount: { toNumber: () => 750 },
          totalCost: { toNumber: () => 8250 },
        };

        mockPrisma.purchaseOrderItem.findUnique.mockResolvedValue(existingItem);
        mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftPO);
        mockPrisma.$transaction.mockImplementation(async (fn) => {
          const result = await fn(mockPrisma);
          return updatedItem;
        });
        mockPrisma.purchaseOrderItem.update.mockResolvedValue(updatedItem);
        mockPrisma.purchaseOrder.update.mockResolvedValue({
          ...draftPO,
          subTotal: { toNumber: () => 7500 },
          taxTotal: { toNumber: () => 750 },
          total: { toNumber: () => 8250 },
        });

        const result = await caller.purchaseOrders.items.update({
          id: testId('poi1'),
          qtyOrdered: 150,
        });

        expect(result.qtyOrdered).toBe(150);
      });
    });

    describe('items.remove', () => {
      it('should remove item from purchase order', async () => {
        const existingItem = {
          id: testId('poi1'),
          poId: testId('po1'),
          lineTotal: { toNumber: () => 5000 },
          taxAmount: { toNumber: () => 500 },
          totalCost: { toNumber: () => 5500 },
        };

        const draftPO = {
          id: testId('po1'),
          status: 'DRAFT',
          organizationId: testId('org'),
          subTotal: { toNumber: () => 10000 },
          taxTotal: { toNumber: () => 1000 },
          total: { toNumber: () => 11000 },
        };

        mockPrisma.purchaseOrderItem.findUnique.mockResolvedValue(existingItem);
        mockPrisma.purchaseOrder.findFirst.mockResolvedValue(draftPO);
        mockPrisma.$transaction.mockImplementation(async (fn) => {
          const result = await fn(mockPrisma);
          return existingItem;
        });
        mockPrisma.purchaseOrderItem.delete.mockResolvedValue(existingItem);
        mockPrisma.purchaseOrder.update.mockResolvedValue({
          ...draftPO,
          subTotal: { toNumber: () => 5000 },
          taxTotal: { toNumber: () => 500 },
          total: { toNumber: () => 5500 },
        });

        const result = await caller.purchaseOrders.items.remove({
          id: testId('poi1'),
        });

        expect(result.id).toBe(testId('poi1'));
        expect(mockPrisma.purchaseOrderItem.delete).toHaveBeenCalled();
      });
    });
  });

  describe('getPerformance', () => {
    it('should get purchase order performance metrics', async () => {
      const mockPOs = [
        {
          id: testId('po1'),
          orderDate: new Date('2024-01-15'),
          expectedDate: new Date('2024-01-25'),
          status: 'RECEIVED',
          total: 10000,
          items: [
            {
              qtyOrdered: 100,
              qtyReceived: 100,
            },
          ],
          receipts: [
            {
              receivedDate: new Date('2024-01-24'),
            },
          ],
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPOs);

      const result = await caller.purchaseOrders.getPerformance({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
      });

      expect(result.metrics.summary.totalOrders).toBe(1);
      expect(result.metrics.summary.totalValue).toBe(10000);
      expect(result.metrics.delivery.onTime).toBe(1);
      expect(result.metrics.status.received).toBe(1);
    });
  });

  describe('export', () => {
    it('should export purchase orders data', async () => {
      const mockPOs = [
        {
          id: testId('po1'),
          poNumber: 'PO-2024-001',
          orderDate: new Date(),
          status: 'APPROVED',
          total: { toNumber: () => 10000 },
          supplier: {
            name: 'Test Supplier',
          },
          items: [
            {
              item: {
                sku: 'ITEM001',
                name: 'Test Item',
              },
              qtyOrdered: 100,
              unitCost: { toNumber: () => 50 },
              totalCost: { toNumber: () => 5000 },
            },
          ],
        },
      ];

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPOs);

      const result = await caller.purchaseOrders.export({
        filters: {},
        format: 'csv',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].poNumber).toBe('PO-2024-001');
      expect(result.format).toBe('csv');
      expect(result.count).toBe(1);
    });
  });
});