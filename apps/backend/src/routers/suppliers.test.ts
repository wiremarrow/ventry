import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    supplier: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    supplierContact: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    purchaseOrder: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    purchaseOrderItem: {
      groupBy: vi.fn(),
    },
    receipt: {
      aggregate: vi.fn(),
    },
    lot: {
      findMany: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  return { 
    prisma: mockPrisma,
    Prisma: {
      SupplierWhereInput: {},
      PurchaseOrderWhereInput: {},
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
    PurchaseOrderStatus: {
      DRAFT: 'DRAFT',
      SUBMITTED: 'SUBMITTED',
      APPROVED: 'APPROVED',
      RECEIVED: 'RECEIVED',
      CANCELLED: 'CANCELLED',
    },
  };
});

// Access the mocked prisma for tests
const mockPrisma = {
  supplier: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  supplierContact: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  purchaseOrder: {
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  purchaseOrderItem: {
    groupBy: vi.fn(),
  },
  receipt: {
    aggregate: vi.fn(),
  },
  lot: {
    findMany: vi.fn(),
  },
  item: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  }),
};

describe('Suppliers Router', () => {
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
      role: 'MANAGER', // Managers can manage suppliers
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list suppliers with pagination and metrics', async () => {
      const mockSuppliers = [
        {
          id: testId('supp1'),
          supplierCode: 'SUPP001',
          name: 'Test Supplier 1',
          email: 'supplier1@example.com',
          phone: '123-456-7890',
          country: 'USA',
          organizationId: testId('org'),
          leadTimeDays: 7,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            contacts: 2,
            purchaseOrders: 5,
          },
          purchaseOrders: [
            {
              id: testId('po1'),
              orderDate: new Date(),
              status: 'APPROVED',
            },
          ],
        },
      ];

      mockPrisma.supplier.findMany.mockResolvedValue(mockSuppliers);
      mockPrisma.supplier.count.mockResolvedValue(1);
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: 50000 },
        _count: 3,
      });

      const result = await caller.suppliers.list({
        page: 1,
        limit: 20,
      });

      expect(result.suppliers).toHaveLength(1);
      expect(result.suppliers[0].supplierCode).toBe('SUPP001');
      expect(result.suppliers[0].totalOrderValue12Months).toBe(50000);
      expect(result.suppliers[0].orderCount12Months).toBe(3);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter suppliers by search', async () => {
      mockPrisma.supplier.findMany.mockResolvedValue([]);
      mockPrisma.supplier.count.mockResolvedValue(0);

      await caller.suppliers.list({
        search: 'test',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            OR: expect.arrayContaining([
              { supplierCode: { contains: 'test', mode: 'insensitive' } },
              { name: { contains: 'test', mode: 'insensitive' } },
              { email: { contains: 'test', mode: 'insensitive' } },
              { phone: { contains: 'test', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter suppliers by country', async () => {
      mockPrisma.supplier.findMany.mockResolvedValue([]);
      mockPrisma.supplier.count.mockResolvedValue(0);

      await caller.suppliers.list({
        country: 'USA',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            country: 'USA',
          }),
        })
      );
    });

    it('should filter suppliers with open orders', async () => {
      mockPrisma.supplier.findMany.mockResolvedValue([]);
      mockPrisma.supplier.count.mockResolvedValue(0);

      await caller.suppliers.list({
        hasOpenOrders: true,
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            purchaseOrders: {
              some: {
                status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
              },
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

      await expect(noOrgCaller.suppliers.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('get', () => {
    it('should get supplier by id with full statistics', async () => {
      const mockSupplier = {
        id: testId('supp1'),
        supplierCode: 'SUPP001',
        name: 'Test Supplier',
        organizationId: testId('org'),
        contacts: [
          {
            id: testId('cont1'),
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@supplier.com',
          },
        ],
        purchaseOrders: [
          {
            id: testId('po1'),
            poNumber: 'PO001',
            orderDate: new Date(),
            expectedDate: new Date(),
            status: 'APPROVED',
            total: 10000,
          },
        ],
        lots: [
          {
            id: testId('lot1'),
            lotNumber: 'LOT001',
            receivedDate: new Date(),
            qtyInitial: 100,
            qtyOnHand: 80,
            item: {
              sku: 'ITEM001',
              name: 'Test Item',
            },
          },
        ],
      };

      const mockOrderStats = [
        {
          status: 'APPROVED',
          _count: 5,
          _sum: { total: 25000 },
        },
        {
          status: 'RECEIVED',
          _count: 10,
          _sum: { total: 75000 },
        },
      ];

      const mockQualityStats = {
        _count: 15,
      };

      mockPrisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      mockPrisma.purchaseOrder.groupBy.mockResolvedValue(mockOrderStats);
      mockPrisma.receipt.aggregate.mockResolvedValue(mockQualityStats);

      const result = await caller.suppliers.get({
        id: testId('supp1'),
      });

      expect(result.id).toBe(testId('supp1'));
      expect(result.contacts).toHaveLength(1);
      expect(result.purchaseOrders).toHaveLength(1);
      expect(result.lots).toHaveLength(1);
      expect(result.statistics.orders.total).toBe(15);
      expect(result.statistics.orders.totalValue).toBe(100000);
      expect(result.statistics.quality.receiptsCount).toBe(15);
    });

    it('should throw NOT_FOUND when supplier does not exist', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        caller.suppliers.get({ id: testId('nonexistent') })
      ).rejects.toThrow('Supplier not found');
    });
  });

  describe('create', () => {
    it('should create a new supplier', async () => {
      const supplierData = {
        supplierCode: 'SUPP002',
        name: 'New Supplier',
        phone: '987-654-3210',
        email: 'new@supplier.com',
        website: 'https://newsupplier.com',
        currencyId: 'USD',
        paymentTerms: 'NET30',
        leadTimeDays: 14,
        line1: '123 Supply St',
        city: 'Supply City',
        state: 'SC',
        postalCode: '12345',
        country: 'USA',
      };

      const newSupplier = {
        id: testId('supp2'),
        ...supplierData,
        organizationId: testId('org'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.supplier.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return newSupplier;
      });
      mockPrisma.supplier.create.mockResolvedValue(newSupplier);

      const result = await caller.suppliers.create(supplierData);

      expect(result.supplierCode).toBe('SUPP002');
      expect(result.name).toBe('New Supplier');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw CONFLICT when supplier code already exists', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue({ id: testId('existing') });

      await expect(
        caller.suppliers.create({
          supplierCode: 'SUPP001',
          name: 'Duplicate Supplier',
          line1: '123 Main St',
          city: 'City',
          state: 'ST',
          postalCode: '12345',
          country: 'USA',
        })
      ).rejects.toThrow('A supplier with this code already exists');
    });

    it('should require ADMIN or MANAGER role', async () => {
      const employeeCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'EMPLOYEE' },
      });

      await expect(
        employeeCaller.suppliers.create({
          supplierCode: 'SUPP001',
          name: 'Test Supplier',
          line1: '123 Main St',
          city: 'City',
          state: 'ST',
          postalCode: '12345',
          country: 'USA',
        })
      ).rejects.toThrow('Only administrators and managers can create suppliers');
    });
  });

  describe('update', () => {
    it('should update an existing supplier', async () => {
      const existingSupplier = {
        id: testId('supp1'),
        supplierCode: 'SUPP001',
        name: 'Old Name',
        organizationId: testId('org'),
      };

      const updatedSupplier = {
        ...existingSupplier,
        name: 'Updated Name',
      };

      mockPrisma.supplier.findFirst.mockResolvedValue(existingSupplier);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return updatedSupplier;
      });
      mockPrisma.supplier.update.mockResolvedValue(updatedSupplier);

      const result = await caller.suppliers.update({
        id: testId('supp1'),
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockPrisma.supplier.update).toHaveBeenCalledWith({
        where: { id: testId('supp1') },
        data: { name: 'Updated Name' },
      });
    });

    it('should prevent updating supplier code to existing one', async () => {
      const existingSupplier = {
        id: testId('supp1'),
        supplierCode: 'SUPP001',
        organizationId: testId('org'),
      };

      mockPrisma.supplier.findFirst
        .mockResolvedValueOnce(existingSupplier) // Current supplier
        .mockResolvedValueOnce({ id: testId('supp2') }); // Different supplier with same code

      await expect(
        caller.suppliers.update({
          id: testId('supp1'),
          supplierCode: 'SUPP002',
        })
      ).rejects.toThrow('A supplier with this code already exists');
    });
  });

  describe('delete', () => {
    it('should delete a supplier', async () => {
      // Create caller with ADMIN role for delete
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });

      const mockSupplier = {
        id: testId('supp1'),
        supplierCode: 'SUPP001',
        name: 'Test Supplier',
        organizationId: testId('org'),
      };

      mockPrisma.purchaseOrder.count.mockResolvedValue(0); // No active orders
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return mockSupplier;
      });
      mockPrisma.supplier.delete.mockResolvedValue(mockSupplier);

      const result = await adminCaller.suppliers.delete({
        id: testId('supp1'),
      });

      expect(result.id).toBe(testId('supp1'));
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw PRECONDITION_FAILED when supplier has active orders', async () => {
      // Create caller with ADMIN role for delete
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });

      mockPrisma.purchaseOrder.count.mockResolvedValue(3); // Has active orders

      await expect(
        adminCaller.suppliers.delete({ id: testId('supp1') })
      ).rejects.toThrow('Cannot delete supplier with 3 active orders');
    });

    it('should require ADMIN role for delete', async () => {
      await expect(
        caller.suppliers.delete({ id: testId('supp1') })
      ).rejects.toThrow('Only administrators can delete suppliers');
    });

    it('should allow force deletion with active orders', async () => {
      // Create caller with ADMIN role for delete
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });

      const mockSupplier = {
        id: testId('supp1'),
        organizationId: testId('org'),
      };

      mockPrisma.purchaseOrder.count.mockResolvedValue(3); // Has active orders
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return mockSupplier;
      });
      mockPrisma.supplier.delete.mockResolvedValue(mockSupplier);

      const result = await adminCaller.suppliers.delete({
        id: testId('supp1'),
        force: true,
      });

      expect(result.id).toBe(testId('supp1'));
    });
  });

  describe('archive', () => {
    it('should archive a supplier', async () => {
      const mockSupplier = {
        id: testId('supp1'),
        supplierCode: 'SUPP001',
        name: 'Test Supplier',
        organizationId: testId('org'),
      };

      mockPrisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0); // No active orders
      mockPrisma.supplier.delete.mockResolvedValue(mockSupplier);

      const result = await caller.suppliers.archive({
        id: testId('supp1'),
      });

      expect(result.id).toBe(testId('supp1'));
      expect(mockPrisma.supplier.delete).toHaveBeenCalledWith({
        where: { id: testId('supp1') },
      });
    });

    it('should throw PRECONDITION_FAILED when supplier has active orders', async () => {
      const mockSupplier = {
        id: testId('supp1'),
        organizationId: testId('org'),
      };

      mockPrisma.supplier.findFirst.mockResolvedValue(mockSupplier);
      mockPrisma.purchaseOrder.count.mockResolvedValue(2); // Has active orders

      await expect(
        caller.suppliers.archive({ id: testId('supp1') })
      ).rejects.toThrow('Cannot archive supplier with 2 active purchase orders');
    });

    it('should throw NOT_FOUND when supplier does not exist', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        caller.suppliers.archive({ id: testId('nonexistent') })
      ).rejects.toThrow('Supplier not found');
    });
  });

  describe('getStats', () => {
    it('should get supplier statistics', async () => {
      mockPrisma.supplier.count.mockResolvedValue(15);
      mockPrisma.supplier.count.mockResolvedValueOnce(15).mockResolvedValueOnce(8); // Second call for active suppliers
      mockPrisma.supplier.findMany.mockResolvedValue([
        { leadTimeDays: 7 },
        { leadTimeDays: 14 },
        { leadTimeDays: 10 },
      ]);
      mockPrisma.purchaseOrder.aggregate.mockResolvedValue({
        _sum: { total: { toNumber: () => 150000 } },
      });

      const result = await caller.suppliers.getStats();

      expect(result.total).toBe(15);
      expect(result.active).toBe(8);
      expect(result.avgLeadTimeDays).toBeCloseTo(10.33, 1);
      expect(result.monthlyPurchaseValue).toBe(150000);
    });
  });

  describe('getPerformance', () => {
    it('should get supplier performance metrics', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const mockPurchaseOrders = [
        {
          id: testId('po1'),
          orderDate: new Date('2024-01-15'),
          expectedDate: new Date('2024-01-25'),
          total: 10000,
          status: 'RECEIVED',
          receipts: [
            {
              id: testId('rec1'),
              receivedDate: new Date('2024-01-24'),
            },
          ],
          items: [
            {
              itemId: testId('item1'),
              qtyOrdered: 100,
              totalCost: 10000,
            },
          ],
        },
      ];

      const mockTopItems = [
        {
          itemId: testId('item1'),
          _sum: {
            qtyOrdered: 100,
            totalCost: 10000,
          },
          _count: 1,
        },
      ];

      const mockItem = {
        id: testId('item1'),
        sku: 'ITEM001',
        name: 'Test Item',
        category: { name: 'Category 1' },
      };

      mockPrisma.purchaseOrder.findMany.mockResolvedValue(mockPurchaseOrders);
      mockPrisma.purchaseOrderItem.groupBy.mockResolvedValue(mockTopItems);
      mockPrisma.item.findUnique.mockResolvedValue(mockItem);

      const result = await caller.suppliers.getPerformance({
        supplierId: testId('supp1'),
        dateFrom,
        dateTo,
      });

      expect(result.metrics.orderMetrics.totalOrders).toBe(1);
      expect(result.metrics.orderMetrics.totalValue).toBe(10000);
      expect(result.metrics.deliveryMetrics.onTimeDeliveries).toBe(1);
      expect(result.metrics.deliveryMetrics.avgLeadTime).toBe(9); // 9 days lead time
      expect(result.topItems).toHaveLength(1);
      expect(result.topItems[0].name).toBe('Test Item');
    });
  });

  describe('getSuggestedReorders', () => {
    it('should return empty suggestions', async () => {
      const result = await caller.suppliers.getSuggestedReorders({
        supplierId: testId('supp1'),
      });

      expect(result.suggestions).toEqual([]);
      expect(result.summary.totalItems).toBe(0);
      expect(result.summary.totalValue).toBe(0);
      expect(result.summary.criticalItems).toBe(0);
    });
  });

  describe('import', () => {
    it('should validate suppliers in validation mode', async () => {
      // Create caller with ADMIN role for import
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });

      const suppliers = [
        {
          supplierCode: 'SUPP003',
          name: 'Valid Supplier',
          line1: '123 Valid St',
          city: 'Valid City',
          state: 'VC',
          postalCode: '12345',
          country: 'USA',
          currencyId: 'USD',
          leadTimeDays: 7,
        },
      ];

      mockPrisma.supplier.findFirst.mockResolvedValue(null); // No duplicates

      const result = await adminCaller.suppliers.import({
        suppliers,
        validateOnly: true,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.validCount).toBe(1);
      expect(result.totalCount).toBe(1);
    });

    it('should import valid suppliers', async () => {
      // Create caller with ADMIN role for import
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });

      const suppliers = [
        {
          supplierCode: 'SUPP003',
          name: 'New Supplier',
          line1: '123 New St',
          city: 'New City',
          state: 'NC',
          postalCode: '12345',
          country: 'USA',
          currencyId: 'USD',
          leadTimeDays: 7,
        },
      ];

      const createdSupplier = {
        id: testId('supp3'),
        ...suppliers[0],
        organizationId: testId('org'),
      };

      mockPrisma.supplier.findFirst.mockResolvedValue(null); // No duplicates
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return [createdSupplier];
      });
      mockPrisma.supplier.create.mockResolvedValue(createdSupplier);

      const result = await adminCaller.suppliers.import({
        suppliers,
        validateOnly: false,
      });

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.suppliers).toHaveLength(1);
    });

    it('should report validation errors', async () => {
      // Create caller with ADMIN role for import
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });

      const suppliers = [
        {
          supplierCode: 'SUPP001',
          name: 'Duplicate Supplier',
          email: 'valid@email.com', // Use valid email to pass Zod validation
          line1: '123 Main St',
          city: 'City',
          state: 'ST',
          postalCode: '12345',
          country: 'USA',
          currencyId: 'USD',
          leadTimeDays: 7,
        },
      ];

      mockPrisma.supplier.findFirst.mockResolvedValue({ id: testId('existing') }); // Duplicate exists

      await expect(
        adminCaller.suppliers.import({
          suppliers,
          validateOnly: false,
        })
      ).rejects.toThrow('Validation failed for 1 suppliers');
    });

    it('should require ADMIN role', async () => {
      await expect(
        caller.suppliers.import({
          suppliers: [],
          validateOnly: true,
        })
      ).rejects.toThrow('Only administrators can import suppliers');
    });
  });

  describe('contacts sub-router', () => {
    describe('contacts.list', () => {
      it('should list contacts for a supplier', async () => {
        const mockContacts = [
          {
            id: testId('cont1'),
            supplierId: testId('supp1'),
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@supplier.com',
            phone: '123-456-7890',
            role: 'Sales Manager',
          },
        ];

        mockPrisma.supplierContact.findMany.mockResolvedValue(mockContacts);

        const result = await caller.suppliers.contacts.list({
          supplierId: testId('supp1'),
        });

        expect(result).toHaveLength(1);
        expect(result[0].firstName).toBe('John');
      });
    });

    describe('contacts.create', () => {
      it('should create a new contact', async () => {
        const contactData = {
          supplierId: testId('supp1'),
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@supplier.com',
          phone: '987-654-3210',
          role: 'Account Manager',
        };

        const newContact = {
          id: testId('cont2'),
          ...contactData,
          organizationId: testId('org'),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.supplierContact.create.mockResolvedValue(newContact);

        const result = await caller.suppliers.contacts.create(contactData);

        expect(result.firstName).toBe('Jane');
        expect(result.lastName).toBe('Smith');
        expect(mockPrisma.supplierContact.create).toHaveBeenCalledWith({
          data: {
            ...contactData,
            organizationId: testId('org'),
          },
        });
      });
    });

    describe('contacts.update', () => {
      it('should update an existing contact', async () => {
        const updatedContact = {
          id: testId('cont1'),
          firstName: 'John',
          lastName: 'Updated',
          email: 'john.updated@supplier.com',
        };

        mockPrisma.supplierContact.update.mockResolvedValue(updatedContact);

        const result = await caller.suppliers.contacts.update({
          id: testId('cont1'),
          data: {
            lastName: 'Updated',
            email: 'john.updated@supplier.com',
          },
        });

        expect(result.lastName).toBe('Updated');
        expect(result.email).toBe('john.updated@supplier.com');
      });
    });

    describe('contacts.delete', () => {
      it('should delete a contact', async () => {
        const deletedContact = {
          id: testId('cont1'),
          firstName: 'John',
          lastName: 'Doe',
        };

        mockPrisma.supplierContact.delete.mockResolvedValue(deletedContact);

        const result = await caller.suppliers.contacts.delete({
          id: testId('cont1'),
        });

        expect(result.id).toBe(testId('cont1'));
        expect(mockPrisma.supplierContact.delete).toHaveBeenCalledWith({
          where: { id: testId('cont1') },
        });
      });
    });
  });
});