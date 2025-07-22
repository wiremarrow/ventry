import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setRLSContext, clearRLSContext, withRLS, validateRLSConfiguration } from '../rls-service.js';
import { type ValidatedRLSContext, type RLSContext } from '../types.js';
import { RLS_ERRORS } from '../constants.js';

// Mock Prisma
const mockExecuteRaw = vi.fn();
const mockExecuteRawUnsafe = vi.fn();
const mockQueryRaw = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  $executeRaw: mockExecuteRaw,
  $executeRawUnsafe: mockExecuteRawUnsafe,
  $queryRaw: mockQueryRaw,
  $transaction: mockTransaction,
};

const mockTx = {
  $executeRaw: mockExecuteRaw,
  $executeRawUnsafe: mockExecuteRawUnsafe,
  $queryRaw: mockQueryRaw,
};

// Mock logger
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('RLS Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setRLSContext', () => {
    it('should set organization ID in session', async () => {
      const context: ValidatedRLSContext = {
        organizationId: 'clh3sa7gu0000qzrmn831i7rn',
        bypassRLS: false,
      };

      await setRLSContext(mockTx as any, context);

      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      // Check that the tagged template was called with the right arguments
      const call = mockExecuteRaw.mock.calls[0];
      expect(call[0]).toEqual(expect.arrayContaining([
        expect.stringContaining('SELECT set_rls_context'),
      ]));
      expect(call[1]).toBe('clh3sa7gu0000qzrmn831i7rn');
      expect(call[2]).toBeUndefined();
    });

    it('should set both organization and user ID when provided', async () => {
      const context: ValidatedRLSContext = {
        organizationId: 'clh3sa7gu0000qzrmn831i7rn',
        userId: 'clh3sa7gu0000qzrmn831i7ro',
        bypassRLS: false,
      };

      await setRLSContext(mockTx as any, context);

      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      // The new implementation uses a single function call with both parameters
      const call = mockExecuteRaw.mock.calls[0];
      expect(call[0]).toEqual(expect.arrayContaining([
        expect.stringContaining('SELECT set_rls_context'),
      ]));
      expect(call[1]).toBe('clh3sa7gu0000qzrmn831i7rn');
      expect(call[2]).toBe('clh3sa7gu0000qzrmn831i7ro');
    });

    it('should throw error if setting session variables fails', async () => {
      const context: ValidatedRLSContext = {
        organizationId: 'clh3sa7gu0000qzrmn831i7rn',
        bypassRLS: false,
      };

      mockExecuteRaw.mockRejectedValue(new Error('Database error'));

      await expect(setRLSContext(mockTx as any, context)).rejects.toThrow(
        RLS_ERRORS.SESSION_VAR_FAILED
      );
    });
  });

  describe('clearRLSContext', () => {
    it('should reset session variables', async () => {
      await clearRLSContext(mockTx as any);

      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      const call = mockExecuteRaw.mock.calls[0];
      expect(call[0]).toEqual(expect.arrayContaining([
        expect.stringContaining('SELECT clear_rls_context'),
      ]));
    });

    it('should not throw if clearing fails', async () => {
      mockExecuteRaw.mockRejectedValue(new Error('Database error'));

      await expect(clearRLSContext(mockTx as any)).resolves.not.toThrow();
    });
  });

  describe('withRLS', () => {
    it('should execute operation with RLS context', async () => {
      const context: RLSContext = {
        organizationId: 'clh3sa7gu0000qzrmn831i7rn',
        userId: 'clh3sa7gu0000qzrmn831i7ro',
        bypassRLS: false,
      };

      const mockOperation = vi.fn().mockResolvedValue({ result: 'success' });
      
      mockTransaction.mockImplementation(async (fn) => {
        return fn(mockTx);
      });

      const result = await withRLS(mockPrisma as any, context, mockOperation);

      expect(result.data).toEqual({ result: 'success' });
      expect(result.context.organizationId).toBe(context.organizationId);
      expect(result.context.userId).toBe(context.userId);
      expect(result.context.bypassed).toBe(false);
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
      
      // Should call setRLSContext which uses $executeRaw
      expect(mockExecuteRaw).toHaveBeenCalled();
      const call = mockExecuteRaw.mock.calls[0];
      expect(call[0]).toEqual(expect.arrayContaining([
        expect.stringContaining('SELECT set_rls_context'),
      ]));
      expect(mockOperation).toHaveBeenCalledWith(mockTx);
    });

    it('should handle bypass context', async () => {
      const context: RLSContext = {
        bypassRLS: true,
        bypassReason: 'System maintenance',
      };

      const mockOperation = vi.fn().mockResolvedValue({ result: 'success' });
      
      mockTransaction.mockImplementation(async (fn) => {
        return fn(mockTx);
      });

      const result = await withRLS(mockPrisma as any, context, mockOperation);

      expect(result.data).toEqual({ result: 'success' });
      expect(result.context.bypassed).toBe(true);
      expect(mockExecuteRaw).not.toHaveBeenCalled();
    });

    it('should reject invalid context', async () => {
      const context: RLSContext = {
        organizationId: 'invalid-id',
      };

      const mockOperation = vi.fn();

      await expect(withRLS(mockPrisma as any, context, mockOperation)).rejects.toThrow(
        'Invalid RLS context'
      );
      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe('validateRLSConfiguration', () => {
    it('should return true when RLS is properly configured', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([
          { routine_name: 'set_rls_context' },
          { routine_name: 'clear_rls_context' },
          { routine_name: 'get_rls_context' },
          { routine_name: 'current_organization_id' },
          { routine_name: 'current_user_id' },
        ])
        .mockResolvedValueOnce([])  // SELECT set_rls_context
        .mockResolvedValueOnce([    // SELECT get_rls_context
          { organization_id: 'cjld2cjxh0000qzrmn831i7rn', user_id: 'cjld2cjxh0001qzrmn831i7ro' }
        ])
        .mockResolvedValueOnce([])  // SELECT clear_rls_context
        .mockResolvedValueOnce([
          { relname: 'items', relrowsecurity: true },
          { relname: 'orders', relrowsecurity: true },
          { relname: 'inventory', relrowsecurity: true },
        ]);

      mockTransaction.mockImplementation(async (fn) => {
        return fn(mockTx);
      });

      const result = await validateRLSConfiguration(mockPrisma as any);
      expect(result).toBe(true);
    });

    it('should return false when RLS functions are missing', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ routine_name: 'current_organization_id' }]);

      const result = await validateRLSConfiguration(mockPrisma as any);
      expect(result).toBe(false);
    });

    it('should return false when RLS is not enabled on tables', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([
          { routine_name: 'set_rls_context' },
          { routine_name: 'clear_rls_context' },
          { routine_name: 'get_rls_context' },
          { routine_name: 'current_organization_id' },
          { routine_name: 'current_user_id' },
        ])
        .mockResolvedValueOnce([])  // SELECT set_rls_context
        .mockResolvedValueOnce([    // SELECT get_rls_context
          { organization_id: 'cjld2cjxh0000qzrmn831i7rn', user_id: 'cjld2cjxh0001qzrmn831i7ro' }
        ])
        .mockResolvedValueOnce([])  // SELECT clear_rls_context
        .mockResolvedValueOnce([
          { relname: 'items', relrowsecurity: false },
          { relname: 'orders', relrowsecurity: true },
          { relname: 'inventory', relrowsecurity: true },
        ]);

      mockTransaction.mockImplementation(async (fn) => {
        return fn(mockTx);
      });

      const result = await validateRLSConfiguration(mockPrisma as any);
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockQueryRaw.mockRejectedValue(new Error('Database error'));

      const result = await validateRLSConfiguration(mockPrisma as any);
      expect(result).toBe(false);
    });
  });
});