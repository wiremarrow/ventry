import { describe, it, expect } from 'vitest';
import {
  cuidSchema,
  rlsContextSchema,
  validatedRLSContextSchema,
  rlsBypassContextSchema,
  isValidatedContext,
  isBypassContext,
  validateRLSContext,
  sanitizeSessionValue,
  type RLSContext,
  type ValidatedRLSContext,
  type RLSBypassContext,
} from '../types.js';
import { RLS_ERRORS } from '../constants.js';

describe('RLS Types', () => {
  describe('cuidSchema', () => {
    it('should validate valid CUID', () => {
      const validCuid = 'clh3sa7gu0000qzrmn831i7rn';
      const result = cuidSchema.safeParse(validCuid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid CUID', () => {
      const invalidCuids = [
        'short',
        'this-is-way-too-long-to-be-a-valid-cuid-format',
        'UPPERCASE-NOT-ALLOWED-IN-CUID',
        'special-chars-not-allowed!',
        '',
        null,
        undefined,
        123,
      ];

      invalidCuids.forEach((invalid) => {
        const result = cuidSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('validateRLSContext', () => {
    it('should validate normal context with organization ID', () => {
      const context: RLSContext = {
        organizationId: 'clh3sa7gu0000qzrmn831i7rn',
        userId: 'clh3sa7gu0000qzrmn831i7ro',
        bypassRLS: false,
      };

      const result = validateRLSContext(context);
      expect(isValidatedContext(result)).toBe(true);
      expect((result as ValidatedRLSContext).organizationId).toBe(context.organizationId);
    });

    it('should validate bypass context', () => {
      const context: RLSContext = {
        bypassRLS: true,
        bypassReason: 'System maintenance operation',
      };

      const result = validateRLSContext(context);
      expect(isBypassContext(result)).toBe(true);
      expect((result as RLSBypassContext).bypassReason).toBe(context.bypassReason);
    });

    it('should reject context without organization ID when not bypassing', () => {
      const context: RLSContext = {
        userId: 'clh3sa7gu0000qzrmn831i7ro',
        bypassRLS: false,
      };

      expect(() => validateRLSContext(context)).toThrow(RLS_ERRORS.MISSING_ORG_CONTEXT);
    });

    it('should reject bypass context without reason', () => {
      const context: RLSContext = {
        bypassRLS: true,
      };

      expect(() => validateRLSContext(context)).toThrow('Invalid RLS bypass context');
    });

    it('should reject invalid organization ID format', () => {
      const context: RLSContext = {
        organizationId: 'invalid-id-format',
        bypassRLS: false,
      };

      expect(() => validateRLSContext(context)).toThrow('Invalid RLS context');
    });
  });

  describe('Type Guards', () => {
    describe('isValidatedContext', () => {
      it('should return true for valid context', () => {
        const context: ValidatedRLSContext = {
          organizationId: 'clh3sa7gu0000qzrmn831i7rn',
          bypassRLS: false,
        };

        expect(isValidatedContext(context)).toBe(true);
      });

      it('should return false for bypass context', () => {
        const context: RLSBypassContext = {
          bypassRLS: true,
          bypassReason: 'Test',
        };

        expect(isValidatedContext(context)).toBe(false);
      });

      it('should return false for invalid organization ID', () => {
        const context = {
          organizationId: 'invalid',
          bypassRLS: false,
        };

        expect(isValidatedContext(context)).toBe(false);
      });
    });

    describe('isBypassContext', () => {
      it('should return true for bypass context', () => {
        const context: RLSBypassContext = {
          bypassRLS: true,
          bypassReason: 'Test operation',
        };

        expect(isBypassContext(context)).toBe(true);
      });

      it('should return false for normal context', () => {
        const context: ValidatedRLSContext = {
          organizationId: 'clh3sa7gu0000qzrmn831i7rn',
          bypassRLS: false,
        };

        expect(isBypassContext(context)).toBe(false);
      });

      it('should return false for bypass without reason', () => {
        const context = {
          bypassRLS: true,
        };

        expect(isBypassContext(context)).toBe(false);
      });
    });
  });

  describe('sanitizeSessionValue', () => {
    it('should accept valid CUID', () => {
      const validCuid = 'clh3sa7gu0000qzrmn831i7rn';
      const result = sanitizeSessionValue(validCuid);
      expect(result).toBe(validCuid);
    });

    it('should reject values that are too long', () => {
      const longValue = 'a'.repeat(51);
      expect(() => sanitizeSessionValue(longValue)).toThrow('Session variable value too long');
    });

    it('should reject invalid format', () => {
      const invalidValues = [
        'has-special-chars!',
        'UPPERCASE',
        'spaces not allowed',
        '../path/injection',
        "'; DROP TABLE items; --",
      ];

      invalidValues.forEach((invalid) => {
        expect(() => sanitizeSessionValue(invalid)).toThrow(
          'Invalid session variable value format'
        );
      });
    });
  });
});
