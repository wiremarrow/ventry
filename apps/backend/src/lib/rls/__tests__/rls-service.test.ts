import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setRLSContext, clearRLSContext, withRLS, validateRLSConfiguration } from '../rls-service.js';
import { type ValidatedRLSContext, type RLSContext } from '../types.js';
import { RLS_ERRORS } from '../constants.js';

// Mock Prisma
const mockExecuteRawUnsafe = vi.fn();
const mockQueryRaw = vi.fn();
const mockTransaction = vi.fn();

const mockPrisma = {
  $executeRawUnsafe: mockExecuteRawUnsafe,
  $queryRaw: mockQueryRaw,
  $transaction: mockTransaction,
};

const mockTx = {
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

      expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
      expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
        'SET LOCAL app.current_organization_id = $1',
        'clh3sa7gu0000qzrmn831i7rn'
      );
    });

    it('should set both organization and user ID when provided', async () => {
      const context: ValidatedRLSContext = {
        organizationId: 'clh3sa7gu0000qzrmn831i7rn',
        userId: 'clh3sa7gu0000qzrmn831i7ro',
        bypassRLS: false,
      };

      await setRLSContext(mockTx as any, context);

      expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2);
      expect(mockExecuteRawUnsafe).toHaveBeenNthCalledWith(
        1,
        'SET LOCAL app.current_organization_id = $1',
        'clh3sa7gu0000qzrmn831i7rn'
      );
      expect(mockExecuteRawUnsafe).toHaveBeenNthCalledWith(
        2,
        'SET LOCAL app.current_user_id = $1',
        'clh3sa7gu0000qzrmn831i7ro'
      );
    });

    it('should throw error if setting session variables fails', async () => {
      const context: ValidatedRLSContext = {
        organizationId: 'clh3sa7gu0000qzrmn831i7rn',
        bypassRLS: false,
      };

      mockExecuteRawUnsafe.mockRejectedValue(new Error('Database error'));

      await expect(setRLSContext(mockTx as any, context)).rejects.toThrow(
        RLS_ERRORS.SESSION_VAR_FAILED
      );
    });
  });

  describe('clearRLSContext', () => {
    it('should reset session variables', async () => {
      await clearRLSContext(mockTx as any);

      expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(2);
      expect(mockExecuteRawUnsafe).toHaveBeenNthCalledWith(
        1,
        'RESET app.current_organization_id'
      );
      expect(mockExecuteRawUnsafe).toHaveBeenNthCalledWith(
        2,
        'RESET app.current_user_id'
      );
    });

    it('should not throw if clearing fails', async () => {
      mockExecuteRawUnsafe.mockRejectedValue(new Error('Database error'));

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
      
      expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
        'SET LOCAL app.current_organization_id = $1',
        context.organizationId
      );
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
      expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
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
          { routine_name: 'current_organization_id' },
          { routine_name: 'current_user_id' },
        ])
        .mockResolvedValueOnce([
          { relname: 'items', relrowsecurity: true },
          { relname: 'orders', relrowsecurity: true },
          { relname: 'inventory', relrowsecurity: true },
        ]);

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
          { routine_name: 'current_organization_id' },
          { routine_name: 'current_user_id' },
        ])
        .mockResolvedValueOnce([
          { relname: 'items', relrowsecurity: false },
          { relname: 'orders', relrowsecurity: true },
          { relname: 'inventory', relrowsecurity: true },
        ]);

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