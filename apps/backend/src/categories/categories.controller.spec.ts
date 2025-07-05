import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotFoundException, ConflictException } from '@nestjs/common';

const mockCategoriesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let categoriesService: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<CategoriesController>(CategoriesController);
    categoriesService = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a category successfully', async () => {
      const createCategoryDto = {
        name: 'Electronics',
        description: 'Electronic devices and components',
        isActive: true,
      };

      const mockCreatedCategory = {
        id: '1',
        ...createCategoryDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCategoriesService.create.mockResolvedValue(mockCreatedCategory);

      const result = await controller.create(createCategoryDto);

      expect(result).toEqual(mockCreatedCategory);
      expect(mockCategoriesService.create).toHaveBeenCalledWith(createCategoryDto);
      expect(mockCategoriesService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle ConflictException when category name already exists', async () => {
      const createCategoryDto = {
        name: 'Existing Category',
        description: 'A category that already exists',
        isActive: true,
      };

      mockCategoriesService.create.mockRejectedValue(new ConflictException('Category name already exists'));

      await expect(controller.create(createCategoryDto)).rejects.toThrow(ConflictException);
      expect(mockCategoriesService.create).toHaveBeenCalledWith(createCategoryDto);
    });

    it('should create category with minimal data', async () => {
      const createCategoryDto = {
        name: 'Minimal Category',
        isActive: true,
      };

      const mockCreatedCategory = {
        id: '2',
        name: 'Minimal Category',
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCategoriesService.create.mockResolvedValue(mockCreatedCategory);

      const result = await controller.create(createCategoryDto);

      expect(result).toEqual(mockCreatedCategory);
      expect(result.description).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const mockCategories = [
        {
          id: '1',
          name: 'Electronics',
          description: 'Electronic devices',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { products: 5 },
        },
        {
          id: '2',
          name: 'Books',
          description: 'Books and literature',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { products: 12 },
        },
      ];

      mockCategoriesService.findAll.mockResolvedValue(mockCategories);

      const result = await controller.findAll();

      expect(result).toEqual(mockCategories);
      expect(mockCategoriesService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no categories exist', async () => {
      mockCategoriesService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(mockCategoriesService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return categories with product counts', async () => {
      const mockCategories = [
        {
          id: '1',
          name: 'Electronics',
          description: 'Electronic devices',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { products: 0 },
        },
      ];

      mockCategoriesService.findAll.mockResolvedValue(mockCategories);

      const result = await controller.findAll();

      expect(result[0]).toHaveProperty('_count');
      expect((result[0] as any)._count.products).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a category by ID', async () => {
      const mockCategory = {
        id: '1',
        name: 'Electronics',
        description: 'Electronic devices and components',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { products: 5 },
      };

      mockCategoriesService.findById.mockResolvedValue(mockCategory);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockCategory);
      expect(mockCategoriesService.findById).toHaveBeenCalledWith('1');
      expect(mockCategoriesService.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when category not found', async () => {
      mockCategoriesService.findById.mockRejectedValue(new NotFoundException('Category not found'));

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockCategoriesService.findById).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('update', () => {
    it('should update a category successfully', async () => {
      const updateDto = {
        name: 'Updated Electronics',
        description: 'Updated electronic devices description',
        isActive: false,
      };

      const mockUpdatedCategory = {
        id: '1',
        name: 'Updated Electronics',
        description: 'Updated electronic devices description',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCategoriesService.update.mockResolvedValue(mockUpdatedCategory);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(mockUpdatedCategory);
      expect(mockCategoriesService.update).toHaveBeenCalledWith('1', updateDto);
      expect(mockCategoriesService.update).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const updateDto = {
        name: 'Electronics',
        description: 'Updated description only',
        isActive: true,
      };

      const mockUpdatedCategory = {
        id: '1',
        name: 'Electronics',
        description: 'Updated description only',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCategoriesService.update.mockResolvedValue(mockUpdatedCategory);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(mockUpdatedCategory);
      expect(mockCategoriesService.update).toHaveBeenCalledWith('1', updateDto);
    });

    it('should throw NotFoundException when updating non-existent category', async () => {
      const updateDto = {
        name: 'Updated Category',
        isActive: true,
      };

      mockCategoriesService.update.mockRejectedValue(new NotFoundException('Category not found'));

      await expect(controller.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
      expect(mockCategoriesService.update).toHaveBeenCalledWith('non-existent', updateDto);
    });

    it('should handle ConflictException when updating to existing name', async () => {
      const updateDto = {
        name: 'Existing Category Name',
        isActive: true,
      };

      mockCategoriesService.update.mockRejectedValue(new ConflictException('Category name already exists'));

      await expect(controller.update('1', updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove a category successfully', async () => {
      const mockRemovedCategory = {
        id: '1',
        name: 'Electronics',
        description: 'Electronic devices',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCategoriesService.remove.mockResolvedValue(mockRemovedCategory);

      const result = await controller.remove('1');

      expect(result).toEqual(mockRemovedCategory);
      expect(mockCategoriesService.remove).toHaveBeenCalledWith('1');
      expect(mockCategoriesService.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when removing non-existent category', async () => {
      mockCategoriesService.remove.mockRejectedValue(new NotFoundException('Category not found'));

      await expect(controller.remove('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockCategoriesService.remove).toHaveBeenCalledWith('non-existent');
    });

    it('should handle ConflictException when category has products', async () => {
      mockCategoriesService.remove.mockRejectedValue(new ConflictException('Cannot delete category with existing products'));

      await expect(controller.remove('1')).rejects.toThrow(ConflictException);
      expect(mockCategoriesService.remove).toHaveBeenCalledWith('1');
    });
  });

  describe('controller metadata', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have correct service dependency', () => {
      expect(categoriesService).toBeDefined();
    });
  });
});