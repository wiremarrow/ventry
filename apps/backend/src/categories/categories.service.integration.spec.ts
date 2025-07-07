import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { CategoriesService } from './categories.service';
import { DatabaseService } from '../database/database.service';
import { 
  createTestUser, 
  createTestCategory, 
  createTestProduct,
  cleanTestData 
} from '../test-helpers/factories';

describe('CategoriesService Integration', () => {
  let service: CategoriesService;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [CategoriesService, DatabaseService],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterAll(async () => {
    // Clean up any remaining test data
    await cleanTestData(databaseService);
    await databaseService.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test for isolation
    await cleanTestData(databaseService);
  });

  describe('CRUD Operations', () => {
    it('should create and find category', async () => {
      const categoryData = {
        name: 'Electronics',
        description: 'Electronic devices and components',
        isActive: true,
      };

      const createdCategory = await service.create(categoryData);

      expect(createdCategory).toBeDefined();
      expect(createdCategory.name).toBe(categoryData.name);
      expect(createdCategory.description).toBe(categoryData.description);
      expect(createdCategory.isActive).toBe(true);

      const foundCategory = await service.findById(createdCategory.id);
      expect(foundCategory).toBeDefined();
      expect(foundCategory!.id).toBe(createdCategory.id);
    });

    it('should list all categories', async () => {
      // Create test categories using factory
      const testCategory1 = await createTestCategory(databaseService, {
        name: 'Test Books Category',
        description: 'Books and literature',
        isActive: true,
      });
      const testCategory2 = await createTestCategory(databaseService, {
        name: 'Test Clothing Category',
        description: 'Apparel and accessories',
        isActive: true,
      });
      const testCategory3 = await createTestCategory(databaseService, {
        name: 'Test Sports Category',
        description: 'Sports equipment',
        isActive: false,
      });

      const allCategories = await service.findAll();
      expect(allCategories).toHaveLength(3);

      // Verify our test categories are in the results
      const categoryIds = allCategories.map(cat => cat.id);
      expect(categoryIds).toContain(testCategory1.id);
      expect(categoryIds).toContain(testCategory2.id);
      expect(categoryIds).toContain(testCategory3.id);
    });

    it('should update category', async () => {
      const categoryData = {
        name: 'Technology',
        description: 'Tech products',
        isActive: true,
      };

      const createdCategory = await service.create(categoryData);

      const updateData = {
        name: 'Updated Technology',
        description: 'Updated tech products description',
        isActive: false,
      };

      const updatedCategory = await service.update(createdCategory.id, updateData);

      expect(updatedCategory.name).toBe(updateData.name);
      expect(updatedCategory.description).toBe(updateData.description);
      expect(updatedCategory.isActive).toBe(false);
    });

    it('should remove category when no products exist', async () => {
      // Create test category using factory
      const testCategory = await createTestCategory(databaseService, {
        name: 'Empty Category to Remove',
        description: 'Category with no products',
        isActive: true,
      });

      await service.remove(testCategory.id);

      // Category should be deleted
      await expect(service.findById(testCategory.id))
        .rejects.toThrow('Category not found');
    });

    it('should prevent deletion of category with products', async () => {
      // Create test data using factories
      const testUser = await createTestUser(databaseService);
      const testCategory = await createTestCategory(databaseService, {
        name: 'Category with Products',
        description: 'This category has products',
        isActive: true,
      });

      // Create a product in this category using factory
      await createTestProduct(databaseService, {
        categoryId: testCategory.id,
        createdById: testUser.id,
      }, {
        name: 'Test Product',
        description: 'A test product',
        unitPrice: 10.99,
      });

      // Should throw error when trying to delete category with products
      await expect(service.remove(testCategory.id))
        .rejects.toThrow('Cannot delete category with existing products');
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundException for non-existent category', async () => {
      await expect(service.findById('non-existent-id'))
        .rejects.toThrow('Category not found');
    });

    it('should throw NotFoundException for updating non-existent category', async () => {
      await expect(
        service.update('non-existent-id', {
          name: 'Test',
          description: 'Test',
          isActive: true,
        })
      ).rejects.toThrow('Category not found');
    });

    it('should handle duplicate category names', async () => {
      const categoryData = {
        name: 'Duplicate Category',
        description: 'First category',
        isActive: true,
      };

      await service.create(categoryData);

      // Try to create another category with the same name
      await expect(
        service.create({
          name: 'Duplicate Category',
          description: 'Second category',
          isActive: true,
        })
      ).rejects.toThrow('Category name already exists');
    });
  });

  describe('Database Relationships', () => {
    it('should include product count in category listing', async () => {
      // Create test data using factories
      const testUser = await createTestUser(databaseService);
      const testCategory = await createTestCategory(databaseService);

      // Create some products using the factory
      for (let i = 1; i <= 3; i++) {
        await createTestProduct(databaseService, {
          categoryId: testCategory.id,
          createdById: testUser.id,
        }, {
          name: `Test Product ${i}`,
          unitPrice: 10.00 * i,
        });
      }

      const categories = await service.findAll();
      const categoryWithCount = categories.find(cat => cat.id === testCategory.id);

      expect(categoryWithCount).toBeDefined();
      expect((categoryWithCount as any)._count?.products).toBe(3);
    });
  });
});