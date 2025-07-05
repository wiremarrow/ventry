import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { DatabaseService } from '../database/database.service';

const mockDatabaseService = {
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  inventoryItem: {
    count: jest.fn(),
  },
};

describe('ProductsService', () => {
  let service: ProductsService;
  let _databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    _databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all products', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Product 1',
          sku: 'SKU001',
          description: 'Product 1 description',
          categoryId: 'cat1',
          unitPrice: 10.99,
          cost: 5.00,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdById: 'user1',
          updatedById: 'user1',
        },
        {
          id: '2',
          name: 'Product 2',
          sku: 'SKU002',
          description: 'Product 2 description',
          categoryId: 'cat2',
          unitPrice: 25.99,
          cost: 12.50,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdById: 'user1',
          updatedById: 'user1',
        },
      ];

      mockDatabaseService.product.findMany.mockResolvedValue(mockProducts);

      const result = await service.findAll();

      expect(result).toEqual(mockProducts);
      expect(mockDatabaseService.product.findMany).toHaveBeenCalledWith({
        skip: undefined,
        take: undefined,
        cursor: undefined,
        where: undefined,
        orderBy: undefined,
        include: {
          category: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              inventoryItems: true,
            },
          },
        },
      });
    });
  });

  describe('findById', () => {
    it('should return a product when found', async () => {
      const mockProduct = {
        id: '1',
        name: 'Product 1',
        sku: 'SKU001',
        description: 'Product 1 description',
        categoryId: 'cat1',
        unitPrice: 10.99,
        cost: 5.00,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'user1',
        updatedById: 'user1',
      };

      mockDatabaseService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findById('1');

      expect(result).toEqual(mockProduct);
      expect(mockDatabaseService.product.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          category: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              inventoryItems: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when product not found', async () => {
      mockDatabaseService.product.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySku', () => {
    it('should return a product when found by SKU', async () => {
      const mockProduct = {
        id: '1',
        name: 'Product 1',
        sku: 'SKU001',
        description: 'Product 1 description',
        categoryId: 'cat1',
        unitPrice: 10.99,
        cost: 5.00,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'user1',
        updatedById: 'user1',
      };

      mockDatabaseService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findBySku('SKU001');

      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException when product not found by SKU', async () => {
      mockDatabaseService.product.findUnique.mockResolvedValue(null);

      await expect(service.findBySku('NON-EXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      const createProductDto = {
        name: 'New Product',
        sku: 'NEW001',
        description: 'New product description',
        categoryId: 'cat1',
        unitPrice: 19.99,
        cost: 10.00,
        isActive: true,
      };

      const mockCreatedProduct = {
        id: '1',
        ...createProductDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabaseService.product.create.mockResolvedValue(mockCreatedProduct);

      const result = await service.create(createProductDto, 'user1');

      expect(result).toEqual(mockCreatedProduct);
      expect(mockDatabaseService.product.create).toHaveBeenCalledWith({
        data: {
          ...createProductDto,
          createdById: 'user1',
          updatedById: 'user1',
        },
        include: {
          category: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    it('should throw ConflictException when SKU already exists', async () => {
      const createProductDto = {
        name: 'New Product',
        sku: 'EXISTING001',
        description: 'New product description',
        categoryId: 'cat1',
        unitPrice: 19.99,
        cost: 10.00,
        isActive: true,
      };

      mockDatabaseService.product.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['sku'] },
      });

      await expect(service.create(createProductDto, 'user1')).rejects.toThrow(ConflictException);
    });

    it('should throw original error for database errors other than P2002', async () => {
      const createProductDto = {
        name: 'New Product',
        sku: 'NEW001',
        description: 'New product description',
        categoryId: 'cat1',
        unitPrice: 19.99,
        cost: 10.00,
        isActive: true,
      };

      const databaseError = new Error('Database connection failed');
      mockDatabaseService.product.create.mockRejectedValue(databaseError);

      await expect(service.create(createProductDto, 'user1')).rejects.toThrow(databaseError);
    });
  });

  describe('update', () => {
    it('should update a product successfully', async () => {
      const updateProductDto = {
        name: 'Updated Product',
        sku: 'SKU001',
        description: 'Updated description',
        categoryId: 'cat1',
        unitPrice: 29.99,
        isActive: true,
      };

      const mockUpdatedProduct = {
        id: '1',
        name: 'Updated Product',
        sku: 'SKU001',
        description: 'Updated description',
        categoryId: 'cat1',
        unitPrice: 29.99,
        cost: 5.00,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'user1',
        updatedById: 'user1',
      };

      mockDatabaseService.product.update.mockResolvedValue(mockUpdatedProduct);

      // Mock findById to return a product first
      mockDatabaseService.product.findUnique.mockResolvedValue({
        id: '1',
        name: 'Original Product',
        sku: 'SKU001',
      });

      const result = await service.update('1', updateProductDto, 'user1');

      expect(result).toEqual(mockUpdatedProduct);
      expect(mockDatabaseService.product.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          ...updateProductDto,
          updatedById: 'user1',
        },
        include: {
          category: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when product not found', async () => {
      const updateProductDto = {
        name: 'Updated Product',
        sku: 'SKU001',
        categoryId: 'cat1',
        unitPrice: 19.99,
        isActive: true,
      };

      mockDatabaseService.product.update.mockRejectedValue({
        code: 'P2025',
      });

      // Mock findById to return null
      mockDatabaseService.product.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateProductDto, 'user1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate SKU on update', async () => {
      const updateProductDto = {
        name: 'Updated Product',
        sku: 'EXISTING-SKU',
        categoryId: 'cat1',
        unitPrice: 19.99,
        isActive: true,
      };

      // Mock findById to return a product first
      mockDatabaseService.product.findUnique.mockResolvedValue({
        id: '1',
        name: 'Original Product',
        sku: 'SKU001',
      });

      mockDatabaseService.product.update.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['sku'] },
      });

      await expect(service.update('1', updateProductDto, 'user1')).rejects.toThrow(ConflictException);
    });

    it('should throw original error for database errors other than P2002 on update', async () => {
      const updateProductDto = {
        name: 'Updated Product',
        sku: 'SKU001',
        categoryId: 'cat1',
        unitPrice: 19.99,
        isActive: true,
      };

      // Mock findById to return a product first
      mockDatabaseService.product.findUnique.mockResolvedValue({
        id: '1',
        name: 'Original Product',
        sku: 'SKU001',
      });

      const databaseError = new Error('Database connection failed');
      mockDatabaseService.product.update.mockRejectedValue(databaseError);

      await expect(service.update('1', updateProductDto, 'user1')).rejects.toThrow(databaseError);
    });
  });

  describe('remove', () => {
    it('should hard delete a product successfully when no inventory exists', async () => {
      const mockProduct = {
        id: '1',
        name: 'Product 1',
        sku: 'SKU001',
        description: 'Product 1 description',
        categoryId: 'cat1',
        unitPrice: 10.99,
        cost: 5.00,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'user1',
        updatedById: 'user1',
      };

      // Mock findById to return the product
      mockDatabaseService.product.findUnique.mockResolvedValue(mockProduct);
      // Mock inventory count to return 0
      mockDatabaseService.inventoryItem.count.mockResolvedValue(0);
      // Mock delete to return the deleted product
      mockDatabaseService.product.delete.mockResolvedValue(mockProduct);

      const result = await service.remove('1');

      expect(result).toEqual(mockProduct);
      expect(mockDatabaseService.inventoryItem.count).toHaveBeenCalledWith({
        where: { productId: '1' },
      });
      expect(mockDatabaseService.product.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw ConflictException when product has inventory', async () => {
      const mockProduct = {
        id: '1',
        name: 'Product 1',
        sku: 'SKU001',
      };

      // Mock findById to return the product
      mockDatabaseService.product.findUnique.mockResolvedValue(mockProduct);
      // Mock inventory count to return > 0
      mockDatabaseService.inventoryItem.count.mockResolvedValue(5);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
      expect(mockDatabaseService.inventoryItem.count).toHaveBeenCalledWith({
        where: { productId: '1' },
      });
    });

    it('should throw NotFoundException when product not found', async () => {
      mockDatabaseService.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});