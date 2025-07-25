import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRLSProxy } from '../rls-proxy.js';
import { type RLSContext } from '../types.js';

// Mock the rls-service module
vi.mock('../rls-service.js', () => ({
  withRLS: vi.fn().mockImplementation(async (prisma, context, operation) => {
    // Simulate withRLS behavior
    return {
      data: await operation(prisma),
      timing: { contextSetMs: 1, queryMs: 5, totalMs: 6 },
      context: { organizationId: context.organizationId, bypassed: false },
    };
  }),
  setRLSContext: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('../../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('RLS Proxy', () => {
  let mockPrisma: any;
  let mockContext: RLSContext;
  let getContext: () => RLSContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Prisma client
    mockPrisma = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $transaction: vi.fn().mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn(mockPrisma);
        }
        return Promise.all(fn);
      }),
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: '1', name: 'Test User' }]),
        findUnique: vi.fn().mockResolvedValue({ id: '1', name: 'Test User' }),
        create: vi.fn().mockResolvedValue({ id: '2', name: 'New User' }),
        update: vi.fn().mockResolvedValue({ id: '1', name: 'Updated User' }),
        delete: vi.fn().mockResolvedValue({ id: '1', name: 'Deleted User' }),
      },
      item: {
        findMany: vi.fn().mockResolvedValue([{ id: '1', name: 'Test Item' }]),
        create: vi.fn().mockResolvedValue({ id: '2', name: 'New Item' }),
      },
    };

    mockContext = {
      organizationId: 'clh3sa7gu0000qzrmn831i7rn',
      userId: 'clh3sa7gu0000qzrmn831i7ro',
      bypassRLS: false,
    };

    getContext = () => mockContext;
  });

  describe('Proxy Creation', () => {
    it('should create a proxy that preserves non-model properties', () => {
      const proxy = createRLSProxy(mockPrisma, getContext);

      expect(proxy.$connect).toBe(mockPrisma.$connect);
      expect(proxy.$disconnect).toBe(mockPrisma.$disconnect);
    });

    it('should create proxies for model delegates', () => {
      const proxy = createRLSProxy(mockPrisma, getContext);

      expect(proxy.user).toBeDefined();
      expect(proxy.user).not.toBe(mockPrisma.user);
      expect(proxy.item).toBeDefined();
      expect(proxy.item).not.toBe(mockPrisma.item);
    });
  });

  describe('Model Operations', () => {
    it('should wrap model operations with RLS context', async () => {
      const proxy = createRLSProxy(mockPrisma, getContext);
      const { withRLS } = await import('../rls-service.js');

      await proxy.user.findMany();

      expect(withRLS).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          organizationId: mockContext.organizationId,
          userId: mockContext.userId,
        }),
        expect.any(Function)
      );
    });

    it('should return the data from the operation', async () => {
      const proxy = createRLSProxy(mockPrisma, getContext);

      const result = await proxy.user.findMany();

      expect(result).toEqual([{ id: '1', name: 'Test User' }]);
    });

    it('should handle bypass context', async () => {
      mockContext = {
        bypassRLS: true,
        bypassReason: 'System operation',
      };

      const proxy = createRLSProxy(mockPrisma, getContext);
      const result = await proxy.user.findMany();

      expect(result).toEqual([{ id: '1', name: 'Test User' }]);
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });

    it('should cache model proxies for performance', async () => {
      const proxy = createRLSProxy(mockPrisma, getContext);

      const userProxy1 = proxy.user;
      const userProxy2 = proxy.user;

      expect(userProxy1).toBe(userProxy2);
    });
  });

  describe('Transaction Handling', () => {
    it('should wrap interactive transactions', async () => {
      const proxy = createRLSProxy(mockPrisma, getContext);

      const callback = vi.fn().mockResolvedValue('transaction result');
      const result = await proxy.$transaction(callback);

      expect(result).toBe('transaction result');
      expect(callback).toHaveBeenCalled();
    });

    it('should handle batch transactions with warning', async () => {
      const proxy = createRLSProxy(mockPrisma, getContext);

      const promises = [Promise.resolve('result1'), Promise.resolve('result2')];

      const result = await proxy.$transaction(promises);

      expect(result).toEqual(['result1', 'result2']);
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from operations', async () => {
      // Mock withRLS to throw the database error
      const { withRLS } = await import('../rls-service.js');
      const error = new Error('Database error');
      (withRLS as any).mockRejectedValue(error);

      const proxy = createRLSProxy(mockPrisma, getContext);

      await expect(proxy.user.findMany()).rejects.toThrow('Database error');
    });

    it('should handle invalid context errors', async () => {
      mockContext = {
        organizationId: 'invalid-id',
      };

      const { withRLS } = await import('../rls-service.js');
      (withRLS as any).mockRejectedValue(new Error('Invalid RLS context'));

      const proxy = createRLSProxy(mockPrisma, getContext);

      await expect(proxy.user.findMany()).rejects.toThrow('Invalid RLS context');
    });
  });

  describe('Non-Proxied Methods', () => {
    it('should not proxy $connect and $disconnect', async () => {
      const proxy = createRLSProxy(mockPrisma, getContext);

      await proxy.$connect();
      await proxy.$disconnect();

      expect(mockPrisma.$connect).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle symbol properties', () => {
      const symbolProp = Symbol('test');
      mockPrisma[symbolProp] = 'symbol value';

      const proxy = createRLSProxy(mockPrisma, getContext);

      expect(proxy[symbolProp]).toBe('symbol value');
    });
  });
});
