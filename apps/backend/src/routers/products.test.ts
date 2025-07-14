import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser, mockItem, createMockItem } from '../test-utils/test-data.js';

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  
  return { prisma: mockPrisma };
});

// Access the mocked prisma for tests
const mockPrisma = {
  item: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

describe('Products Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    caller = await createDirectCaller({ 
      user: mockAuthenticatedUser,
      prisma: mockPrisma as any 
    });
  });

  describe('list', () => {
    it('should return products list', async () => {
      const products = [mockItem, createMockItem({ name: 'Product 2' })];
      mockPrisma.item.findMany.mockResolvedValue(products);

      const result = await caller.products.list({});

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual(mockItem);
      expect(mockPrisma.item.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockAuthenticatedUser.organizationId },
        take: 51, // limit + 1 for pagination
        cursor: undefined,
        include: {
          category: true,
          unitOfMeasure: true,
          defaultSupplier: true,
          inventory: {
            select: {
              qtyOnHand: true,
              qtyReserved: true,
              locationId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter products by search term', async () => {
      const searchTerm = 'test';
      mockPrisma.item.findMany.mockResolvedValue([mockItem]);

      await caller.products.list({ search: searchTerm });

      expect(mockPrisma.item.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockAuthenticatedUser.organizationId,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { sku: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 51,
        cursor: undefined,
        include: {
          category: true,
          unitOfMeasure: true,
          defaultSupplier: true,
          inventory: {
            select: {
              qtyOnHand: true,
              qtyReserved: true,
              locationId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getById', () => {
    it('should return product by id', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(mockItem);

      const result = await caller.products.getById({ id: mockItem.id });

      expect(result).toEqual(mockItem);
      expect(mockPrisma.item.findFirst).toHaveBeenCalledWith({
        where: { 
          id: mockItem.id,
          organizationId: mockAuthenticatedUser.organizationId,
        },
        include: {
          category: true,
          unitOfMeasure: true,
          defaultSupplier: true,
          inventory: {
            include: {
              location: true,
            },
          },
          images: true,
          priceHistory: {
            orderBy: { startDate: 'desc' },
            take: 10,
          },
        },
      });
    });

    it('should throw error for non-existent product', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(null);

      await expect(
        caller.products.getById({ id: 'non-existent-id' })
      ).rejects.toThrow('Item not found');
    });
  });

  describe('create', () => {
    it('should create new product', async () => {
      const newProductData = {
        name: 'New Product',
        sku: 'NEW-001',
        defaultPrice: 29.99,
        categoryId: 'category-id',
        uomId: 'test-uom-id',
      };

      mockPrisma.item.findFirst.mockResolvedValue(null); // No existing SKU
      mockPrisma.item.create.mockResolvedValue({
        ...mockItem,
        ...newProductData,
      });

      const result = await caller.products.create(newProductData);

      expect(result.name).toBe(newProductData.name);
      expect(mockPrisma.item.create).toHaveBeenCalledWith({
        data: {
          organizationId: mockAuthenticatedUser.organizationId,
          name: newProductData.name,
          description: undefined,
          sku: newProductData.sku,
          defaultPrice: newProductData.defaultPrice,
          defaultCost: undefined,
          categoryId: newProductData.categoryId,
          uomId: newProductData.uomId,
          defaultSupplierId: undefined,
          reorderPoint: 0,
          reorderQty: 0,
          isActive: true,
        },
        include: {
          category: true,
          unitOfMeasure: true,
        },
      });
    });

    it('should throw error for duplicate SKU', async () => {
      const existingProduct = createMockItem({ sku: 'EXISTING-SKU' });
      mockPrisma.item.findFirst.mockResolvedValue(existingProduct);

      await expect(
        caller.products.create({
          name: 'New Product',
          sku: 'EXISTING-SKU',
          defaultPrice: 29.99,
          categoryId: 'category-id',
          uomId: 'test-uom-id',
        })
      ).rejects.toThrow('Item with this SKU already exists');
    });
  });

  describe('update', () => {
    it('should update existing product', async () => {
      const updateData = { name: 'Updated Product', defaultPrice: 39.99 };
      
      mockPrisma.item.findFirst.mockResolvedValue(mockItem);
      mockPrisma.item.update.mockResolvedValue({
        ...mockItem,
        ...updateData,
      });

      const result = await caller.products.update({
        id: mockItem.id,
        data: updateData,
      });

      expect(result.name).toBe(updateData.name);
      expect(mockPrisma.item.update).toHaveBeenCalledWith({
        where: { id: mockItem.id },
        data: {
          name: updateData.name,
          description: undefined,
          sku: undefined,
          defaultPrice: updateData.defaultPrice,
          defaultCost: undefined,
          categoryId: undefined,
          uomId: undefined,
          defaultSupplierId: undefined,
          reorderPoint: undefined,
          reorderQty: undefined,
          isActive: undefined,
        },
        include: {
          category: true,
          unitOfMeasure: true,
        },
      });
    });

    it('should throw error for non-existent product', async () => {
      mockPrisma.item.findFirst.mockResolvedValue(null);

      await expect(
        caller.products.update({
          id: 'non-existent-id',
          data: { name: 'Updated' },
        })
      ).rejects.toThrow('Item not found');
    });
  });

  describe('delete', () => {
    it('should soft delete product', async () => {
      const deletedProduct = { ...mockItem, isActive: false };
      mockPrisma.item.update.mockResolvedValue(deletedProduct);

      const result = await caller.products.delete({ id: mockItem.id });

      expect(result.success).toBe(true);
      expect(result.id).toBe(mockItem.id);
      expect(mockPrisma.item.update).toHaveBeenCalledWith({
        where: { id: mockItem.id },
        data: {
          isActive: false,
        },
      });
    });
  });

  describe('unauthorized access', () => {
    it('should throw error when not authenticated', async () => {
      const unauthenticatedCaller = await createDirectCaller({ 
        user: null,
        prisma: mockPrisma as any 
      });

      await expect(
        unauthenticatedCaller.products.list({})
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });
});