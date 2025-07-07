import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { createTestUser, cleanTestData } from '../test-helpers/factories';

describe('UsersService Integration', () => {
  let service: UsersService;
  let databaseService: DatabaseService;

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
  });

  afterAll(async () => {
    // Clean up any remaining test data from this worker's database
    await cleanTestData(databaseService);
    await databaseService.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test for isolation within this worker
    // Each worker has its own database, so no interference between workers
    await cleanTestData(databaseService);
  });

  describe('CRUD Operations', () => {
    it('should create and find user by email', async () => {
      // Create test user data with guaranteed unique identifiers
      const testUser = await createTestUser(databaseService, {
        firstName: 'Integration',
        lastName: 'Test',
      });

      // Test finding by email
      const foundUser = await service.findByEmail(testUser.email);
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.email).toBe(testUser.email);
      expect(foundUser!.username).toBe(testUser.username);
      expect(foundUser!.role).toBe('USER'); // Default role
    });

    it('should find user by username', async () => {
      // Create test user with unique username
      const testUser = await createTestUser(databaseService, {
        firstName: 'Username',
        lastName: 'Test',
      });

      const foundUser = await service.findByUsername(testUser.username);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.email).toBe(testUser.email);
    });

    it('should update user information', async () => {
      // Create test user
      const testUser = await createTestUser(databaseService, {
        firstName: 'Original',
        lastName: 'Name',
      });
      
      const updatedUser = await service.update(testUser.id, {
        firstName: 'Updated',
        lastName: 'NewName',
      });

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('NewName');
      expect(updatedUser.email).toBe(testUser.email); // Unchanged
    });

    it('should update last login time', async () => {
      // Create test user
      const testUser = await createTestUser(databaseService, {
        firstName: 'LastLogin',
        lastName: 'Test',
      });
      
      expect(testUser.lastLoginAt).toBeNull();

      const updatedUser = await service.updateLastLogin(testUser.id);
      expect(updatedUser.lastLoginAt).toBeDefined();
      expect(updatedUser.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should deactivate user (soft delete)', async () => {
      // Create test user using factory
      const testUser = await createTestUser(databaseService, {
        firstName: 'Deactivate',
        lastName: 'Test',
      });
      expect(testUser.isActive).toBe(true);

      const deactivatedUser = await service.remove(testUser.id);
      expect(deactivatedUser.isActive).toBe(false);

      // User should still exist in database but be inactive
      const foundUser = await service.findById(testUser.id);
      expect(foundUser).toBeDefined();
      expect(foundUser!.isActive).toBe(false);
    });

    it('should hard delete user', async () => {
      // Create test user using factory
      const testUser = await createTestUser(databaseService, {
        firstName: 'Delete',
        lastName: 'Test',
      });
      
      await service.delete(testUser.id);

      // User should no longer exist in database
      const foundUser = await service.findById(testUser.id);
      expect(foundUser).toBeNull();
    });

    it('should list all users excluding passwords', async () => {
      // Create test users using factory
      const testUser1 = await createTestUser(databaseService, {
        firstName: 'User',
        lastName: 'One',
      });
      const testUser2 = await createTestUser(databaseService, {
        firstName: 'User',
        lastName: 'Two',
      });

      const allUsers = await service.findAll();
      expect(allUsers).toHaveLength(2);
      
      // Ensure passwords are not included
      allUsers.forEach(user => {
        expect(user).not.toHaveProperty('password');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('username');
      });

      // Verify our test users are in the results
      const userIds = allUsers.map(user => user.id);
      expect(userIds).toContain(testUser1.id);
      expect(userIds).toContain(testUser2.id);
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
      // Create initial test user using a service call to ensure it's in the database
      const initialUserData = {
        email: 'unique-test@example.com',
        username: 'uniquetestuser',
        firstName: 'Unique',
        lastName: 'Test',
        password: 'password123',
      };
      
      const testUser = await service.create(initialUserData);

      // Try to create user with same email
      await expect(
        service.create({
          email: testUser.email, // Same email
          username: 'differentusername',
          firstName: 'Different',
          lastName: 'User',
          password: 'password',
        })
      ).rejects.toThrow();

      // Try to create user with same username
      await expect(
        service.create({
          email: 'different@test.com',
          username: testUser.username, // Same username
          firstName: 'Different',
          lastName: 'User',
          password: 'password',
        })
      ).rejects.toThrow();
    });
  });
});