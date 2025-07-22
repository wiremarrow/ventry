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

// Mock the CookieService
vi.mock('../../services/cookie-service.js', () => ({
  CookieService: {
    getAuthToken: vi.fn(),
  },
}));

// Import after mocking to ensure the module gets the mocked logger
import { getRawToken, extractAuthToken, type TokenExtractionResult } from './token-extractor.js';
import { COOKIE_NAMES } from './constants.js';
import { CookieService } from '../../services/cookie-service.js';

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
    
    // Reset CookieService mock
    vi.mocked(CookieService.getAuthToken).mockReturnValue(undefined);
  });

  describe('getRawToken', () => {
    it('should return undefined when no token is present', () => {
      const result = getRawToken(mockRequest);
      expect(result).toBeUndefined();
    });

    it('should extract and unsign a valid cookie token', () => {
      const unsignedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      
      vi.mocked(CookieService.getAuthToken).mockReturnValue(unsignedToken);

      const result = getRawToken(mockRequest);
      
      expect(result).toBe(unsignedToken);
      expect(CookieService.getAuthToken).toHaveBeenCalledWith(mockRequest);
    });

    it('should handle invalid signed cookies gracefully', () => {
      // CookieService returns undefined for invalid cookies
      vi.mocked(CookieService.getAuthToken).mockReturnValue(undefined);

      const result = getRawToken(mockRequest);
      
      expect(result).toBeUndefined();
      expect(CookieService.getAuthToken).toHaveBeenCalledWith(mockRequest);
    });

    it('should fall back to Authorization header when cookie is not present', () => {
      const bearerToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      mockRequest.headers.authorization = bearerToken;
      
      // CookieService returns undefined, so it falls back to header
      vi.mocked(CookieService.getAuthToken).mockReturnValue(undefined);

      const result = getRawToken(mockRequest);
      
      expect(result).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(CookieService.getAuthToken).toHaveBeenCalledWith(mockRequest);
    });

    it('should prefer cookie token over header token', () => {
      const cookieToken = 'cookie-token-value';
      const headerToken = 'header-token-value';
      
      mockRequest.headers.authorization = `Bearer ${headerToken}`;
      vi.mocked(CookieService.getAuthToken).mockReturnValue(cookieToken);

      const result = getRawToken(mockRequest);
      
      expect(result).toBe(cookieToken);
      expect(CookieService.getAuthToken).toHaveBeenCalledWith(mockRequest);
    });

    it('should handle cookie service errors gracefully', () => {
      // When CookieService.getAuthToken fails, it returns undefined
      vi.mocked(CookieService.getAuthToken).mockReturnValue(undefined);

      const result = getRawToken(mockRequest);
      
      expect(result).toBeUndefined();
      expect(CookieService.getAuthToken).toHaveBeenCalledWith(mockRequest);
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
      
      // CookieService returns undefined for requests without cookies
      vi.mocked(CookieService.getAuthToken).mockReturnValue(undefined);

      const result = getRawToken(bareRequest);
      
      expect(result).toBe('fallback-token');
      expect(CookieService.getAuthToken).toHaveBeenCalledWith(bareRequest);
    });

    it('should handle concurrent requests independently', () => {
      const request1 = {
        cookies: { [COOKIE_NAMES.AUTH_TOKEN]: 'token1' },
        headers: {},
      };

      const request2 = {
        cookies: { [COOKIE_NAMES.AUTH_TOKEN]: 'token2' },
        headers: {},
      };

      // Mock different return values for each request
      vi.mocked(CookieService.getAuthToken)
        .mockReturnValueOnce('user1-token')
        .mockReturnValueOnce('user2-token');

      const result1 = getRawToken(request1);
      const result2 = getRawToken(request2);
      
      expect(result1).toBe('user1-token');
      expect(result2).toBe('user2-token');
      expect(CookieService.getAuthToken).toHaveBeenCalledWith(request1);
      expect(CookieService.getAuthToken).toHaveBeenCalledWith(request2);
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