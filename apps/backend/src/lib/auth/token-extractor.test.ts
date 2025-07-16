import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest } from 'fastify';

// Hoist a shared logger instance so the mock factory can access it
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the logger module to always return the same instance
vi.mock('../logger.js', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

// Import after mocking to ensure the module gets the mocked logger
import { getRawToken, extractAuthToken, type TokenExtractionResult } from './token-extractor.js';
import { COOKIE_NAMES } from './constants.js';

describe('Token Extractor', () => {
  let mockRequest: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock request with cookies and headers
    mockRequest = {
      cookies: {},
      headers: {},
      unsignCookie: vi.fn(),
    };
  });

  describe('getRawToken', () => {
    it('should return undefined when no token is present', () => {
      const result = getRawToken(mockRequest);
      expect(result).toBeUndefined();
    });

    it('should extract and unsign a valid cookie token', () => {
      const signedToken = 's:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.signature';
      const unsignedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      
      mockRequest.cookies[COOKIE_NAMES.AUTH_TOKEN] = signedToken;
      mockRequest.unsignCookie.mockReturnValue({
        valid: true,
        value: unsignedToken,
      });

      const result = getRawToken(mockRequest);
      
      expect(result).toBe(unsignedToken);
      expect(mockRequest.unsignCookie).toHaveBeenCalledWith(signedToken);
    });

    it('should handle invalid signed cookies gracefully', () => {
      const invalidSignedToken = 'invalid-signed-token';
      
      mockRequest.cookies[COOKIE_NAMES.AUTH_TOKEN] = invalidSignedToken;
      mockRequest.unsignCookie.mockReturnValue({
        valid: false,
        value: null,
      });

      const result = getRawToken(mockRequest);
      
      expect(result).toBeUndefined();
      expect(mockRequest.unsignCookie).toHaveBeenCalledWith(invalidSignedToken);
    });

    it('should fall back to Authorization header when cookie is not present', () => {
      const bearerToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      mockRequest.headers.authorization = bearerToken;

      const result = getRawToken(mockRequest);
      
      expect(result).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(mockRequest.unsignCookie).not.toHaveBeenCalled();
    });

    it('should prefer cookie token over header token', () => {
      const cookieToken = 'cookie-token-value';
      const headerToken = 'header-token-value';
      
      mockRequest.cookies[COOKIE_NAMES.AUTH_TOKEN] = 's:' + cookieToken;
      mockRequest.headers.authorization = `Bearer ${headerToken}`;
      mockRequest.unsignCookie.mockReturnValue({
        valid: true,
        value: cookieToken,
      });

      const result = getRawToken(mockRequest);
      
      expect(result).toBe(cookieToken);
    });

    it('should handle unsignCookie throwing an error', () => {
      mockRequest.cookies[COOKIE_NAMES.AUTH_TOKEN] = 'malformed-cookie';
      mockRequest.unsignCookie.mockImplementation(() => {
        throw new TypeError('Signed cookie string must be provided.');
      });

      const result = getRawToken(mockRequest);
      
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(TypeError),
          cookieName: COOKIE_NAMES.AUTH_TOKEN,
        }),
        'Failed to unsign cookie'
      );
    });

    it('should handle Authorization header with lowercase "bearer"', () => {
      mockRequest.headers.authorization = 'bearer token123';

      const result = getRawToken(mockRequest);
      
      expect(result).toBe('token123');
    });

    it('should handle malformed Authorization header', () => {
      mockRequest.headers.authorization = 'InvalidFormat token123';

      const result = getRawToken(mockRequest);
      
      expect(result).toBeUndefined();
    });

    it('should handle empty Authorization header', () => {
      mockRequest.headers.authorization = '';

      const result = getRawToken(mockRequest);
      
      expect(result).toBeUndefined();
    });

    it('should handle Bearer token with extra spaces', () => {
      mockRequest.headers.authorization = 'Bearer   token123';

      const result = getRawToken(mockRequest);
      
      expect(result).toBe('token123');
    });
  });

  describe('extractAuthToken', () => {
    it('should return detailed extraction result for cookie source', () => {
      const signedToken = 's:token123.signature';
      const unsignedToken = 'token123';
      
      mockRequest.cookies[COOKIE_NAMES.AUTH_TOKEN] = signedToken;
      mockRequest.unsignCookie.mockReturnValue({
        valid: true,
        value: unsignedToken,
      });

      const result = extractAuthToken(mockRequest);
      
      expect(result).toEqual({
        token: unsignedToken,
        source: 'cookie',
        metadata: {
          cookieSigned: true,
        },
      });
    });

    it('should return detailed extraction result for header source', () => {
      mockRequest.headers.authorization = 'Bearer headertoken123';

      const result = extractAuthToken(mockRequest);
      
      expect(result).toEqual({
        token: 'headertoken123',
        source: 'header',
        metadata: {
          headerFormat: 'Bearer',
        },
      });
    });

    it('should return no token with error details when extraction fails', () => {
      mockRequest.cookies[COOKIE_NAMES.AUTH_TOKEN] = 'bad-cookie';
      mockRequest.unsignCookie.mockImplementation(() => {
        throw new Error('Cookie unsigning failed');
      });

      const result = extractAuthToken(mockRequest);
      
      expect(result).toEqual({
        source: 'none',
        error: 'Failed to extract token: Cookie unsigning failed',
      });
    });

    it('should handle missing cookies object gracefully', () => {
      delete mockRequest.cookies;

      const result = extractAuthToken(mockRequest);
      
      expect(result).toEqual({
        source: 'none',
      });
    });

    it('should handle null cookies value', () => {
      mockRequest.cookies[COOKIE_NAMES.AUTH_TOKEN] = null;

      const result = extractAuthToken(mockRequest);
      
      expect(result).toEqual({
        source: 'none',
      });
    });

    it('should handle undefined cookies value', () => {
      mockRequest.cookies[COOKIE_NAMES.AUTH_TOKEN] = undefined;

      const result = extractAuthToken(mockRequest);
      
      expect(result).toEqual({
        source: 'none',
      });
    });

    it('should track failed cookie validation', () => {
      mockRequest.cookies[COOKIE_NAMES.AUTH_TOKEN] = 'signed-token';
      mockRequest.unsignCookie.mockReturnValue({
        valid: false,
        value: null,
      });

      const result = extractAuthToken(mockRequest);
      
      expect(result).toEqual({
        source: 'none',
        error: 'Invalid cookie signature',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle request without cookies plugin', () => {
      const bareRequest = {
        headers: {
          authorization: 'Bearer fallback-token',
        },
      } as any;

      const result = getRawToken(bareRequest);
      
      expect(result).toBe('fallback-token');
    });

    it('should handle concurrent requests independently', () => {
      const request1 = {
        cookies: { [COOKIE_NAMES.AUTH_TOKEN]: 'token1' },
        headers: {},
        unsignCookie: vi.fn().mockReturnValue({ valid: true, value: 'user1-token' }),
      };

      const request2 = {
        cookies: { [COOKIE_NAMES.AUTH_TOKEN]: 'token2' },
        headers: {},
        unsignCookie: vi.fn().mockReturnValue({ valid: true, value: 'user2-token' }),
      };

      const result1 = getRawToken(request1);
      const result2 = getRawToken(request2);
      
      expect(result1).toBe('user1-token');
      expect(result2).toBe('user2-token');
      expect(request1.unsignCookie).not.toHaveBeenCalledWith('token2');
      expect(request2.unsignCookie).not.toHaveBeenCalledWith('token1');
    });

    it('should handle very long tokens', () => {
      const longToken = 'a'.repeat(1000);
      mockRequest.headers.authorization = `Bearer ${longToken}`;

      const result = getRawToken(mockRequest);
      
      expect(result).toBe(longToken);
    });

    it('should handle special characters in tokens', () => {
      const specialToken = 'token-with_special.characters/+=';
      mockRequest.headers.authorization = `Bearer ${specialToken}`;

      const result = getRawToken(mockRequest);
      
      expect(result).toBe(specialToken);
    });
  });
});