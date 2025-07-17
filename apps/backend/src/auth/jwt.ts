import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthError } from '../lib/auth/auth-error.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('jwt');
const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;

export interface JWTPayload {
  userId: string;
  organizationId?: string;
  // Optional advisory claims - not used for authorization
  email?: string;
  role?: string;
}

export interface JWTVerifyResult {
  userId: string;
  organizationId?: string;
}

export function signJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

/**
 * Verifies a JWT token and returns the user information
 * @param token - The JWT token to verify
 * @returns The verified user information (userId and optional organizationId)
 * @throws AuthError with specific error codes:
 *   - NO_TOKEN: Token is missing or empty
 *   - EXPIRED: Token has expired
 *   - INVALID_SIGNATURE: Token signature is invalid
 *   - MALFORMED: Token is malformed or payload is invalid
 */
export function verifyJwt(token: string): JWTVerifyResult {
  // Check for missing token
  if (!token) {
    logger.warn('JWT verification attempted with no token');
    throw new AuthError('NO_TOKEN', 'UNAUTHORIZED');
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Validate payload structure
    if (!payload || typeof payload !== 'object' || !payload.userId) {
      logger.warn({ payload }, 'Invalid JWT payload structure');
      throw new AuthError('MALFORMED', 'UNAUTHORIZED');
    }
    
    // Return only the necessary fields
    const result: JWTVerifyResult = {
      userId: payload.userId,
    };
    
    if (payload.organizationId) {
      result.organizationId = payload.organizationId;
    }
    
    return result;
  } catch (error) {
    // If it's already an AuthError, re-throw it
    if (error instanceof AuthError) {
      throw error;
    }
    
    // Handle specific JWT errors
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug({ error }, 'JWT token expired');
      throw new AuthError('EXPIRED', 'UNAUTHORIZED', error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.debug({ error }, 'JWT verification failed');
      throw new AuthError('INVALID_SIGNATURE', 'UNAUTHORIZED', error);
    } else if (error instanceof jwt.NotBeforeError) {
      logger.debug({ error }, 'JWT not yet active');
      throw new AuthError('MALFORMED', 'UNAUTHORIZED', error);
    }
    
    // Handle any other errors
    logger.error({ error }, 'Unexpected error during JWT verification');
    throw new AuthError('MALFORMED', 'UNAUTHORIZED', error as Error);
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use verifyJwt instead
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const result = verifyJwt(token);
    // For backward compatibility, we need to return the full payload
    // This requires re-verifying to get all fields
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}