import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    receipt: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    receiptItem: {
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    purchaseOrder: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    purchaseOrderItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    inventory: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    lot: {
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    serialNumber: {
      createMany: vi.fn(),
    },
    item: {
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
      ReceiptWhereInput: {},
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
  receipt: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  receiptItem: {
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  purchaseOrder: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  purchaseOrderItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  inventory: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  lot: {
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  },
  stockMovement: {
    create: vi.fn(),
    createMany: vi.fn(),
  },
  serialNumber: {
    createMany: vi.fn(),
  },
  item: {
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

describe('Receipts Router', () => {
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
      role: 'WAREHOUSE', // Can manage receipts
    };

    caller = await createDirectCaller({
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list receipts with pagination', async () => {
      const mockReceipts = [
        {
          id: testId('rec1'),
          reference: 'REC-2024-000001',
          poId: testId('po1'),
          receivedDate: new Date(),
          receivedById: testId('user1'),
          organizationId: testId('org'),
          createdAt: new Date(),
          updatedAt: new Date(),
          purchaseOrder: {
            id: testId('po1'),
            poNumber: 'PO-2024-001',
            supplier: {
              id: testId('supp1'),
              name: 'Test Supplier',
            },
          },
          items: [
            {
              id: testId('ri1'),
              qtyReceived: 100,
              qtyRejected: 0,
            },
          ],
          receivedBy: {
            id: testId('user1'),
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ];

      mockPrisma.receipt.findMany.mockResolvedValue(mockReceipts);
      mockPrisma.receipt.count.mockResolvedValue(1);

      const result = await caller.receipts.list({
        page: 1,
        limit: 20,
      });

      expect(result.receipts).toHaveLength(1);
      expect(result.receipts[0].reference).toBe('REC-2024-000001');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter receipts by purchase order', async () => {
      mockPrisma.receipt.findMany.mockResolvedValue([]);
      mockPrisma.receipt.count.mockResolvedValue(0);

      await caller.receipts.list({
        purchaseOrderId: testId('po1'),
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            poId: testId('po1'),
          }),
        })
      );
    });

    it('should filter receipts by supplier', async () => {
      mockPrisma.receipt.findMany.mockResolvedValue([]);
      mockPrisma.receipt.count.mockResolvedValue(0);

      await caller.receipts.list({
        supplierId: testId('supp1'),
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            purchaseOrder: expect.objectContaining({
              supplierId: testId('supp1'),
            }),
          }),
        })
      );
    });

    it('should filter receipts by date range', async () => {
      mockPrisma.receipt.findMany.mockResolvedValue([]);
      mockPrisma.receipt.count.mockResolvedValue(0);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      await caller.receipts.list({
        dateFrom,
        dateTo,
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.receipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            receivedDate: {
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

      await expect(noOrgCaller.receipts.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('get', () => {
    it('should get receipt by id with full details', async () => {
      const mockReceipt = {
        id: testId('rec1'),
        reference: 'REC-2024-000001',
        poId: testId('po1'),
        receivedDate: new Date(),
        organizationId: testId('org'),
        purchaseOrder: {
          id: testId('po1'),
          poNumber: 'PO-2024-001',
          organizationId: testId('org'),
          supplier: {
            name: 'Test Supplier',
          },
          items: [
            {
              id: testId('poi1'),
              itemId: testId('item1'),
              qtyOrdered: 100,
              qtyReceived: 80,
              item: {
                sku: 'ITEM001',
                name: 'Test Item',
              },
            },
          ],
        },
        items: [
          {
            id: testId('ri1'),
            poItemId: testId('poi1'),
            qtyReceived: 80,
            qtyRejected: 0,
            location: {
              name: 'Main Warehouse',
            },
            lot: {
              lotNumber: 'LOT001',
            },
          },
        ],
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(mockReceipt);

      const result = await caller.receipts.get({
        id: testId('rec1'),
      });

      expect(result.id).toBe(testId('rec1'));
      expect(result.reference).toBe('REC-2024-000001');
      expect(result.items).toHaveLength(1);
    });

    it('should throw NOT_FOUND when receipt does not exist', async () => {
      mockPrisma.receipt.findFirst.mockResolvedValue(null);

      await expect(caller.receipts.get({ id: testId('nonexistent') })).rejects.toThrow(
        'Receipt not found'
      );
    });
  });

  describe('create', () => {
    it('should create a new receipt', async () => {
      const receiptData = {
        purchaseOrderId: testId('po1'),
        receivedDate: new Date(),
        notes: 'Test receipt',
        items: [
          {
            poItemId: testId('poi1'),
            qtyReceived: 100,
            qtyRejected: 0,
            locationId: testId('loc1'),
            lotNumber: 'LOT001',
          },
        ],
      };

      const mockPO = {
        id: testId('po1'),
        status: 'APPROVED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('poi1'),
            itemId: testId('item1'),
            qtyOrdered: 100,
            qtyReceived: 0,
          },
        ],
      };

      const newReceipt = {
        id: testId('rec1'),
        reference: 'REC-2024-000001',
        ...receiptData,
        organizationId: testId('org'),
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(mockPO);
      mockPrisma.receipt.count.mockResolvedValue(0); // For receipt number generation
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        // Mock lot.create to return an object with id
        mockPrisma.lot.create.mockResolvedValue({ id: testId('lot1') });
        const result = await fn(mockPrisma);
        return newReceipt;
      });
      mockPrisma.receipt.create.mockResolvedValue(newReceipt);

      const result = await caller.receipts.create(receiptData);

      expect(result.reference).toBe('REC-2024-000001');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when purchase order does not exist', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(
        caller.receipts.create({
          purchaseOrderId: testId('nonexistent'),
          items: [
            {
              poItemId: testId('poi1'),
              qtyReceived: 10,
              qtyRejected: 0,
              locationId: testId('loc1'),
            },
          ],
        })
      ).rejects.toThrow('Purchase order not found');
    });

    it('should require approved purchase order', async () => {
      const mockPO = {
        id: testId('po1'),
        status: 'DRAFT',
        organizationId: testId('org'),
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(mockPO);

      await expect(
        caller.receipts.create({
          purchaseOrderId: testId('po1'),
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

    it('should require WAREHOUSE, MANAGER or ADMIN role', async () => {
      const employeeCaller = await createDirectCaller({
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'EMPLOYEE' },
      });

      await expect(
        employeeCaller.receipts.create({
          purchaseOrderId: testId('po1'),
          items: [
            {
              poItemId: testId('poi1'),
              qtyReceived: 10,
              qtyRejected: 0,
              locationId: testId('loc1'),
            },
          ],
        })
      ).rejects.toThrow('Insufficient permissions to create receipts');
    });

    it('should allow receiving more than ordered (with discrepancy)', async () => {
      const mockPO = {
        id: testId('po1'),
        status: 'APPROVED',
        organizationId: testId('org'),
        items: [
          {
            id: testId('poi1'),
            itemId: testId('item1'),
            qtyOrdered: 100,
            qtyReceived: 80, // Already received 80
          },
        ],
      };

      const newReceipt = {
        id: testId('rec1'),
        reference: 'REC-2024-000001',
        poId: testId('po1'),
        receivedDate: new Date(),
        organizationId: testId('org'),
      };

      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(mockPO);
      mockPrisma.receipt.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        mockPrisma.lot.create.mockResolvedValue({ id: testId('lot1') });
        const result = await fn(mockPrisma);
        return newReceipt;
      });
      mockPrisma.receipt.create.mockResolvedValue(newReceipt);

      // Should succeed but mark hasDiscrepancies
      const result = await caller.receipts.create({
        purchaseOrderId: testId('po1'),
        items: [
          {
            poItemId: testId('poi1'),
            qtyReceived: 30, // Trying to receive 30 more (total would be 110)
            qtyRejected: 0,
            locationId: testId('loc1'),
          },
        ],
      });

      expect(result.reference).toBe('REC-2024-000001');
    });
  });

  describe('addItems', () => {
    it('should add items to existing receipt', async () => {
      const mockPO = {
        id: testId('po1'),
        status: 'PARTIAL',
        organizationId: testId('org'),
        items: [
          {
            id: testId('poi2'),
            itemId: testId('item2'),
            qtyOrdered: 50,
            qtyReceived: 0,
          },
        ],
      };

      const mockReceipt = {
        id: testId('rec1'),
        poId: testId('po1'),
        organizationId: testId('org'),
        purchaseOrder: mockPO,
      };

      mockPrisma.receipt.findUnique.mockResolvedValue(mockReceipt);
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(mockPO);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        // Mock receiptItem.findFirst inside transaction
        mockPrisma.receiptItem.findFirst = vi.fn().mockResolvedValue(null);
        const result = await fn(mockPrisma);
        return { count: 1 };
      });

      await caller.receipts.addItems({
        receiptId: testId('rec1'),
        items: [
          {
            poItemId: testId('poi2'),
            qtyReceived: 50,
            qtyRejected: 0,
            locationId: testId('loc1'),
          },
        ],
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when receipt does not exist', async () => {
      mockPrisma.receipt.findUnique.mockResolvedValue(null);

      await expect(
        caller.receipts.addItems({
          receiptId: testId('nonexistent'),
          items: [],
        })
      ).rejects.toThrow('Receipt not found');
    });
  });

  describe('updateItems', () => {
    it('should update receipt items', async () => {
      const mockItems = [
        {
          id: testId('ri1'),
          receiptId: testId('rec1'),
          poItemId: testId('poi1'),
          qtyReceived: 100,
          qtyRejected: 0,
          purchaseOrderItem: {
            qtyOrdered: 100,
          },
          receipt: {
            organizationId: testId('org'),
          },
        },
      ];

      mockPrisma.receiptItem.findMany.mockResolvedValue(mockItems);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        // Mock findUnique inside transaction
        mockPrisma.receiptItem.findUnique.mockResolvedValue(mockItems[0]);
        // Mock purchaseOrderItem.findFirst for poItem lookup
        mockPrisma.purchaseOrderItem.findFirst.mockResolvedValue({
          qtyOrdered: 100,
          qtyReceived: 50,
        });
        // Mock receiptItem.update to return updated item with receiptId
        mockPrisma.receiptItem.update.mockResolvedValue({
          ...mockItems[0],
          qtyReceived: 90,
          qtyRejected: 10,
          rejectionReason: 'Damaged',
        });
        const result = await fn(mockPrisma);
        return [
          {
            ...mockItems[0],
            qtyReceived: 90,
            qtyRejected: 10,
            rejectionReason: 'Damaged',
          },
        ];
      });

      const result = await caller.receipts.updateItems({
        items: [
          {
            id: testId('ri1'),
            qtyReceived: 90,
            qtyRejected: 10,
            rejectionReason: 'Damaged',
          },
        ],
      });

      expect(result).toHaveLength(1);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should allow updating quantities without validation', async () => {
      const mockItems = [
        {
          id: testId('ri1'),
          receiptId: testId('rec1'),
          itemId: testId('item1'),
          poItemId: testId('poi1'),
          qtyReceived: 50,
          qtyRejected: 0,
          purchaseOrderItem: {
            qtyOrdered: 100,
            qtyReceived: 50, // Already received 50
          },
          receipt: {
            organizationId: testId('org'),
            poId: testId('po1'),
          },
        },
      ];

      mockPrisma.receiptItem.findMany.mockResolvedValue(mockItems);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        // Mock findUnique inside transaction
        mockPrisma.receiptItem.findUnique.mockResolvedValue(mockItems[0]);
        // Mock purchaseOrderItem.findFirst for poItem lookup
        mockPrisma.purchaseOrderItem.findFirst.mockResolvedValue({
          id: testId('poi1'),
          qtyOrdered: 100,
          qtyReceived: 50,
        });
        // Mock receiptItem.update to return updated item with receiptId
        mockPrisma.receiptItem.update.mockResolvedValue({
          ...mockItems[0],
          qtyReceived: 60,
          qtyRejected: 0,
        });
        // Mock inventory operations
        mockPrisma.inventory.findFirst.mockResolvedValue({
          id: testId('inv1'),
          qtyOnHand: 50,
        });
        mockPrisma.inventory.update.mockResolvedValue({
          id: testId('inv1'),
          qtyOnHand: 60,
        });
        mockPrisma.purchaseOrderItem.update.mockResolvedValue({
          id: testId('poi1'),
          qtyReceived: 60,
        });
        const result = await fn(mockPrisma);
        return [
          {
            ...mockItems[0],
            qtyReceived: 60,
            qtyRejected: 0,
          },
        ];
      });

      const result = await caller.receipts.updateItems({
        items: [
          {
            id: testId('ri1'),
            qtyReceived: 60, // Allowed even though total would exceed ordered
            qtyRejected: 0,
          },
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0].qtyReceived).toBe(60);
    });
  });

  describe('complete', () => {
    it('should complete a receipt', async () => {
      // Create caller with MANAGER role for complete
      const managerCaller = await createDirectCaller({
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'MANAGER' },
      });

      const mockReceipt = {
        id: testId('rec1'),
        poId: testId('po1'),
        organizationId: testId('org'),
        items: [
          {
            id: testId('ri1'),
            qtyReceived: 100,
            qtyRejected: 0,
          },
        ],
        purchaseOrder: {
          id: testId('po1'),
          status: 'PARTIAL',
          items: [
            {
              id: testId('poi1'),
              qtyOrdered: 100,
              qtyReceived: 100,
            },
          ],
        },
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(mockReceipt);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return mockReceipt;
      });

      const result = await managerCaller.receipts.complete({
        id: testId('rec1'),
      });

      expect(result.id).toBe(testId('rec1'));
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should prevent completing receipt without items', async () => {
      const mockReceipt = {
        id: testId('rec1'),
        organizationId: testId('org'),
        items: [], // No items
        purchaseOrder: {
          id: testId('po1'),
          status: 'PARTIAL',
        },
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(mockReceipt);

      await expect(caller.receipts.complete({ id: testId('rec1') })).rejects.toThrow(
        'Cannot complete receipt without items'
      );
    });
  });

  describe('getDiscrepancies', () => {
    it('should get receipt discrepancies', async () => {
      const mockReceipt = {
        id: testId('rec1'),
        reference: 'REC-2024-000001',
        organizationId: testId('org'),
        purchaseOrder: {
          organizationId: testId('org'),
          items: [
            {
              id: testId('poi1'),
              itemId: testId('item1'),
              qtyOrdered: 100,
              item: {
                sku: 'ITEM001',
                name: 'Test Item',
              },
            },
          ],
        },
        items: [
          {
            id: testId('ri1'),
            itemId: testId('item1'), // Add itemId to match PO item
            poItemId: testId('poi1'),
            qtyReceived: 90,
            qtyRejected: 10,
            rejectionReason: 'Damaged',
            item: {
              sku: 'ITEM001',
              name: 'Test Item',
            },
            purchaseOrderItem: {
              id: testId('poi1'),
              qtyOrdered: 100,
              item: {
                sku: 'ITEM001',
                name: 'Test Item',
              },
            },
          },
        ],
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(mockReceipt);

      const result = await caller.receipts.getDiscrepancies({
        receiptId: testId('rec1'),
      });

      expect(result.summary.totalItems).toBe(1);
      expect(result.summary.itemsWithDiscrepancies).toBe(1);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].discrepancy.type).toBe('UNDER_RECEIPT');
      expect(result.details[0].discrepancy.variance).toBe(-10);
    });

    it('should return no discrepancies for perfect receipt', async () => {
      const mockReceipt = {
        id: testId('rec1'),
        organizationId: testId('org'),
        purchaseOrder: {
          organizationId: testId('org'),
          items: [
            {
              id: testId('poi1'),
              itemId: testId('item1'),
              qtyOrdered: 100,
              item: {
                sku: 'ITEM001',
                name: 'Test Item',
              },
            },
          ],
        },
        items: [
          {
            id: testId('ri1'),
            qtyReceived: 100,
            qtyRejected: 0,
            purchaseOrderItem: {
              qtyOrdered: 100,
              item: {
                sku: 'ITEM001',
                name: 'Test Item',
              },
            },
          },
        ],
      };

      mockPrisma.receipt.findFirst.mockResolvedValue(mockReceipt);

      const result = await caller.receipts.getDiscrepancies({
        receiptId: testId('rec1'),
      });

      expect(result.details).toHaveLength(0);
      expect(result.summary.itemsWithDiscrepancies).toBe(0);
    });
  });

  describe('export', () => {
    it('should export receipts data', async () => {
      const mockReceipts = [
        {
          id: testId('rec1'),
          reference: 'REC-2024-000001',
          receivedDate: new Date(),
          purchaseOrder: {
            poNumber: 'PO-2024-001',
            supplier: {
              name: 'Test Supplier',
            },
          },
          items: [
            {
              qtyReceived: 100,
              qtyRejected: 0,
              purchaseOrderItem: {
                item: {
                  sku: 'ITEM001',
                  name: 'Test Item',
                },
              },
            },
          ],
          receivedBy: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ];

      mockPrisma.receipt.findMany.mockResolvedValue(mockReceipts);

      const result = await caller.receipts.export({
        filters: {},
        format: 'csv',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].reference).toBe('REC-2024-000001');
      expect(result.format).toBe('csv');
      expect(result.count).toBe(1);
    });
  });
});
