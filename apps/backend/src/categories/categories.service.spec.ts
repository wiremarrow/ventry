import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { DatabaseService } from '../database/database.service';

// Mock the DatabaseService properly
const mockDatabaseService = {
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  product: {
    count: jest.fn(),
  },
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let databaseService: typeof mockDatabaseService;

  const mockCategory = {
    id: '1',
    name: 'Electronics',
    description: 'Electronic items',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    databaseService = module.get(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return array of categories', async () => {
      const categories = [mockCategory];
      databaseService.category.findMany.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toEqual(categories);
      expect(databaseService.category.findMany).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return category when found', async () => {
      databaseService.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findById('1');

      expect(result).toEqual(mockCategory);
      expect(databaseService.category.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when category not found', async () => {
      databaseService.category.findUnique.mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create category successfully', async () => {
      const createData = {
        name: 'Books',
        description: 'Book items',
        isActive: true,
      };

      databaseService.category.create.mockResolvedValue({
        ...mockCategory,
        ...createData,
      });

      const result = await service.create(createData);

      expect(result).toEqual({
        ...mockCategory,
        ...createData,
      });
      expect(databaseService.category.create).toHaveBeenCalledWith({
        data: createData,
      });
    });

    it('should throw ConflictException for duplicate name', async () => {
      const createData = {
        name: 'Electronics',
        description: 'Duplicate category',
        isActive: true,
      };

      databaseService.category.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create(createData)).rejects.toThrow(ConflictException);
    });

    it('should throw original error for database errors other than P2002', async () => {
      const createData = {
        name: 'Books',
        description: 'Book items',
        isActive: true,
      };

      const databaseError = new Error('Database connection failed');
      databaseService.category.create.mockRejectedValue(databaseError);

      await expect(service.create(createData)).rejects.toThrow(databaseError);
    });
  });

  describe('update', () => {
    it('should update category successfully', async () => {
      const updateData = { name: 'Updated Electronics', description: 'Updated description', isActive: true };
      const updatedCategory = { ...mockCategory, ...updateData };

      // Mock findById to return the category
      databaseService.category.findUnique.mockResolvedValue(mockCategory);
      databaseService.category.update.mockResolvedValue(updatedCategory);

      const result = await service.update('1', updateData);

      expect(result).toEqual(updatedCategory);
      expect(databaseService.category.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
      });
    });

    it('should throw NotFoundException when category not found', async () => {
      databaseService.category.findUnique.mockResolvedValue(null);

      await expect(service.update('999', { name: 'Updated', description: 'Updated', isActive: true }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate name on update', async () => {
      const updateData = { name: 'Existing Category', description: 'Updated', isActive: true };
      
      databaseService.category.findUnique.mockResolvedValue(mockCategory);
      databaseService.category.update.mockRejectedValue({ code: 'P2002' });

      await expect(service.update('1', updateData)).rejects.toThrow(ConflictException);
    });

    it('should throw original error for database errors other than P2002 on update', async () => {
      const updateData = { name: 'Updated Category', description: 'Updated', isActive: true };
      const databaseError = new Error('Database connection failed');
      
      databaseService.category.findUnique.mockResolvedValue(mockCategory);
      databaseService.category.update.mockRejectedValue(databaseError);

      await expect(service.update('1', updateData)).rejects.toThrow(databaseError);
    });
  });

  describe('remove', () => {
    it('should remove category successfully', async () => {
      databaseService.category.findUnique.mockResolvedValue(mockCategory);
      databaseService.product.count.mockResolvedValue(0);
      databaseService.category.delete.mockResolvedValue(mockCategory);

      await service.remove('1');

      expect(databaseService.product.count).toHaveBeenCalledWith({
        where: { categoryId: '1' },
      });
      expect(databaseService.category.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw ConflictException when category has products', async () => {
      databaseService.category.findUnique.mockResolvedValue(mockCategory);
      databaseService.product.count.mockResolvedValue(5);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when category not found', async () => {
      databaseService.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });
  });
});