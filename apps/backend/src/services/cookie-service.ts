import type { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../lib/logger.js';
import { 
  setCookie as baseSetCookie, 
  clearCookie as baseClearCookie, 
  getCookie as baseGetCookie,
  getSignedCookie as baseGetSignedCookie,
  type CookieOptions 
} from '../lib/cookies.js';

const logger = createLogger('cookie-service');

/**
 * Service for managing cookies in a consistent and secure way
 */
export class CookieService {
  static readonly COOKIE_NAMES = {
    AUTH_TOKEN: 'auth-token',
    ACTIVE_ORGANIZATION: 'active-organization',
    REFRESH_TOKEN: 'refresh-token',
    SESSION_ID: 'session-id',
  } as const;

  /**
   * Set a signed cookie
   */
  static setSignedCookie(res: FastifyReply, name: string, value: string, options?: CookieOptions): void {
    try {
      baseSetCookie(res, name, value, options);
      logger.debug({ cookieName: name }, 'Signed cookie set successfully');
    } catch (error) {
      logger.error({ error, cookieName: name }, 'Failed to set signed cookie');
      throw error;
    }
  }

  /**
   * Get a signed cookie value (automatically verifies signature)
   */
  static getSignedCookie(req: FastifyRequest, name: string): string | undefined {
    try {
      const cookieValue = req.cookies[name];
      if (!cookieValue) {
        logger.debug({ cookieName: name }, 'Cookie not found');
        return undefined;
      }

      const unsignedCookie = req.unsignCookie(cookieValue);
      if (!unsignedCookie || !unsignedCookie.valid) {
        logger.warn({ cookieName: name }, 'Invalid cookie signature');
        return undefined;
      }

      return unsignedCookie.value;
    } catch (error) {
      logger.error({ error, cookieName: name }, 'Failed to get signed cookie');
      return undefined;
    }
  }

  /**
   * Clear a cookie
   */
  static clearCookie(res: FastifyReply, name: string, options?: CookieOptions): void {
    try {
      baseClearCookie(res, name, options);
      logger.debug({ cookieName: name }, 'Cookie cleared successfully');
    } catch (error) {
      logger.error({ error, cookieName: name }, 'Failed to clear cookie');
      throw error;
    }
  }

  /**
   * Get a regular (unsigned) cookie value
   */
  static getCookie(req: FastifyRequest, name: string): string | undefined {
    return baseGetCookie(req, name);
  }

  /**
   * Set the active organization cookie
   */
  static setActiveOrganization(res: FastifyReply, organizationId: string): void {
    this.setSignedCookie(res, this.COOKIE_NAMES.ACTIVE_ORGANIZATION, organizationId, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
  }

  /**
   * Get the active organization from cookie
   */
  static getActiveOrganization(req: FastifyRequest): string | undefined {
    return this.getSignedCookie(req, this.COOKIE_NAMES.ACTIVE_ORGANIZATION);
  }

  /**
   * Clear the active organization cookie
   */
  static clearActiveOrganization(res: FastifyReply): void {
    this.clearCookie(res, this.COOKIE_NAMES.ACTIVE_ORGANIZATION);
  }

  /**
   * Set authentication token cookie
   */
  static setAuthToken(res: FastifyReply, token: string): void {
    this.setSignedCookie(res, this.COOKIE_NAMES.AUTH_TOKEN, token);
  }

  /**
   * Get authentication token from cookie
   */
  static getAuthToken(req: FastifyRequest): string | undefined {
    return this.getSignedCookie(req, this.COOKIE_NAMES.AUTH_TOKEN);
  }

  /**
   * Clear authentication token cookie
   */
  static clearAuthToken(res: FastifyReply): void {
    this.clearCookie(res, this.COOKIE_NAMES.AUTH_TOKEN);
  }

  /**
   * Clear all auth-related cookies
   */
  static clearAllAuthCookies(res: FastifyReply): void {
    this.clearAuthToken(res);
    this.clearActiveOrganization(res);
    this.clearCookie(res, this.COOKIE_NAMES.REFRESH_TOKEN);
    this.clearCookie(res, this.COOKIE_NAMES.SESSION_ID);
    logger.info('All auth cookies cleared');
  }

  /**
   * Check if a signed cookie string has been provided (for error handling)
   */
  static isCookieSignatureError(error: unknown): boolean {
    return error instanceof Error && 
           error.message.toLowerCase().includes('signed cookie string must be provided');
  }
}