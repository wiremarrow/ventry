import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { PrismaClient } from '@ventry/database';

describe('UsersService Integration', () => {
  let service: UsersService;
  let databaseService: DatabaseService;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [UsersService, DatabaseService],
    }).compile();

    service = module.get<UsersService>(UsersService);
    databaseService = module.get<DatabaseService>(DatabaseService);
    prisma = databaseService as any; // Access underlying Prisma client

    // Clean up test data
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
    it('should create and find user by email', async () => {
      const userData = {
        email: 'integration@test.com',
        username: 'integrationuser',
        firstName: 'Integration',
        lastName: 'Test',
        password: 'hashedpassword123',
      };

      const createdUser = await service.create(userData);

      expect(createdUser).toBeDefined();
      expect(createdUser.email).toBe(userData.email);
      expect(createdUser.username).toBe(userData.username);
      expect(createdUser.role).toBe('USER'); // Default role

      const foundUser = await service.findByEmail(userData.email);
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.password).toBe(userData.password);
    });

    it('should find user by username', async () => {
      const userData = {
        email: 'username@test.com',
        username: 'uniqueusername',
        firstName: 'Username',
        lastName: 'Test',
        password: 'hashedpassword123',
      };

      const createdUser = await service.create(userData);
      const foundUser = await service.findByUsername(userData.username);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.email).toBe(userData.email);
    });

    it('should update user information', async () => {
      const userData = {
        email: 'update@test.com',
        username: 'updateuser',
        firstName: 'Update',
        lastName: 'Test',
        password: 'hashedpassword123',
      };

      const createdUser = await service.create(userData);
      
      const updatedUser = await service.update(createdUser.id, {
        firstName: 'Updated',
        lastName: 'Name',
      });

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Name');
      expect(updatedUser.email).toBe(userData.email); // Unchanged
    });

    it('should update last login time', async () => {
      const userData = {
        email: 'lastlogin@test.com',
        username: 'lastloginuser',
        firstName: 'LastLogin',
        lastName: 'Test',
        password: 'hashedpassword123',
      };

      const createdUser = await service.create(userData);
      expect(createdUser.lastLoginAt).toBeNull();

      const updatedUser = await service.updateLastLogin(createdUser.id);
      expect(updatedUser.lastLoginAt).toBeDefined();
      expect(updatedUser.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should deactivate user (soft delete)', async () => {
      const userData = {
        email: 'deactivate@test.com',
        username: 'deactivateuser',
        firstName: 'Deactivate',
        lastName: 'Test',
        password: 'hashedpassword123',
      };

      const createdUser = await service.create(userData);
      expect(createdUser.isActive).toBe(true);

      const deactivatedUser = await service.remove(createdUser.id);
      expect(deactivatedUser.isActive).toBe(false);

      // User should still exist in database but be inactive
      const foundUser = await service.findById(createdUser.id);
      expect(foundUser).toBeDefined();
      expect(foundUser!.isActive).toBe(false);
    });

    it('should hard delete user', async () => {
      const userData = {
        email: 'delete@test.com',
        username: 'deleteuser',
        firstName: 'Delete',
        lastName: 'Test',
        password: 'hashedpassword123',
      };

      const createdUser = await service.create(userData);
      
      await service.delete(createdUser.id);

      // User should no longer exist in database
      const foundUser = await service.findById(createdUser.id);
      expect(foundUser).toBeNull();
    });

    it('should list all users excluding passwords', async () => {
      const users = [
        {
          email: 'user1@test.com',
          username: 'user1',
          firstName: 'User',
          lastName: 'One',
          password: 'password1',
        },
        {
          email: 'user2@test.com',
          username: 'user2',
          firstName: 'User',
          lastName: 'Two',
          password: 'password2',
        },
      ];

      for (const userData of users) {
        await service.create(userData);
      }

      const allUsers = await service.findAll();
      expect(allUsers).toHaveLength(2);
      
      // Ensure passwords are not included
      allUsers.forEach(user => {
        expect(user).not.toHaveProperty('password');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('username');
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundException for non-existent user update', async () => {
      await expect(
        service.update('non-existent-id', { firstName: 'Test' })
      ).rejects.toThrow('User not found');
    });

    it('should throw NotFoundException for non-existent user removal', async () => {
      await expect(
        service.remove('non-existent-id')
      ).rejects.toThrow('User not found');
    });

    it('should throw NotFoundException for non-existent user deletion', async () => {
      await expect(
        service.delete('non-existent-id')
      ).rejects.toThrow('User not found');
    });

    it('should handle unique constraint violations', async () => {
      const userData = {
        email: 'unique@test.com',
        username: 'uniqueuser',
        firstName: 'Unique',
        lastName: 'Test',
        password: 'password',
      };

      await service.create(userData);

      // Try to create user with same email
      await expect(
        service.create({
          ...userData,
          username: 'differentusername',
        })
      ).rejects.toThrow();

      // Try to create user with same username
      await expect(
        service.create({
          ...userData,
          email: 'different@test.com',
        })
      ).rejects.toThrow();
    });
  });
});