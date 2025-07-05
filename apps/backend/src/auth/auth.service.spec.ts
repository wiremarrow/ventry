import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

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
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByUsername: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            updateLastLogin: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should validate user with correct credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
        lastLoginAt: null,
      });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent@example.com', 'password')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.validateUser('test@example.com', 'password')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('test@example.com', 'wrongpassword')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return auth response with tokens', async () => {
      const validateUserSpy = jest.spyOn(service, 'validateUser');
      const userWithoutPassword = { ...mockUser };
      delete (userWithoutPassword as any).password;
      
      validateUserSpy.mockResolvedValue(userWithoutPassword);
      usersService.updateLastLogin.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue('7d');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(usersService.updateLastLogin).toHaveBeenCalledWith('1');
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-jwt-token',
        user: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
          isActive: true,
          createdAt: mockUser.createdAt.toISOString(),
          lastLoginAt: undefined,
        },
      });
    });
  });

  describe('register', () => {
    it('should create new user and return auth response', async () => {
      const newUser = { ...mockUser };
      delete (newUser as any).password;
      
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue(newUser);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue('7d');

      const result = await service.register({
        email: 'new@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'password',
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(usersService.findByUsername).toHaveBeenCalledWith('newuser');
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-jwt-token',
        user: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
          isActive: true,
          createdAt: mockUser.createdAt.toISOString(),
          lastLoginAt: undefined,
        },
      });
    });

    it('should throw UnauthorizedException for existing email', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register({
        email: 'existing@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'password',
      })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for existing username', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByUsername.mockResolvedValue(mockUser);

      await expect(service.register({
        email: 'new@example.com',
        username: 'existinguser',
        firstName: 'New',
        lastName: 'User',
        password: 'password',
      })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens for valid refresh token', async () => {
      const mockPayload = { email: 'test@example.com', sub: '1', role: 'USER' };
      const userWithoutPassword = { ...mockUser };
      delete (userWithoutPassword as any).password;

      jwtService.verify.mockReturnValue(mockPayload);
      usersService.findById.mockResolvedValue(userWithoutPassword);
      jwtService.sign.mockReturnValue('new-token');
      configService.get.mockReturnValue('7d');

      const result = await service.refreshToken('valid-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token');
      expect(usersService.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual({
        accessToken: 'new-token',
        refreshToken: 'new-token',
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const mockPayload = { email: 'test@example.com', sub: '1', role: 'USER' };
      const inactiveUser = { ...mockUser, isActive: false };

      jwtService.verify.mockReturnValue(mockPayload);
      usersService.findById.mockResolvedValue(inactiveUser);

      await expect(service.refreshToken('valid-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const mockPayload = { email: 'test@example.com', sub: '1', role: 'USER' };

      jwtService.verify.mockReturnValue(mockPayload);
      usersService.findById.mockResolvedValue(null);

      await expect(service.refreshToken('valid-token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should use default expiration when config not set', async () => {
      const mockPayload = { email: 'test@example.com', sub: '1', role: 'USER' };
      const userWithoutPassword = { ...mockUser };
      delete (userWithoutPassword as any).password;

      jwtService.verify.mockReturnValue(mockPayload);
      usersService.findById.mockResolvedValue(userWithoutPassword);
      jwtService.sign.mockReturnValue('new-token');
      configService.get.mockReturnValue(null); // Config returns null

      const result = await service.refreshToken('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-token',
        refreshToken: 'new-token',
      });
      // Check that the sign method was called with the fallback value
      expect(jwtService.sign).toHaveBeenCalledWith(
        { email: 'test@example.com', sub: '1', role: 'USER' },
        { expiresIn: '7d' }
      );
    });
  });

  describe('additional edge cases', () => {
    it('should handle login with default JWT refresh expiration', async () => {
      const validateUserSpy = jest.spyOn(service, 'validateUser');
      const userWithoutPassword = { ...mockUser };
      delete (userWithoutPassword as any).password;
      
      validateUserSpy.mockResolvedValue(userWithoutPassword);
      usersService.updateLastLogin.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue(null); // Config returns null

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      // Check that the sign method was called with the fallback value
      expect(jwtService.sign).toHaveBeenCalledWith(
        { email: 'test@example.com', sub: '1', role: 'USER' },
        { expiresIn: '7d' }
      );
    });

    it('should handle register with default JWT refresh expiration', async () => {
      const newUser = { ...mockUser };
      delete (newUser as any).password;
      
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue(newUser);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      configService.get.mockReturnValue(undefined); // Config returns undefined

      const result = await service.register({
        email: 'new@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'password',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      // Check that the sign method was called with the fallback value
      expect(jwtService.sign).toHaveBeenCalledWith(
        { email: 'test@example.com', sub: '1', role: 'USER' },
        { expiresIn: '7d' }
      );
    });
  });
});