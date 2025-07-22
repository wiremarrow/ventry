import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Mock JWT module first to avoid hoisting issues
vi.mock('../auth/jwt.js', () => ({
  signJWT: vi.fn().mockReturnValue('mock-jwt-token'),
  verifyJWT: vi.fn(),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// Mock the auth service to ensure it uses our mock prisma
vi.mock('../services/auth-service.js', async () => {
  const actual = await vi.importActual('../services/auth-service.js');
  return {
    ...actual,
    createAuthService: vi.fn().mockImplementation((options) => {
      // Create a real AuthService instance but with our mocked prisma
      const AuthService = (actual as any).AuthService;
      return new AuthService(options);
    }),
  };
});

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      create: vi.fn(),
    },
  };
  
  return { 
    prisma: mockPrisma,
    OrganizationRole: {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      MEMBER: 'MEMBER'
    }
  };
});

// Access the mocked prisma for tests
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  organizationMember: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  organization: {
    create: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (fn) => {
    // Simple transaction mock that just calls the function with mockPrisma
    return await fn(mockPrisma);
  }),
};

describe('Auth Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create a proper mock response object with setCookie
    mockRes = {
      setCookie: vi.fn(),
      clearCookie: vi.fn(),
      header: vi.fn(),
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const userWithPassword = { ...mockUser, password: 'hashedpassword' };
      const mockOrganization = { id: 'org1', name: 'Test Org' };
      const mockMembership = {
        id: 'mem1',
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: 'MEMBER',
        organization: mockOrganization,
      };
      
      mockPrisma.user.findUnique.mockResolvedValue(userWithPassword);
      mockPrisma.user.update.mockResolvedValue(userWithPassword);
      mockPrisma.organizationMember.findFirst.mockResolvedValue(mockMembership);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await caller.auth.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should throw error for invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        caller.auth.login({
          email: 'invalid@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      const userWithPassword = { ...mockUser, password: 'hashedpassword' };
      mockPrisma.user.findUnique.mockResolvedValue(userWithPassword);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        caller.auth.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      const inactiveUser = { ...mockUser, password: 'hashedpassword', isActive: false };
      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(
        caller.auth.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Account is deactivated');
    });
  });

  describe('register', () => {
    it('should register new user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null); // No existing user
      mockPrisma.user.create.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedpassword' as never);

      const result = await caller.auth.register({
        email: 'new@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'password123',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('user');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          password: 'hashedpassword',
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    });

    it('should throw error for existing email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, email: 'existing@example.com' });

      await expect(
        caller.auth.register({
          email: 'existing@example.com',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          password: 'password123',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should throw error for existing username', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, username: 'existinguser' });

      await expect(
        caller.auth.register({
          email: 'new@example.com',
          username: 'existinguser',
          firstName: 'New',
          lastName: 'User',
          password: 'password123',
        })
      ).rejects.toThrow('Username already taken');
    });
  });

  describe('me', () => {
    it('should return current user when authenticated', async () => {
      const authenticatedCaller = await createDirectCaller({ 
        user: mockAuthenticatedUser,
        prisma: mockPrisma as any,
        res: mockRes
      });

      const result = await authenticatedCaller.auth.me();

      expect(result).toEqual(mockAuthenticatedUser);
    });

    it('should throw error when not authenticated', async () => {
      await expect(caller.auth.me()).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('logout', () => {
    it('should successfully logout authenticated user', async () => {
      const authenticatedCaller = await createDirectCaller({ 
        user: mockAuthenticatedUser,
        prisma: mockPrisma as any,
        res: mockRes
      });

      const result = await authenticatedCaller.auth.logout();

      expect(result).toEqual({ success: true });
      // Check that clearCookie was called for each cookie
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(4); // auth-token, active-organization, refresh-token, session-id
      expect(mockRes.clearCookie).toHaveBeenCalledWith('auth-token', expect.any(Object));
      expect(mockRes.clearCookie).toHaveBeenCalledWith('active-organization', expect.any(Object));
    });

    it('should handle logout when not authenticated', async () => {
      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      // Should still clear cookies even if not authenticated
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(4); // auth-token, active-organization, refresh-token, session-id
      expect(mockRes.clearCookie).toHaveBeenCalledWith('auth-token', expect.any(Object));
      expect(mockRes.clearCookie).toHaveBeenCalledWith('active-organization', expect.any(Object));
    });
  });

  describe('refreshToken', () => {
    it('should throw NOT_IMPLEMENTED error', async () => {
      await expect(
        caller.auth.refreshToken({
          refreshToken: 'any-refresh-token',
        })
      ).rejects.toThrow('Refresh token not implemented yet');
    });
  });

  describe('debug', () => {
    it('should return debug information for authenticated user', async () => {
      const mockReq = {
        headers: { 'x-organization-id': 'org-123' },
        cookies: {
          'active-organization': 'org-123',
          'auth-token': 'token-123',
        },
      };

      const authenticatedCaller = await createDirectCaller({ 
        user: mockAuthenticatedUser,
        prisma: mockPrisma as any,
        res: mockRes,
        req: mockReq
      });

      const result = await authenticatedCaller.auth.debug();

      expect(result).toEqual({
        user: {
          id: mockAuthenticatedUser.id,
          email: mockAuthenticatedUser.email,
          organizationId: mockAuthenticatedUser.organizationId,
          organizationRole: mockAuthenticatedUser.organizationRole,
        },
        headers: {
          'x-organization-id': 'org-123',
        },
        cookies: {
          'active-organization': 'org-123',
          'auth-token': 'present',
        },
      });
    });

    it('should throw error when not authenticated', async () => {
      await expect(caller.auth.debug()).rejects.toThrow('UNAUTHORIZED');
    });
  });
});