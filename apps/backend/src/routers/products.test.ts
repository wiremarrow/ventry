import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser, mockProduct, createMockProduct } from '../test-utils/test-data.js';

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  
  return { prisma: mockPrisma };
});

// Access the mocked prisma for tests
const mockPrisma = {
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
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
      const products = [mockProduct, createMockProduct({ name: 'Product 2' })];
      mockPrisma.product.findMany.mockResolvedValue(products);

      const result = await caller.products.list({});

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual(mockProduct);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        take: 51, // limit + 1 for pagination
        cursor: undefined,
        include: {
          category: true,
          inventoryItems: {
            select: {
              quantity: true,
              locationId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter products by search term', async () => {
      const searchTerm = 'test';
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);

      await caller.products.list({ search: searchTerm });

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { sku: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 51,
        cursor: undefined,
        include: {
          category: true,
          inventoryItems: {
            select: {
              quantity: true,
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
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await caller.products.getById({ id: mockProduct.id });

      expect(result).toEqual(mockProduct);
      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: mockProduct.id },
        include: {
          category: true,
          inventoryItems: {
            include: {
              location: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    it('should throw error for non-existent product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        caller.products.getById({ id: 'non-existent-id' })
      ).rejects.toThrow('Product not found');
    });
  });

  describe('create', () => {
    it('should create new product', async () => {
      const newProductData = {
        name: 'New Product',
        sku: 'NEW-001',
        unitPrice: 29.99,
        categoryId: 'category-id',
      };

      mockPrisma.product.findUnique.mockResolvedValue(null); // No existing SKU
      mockPrisma.product.create.mockResolvedValue({
        ...mockProduct,
        ...newProductData,
      });

      const result = await caller.products.create(newProductData);

      expect(result.name).toBe(newProductData.name);
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          name: newProductData.name,
          sku: newProductData.sku,
          unitPrice: newProductData.unitPrice,
          categoryId: newProductData.categoryId,
          isActive: true, // Default from schema
          createdById: mockUser.id,
          updatedById: mockUser.id,
        },
        include: {
          category: true,
        },
      });
    });

    it('should throw error for duplicate SKU', async () => {
      const existingProduct = createMockProduct({ sku: 'EXISTING-SKU' });
      mockPrisma.product.findUnique.mockResolvedValue(existingProduct);

      await expect(
        caller.products.create({
          name: 'New Product',
          sku: 'EXISTING-SKU',
          unitPrice: 29.99,
          categoryId: 'category-id',
        })
      ).rejects.toThrow('Product with this SKU already exists');
    });
  });

  describe('update', () => {
    it('should update existing product', async () => {
      const updateData = { name: 'Updated Product', unitPrice: 39.99 };
      
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.product.update.mockResolvedValue({
        ...mockProduct,
        ...updateData,
      });

      const result = await caller.products.update({
        id: mockProduct.id,
        data: updateData,
      });

      expect(result.name).toBe(updateData.name);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: mockProduct.id },
        data: {
          ...updateData,
          updatedById: mockUser.id,
        },
        include: {
          category: true,
        },
      });
    });

    it('should throw error for non-existent product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        caller.products.update({
          id: 'non-existent-id',
          data: { name: 'Updated' },
        })
      ).rejects.toThrow('Product not found');
    });
  });

  describe('delete', () => {
    it('should soft delete product', async () => {
      const deletedProduct = { ...mockProduct, isActive: false };
      mockPrisma.product.update.mockResolvedValue(deletedProduct);

      const result = await caller.products.delete({ id: mockProduct.id });

      expect(result.success).toBe(true);
      expect(result.id).toBe(mockProduct.id);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: mockProduct.id },
        data: {
          isActive: false,
          updatedById: mockUser.id,
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