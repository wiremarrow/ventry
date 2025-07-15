/**
 * Cookie utilities for secure cookie management
 */

import type { FastifyReply } from 'fastify';
import { env, isProduction } from '../config/env.js';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number; // in seconds
  path?: string;
  domain?: string;
}

const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

/**
 * Set a cookie using Fastify's cookie plugin
 */
export function setCookie(
  reply: FastifyReply,
  name: string,
  value: string,
  options: CookieOptions = {}
) {
  const finalOptions = { ...DEFAULT_COOKIE_OPTIONS, ...options };
  
  // Fastify's setCookie method from @fastify/cookie plugin
  reply.setCookie(name, value, {
    httpOnly: finalOptions.httpOnly,
    secure: finalOptions.secure,
    sameSite: finalOptions.sameSite,
    maxAge: finalOptions.maxAge ? finalOptions.maxAge * 1000 : undefined, // Convert to milliseconds
    path: finalOptions.path,
    domain: finalOptions.domain,
    signed: true, // Use signed cookies for security
  });
}

/**
 * Clear a cookie
 */
export function clearCookie(
  reply: FastifyReply,
  name: string,
  options: CookieOptions = {}
) {
  reply.clearCookie(name, {
    path: options.path || '/',
    domain: options.domain,
  });
}

/**
 * Get a cookie value
 */
export function getCookie(request: any, name: string): string | undefined {
  return request.cookies[name];
}

/**
 * Get a signed cookie value (automatically verifies signature)
 */
export function getSignedCookie(request: any, name: string): string | undefined {
  return request.unsignCookie(request.cookies[name])?.value;
}

// Cookie names used in the application
export const COOKIE_NAMES = {
  AUTH_TOKEN: 'auth-token',
  REFRESH_TOKEN: 'refresh-token',
  SESSION_ID: 'session-id',
} as const;