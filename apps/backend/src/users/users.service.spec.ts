import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import * as _bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';

jest.mock('bcryptjs');

const mockDatabaseService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;
  let databaseService: typeof mockDatabaseService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    password: 'hashedpassword',
    role: 'USER' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    databaseService = module.get(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return array of users without passwords', async () => {
      const usersWithoutPassword = [{ ...mockUser }];
      delete (usersWithoutPassword[0] as any).password;
      
      databaseService.user.findMany.mockResolvedValue(usersWithoutPassword);

      const result = await service.findAll();

      expect(result).toEqual(usersWithoutPassword);
      expect(databaseService.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      });
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      databaseService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('1');

      expect(result).toEqual(mockUser);
      expect(databaseService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should return null when user not found', async () => {
      databaseService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user with password when found', async () => {
      databaseService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(databaseService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      databaseService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return user when found', async () => {
      databaseService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(databaseService.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });

    it('should return null when user not found', async () => {
      databaseService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      const createUserDto = {
        email: 'new@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'hashedpassword',
      };

      databaseService.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockUser);
      expect(databaseService.user.create).toHaveBeenCalledWith({
        data: createUserDto,
      });
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const updateData = { firstName: 'Updated' };
      const updatedUser = { ...mockUser, ...updateData };

      databaseService.user.findUnique.mockResolvedValue(mockUser);
      databaseService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('1', updateData);

      expect(result).toEqual(updatedUser);
      expect(databaseService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      databaseService.user.findUnique.mockResolvedValue(null);

      await expect(service.update('999', { firstName: 'Updated' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLastLogin', () => {
    it('should update user last login time', async () => {
      const updatedUser = { ...mockUser, lastLoginAt: new Date() };
      databaseService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateLastLogin('1');

      expect(result).toEqual(updatedUser);
      expect(databaseService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          lastLoginAt: expect.any(Date),
        },
      });
    });
  });

  describe('remove', () => {
    it('should deactivate user successfully', async () => {
      const deactivatedUser = { ...mockUser, isActive: false };

      databaseService.user.findUnique.mockResolvedValue(mockUser);
      databaseService.user.update.mockResolvedValue(deactivatedUser);

      const result = await service.remove('1');

      expect(result).toEqual(deactivatedUser);
      expect(databaseService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          isActive: false,
        },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      databaseService.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      databaseService.user.findUnique.mockResolvedValue(mockUser);
      databaseService.user.delete.mockResolvedValue(mockUser);

      const result = await service.delete('1');

      expect(result).toEqual(mockUser);
      expect(databaseService.user.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      databaseService.user.findUnique.mockResolvedValue(null);

      await expect(service.delete('999')).rejects.toThrow(NotFoundException);
    });
  });
});