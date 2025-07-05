import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const mockAuthService = {
  login: jest.fn(),
  register: jest.fn(),
  refreshToken: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const expectedResult = {
        accessToken: 'jwt.access.token',
        refreshToken: 'jwt.refresh.token',
        user: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
        },
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it('should handle login errors', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(controller.login(loginDto)).rejects.toThrow('Invalid credentials');
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'password123',
      };

      const expectedResult = {
        accessToken: 'jwt.access.token',
        refreshToken: 'jwt.refresh.token',
        user: {
          id: '2',
          email: 'newuser@example.com',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          role: 'USER',
        },
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });

    it('should handle registration errors', async () => {
      const registerDto = {
        email: 'existing@example.com',
        username: 'existinguser',
        firstName: 'Existing',
        lastName: 'User',
        password: 'password123',
      };

      mockAuthService.register.mockRejectedValue(new Error('User already exists'));

      await expect(controller.register(registerDto)).rejects.toThrow('User already exists');
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshTokenDto = {
        refreshToken: 'valid.refresh.token',
      };

      const expectedResult = {
        accessToken: 'new.jwt.access.token',
        refreshToken: 'new.jwt.refresh.token',
      };

      mockAuthService.refreshToken.mockResolvedValue(expectedResult);

      const result = await controller.refreshToken(refreshTokenDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
    });

    it('should handle refresh token errors', async () => {
      const refreshTokenDto = {
        refreshToken: 'invalid.refresh.token',
      };

      mockAuthService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(controller.refreshToken(refreshTokenDto)).rejects.toThrow('Invalid refresh token');
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockRequest = {
        user: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
        },
      };

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockRequest.user);
    });

    it('should return profile with all user properties', async () => {
      const mockRequest = {
        user: {
          id: '1',
          email: 'admin@example.com',
          username: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          lastLoginAt: '2024-01-01T12:00:00.000Z',
        },
      };

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockRequest.user);
      expect(result.role).toBe('ADMIN');
      expect(result.isActive).toBe(true);
    });
  });

  describe('controller metadata', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have correct service dependency', () => {
      expect(authService).toBeDefined();
    });
  });
});