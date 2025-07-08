import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { NotFoundException, ConflictException } from '@nestjs/common';

const mockProductsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySku: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ProductsController>(ProductsController);
    productsService = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      const createProductDto = {
        name: 'Test Product',
        sku: 'TEST-001',
        description: 'A test product',
        categoryId: 'cat1',
        unitPrice: 19.99,
        cost: 10.00,
        isActive: true,
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      const mockCreatedProduct = {
        id: '1',
        ...createProductDto,
        createdById: 'user1',
        updatedById: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'cat1',
          name: 'Test Category',
        },
        createdBy: {
          id: 'user1',
          firstName: 'Test',
          lastName: 'User',
        },
        updatedBy: {
          id: 'user1',
          firstName: 'Test',
          lastName: 'User',
        },
      };

      mockProductsService.create.mockResolvedValue(mockCreatedProduct);

      const result = await controller.create(createProductDto, mockRequest);

      expect(result).toEqual(mockCreatedProduct);
      expect(mockProductsService.create).toHaveBeenCalledWith(createProductDto, 'user1');
      expect(mockProductsService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle ConflictException when SKU already exists', async () => {
      const createProductDto = {
        name: 'Test Product',
        sku: 'EXISTING-SKU',
        description: 'A test product',
        categoryId: 'cat1',
        unitPrice: 19.99,
        cost: 10.00,
        isActive: true,
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      mockProductsService.create.mockRejectedValue(new ConflictException('Product SKU already exists'));

      await expect(controller.create(createProductDto, mockRequest)).rejects.toThrow(ConflictException);
      expect(mockProductsService.create).toHaveBeenCalledWith(createProductDto, 'user1');
    });
  });

  describe('findAll', () => {
    it('should return all products', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Product 1',
          sku: 'PROD-001',
          description: 'First product',
          categoryId: 'cat1',
          unitPrice: 19.99,
          cost: 10.00,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: 'cat1',
            name: 'Category 1',
          },
          _count: { inventoryItems: 5 },
        },
        {
          id: '2',
          name: 'Product 2',
          sku: 'PROD-002',
          description: 'Second product',
          categoryId: 'cat2',
          unitPrice: 29.99,
          cost: 15.00,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: 'cat2',
            name: 'Category 2',
          },
          _count: { inventoryItems: 3 },
        },
      ];

      mockProductsService.findAll.mockResolvedValue(mockProducts);

      const result = await controller.findAll({});

      expect(result).toEqual(mockProducts);
      expect(mockProductsService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no products exist', async () => {
      mockProductsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll({});

      expect(result).toEqual([]);
      expect(mockProductsService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a product by ID', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        sku: 'TEST-001',
        description: 'A test product',
        categoryId: 'cat1',
        unitPrice: 19.99,
        cost: 10.00,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'cat1',
          name: 'Test Category',
        },
        _count: { inventoryItems: 2 },
      };

      mockProductsService.findById.mockResolvedValue(mockProduct);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.findById).toHaveBeenCalledWith('1');
      expect(mockProductsService.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when product not found', async () => {
      mockProductsService.findById.mockRejectedValue(new NotFoundException('Product not found'));

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockProductsService.findById).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('findBySku', () => {
    it('should return a product by SKU', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        sku: 'TEST-001',
        description: 'A test product',
        categoryId: 'cat1',
        unitPrice: 19.99,
        cost: 10.00,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'cat1',
          name: 'Test Category',
        },
        _count: { inventoryItems: 2 },
      };

      mockProductsService.findBySku.mockResolvedValue(mockProduct);

      const result = await controller.findBySku('TEST-001');

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.findBySku).toHaveBeenCalledWith('TEST-001');
      expect(mockProductsService.findBySku).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when product not found by SKU', async () => {
      mockProductsService.findBySku.mockRejectedValue(new NotFoundException('Product not found'));

      await expect(controller.findBySku('NON-EXISTENT')).rejects.toThrow(NotFoundException);
      expect(mockProductsService.findBySku).toHaveBeenCalledWith('NON-EXISTENT');
    });
  });

  describe('update', () => {
    it('should update a product successfully', async () => {
      const updateDto = {
        name: 'Updated Product',
        description: 'Updated description',
        unitPrice: 29.99,
        sku: 'UPD-001',
        categoryId: 'cat1',
        isActive: true,
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      const mockUpdatedProduct = {
        id: '1',
        name: 'Updated Product',
        sku: 'UPD-001',
        description: 'Updated description',
        categoryId: 'cat1',
        unitPrice: 29.99,
        cost: 10.00,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'user1',
        updatedById: 'user1',
        category: {
          id: 'cat1',
          name: 'Test Category',
        },
      };

      mockProductsService.update.mockResolvedValue(mockUpdatedProduct);

      const result = await controller.update('1', updateDto, mockRequest);

      expect(result).toEqual(mockUpdatedProduct);
      expect(mockProductsService.update).toHaveBeenCalledWith('1', updateDto, 'user1');
      expect(mockProductsService.update).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const updateDto = {
        name: 'Test Product',
        sku: 'TEST-001',
        categoryId: 'cat1',
        unitPrice: 39.99,
        isActive: true,
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      const mockUpdatedProduct = {
        id: '1',
        name: 'Test Product',
        sku: 'TEST-001',
        description: 'A test product',
        categoryId: 'cat1',
        unitPrice: 39.99,
        cost: 10.00,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'user1',
        updatedById: 'user1',
      };

      mockProductsService.update.mockResolvedValue(mockUpdatedProduct);

      const result = await controller.update('1', updateDto, mockRequest);

      expect(result).toEqual(mockUpdatedProduct);
      expect(result.unitPrice).toBe(39.99);
    });

    it('should throw NotFoundException when updating non-existent product', async () => {
      const updateDto = {
        name: 'Updated Product',
        sku: 'TEST-001',
        categoryId: 'cat1',
        unitPrice: 19.99,
        isActive: true,
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      mockProductsService.update.mockRejectedValue(new NotFoundException('Product not found'));

      await expect(controller.update('non-existent', updateDto, mockRequest)).rejects.toThrow(NotFoundException);
      expect(mockProductsService.update).toHaveBeenCalledWith('non-existent', updateDto, 'user1');
    });
  });

  describe('remove', () => {
    it('should remove a product successfully', async () => {
      const mockRemovedProduct = {
        id: '1',
        name: 'Test Product',
        sku: 'TEST-001',
        description: 'A test product',
        categoryId: 'cat1',
        unitPrice: 19.99,
        cost: 10.00,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'user1',
        updatedById: 'user1',
      };

      mockProductsService.remove.mockResolvedValue(mockRemovedProduct);

      const result = await controller.remove('1');

      expect(result).toEqual(mockRemovedProduct);
      expect(mockProductsService.remove).toHaveBeenCalledWith('1');
      expect(mockProductsService.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when removing non-existent product', async () => {
      mockProductsService.remove.mockRejectedValue(new NotFoundException('Product not found'));

      await expect(controller.remove('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockProductsService.remove).toHaveBeenCalledWith('non-existent');
    });

    it('should handle ConflictException when product has inventory', async () => {
      mockProductsService.remove.mockRejectedValue(new ConflictException('Cannot delete product with existing inventory'));

      await expect(controller.remove('1')).rejects.toThrow(ConflictException);
      expect(mockProductsService.remove).toHaveBeenCalledWith('1');
    });
  });

  describe('edge cases and additional branches', () => {
    it('should handle findAll with isActive filter set to true', async () => {
      const queryParams = {
        isActive: 'true',
      };

      const mockProducts = [
        {
          id: '1',
          name: 'Active Product',
          sku: 'ACT-001',
          description: 'An active product',
          categoryId: 'cat1',
          unitPrice: 19.99,
          cost: 10.00,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: {
            id: 'cat1',
            name: 'Category 1',
          },
          _count: { inventoryItems: 1 },
        },
      ];

      mockProductsService.findAll.mockResolvedValue(mockProducts);

      const result = await controller.findAll(queryParams);

      expect(result).toEqual(mockProducts);
      expect(mockProductsService.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
        }),
      }));
    });

    it('should handle findAll with category filter', async () => {
      const queryParams = {
        categoryId: 'cat1',
      };

      const mockProducts = [
        {
          id: '1',
          name: 'Category Product',
          sku: 'CAT-001',
          categoryId: 'cat1',
          unitPrice: 19.99,
          isActive: true,
        },
      ];

      mockProductsService.findAll.mockResolvedValue(mockProducts);

      const result = await controller.findAll(queryParams);

      expect(result).toEqual(mockProducts);
      expect(mockProductsService.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          categoryId: 'cat1',
        }),
      }));
    });

    it('should handle findAll with search term', async () => {
      const queryParams = {
        search: 'test product',
      };

      const mockProducts = [
        {
          id: '1',
          name: 'Test Product',
          sku: 'TEST-001',
          description: 'A test product',
          categoryId: 'cat1',
          unitPrice: 19.99,
          isActive: true,
        },
      ];

      mockProductsService.findAll.mockResolvedValue(mockProducts);

      const result = await controller.findAll(queryParams);

      expect(result).toEqual(mockProducts);
      expect(mockProductsService.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: 'test product', mode: 'insensitive' } },
            { description: { contains: 'test product', mode: 'insensitive' } },
            { sku: { contains: 'test product', mode: 'insensitive' } },
          ]),
        }),
      }));
    });

    it('should handle findAll with isActive filter set to false', async () => {
      const queryParams = {
        isActive: 'false',
      };

      const mockProducts = [
        {
          id: '1',
          name: 'Inactive Product',
          sku: 'INACT-001',
          isActive: false,
          categoryId: 'cat1',
          unitPrice: 19.99,
        },
      ];

      mockProductsService.findAll.mockResolvedValue(mockProducts);

      const result = await controller.findAll(queryParams);

      expect(result).toEqual(mockProducts);
      expect(mockProductsService.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          isActive: false,
        }),
      }));
    });

    it('should handle findAll with pagination', async () => {
      const queryParams = {
        page: '2',
        limit: '5',
      };

      const mockProducts = [
        {
          id: '6',
          name: 'Page 2 Product',
          sku: 'P2-001',
          categoryId: 'cat1',
          unitPrice: 19.99,
          isActive: true,
        },
      ];

      mockProductsService.findAll.mockResolvedValue(mockProducts);

      const result = await controller.findAll(queryParams);

      expect(result).toEqual(mockProducts);
      expect(mockProductsService.findAll).toHaveBeenCalledWith(expect.objectContaining({
        skip: 5, // (page - 1) * limit = (2 - 1) * 5 = 5
        take: 5,
      }));
    });
  });

  describe('controller metadata', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have correct service dependency', () => {
      expect(productsService).toBeDefined();
    });
  });
});