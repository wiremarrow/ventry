import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { CategoriesService } from './categories.service';
import { DatabaseService } from '../database/database.service';
import { PrismaClient } from '@ventry/database';

describe('CategoriesService Integration', () => {
  let service: CategoriesService;
  let databaseService: DatabaseService;
  let prisma: PrismaClient;

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
    prisma = databaseService as any;

    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await databaseService.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  async function cleanDatabase() {
    try {
      // Clean up in reverse order of dependencies
      // Use deleteMany with error handling for tables that might not exist
      await prisma.auditLog.deleteMany().catch(() => {});
      await prisma.inventoryMovement.deleteMany().catch(() => {});
      await prisma.inventoryItem.deleteMany().catch(() => {});
      await prisma.product.deleteMany().catch(() => {});
      await prisma.category.deleteMany().catch(() => {});
      await prisma.location.deleteMany().catch(() => {});
      await prisma.user.deleteMany().catch(() => {});
    } catch (error) {
      // Ignore cleanup errors - tables might not exist yet
      console.warn('Database cleanup warning:', error.message);
    }
  }

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
      const categories = [
        { name: 'Books', description: 'Books and literature', isActive: true },
        { name: 'Clothing', description: 'Apparel and accessories', isActive: true },
        { name: 'Sports', description: 'Sports equipment', isActive: false },
      ];

      for (const categoryData of categories) {
        await service.create(categoryData);
      }

      const allCategories = await service.findAll();
      expect(allCategories).toHaveLength(3);

      const categoryNames = allCategories.map(cat => cat.name).sort();
      expect(categoryNames).toEqual(['Books', 'Clothing', 'Sports']);
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
      const categoryData = {
        name: 'Empty Category',
        description: 'Category with no products',
        isActive: true,
      };

      const createdCategory = await service.create(categoryData);

      await service.remove(createdCategory.id);

      // Category should be deleted
      await expect(service.findById(createdCategory.id))
        .rejects.toThrow('Category not found');
    });

    it('should prevent deletion of category with products', async () => {
      // First create a user for the product
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          password: 'password',
        },
      });

      // Create a location for the product
      const _location = await prisma.location.create({
        data: {
          name: 'Test Location',
          description: 'Test location description',
          address: '123 Test St',
          isActive: true,
        },
      });

      const categoryData = {
        name: 'Category with Products',
        description: 'This category has products',
        isActive: true,
      };

      const createdCategory = await service.create(categoryData);

      // Create a product in this category
      await prisma.product.create({
        data: {
          name: 'Test Product',
          description: 'A test product',
          sku: 'TEST-001',
          category: {
            connect: { id: createdCategory.id }
          },
          createdBy: {
            connect: { id: user.id }
          },
          updatedBy: {
            connect: { id: user.id }
          },
          unitPrice: 10.99,
          isActive: true,
        },
      });

      // Should throw error when trying to delete category with products
      await expect(service.remove(createdCategory.id))
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
      const categoryData = {
        name: 'Category with Count',
        description: 'Testing product count',
        isActive: true,
      };

      const createdCategory = await service.create(categoryData);

      // Create a user for product creation
      const productUser = await prisma.user.create({
        data: {
          email: 'productuser@test.com',
          username: 'productuser',
          firstName: 'Product',
          lastName: 'User',
          password: 'password',
        },
      });

      // Create some products
      for (let i = 1; i <= 3; i++) {
        await prisma.product.create({
          data: {
            name: `Product ${i}`,
            description: `Product ${i} description`,
            sku: `PROD-${i}`,
            category: {
              connect: { id: createdCategory.id }
            },
            createdBy: {
              connect: { id: productUser.id }
            },
            updatedBy: {
              connect: { id: productUser.id }
            },
            unitPrice: 10.00 * i,
            isActive: true,
          },
        });
      }

      const categories = await service.findAll();
      const categoryWithCount = categories.find(cat => cat.id === createdCategory.id);

      expect(categoryWithCount).toBeDefined();
      expect((categoryWithCount as any)._count?.products).toBe(3);
    });
  });
});