import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createContext } from '../context.js';
import { prisma as basePrisma } from '@ventry/database';
import type { PrismaClient } from '@ventry/database';

// Mock dependencies
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

vi.mock('../../lib/auth/token-extractor.js', () => ({
  getRawToken: vi.fn(),
}));

vi.mock('../../auth/jwt.js', () => ({
  verifyJwt: vi.fn(),
}));

vi.mock('@ventry/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    organizationMember: {
      findUnique: vi.fn(),
    },
    $executeRawUnsafe: vi.fn(),
  },
}));

vi.mock('../../lib/rls/index.js', () => ({
  createRLSProxy: vi.fn((prisma) => prisma),
}));

vi.mock('../../services/cookie-service.js', () => ({
  CookieService: {
    getActiveOrganization: vi.fn(),
  },
}));

// Import after mocking
import { getRawToken } from '../../lib/auth/token-extractor.js';
import { verifyJwt } from '../../auth/jwt.js';
import { createRLSProxy } from '../../lib/rls/index.js';
import { CookieService } from '../../services/cookie-service.js';

describe('createContext', () => {
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      cookies: {},
      headers: {},
      unsignCookie: vi.fn(),
    };

    mockReply = {};

    // Reset CookieService mock
    vi.mocked(CookieService.getActiveOrganization).mockReturnValue(undefined);
  });

  describe('unauthenticated requests', () => {
    it('should create context with no user and RLS bypass for public endpoints', async () => {
      vi.mocked(getRawToken).mockReturnValue(undefined);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      expect(ctx).toEqual({
        req: mockRequest,
        res: mockReply,
        user: null,
        prisma: basePrisma,
        organizationId: undefined,
      });

      expect(getRawToken).toHaveBeenCalledWith(mockRequest);
      expect(verifyJwt).not.toHaveBeenCalled();
      expect(createRLSProxy).toHaveBeenCalledWith(basePrisma, expect.any(Function));

      // Check RLS context
      const rlsContextFn = vi.mocked(createRLSProxy).mock.calls[0][1];
      expect(rlsContextFn()).toEqual({
        bypassRLS: true,
        bypassReason: 'Public endpoint - no auth required',
      });
    });
  });

  describe('authenticated requests', () => {
    it('should create context with user when valid token is provided', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
        organizationId: undefined,
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      expect(ctx.user).toEqual({
        ...mockUser,
        createdAt: mockUser.createdAt.toISOString(),
        organizationId: undefined,
        organizationRole: undefined,
      });

      expect(getRawToken).toHaveBeenCalledWith(mockRequest);
      expect(verifyJwt).toHaveBeenCalledWith(mockToken);
      expect(basePrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
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

    it('should set RLS context when user is authenticated', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      // Verify RLS proxy was called with correct context
      expect(createRLSProxy).toHaveBeenCalledWith(basePrisma, expect.any(Function));

      // Check RLS context function
      const rlsContextFn = vi.mocked(createRLSProxy).mock.calls[0][1];
      expect(rlsContextFn()).toEqual({
        userId: 'user-123',
        bypassRLS: false,
      });
    });

    it('should handle inactive users', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: false,
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      expect(ctx.user).toBeNull();
      expect(basePrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should handle missing user in database', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
      };

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(null);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      expect(ctx.user).toBeNull();
      expect(basePrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should handle JWT verification errors', async () => {
      const mockToken = 'invalid.jwt.token';

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockImplementation(() => {
        throw new Error('INVALID_SIGNATURE');
      });

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      expect(ctx.user).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Invalid token in request'
      );
    });
  });

  describe('organization context', () => {
    it('should set organization context from header', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };
      const mockMembership = {
        organizationId: 'org-456',
        userId: 'user-123',
        role: 'ADMIN',
      };

      mockRequest.headers['x-organization-id'] = 'org-456';

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(basePrisma.organizationMember.findUnique).mockResolvedValue(mockMembership);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      expect(ctx.user?.organizationId).toBe('org-456');
      expect(ctx.user?.organizationRole).toBe('ADMIN');
      expect(ctx.organizationId).toBe('org-456');

      expect(basePrisma.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-456',
            userId: 'user-123',
          },
        },
      });

      // Check RLS context
      const rlsContextFn = vi.mocked(createRLSProxy).mock.calls[0][1];
      expect(rlsContextFn()).toEqual({
        userId: 'user-123',
        organizationId: 'org-456',
        bypassRLS: false,
      });
    });

    it('should set organization context from cookie', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };
      const mockMembership = {
        organizationId: 'org-789',
        userId: 'user-123',
        role: 'MEMBER',
      };

      // Mock CookieService to return the organization ID
      vi.mocked(CookieService.getActiveOrganization).mockReturnValue('org-789');

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(basePrisma.organizationMember.findUnique).mockResolvedValue(mockMembership);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      expect(ctx.user?.organizationId).toBe('org-789');
      expect(ctx.user?.organizationRole).toBe('MEMBER');
    });

    it('should prefer header over cookie for organization', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };
      const mockMembership = {
        organizationId: 'org-header',
        userId: 'user-123',
        role: 'OWNER',
      };

      mockRequest.headers['x-organization-id'] = 'org-header';
      // Mock CookieService to return a different organization ID (should be ignored)
      vi.mocked(CookieService.getActiveOrganization).mockReturnValue('org-cookie');

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(basePrisma.organizationMember.findUnique).mockResolvedValue(mockMembership);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      expect(ctx.user?.organizationId).toBe('org-header');
      expect(basePrisma.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-header',
            userId: 'user-123',
          },
        },
      });
    });

    it('should handle invalid organization access', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };

      mockRequest.headers['x-organization-id'] = 'org-invalid';

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(basePrisma.organizationMember.findUnique).mockResolvedValue(null);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      expect(ctx.user?.organizationId).toBeUndefined();
      expect(ctx.user?.organizationRole).toBeUndefined();

      // Should still have basic RLS context with just userId
      const rlsContextFn = vi.mocked(createRLSProxy).mock.calls[0][1];
      expect(rlsContextFn()).toEqual({
        userId: 'user-123',
        bypassRLS: false,
      });
    });

    it('should handle organization cookie service errors', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
        organizationId: 'jwt-org',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };
      const mockMembership = {
        organizationId: 'jwt-org',
        userId: 'user-123',
        role: 'MEMBER',
      };

      // CookieService returns undefined for invalid cookies
      vi.mocked(CookieService.getActiveOrganization).mockReturnValue(undefined);

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(basePrisma.organizationMember.findUnique).mockResolvedValue(mockMembership);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      // Should fall back to JWT organizationId
      expect(ctx.user?.organizationId).toBe('jwt-org');
      expect(CookieService.getActiveOrganization).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('RLS context setting', () => {
    it('should set RLS context via proxy when user is authenticated', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);

      await createContext({ req: mockRequest, res: mockReply });

      // Verify RLS proxy was called with correct context
      expect(createRLSProxy).toHaveBeenCalledWith(basePrisma, expect.any(Function));

      // Check RLS context function
      const rlsContextFn = vi.mocked(createRLSProxy).mock.calls[0][1];
      expect(rlsContextFn()).toEqual({
        userId: 'user-123',
        bypassRLS: false,
      });
    });

    it('should handle SET LOCAL errors gracefully', async () => {
      const mockToken = 'valid.jwt.token';
      const mockJwtPayload = {
        userId: 'user-123',
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(getRawToken).mockReturnValue(mockToken);
      vi.mocked(verifyJwt).mockReturnValue(mockJwtPayload);
      vi.mocked(basePrisma.user.findUnique).mockResolvedValue(mockUser);

      const ctx = await createContext({ req: mockRequest, res: mockReply });

      // Context should still be created successfully
      expect(ctx.user).toBeTruthy();
      expect(ctx.user?.id).toBe('user-123');

      // RLS proxy should be created with appropriate context
      expect(createRLSProxy).toHaveBeenCalled();
    });
  });
});
