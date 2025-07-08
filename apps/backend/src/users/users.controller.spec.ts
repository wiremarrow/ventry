import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { NotFoundException } from '@nestjs/common';

const mockUsersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const mockUsers = [
        {
          id: '1',
          email: 'user1@example.com',
          username: 'user1',
          firstName: 'User',
          lastName: 'One',
          role: 'USER',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          email: 'user2@example.com',
          username: 'user2',
          firstName: 'User',
          lastName: 'Two',
          role: 'MANAGER',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockUsersService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.findAll();

      expect(result).toEqual(mockUsers);
      expect(mockUsersService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no users exist', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(mockUsersService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a user by ID', async () => {
      const mockUser = {
        id: '1',
        email: 'user@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findById).toHaveBeenCalledWith('1');
      expect(mockUsersService.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.findById.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockUsersService.findById).toHaveBeenCalledWith('non-existent');
    });

    it('should handle valid UUID format', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const mockUser = {
        id: validUuid,
        email: 'user@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.findOne(validUuid);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findById).toHaveBeenCalledWith(validUuid);
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const updateDto = {
        firstName: 'Updated',
        lastName: 'Name',
        isActive: false,
      };

      const mockUpdatedUser = {
        id: '1',
        email: 'user@example.com',
        username: 'testuser',
        firstName: 'Updated',
        lastName: 'Name',
        role: 'USER',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      mockUsersService.update.mockResolvedValue(mockUpdatedUser);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(mockUpdatedUser);
      expect(mockUsersService.update).toHaveBeenCalledWith('1', updateDto);
      expect(mockUsersService.update).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const updateDto = {
        firstName: 'NewFirstName',
      };

      const mockUpdatedUser = {
        id: '1',
        email: 'user@example.com',
        username: 'testuser',
        firstName: 'NewFirstName',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      mockUsersService.update.mockResolvedValue(mockUpdatedUser);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(mockUpdatedUser);
      expect(mockUsersService.update).toHaveBeenCalledWith('1', updateDto);
    });

    it('should throw NotFoundException when updating non-existent user', async () => {
      const updateDto = {
        firstName: 'Updated',
      };

      mockUsersService.update.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
      expect(mockUsersService.update).toHaveBeenCalledWith('non-existent', updateDto);
    });
  });

  describe('remove', () => {
    it('should deactivate a user successfully', async () => {
      const mockDeactivatedUser = {
        id: '1',
        email: 'user@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      mockUsersService.remove.mockResolvedValue(mockDeactivatedUser);

      const result = await controller.remove('1');

      expect(result).toEqual(mockDeactivatedUser);
      expect(mockUsersService.remove).toHaveBeenCalledWith('1');
      expect(mockUsersService.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when deactivating non-existent user', async () => {
      mockUsersService.remove.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.remove('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockUsersService.remove).toHaveBeenCalledWith('non-existent');
    });

    it('should handle already deactivated user', async () => {
      const mockAlreadyDeactivatedUser = {
        id: '1',
        email: 'user@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      mockUsersService.remove.mockResolvedValue(mockAlreadyDeactivatedUser);

      const result = await controller.remove('1');

      expect(result).toEqual(mockAlreadyDeactivatedUser);
      expect(result.isActive).toBe(false);
    });
  });

  describe('controller metadata', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have correct service dependency', () => {
      expect(usersService).toBeDefined();
    });
  });
});