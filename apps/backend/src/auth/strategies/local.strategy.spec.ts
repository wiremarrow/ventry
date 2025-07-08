import { Test, TestingModule } from '@nestjs/testing';
import { LocalStrategy } from './local.strategy.js';
import { AuthService } from '../auth.service.js';
import { UnauthorizedException } from '@nestjs/common';

const mockAuthService = {
  validateUser: jest.fn(),
};

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let _authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    _authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return user when credentials are valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'USER',
      };

      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate('test@example.com', 'validpassword');

      expect(result).toEqual(mockUser);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith('test@example.com', 'validpassword');
      expect(mockAuthService.validateUser).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('test@example.com', 'wrongpassword')).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith('test@example.com', 'wrongpassword');
    });

    it('should throw UnauthorizedException when user validation fails', async () => {
      mockAuthService.validateUser.mockRejectedValue(new Error('Database error'));

      await expect(strategy.validate('test@example.com', 'password')).rejects.toThrow('Database error');
      expect(mockAuthService.validateUser).toHaveBeenCalledWith('test@example.com', 'password');
    });

    it('should handle different user roles', async () => {
      const mockAdminUser = {
        id: 'admin-456',
        email: 'admin@example.com',
        username: 'admin',
        role: 'ADMIN',
      };

      mockAuthService.validateUser.mockResolvedValue(mockAdminUser);

      const result = await strategy.validate('admin@example.com', 'adminpass');

      expect(result).toEqual(mockAdminUser);
      expect(result.role).toBe('ADMIN');
    });

    it('should handle manager users', async () => {
      const mockManagerUser = {
        id: 'manager-789',
        email: 'manager@example.com',
        username: 'manager',
        role: 'MANAGER',
      };

      mockAuthService.validateUser.mockResolvedValue(mockManagerUser);

      const result = await strategy.validate('manager@example.com', 'managerpass');

      expect(result).toEqual(mockManagerUser);
      expect(result.role).toBe('MANAGER');
    });
  });
});