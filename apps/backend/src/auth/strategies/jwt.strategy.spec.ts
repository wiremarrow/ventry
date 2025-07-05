import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

const mockUsersService = {
  findById: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test-secret'),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let _usersService: UsersService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    _usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return user data when user is found and active', async () => {
      const payload = { sub: 'user-123' };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        lastLoginAt: new Date('2024-01-02'),
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastLoginAt: '2024-01-02T00:00:00.000Z',
      });
      expect(mockUsersService.findById).toHaveBeenCalledWith('user-123');
    });

    it('should return null when user is not found', async () => {
      const payload = { sub: 'non-existent' };
      
      mockUsersService.findById.mockResolvedValue(null);

      const result = await strategy.validate(payload);

      expect(result).toBeNull();
      expect(mockUsersService.findById).toHaveBeenCalledWith('non-existent');
    });

    it('should return null when user is inactive', async () => {
      const payload = { sub: 'inactive-user' };
      const mockUser = {
        id: 'inactive-user',
        email: 'inactive@example.com',
        username: 'inactive',
        firstName: 'Inactive',
        lastName: 'User',
        role: 'USER',
        isActive: false,
        createdAt: new Date('2024-01-01'),
        lastLoginAt: null,
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toBeNull();
      expect(mockUsersService.findById).toHaveBeenCalledWith('inactive-user');
    });

    it('should handle user without lastLoginAt', async () => {
      const payload = { sub: 'user-456' };
      const mockUser = {
        id: 'user-456',
        email: 'new@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        lastLoginAt: null,
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-456',
        email: 'new@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastLoginAt: undefined,
      });
    });
  });

  describe('constructor', () => {
    it('should use JWT secret from config service', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });
});