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
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  return { 
    prisma: mockPrisma,
    Prisma: {
      CategoryWhereInput: {},
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
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  }),
};

describe('Categories Router', () => {
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
    it('should list categories with pagination', async () => {
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
        {
          id: testId('cat2'),
          name: 'Laptops',
          description: 'Laptop computers',
          parentId: testId('cat1'),
          organizationId: testId('org'),
          createdAt: new Date(),
          updatedAt: new Date(),
          parent: {
            id: testId('cat1'),
            name: 'Electronics',
          },
          children: [],
          _count: {
            items: 3,
          },
        },
      ];

      mockPrisma.itemCategory.findMany.mockResolvedValue(mockCategories);
      mockPrisma.itemCategory.count.mockResolvedValue(2);

      const result = await caller.categories.list({
        page: 1,
        limit: 20,
      });

      expect(result.categories).toHaveLength(2);
      expect(result.categories[0].name).toBe('Electronics');
      expect(result.categories[1].parent?.name).toBe('Electronics');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('should search categories by name', async () => {
      mockPrisma.itemCategory.findMany.mockResolvedValue([]);
      mockPrisma.itemCategory.count.mockResolvedValue(0);

      await caller.categories.list({
        search: 'laptop',
        page: 1,
        limit: 20,
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
      mockPrisma.itemCategory.count.mockResolvedValue(0);

      await caller.categories.list({
        parentId: testId('cat1'),
        page: 1,
        limit: 20,
      });

      expect(mockPrisma.itemCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: testId('cat1'),
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

      await expect(noOrgCaller.categories.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('getById', () => {
    it('should get category by id with full details', async () => {
      const mockCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        description: 'Electronic items',
        parentId: null,
        organizationId: testId('org'),
        createdAt: new Date(),
        updatedAt: new Date(),
        parent: null,
        children: [
          {
            id: testId('cat2'),
            name: 'Laptops',
            description: 'Laptop computers',
            parentId: testId('cat1'),
            organizationId: testId('org'),
            _count: {
              items: 3,
            },
          },
        ],
        _count: {
          items: 5,
        },
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(mockCategory);

      const result = await caller.categories.getById({
        id: testId('cat1'),
      });

      expect(result.id).toBe(testId('cat1'));
      expect(result.name).toBe('Electronics');
      expect(result.children).toHaveLength(1);
      expect(result._count.items).toBe(5);
    });

    it('should throw NOT_FOUND when category does not exist', async () => {
      mockPrisma.itemCategory.findFirst.mockResolvedValue(null);

      await expect(
        caller.categories.getById({ id: testId('nonexistent') })
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

      const result = await caller.categories.create(categoryData);

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

      const result = await caller.categories.create(categoryData);

      expect(result.name).toBe('Laptops');
      expect(result.parentId).toBe(testId('cat1'));
    });


    it('should throw NOT_FOUND when parent category does not exist', async () => {
      mockPrisma.itemCategory.findFirst.mockResolvedValue(null);

      await expect(
        caller.categories.create({
          name: 'Laptops',
          parentId: testId('nonexistent'),
        })
      ).rejects.toThrow('Parent category not found');
    });

    it('should require MANAGER or ADMIN role', async () => {
      const employeeCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'EMPLOYEE' },
      });

      await expect(
        employeeCaller.categories.create({
          name: 'Electronics',
        })
      ).rejects.toThrow('Insufficient permissions to create categories');
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

      const result = await caller.categories.update({
        id: testId('cat1'),
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
    });

    it('should update parent category', async () => {
      const existingCategory = {
        id: testId('cat2'),
        name: 'Laptops',
        organizationId: testId('org'),
        parentId: null,
      };

      const parentCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
        parentId: null,
      };

      const updatedCategory = {
        ...existingCategory,
        parentId: testId('cat1'),
        updatedAt: new Date(),
      };

      // Need to mock all findFirst calls
      mockPrisma.itemCategory.findFirst
        .mockResolvedValueOnce(existingCategory) // Check category exists  
        .mockResolvedValueOnce(null) // Check no duplicate name
        .mockResolvedValueOnce(parentCategory); // Check parent exists
      mockPrisma.itemCategory.update.mockResolvedValue(updatedCategory);

      const result = await caller.categories.update({
        id: testId('cat2'),
        parentId: testId('cat1'),
      });

      expect(result.parentId).toBe(testId('cat1'));
    });

    it('should prevent circular parent reference', async () => {
      const existingCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
        parentId: null,
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(existingCategory);

      await expect(
        caller.categories.update({
          id: testId('cat1'),
          parentId: testId('cat1'), // Self-reference
        })
      ).rejects.toThrow('Category cannot be its own parent');
    });

    it('should throw NOT_FOUND when category does not exist', async () => {
      mockPrisma.itemCategory.findFirst.mockResolvedValueOnce(null); // Category not found

      await expect(
        caller.categories.update({
          id: testId('nonexistent'),
          name: 'New Name',
        })
      ).rejects.toThrow('Category not found');
    });

    it('should require MANAGER or ADMIN role', async () => {
      const employeeCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'EMPLOYEE' },
      });

      await expect(
        employeeCaller.categories.update({
          id: testId('cat1'),
          name: 'New Name',
        })
      ).rejects.toThrow('Insufficient permissions to update categories');
    });
  });

  describe('delete', () => {
    it('should delete category without children or items', async () => {
      const existingCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
        _count: {
          items: 0,
          children: 0,
        },
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(existingCategory);
      mockPrisma.itemCategory.delete.mockResolvedValue(existingCategory);

      const result = await caller.categories.delete({
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
          items: 0,
          children: 2, // Has children
        },
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(existingCategory);

      await expect(
        caller.categories.delete({ id: testId('cat1') })
      ).rejects.toThrow('Cannot delete category with subcategories');
    });

    it('should prevent deleting category with items', async () => {
      const existingCategory = {
        id: testId('cat1'),
        name: 'Electronics',
        organizationId: testId('org'),
        _count: {
          items: 5, // Has items
          children: 0,
        },
      };

      mockPrisma.itemCategory.findFirst.mockResolvedValue(existingCategory);

      await expect(
        caller.categories.delete({ id: testId('cat1') })
      ).rejects.toThrow('Cannot delete category with items');
    });

    it('should throw NOT_FOUND when category does not exist', async () => {
      mockPrisma.itemCategory.findFirst.mockResolvedValue(null);

      await expect(
        caller.categories.delete({ id: testId('nonexistent') })
      ).rejects.toThrow('Category not found');
    });

    it('should require ADMIN role', async () => {
      const managerCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'MANAGER' },
      });

      await expect(
        managerCaller.categories.delete({ id: testId('cat1') })
      ).rejects.toThrow('Only administrators can delete categories');
    });
  });

  describe('tree', () => {
    it('should get category tree structure', async () => {
      const mockCategories = [
        {
          id: testId('cat1'),
          name: 'Electronics',
          parentId: null,
          organizationId: testId('org'),
          _count: { items: 5 },
        },
        {
          id: testId('cat2'),
          name: 'Laptops',
          parentId: testId('cat1'),
          organizationId: testId('org'),
          _count: { items: 3 },
        },
        {
          id: testId('cat3'),
          name: 'Phones',
          parentId: testId('cat1'),
          organizationId: testId('org'),
          _count: { items: 2 },
        },
        {
          id: testId('cat4'),
          name: 'Furniture',
          parentId: null,
          organizationId: testId('org'),
          _count: { items: 10 },
        },
      ];

      mockPrisma.itemCategory.findMany.mockResolvedValue(mockCategories);

      const result = await caller.categories.tree();

      expect(result).toHaveLength(2); // 2 root categories
      expect(result[0].name).toBe('Electronics');
      expect(result[0].children).toHaveLength(2);
      expect(result[1].name).toBe('Furniture');
      expect(result[1].children).toHaveLength(0);
    });

  });
});
