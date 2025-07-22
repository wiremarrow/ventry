import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    itemCategory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    item: {
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  return { 
    prisma: mockPrisma,
    Prisma: {
      ItemCategoryWhereInput: {},
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
  itemCategory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  item: {
    count: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  }),
};

describe('ItemCategories Router', () => {
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
      role: 'ADMIN', // Need ADMIN or MANAGER role for category operations
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list categories', async () => {
      const mockCategories = [
        {
          id: testId('cat1'),
          name: 'Electronics',
          description: 'Electronic items',
          parentId: null,
          organizationId: testId('org'),
          createdAt: new Date(),
          updatedAt: new Date(),
          parent: null,
          children: [],
          _count: {
            items: 5,
          },
        },
      ];

      mockPrisma.itemCategory.findMany.mockResolvedValue(mockCategories);

      const result = await caller.itemCategories.list({});

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Electronics');
      expect(result[0]._count.items).toBe(5);
    });

    it('should search categories by name', async () => {
      mockPrisma.itemCategory.findMany.mockResolvedValue([]);

      await caller.itemCategories.list({
        search: 'laptop',
      });

      expect(mockPrisma.itemCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'laptop', mode: 'insensitive' } },
              { description: { contains: 'laptop', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should filter by parent category', async () => {
      mockPrisma.itemCategory.findMany.mockResolvedValue([]);

      await caller.itemCategories.list({
        parentId: testId('cat1'),
      });

      expect(mockPrisma.itemCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: testId('cat1'),
          }),
        })
      );
    });

    it('should include children when requested', async () => {
      const mockCategories = [
        {
          id: testId('cat1'),
          name: 'Electronics',
          children: [
            {
              id: testId('cat2'),
              name: 'Laptops',
            },
          ],
        },
      ];

      mockPrisma.itemCategory.findMany.mockResolvedValue(mockCategories);

      const result = await caller.itemCategories.list({
        includeChildren: true,
      });

      expect(mockPrisma.itemCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            children: true,
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

      await expect(noOrgCaller.itemCategories.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('getById', () => {
    it('should get category by id', async () => {
      const mockCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        description: 'Electronic items',
        parentId: null,
        organizationId: testId('org'),
        parent: null,
        children: [],
        items: [],
        _count: {
          items: 5,
        },
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(mockCategory);

      const result = await caller.itemCategories.getById({
        id: testId('cat1'),
      });

      expect(result.id).toBe(testId('cat1'));
      expect(result.name).toBe('Electronics');
    });

    it('should throw NOT_FOUND when category does not exist', async () => {
      mockPrisma.itemCategory.findFirst.mockResolvedValue(null);

      await expect(
        caller.itemCategories.getById({ id: testId('nonexistent') })
      ).rejects.toThrow('Category not found');
    });
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const categoryData = {
        name: 'Electronics',
        description: 'Electronic items',
      };

      const newCategory = {
        id: testId('cat1'),
        ...categoryData,
        parentId: null,
        organizationId: testId('org'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.itemCategory.create.mockResolvedValue(newCategory);

      const result = await caller.itemCategories.create(categoryData);

      expect(result.name).toBe('Electronics');
      expect(result.description).toBe('Electronic items');
    });

    it('should create a subcategory with parent', async () => {
      const categoryData = {
        name: 'Laptops',
        description: 'Laptop computers',
        parentId: testId('cat1'),
      };

      const parentCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
      };

      const newCategory = {
        id: testId('cat2'),
        ...categoryData,
        organizationId: testId('org'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.itemCategory.findFirst
        .mockResolvedValueOnce(parentCategory) // Parent exists
        .mockResolvedValueOnce(null); // No duplicate name
      mockPrisma.itemCategory.create.mockResolvedValue(newCategory);

      const result = await caller.itemCategories.create(categoryData);

      expect(result.name).toBe('Laptops');
      expect(result.parentId).toBe(testId('cat1'));
    });


    it('should throw NOT_FOUND when parent category does not exist', async () => {
      mockPrisma.itemCategory.findFirst.mockResolvedValue(null);

      await expect(
        caller.itemCategories.create({
          name: 'Laptops',
          parentId: testId('nonexistent'),
        })
      ).rejects.toThrow('Parent category not found');
    });

  });

  describe('update', () => {
    it('should update category', async () => {
      const existingCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        description: 'Electronic items',
        organizationId: testId('org'),
        parentId: null,
      };

      const updatedCategory = {
        ...existingCategory,
        description: 'Updated description',
        updatedAt: new Date(),
      };

      mockPrisma.itemCategory.findFirst
        .mockResolvedValueOnce(existingCategory) // Category exists
        .mockResolvedValueOnce(null); // No duplicate name
      mockPrisma.itemCategory.update.mockResolvedValue(updatedCategory);

      const result = await caller.itemCategories.update({
        id: testId('cat1'),
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
    });

    it('should prevent circular parent reference', async () => {
      const existingCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
        parentId: null,
      };

      mockPrisma.itemCategory.findFirst
        .mockResolvedValueOnce(existingCategory); // Category exists and belongs to org

      await expect(
        caller.itemCategories.update({
          id: testId('cat1'),
          parentId: testId('cat1'), // Self-reference
        })
      ).rejects.toThrow('Category cannot be its own parent');
    });

    it('should validate parent exists when updating parentId', async () => {
      const existingCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
        parentId: null,
      };

      mockPrisma.itemCategory.findFirst
        .mockResolvedValueOnce(existingCategory) // Category exists
        .mockResolvedValueOnce(null) // No duplicate name  
        .mockResolvedValueOnce(null); // Parent not found

      await expect(
        caller.itemCategories.update({
          id: testId('cat1'),
          parentId: testId('nonexistent'),
        })
      ).rejects.toThrow('Parent category not found');
    });

    it('should throw NOT_FOUND when category does not exist', async () => {
      mockPrisma.itemCategory.findFirst.mockResolvedValue(null);

      await expect(
        caller.itemCategories.update({
          id: testId('nonexistent'),
          name: 'New Name',
        })
      ).rejects.toThrow('Category not found');
    });

  });

  describe('delete', () => {
    it('should delete category without children or items', async () => {
      const existingCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
        _count: {
          children: 0,
        },
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(existingCategory);
      mockPrisma.item.count.mockResolvedValue(0); // No items
      mockPrisma.itemCategory.delete.mockResolvedValue(existingCategory);

      const result = await caller.itemCategories.delete({
        id: testId('cat1'),
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.itemCategory.delete).toHaveBeenCalledWith({
        where: { id: testId('cat1') },
      });
    });

    it('should prevent deleting category with children', async () => {
      const existingCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
        _count: {
          children: 2, // Has children
        },
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(existingCategory);

      await expect(
        caller.itemCategories.delete({ id: testId('cat1') })
      ).rejects.toThrow('Cannot delete category with subcategories');
    });

    it('should prevent deleting category with items', async () => {
      const existingCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
        _count: {
          children: 0,
          items: 5, // Has items
        },
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(existingCategory);

      await expect(
        caller.itemCategories.delete({ id: testId('cat1') })
      ).rejects.toThrow('Cannot delete category with associated items');
    });

    it('should throw NOT_FOUND when category does not exist', async () => {
      mockPrisma.itemCategory.findFirst.mockResolvedValue(null);

      await expect(
        caller.itemCategories.delete({ id: testId('nonexistent') })
      ).rejects.toThrow('Category not found');
    });

  });

});
