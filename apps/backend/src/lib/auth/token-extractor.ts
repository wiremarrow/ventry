/**
 * Token extraction utilities for secure authentication token handling
 * Provides safe extraction from cookies (with unsigning) and Authorization headers
 */

import type { FastifyRequest } from 'fastify';
import { COOKIE_NAMES } from './constants.js';
import { createLogger } from '../logger.js';
import { CookieService } from '../../services/cookie-service.js';

const logger = createLogger('token-extractor');

// Type for Fastify request with cookies plugin
interface FastifyRequestWithCookies extends FastifyRequest {
  cookies: { [cookieName: string]: string | undefined };
  unsignCookie: (value: string) =>
    | {
        valid: true;
        renew: boolean;
        value: string;
      }
    | {
        valid: false;
        renew: false;
        value: null;
      };
}

/**
 * Result of token extraction with metadata for debugging and analytics
 */
export interface TokenExtractionResult {
  token?: string;
  source: 'cookie' | 'header' | 'none';
  error?: string;
  metadata?: {
    cookieSigned?: boolean;
    headerFormat?: string;
  };
}

/**
 * Safely unsigns a cookie value without throwing exceptions
 * @param request - Fastify request with cookie plugin
 * @param cookieName - Name of the cookie to unsign
 * @returns Unsigned cookie value or undefined if invalid/missing
 */
function safeUnsignCookie(
  request: FastifyRequestWithCookies,
  cookieName: string
): string | undefined {
  try {
    const signedValue = request.cookies[cookieName];

    // Handle null, undefined, or empty cookie values
    if (!signedValue || typeof signedValue !== 'string') {
      return undefined;
    }

    const unsigned = request.unsignCookie(signedValue);

    if (!unsigned.valid || !unsigned.value) {
      logger.warn(
        { cookieName, reason: 'Invalid signature' },
        'Cookie signature validation failed'
      );
      return undefined;
    }

    return unsigned.value;
  } catch (error) {
    // Log the error but don't throw - return undefined to handle gracefully
    logger.warn({ error, cookieName }, 'Failed to unsign cookie');
    return undefined;
  }
}

/**
 * Extracts the raw authentication token from the request
 * Prioritizes secure httpOnly cookies over Authorization headers
 *
 * @param request - Fastify request object
 * @returns The raw token string or undefined if not found
 */
export function getRawToken(
  request: FastifyRequest | FastifyRequestWithCookies
): string | undefined {
  // Try to extract from cookie first (most secure)
  const cookieToken = CookieService.getAuthToken(request as FastifyRequest);
  if (cookieToken) {
    return cookieToken;
  }

  // Fallback to Authorization header for API clients
  const authHeader = request.headers.authorization;

  if (authHeader && typeof authHeader === 'string') {
    // Support both "Bearer" and "bearer" (case-insensitive)
    const bearerMatch = authHeader.match(/^bearer\s+(.+)$/i);

    if (bearerMatch && bearerMatch[1]) {
      // Trim any extra whitespace from the token
      return bearerMatch[1].trim();
    }
  }

  // No token found in either location
  return undefined;
}

/**
 * Extracts authentication token with detailed metadata
 * Provides information about the source and any errors for debugging
 *
 * @param request - Fastify request object
 * @returns Detailed extraction result with token, source, and metadata
 */
export function extractAuthToken(
  request: FastifyRequest | FastifyRequestWithCookies
): TokenExtractionResult {
  try {
    // Type guard to check if cookies plugin is available
    const hasCookies = 'cookies' in request && 'unsignCookie' in request;

    // Try cookie extraction first
    if (hasCookies) {
      const cookieName = COOKIE_NAMES.AUTH_TOKEN;
      const signedValue = (request as FastifyRequestWithCookies).cookies[cookieName];

      if (signedValue && typeof signedValue === 'string') {
        try {
          const unsigned = (request as FastifyRequestWithCookies).unsignCookie(signedValue);

          if (unsigned.valid && unsigned.value) {
            return {
              token: unsigned.value,
              source: 'cookie',
              metadata: {
                cookieSigned: true,
              },
            };
          } else {
            // Cookie exists but signature is invalid
            return {
              source: 'none',
              error: 'Invalid cookie signature',
            };
          }
        } catch (error) {
          // Cookie unsigning failed
          logger.warn({ error, cookieName }, 'Cookie unsigning failed');
          return {
            source: 'none',
            error: `Failed to extract token: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }
    }

    // Try Authorization header
    const authHeader = request.headers.authorization;

    if (authHeader && typeof authHeader === 'string') {
      const bearerMatch = authHeader.match(/^(bearer)\s+(.+)$/i);

      if (bearerMatch && bearerMatch[2]) {
        return {
          token: bearerMatch[2].trim(),
          source: 'header',
          metadata: {
            headerFormat: bearerMatch[1], // Preserve original case
          },
        };
      }
    }

    // No token found
    return {
      source: 'none',
    };
  } catch (error) {
    // Catch any unexpected errors
    logger.error({ error }, 'Unexpected error during token extraction');
    return {
      source: 'none',
      error: `Failed to extract token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
