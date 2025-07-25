/**
 * Authentication error constants for consistent error handling across the application
 */

export const AUTH_ERRORS = {
  NO_TOKEN: {
    code: 'UNAUTHORIZED' as const,
    message: 'Authentication required',
  },
  INVALID_TOKEN: {
    code: 'UNAUTHORIZED' as const,
    message: 'Invalid authentication token',
  },
  EXPIRED_TOKEN: {
    code: 'UNAUTHORIZED' as const,
    message: 'Your session has expired. Please login again.',
  },
  MALFORMED_TOKEN: {
    code: 'UNAUTHORIZED' as const,
    message: 'Malformed authentication token',
  },
  NO_ORGANIZATION: {
    code: 'BAD_REQUEST' as const,
    message: 'No organization selected. Please select an organization to continue.',
  },
  INVALID_ORGANIZATION: {
    code: 'FORBIDDEN' as const,
    message: 'Invalid organization access',
  },
  INSUFFICIENT_PERMISSIONS: {
    code: 'FORBIDDEN' as const,
    message: 'Insufficient permissions for this operation',
  },
  INVALID_SIGNATURE: {
    code: 'UNAUTHORIZED' as const,
    message: 'Invalid token signature',
  },
} as const;

export type AuthErrorCode = (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS]['code'];
export type AuthErrorKey = keyof typeof AUTH_ERRORS;

/**
 * RLS bypass reasons for audit logging
 */
export const RLS_BYPASS_REASONS = {
  PUBLIC_ENDPOINT: 'Public endpoint - no auth required',
  AUTH_VERIFICATION: 'Authentication verification',
  SYSTEM_HEALTH_CHECK: 'System health check',
  DATABASE_MIGRATION: 'Database migration',
  AUDIT_LOG_WRITE: 'Audit log write operation',
  ORGANIZATION_VERIFICATION: 'Organization membership verification',
} as const;

export type RLSBypassReason = (typeof RLS_BYPASS_REASONS)[keyof typeof RLS_BYPASS_REASONS];

/**
 * Cookie names used in the application
 */
export const COOKIE_NAMES = {
  AUTH_TOKEN: 'auth-token',
  ACTIVE_ORGANIZATION: 'active-organization',
  REFRESH_TOKEN: 'refresh-token',
  SESSION_ID: 'session-id',
} as const;

export type CookieName = (typeof COOKIE_NAMES)[keyof typeof COOKIE_NAMES];
