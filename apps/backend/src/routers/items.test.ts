import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMany: vi.fn(),
    },
    inventory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
    itemCategory: {
      findUnique: vi.fn(),
    },
    supplier: {
      findUnique: vi.fn(),
    },
    unitOfMeasure: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    priceHistory: {
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  return { 
    prisma: mockPrisma,
    Prisma: {
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
  item: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
  },
  inventory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
  },
  category: {
    findUnique: vi.fn(),
  },
  itemCategory: {
    findUnique: vi.fn(),
  },
  supplier: {
    findUnique: vi.fn(),
  },
  unitOfMeasure: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  priceHistory: {
    create: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  }),
};

describe('Items Router', () => {
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
      role: 'MANAGER',
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list items with pagination', async () => {
      const mockItems = [
        {
          id: testId('item1'),
          sku: 'ITEM001',
          name: 'Test Item 1',
          description: 'A test item',
          categoryId: testId('cat1'),
          organizationId: testId('org'),
          isActive: true,
          reorderPoint: 50,
          reorderQty: 100,
          defaultCost: 10,
          defaultPrice: 19.99,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { name: 'Category 1' },
          unitOfMeasure: { name: 'Each', abbreviation: 'EA' },
          defaultSupplier: null,
        },
      ];

      mockPrisma.item.findMany.mockResolvedValue(mockItems);
      mockPrisma.item.count.mockResolvedValue(1);

      const result = await caller.items.list({
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sku).toBe('ITEM001');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should filter items by search term', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);

      await caller.items.list({
        search: 'ITEM001',
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: testId('org'),
            OR: expect.arrayContaining([
              { sku: { contains: 'ITEM001', mode: 'insensitive' } },
              { name: { contains: 'ITEM001', mode: 'insensitive' } },
              { description: { contains: 'ITEM001', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by category', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);
      mockPrisma.item.count.mockResolvedValue(0);

      await caller.items.list({
        categoryId: testId('cat1'),
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: testId('cat1'),
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

      await expect(noOrgCaller.items.list({ page: 1, limit: 20 })).rejects.toThrow('No organization selected');
    });
  });

  describe('get', () => {
    it('should get item by id', async () => {
      const mockItem = {
        id: testId('item1'),
        sku: 'ITEM001',
        name: 'Test Item',
        organizationId: testId('org'),
        categoryId: testId('cat1'),
        category: { name: 'Category 1' },
        unitOfMeasure: { name: 'Each' },
        defaultSupplier: null,
        images: [],
        inventory: [],
        priceHistory: [],
        lots: [],
      };

      mockPrisma.item.findFirst.mockResolvedValue(mockItem);

      const result = await caller.items.get({
        id: testId('item1'),
      });

      expect(result.id).toBe(testId('item1'));
      expect(result.sku).toBe('ITEM001');
      expect(result.stockSummary).toEqual({
        onHand: 0,
        reserved: 0,
        available: 0
      });
    });

    it('should throw NOT_FOUND when item does not exist', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(null);

      await expect(
        caller.items.get({ id: testId('nonexistent') })
      ).rejects.toThrow('Item not found');
    });

    it('should throw FORBIDDEN when item belongs to different organization', async () => {
      // findFirst with organizationId filter won't return items from other orgs
      mockPrisma.item.findFirst.mockResolvedValue(null);

      await expect(
        caller.items.get({ id: testId('item1') })
      ).rejects.toThrow('Item not found');
    });
  });

  // Note: The items router doesn't have a separate SKU lookup endpoint
  // SKU lookups would need to be done via the list endpoint with search

  describe('create', () => {
    it('should create a new item', async () => {
      const mockCategory = {
        id: testId('cat1'),
        organizationId: testId('org'),
      };

      const mockUom = {
        id: testId('uom1'),
        organizationId: testId('org'),
      };

      const newItem = {
        id: testId('item1'),
        sku: 'ITEM001',
        name: 'New Item',
        categoryId: testId('cat1'),
        uomId: testId('uom1'),
        organizationId: testId('org'),
        isActive: true,
        reorderPoint: 0,
        reorderQty: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.item.findFirst.mockResolvedValue(null); // No duplicate SKU
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(mockUom);
      mockPrisma.item.create.mockResolvedValue(newItem);

      const result = await caller.items.create({
        sku: 'ITEM001',
        name: 'New Item',
        categoryId: testId('cat1'),
        uomId: testId('uom1'),
      });

      expect(result.sku).toBe('ITEM001');
      expect(result.name).toBe('New Item');
      expect(mockPrisma.item.create).toHaveBeenCalled();
      const createCall = mockPrisma.item.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        sku: 'ITEM001',
        name: 'New Item',
        categoryId: testId('cat1'),
        uomId: testId('uom1'),
        organizationId: testId('org'),
      });
    });

    it('should throw CONFLICT when SKU already exists', async () => {
      mockPrisma.item.findFirst.mockResolvedValue({ id: testId('existing') });

      await expect(
        caller.items.create({
          sku: 'ITEM001',
          name: 'New Item',
          categoryId: testId('cat1'),
          uomId: testId('uom1'),
        })
      ).rejects.toThrow('An item with this SKU already exists');
    });

    it('should create item even with nonexistent category (relies on DB constraint)', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(null);
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.item.create.mockResolvedValue({
        id: testId('item1'),
        sku: 'ITEM001',
        name: 'New Item',
        categoryId: testId('nonexistent'),
        uomId: testId('uom1'),
        organizationId: testId('org'),
        isActive: true,
        reorderPoint: 0,
        reorderQty: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await caller.items.create({
        sku: 'ITEM001',
        name: 'New Item',
        categoryId: testId('nonexistent'),
        uomId: testId('uom1'),
      });
      
      // The router doesn't validate category exists, relies on DB foreign key constraint
      expect(result.sku).toBe('ITEM001');
    });

    it('should require MANAGER role', async () => {
      const employeeCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'EMPLOYEE' },
      });

      await expect(
        employeeCaller.items.create({
          sku: 'ITEM001',
          name: 'New Item',
          categoryId: testId('cat1'),
          uomId: testId('uom1'),
        })
      ).rejects.toThrow('Only administrators and managers can create items');
    });
  });

  describe('update', () => {
    it('should update an existing item', async () => {
      const existingItem = {
        id: testId('item1'),
        sku: 'ITEM001',
        name: 'Old Name',
        organizationId: testId('org'),
      };

      const updatedItem = {
        ...existingItem,
        name: 'Updated Name',
      };

      mockPrisma.item.findFirst.mockResolvedValue(existingItem);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return updatedItem;
      });
      mockPrisma.item.update.mockResolvedValue(updatedItem);

      const result = await caller.items.update({
        id: testId('item1'),
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockPrisma.item.update).toHaveBeenCalledWith({
        where: { id: testId('item1') },
        data: { name: 'Updated Name' },
        include: {
          category: true,
          unitOfMeasure: true,
        },
      });
    });

    it('should prevent updating SKU to existing one', async () => {
      const existingItem = {
        id: testId('item1'),
        sku: 'ITEM001',
        organizationId: testId('org'),
      };

      mockPrisma.item.findFirst
        .mockResolvedValueOnce(existingItem) // Current item
        .mockResolvedValueOnce({ id: testId('item2') }); // Different item with same SKU

      await expect(
        caller.items.update({
          id: testId('item1'),
          sku: 'ITEM002',
        })
      ).rejects.toThrow('An item with this SKU already exists');
    });
  });

  describe('delete', () => {
    it('should delete an item', async () => {
      // Create caller with ADMIN role for delete
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });
      const mockItem = {
        id: testId('item1'),
        sku: 'ITEM001',
        name: 'Test Item',
        organizationId: testId('org'),
      };

      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.inventory.findFirst.mockResolvedValue(null); // No inventory
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return mockItem;
      });
      mockPrisma.item.delete.mockResolvedValue(mockItem);

      const result = await adminCaller.items.delete({
        id: testId('item1'),
      });

      expect(result.id).toBe(testId('item1'));
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw PRECONDITION_FAILED when item has inventory', async () => {
      // Create caller with ADMIN role for delete
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });
      const mockItem = {
        id: testId('item1'),
        organizationId: testId('org'),
      };

      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: testId('inv1'), 
        qtyOnHand: 10
      });

      await expect(
        adminCaller.items.delete({ id: testId('item1') })
      ).rejects.toThrow('Cannot delete item with active inventory');
    });

    it('should require ADMIN role for delete', async () => {
      const mockItem = {
        id: testId('item1'),
        organizationId: testId('org'),
      };

      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.inventory.findFirst.mockResolvedValue(null);

      await expect(
        caller.items.delete({ id: testId('item1') })
      ).rejects.toThrow('Only administrators can delete items');
    });
  });

  describe('bulkImport', () => {
    it('should validate items without creating them', async () => {
      // Create caller with ADMIN role for bulkImport
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });
      const items = [
        {
          sku: 'ITEM001',
          name: 'Item 1',
          categoryId: testId('cat1'),
          uomId: testId('uom1'),
        },
        {
          sku: 'ITEM002',
          name: 'Item 2',
          categoryId: testId('cat1'),
          uomId: testId('uom1'),
        },
      ];

      mockPrisma.item.findFirst.mockResolvedValue(null); // No duplicates
      mockPrisma.itemCategory.findUnique.mockResolvedValue({ id: testId('cat1'), organizationId: testId('org') });
      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue({ id: testId('uom1'), organizationId: testId('org') });

      const result = await adminCaller.items.bulkImport({
        items,
        validateOnly: true,
      });

      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.item.createMany).not.toHaveBeenCalled();
    });

    it('should import valid items', async () => {
      // Create caller with ADMIN role for bulkImport
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });
      const items = [
        {
          sku: 'ITEM001',
          name: 'Item 1',
          categoryId: testId('cat1'),
          uomId: testId('uom1'),
        },
      ];

      mockPrisma.item.findFirst.mockResolvedValue(null);
      mockPrisma.itemCategory.findUnique.mockResolvedValue({ id: testId('cat1'), organizationId: testId('org') });
      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue({ id: testId('uom1'), organizationId: testId('org') });
      
      const createdItem = {
        id: testId('newitem1'),
        sku: 'ITEM001',
        name: 'Item 1',
        organizationId: testId('org'),
      };
      
      mockPrisma.item.create.mockResolvedValue(createdItem);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return [createdItem];
      });

      const result = await adminCaller.items.bulkImport({
        items,
        validateOnly: false,
      });

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(mockPrisma.item.create).toHaveBeenCalled();
    });

    it('should report validation errors', async () => {
      // Create caller with ADMIN role for bulkImport
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });
      const items = [
        {
          sku: 'ITEM001',
          name: 'Item 1',
          categoryId: testId('cat1'),
          uomId: testId('uom1'),
        },
      ];

      mockPrisma.item.findFirst.mockResolvedValue({ id: testId('existing') }); // Duplicate SKU

      const result = await adminCaller.items.bulkImport({
        items,
        validateOnly: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        row: 1,
        errors: ['SKU ITEM001 already exists'],
      });
    });

    it('should require ADMIN role for bulk import', async () => {
      const items = [{ sku: 'ITEM001', name: 'Item 1', categoryId: testId('cat1'), uomId: testId('uom1') }];
      
      await expect(
        caller.items.bulkImport({ items, validateOnly: true })
      ).rejects.toThrow('Only administrators can bulk import items');
    });
  });

  describe('get with inventory data', () => {
    it('should include stock summary when item has inventory', async () => {
      const mockInventory = [
        {
          id: testId('inv1'),
          locationId: testId('loc1'),
          qtyOnHand: 40,
          qtyReserved: 10,
          qtyInTransit: 20,
          location: {
            code: 'A-1-1',
            warehouse: { name: 'Main Warehouse' },
          },
          lot: null,
        },
        {
          id: testId('inv2'),
          locationId: testId('loc2'),
          qtyOnHand: 60,
          qtyReserved: 5,
          qtyInTransit: 0,
          location: {
            code: 'B-1-1',
            warehouse: { name: 'Secondary Warehouse' },
          },
          lot: null,
        },
      ];

      const mockItem = {
        id: testId('item1'),
        sku: 'ITEM001',
        name: 'Test Item',
        organizationId: testId('org'),
        reorderPoint: 50,
        reorderQty: 100,
        category: { name: 'Category 1' },
        unitOfMeasure: { name: 'Each' },
        defaultSupplier: null,
        images: [],
        inventory: mockInventory,
        priceHistory: [],
        lots: [],
      };

      mockPrisma.item.findFirst.mockResolvedValue(mockItem);

      const result = await caller.items.get({
        id: testId('item1'),
      });

      expect(result.id).toBe(testId('item1'));
      expect(result.sku).toBe('ITEM001');
      expect(result.inventory).toHaveLength(2);
      expect(result.stockSummary).toEqual({
        onHand: 100,  // 40 + 60
        reserved: 15, // 10 + 5
        available: 85 // (40-10) + (60-5) = 30 + 55
      });
    });
  });
});