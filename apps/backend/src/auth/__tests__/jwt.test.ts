import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthError } from '../../lib/auth/auth-error.js';

// Mock dependencies before importing the module under test
vi.mock('jsonwebtoken');
vi.mock('../../lib/logger.js', () => ({
  createLogger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));
vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
    JWT_EXPIRES_IN: '7d',
  },
}));

// Import after mocking
import { signJWT, verifyJwt, verifyJWT, type JWTPayload, type JWTVerifyResult } from '../jwt.js';
import { env } from '../../config/env.js';

describe('JWT Utilities', () => {
  const mockSecret = 'test-secret-key';
  const mockExpiresIn = '7d';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signJWT', () => {
    it('should sign a JWT with the provided payload', () => {
      const payload: JWTPayload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'USER',
        organizationId: 'org-456',
      };

      const mockToken = 'signed.jwt.token';
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

      const result = signJWT(payload);

      expect(result).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(payload, mockSecret, { expiresIn: mockExpiresIn });
    });

    it('should sign a JWT without organizationId', () => {
      const payload: JWTPayload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      };

      const mockToken = 'signed.jwt.token';
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

      const result = signJWT(payload);

      expect(result).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(payload, mockSecret, { expiresIn: mockExpiresIn });
    });
  });

  describe('verifyJwt', () => {
    it('should successfully verify a valid token', () => {
      const mockPayload: JWTPayload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'USER',
        organizationId: 'org-456',
      };

      vi.mocked(jwt.verify).mockReturnValue(mockPayload as any);

      const result = verifyJwt('valid.jwt.token');

      expect(result).toEqual({
        userId: 'test-user-123',
        organizationId: 'org-456',
      });
      expect(jwt.verify).toHaveBeenCalledWith('valid.jwt.token', mockSecret);
    });

    it('should extract userId and organizationId from valid token', () => {
      const mockPayload: JWTPayload = {
        userId: 'user-789',
        email: 'user@example.com',
        role: 'ADMIN',
        organizationId: 'org-999',
      };

      vi.mocked(jwt.verify).mockReturnValue(mockPayload as any);

      const result = verifyJwt('valid.jwt.token');

      expect(result).toEqual({
        userId: 'user-789',
        organizationId: 'org-999',
      });
    });

    it('should return only userId when organizationId is not present', () => {
      const mockPayload: JWTPayload = {
        userId: 'user-111',
        email: 'user@example.com',
        role: 'USER',
      };

      vi.mocked(jwt.verify).mockReturnValue(mockPayload as any);

      const result = verifyJwt('valid.jwt.token');

      expect(result).toEqual({
        userId: 'user-111',
      });
    });

    it('should throw EXPIRED error for expired tokens', () => {
      const expiredError = new jwt.TokenExpiredError('jwt expired', new Date());
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw expiredError;
      });

      expect(() => verifyJwt('expired.jwt.token')).toThrow(AuthError);

      try {
        verifyJwt('expired.jwt.token');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AuthError);
        expect(error.message).toBe('EXPIRED');
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw INVALID_SIGNATURE error for tampered tokens', () => {
      const invalidSignatureError = new jwt.JsonWebTokenError('invalid signature');
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw invalidSignatureError;
      });

      expect(() => verifyJwt('tampered.jwt.token')).toThrow(AuthError);

      try {
        verifyJwt('tampered.jwt.token');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AuthError);
        expect(error.message).toBe('INVALID_SIGNATURE');
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw INVALID_SIGNATURE error for malformed tokens', () => {
      const malformedError = new jwt.JsonWebTokenError('jwt malformed');
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw malformedError;
      });

      expect(() => verifyJwt('malformed.jwt.token')).toThrow(AuthError);

      try {
        verifyJwt('malformed.jwt.token');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AuthError);
        expect(error.message).toBe('INVALID_SIGNATURE');
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw MALFORMED error for other JWT errors', () => {
      const notBeforeError = new jwt.NotBeforeError('jwt not active', new Date());
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw notBeforeError;
      });

      expect(() => verifyJwt('not-active.jwt.token')).toThrow(AuthError);

      try {
        verifyJwt('not-active.jwt.token');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AuthError);
        expect(error.message).toBe('MALFORMED');
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw MALFORMED error for non-JWT errors', () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      expect(() => verifyJwt('invalid.jwt.token')).toThrow(AuthError);

      try {
        verifyJwt('invalid.jwt.token');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AuthError);
        expect(error.message).toBe('MALFORMED');
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw NO_TOKEN error for empty token', () => {
      expect(() => verifyJwt('')).toThrow(AuthError);

      try {
        verifyJwt('');
      } catch (error: any) {
        expect(error).toBeInstanceOf(AuthError);
        expect(error.message).toBe('NO_TOKEN');
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw NO_TOKEN error for null/undefined token', () => {
      expect(() => verifyJwt(null as any)).toThrow(AuthError);
      expect(() => verifyJwt(undefined as any)).toThrow(AuthError);
    });

    it('should handle tokens with special characters', () => {
      const mockPayload: JWTPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'USER',
      };

      vi.mocked(jwt.verify).mockReturnValue(mockPayload as any);

      const specialToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = verifyJwt(specialToken);

      expect(result).toEqual({
        userId: 'user-123',
      });
    });

    it('should handle payload without userId gracefully', () => {
      const invalidPayload = {
        email: 'test@example.com',
        role: 'USER',
      };

      vi.mocked(jwt.verify).mockReturnValue(invalidPayload as any);

      expect(() => verifyJwt('invalid.jwt.token')).toThrow(AuthError);
    });
  });

  describe('verifyJWT (legacy)', () => {
    it('should return full payload for valid token', () => {
      const mockPayload: JWTPayload = {
        userId: 'test-user-123',
        email: 'test@example.com',
        role: 'USER',
        organizationId: 'org-456',
      };

      vi.mocked(jwt.verify).mockReturnValue(mockPayload as any);

      const result = verifyJWT('valid.jwt.token');

      expect(result).toEqual(mockPayload);
    });

    it('should return null for invalid token', () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      const result = verifyJWT('invalid.jwt.token');

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle very long tokens', () => {
      const longPayload: JWTPayload = {
        userId: 'user-' + 'x'.repeat(1000),
        email: 'test@example.com',
        role: 'USER',
      };

      vi.mocked(jwt.verify).mockReturnValue(longPayload as any);

      const result = verifyJwt('long.jwt.token');

      expect(result.userId).toHaveLength(1005);
    });

    it('should handle concurrent verification calls', () => {
      const payload1: JWTPayload = {
        userId: 'user-1',
        email: 'user1@example.com',
        role: 'USER',
      };

      const payload2: JWTPayload = {
        userId: 'user-2',
        email: 'user2@example.com',
        role: 'ADMIN',
        organizationId: 'org-2',
      };

      vi.mocked(jwt.verify)
        .mockReturnValueOnce(payload1 as any)
        .mockReturnValueOnce(payload2 as any);

      const result1 = verifyJwt('token1');
      const result2 = verifyJwt('token2');

      expect(result1).toEqual({ userId: 'user-1' });
      expect(result2).toEqual({ userId: 'user-2', organizationId: 'org-2' });
    });
  });
});
