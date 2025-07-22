import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';
import { prisma as mockPrisma } from '@ventry/database';

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  
  // Set up transaction mock
  mockPrisma.$transaction.mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  });
  
  return {
    prisma: mockPrisma,
    Prisma: {},
    OrganizationRole: {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    },
    UserRole: {
      ADMIN: 'ADMIN',
      MANAGER: 'MANAGER',
      EMPLOYEE: 'EMPLOYEE',
      USER: 'USER',
    },
  };
});

describe('Health Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset all mock implementations to avoid interference between tests
    mockPrisma.$queryRaw.mockReset();
    
    // Create a proper mock response object
    mockRes = {
      setCookie: vi.fn(),
      clearCookie: vi.fn(),
      header: vi.fn(),
    };
    
    // Health check is public, so no user required
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: null,
    });
  });

  describe('check', () => {
    it('should return health status with working database', async () => {
      // Mock successful database query
      mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await caller.health.check();

      expect(result.status).toBe('operational');
      expect(result.services.api).toBe('healthy');
      expect(result.services.database.status).toBe('connected');
      expect(result.services.database.error).toBeNull();
      expect(result.version).toBe('1.0.0');
      expect(result.environment).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle database connection error', async () => {
      // Mock database error
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await caller.health.check();

      expect(result.status).toBe('operational'); // API is still operational
      expect(result.services.api).toBe('healthy');
      expect(result.services.database.status).toBe('disconnected');
      expect(result.services.database.error).toBe('Connection refused');
    });

    it('should handle non-Error database failures', async () => {
      // Mock non-Error rejection
      mockPrisma.$queryRaw.mockRejectedValue('Unknown database error');

      const result = await caller.health.check();

      expect(result.status).toBe('operational');
      expect(result.services.api).toBe('healthy');
      expect(result.services.database.status).toBe('disconnected');
      expect(result.services.database.error).toBe('Unknown error');
    });

    it('should return consistent timestamp format', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await caller.health.check();

      // Check ISO 8601 format
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should be accessible without authentication', async () => {
      // Already created caller without user
      mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await caller.health.check();

      expect(result.status).toBe('operational');
    });

    it('should work with authenticated user as well', async () => {
      // Create authenticated caller
      const authenticatedCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: mockAuthenticatedUser,
      });

      mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await authenticatedCaller.health.check();

      expect(result.status).toBe('operational');
    });

    it('should use NODE_ENV environment variable', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await caller.health.check();

      expect(result.environment).toBe('production');

      // Restore original
      process.env.NODE_ENV = originalEnv;
    });

    it('should default to development when NODE_ENV is not set', async () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await caller.health.check();

      expect(result.environment).toBe('development');

      // Restore original
      process.env.NODE_ENV = originalEnv;
    });
  });
});