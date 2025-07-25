/**
 * RLS (Row-Level Security) Constants
 *
 * This file contains all constants used in the RLS implementation
 * to ensure consistency and prevent magic strings throughout the codebase.
 */

/**
 * PostgreSQL session variable names used for RLS context
 */
export const RLS_SESSION_VARS = {
  ORGANIZATION_ID: 'app.current_organization_id',
  USER_ID: 'app.current_user_id',
} as const;

/**
 * RLS policy names for different tables
 */
export const RLS_POLICIES = {
  TENANT_ISOLATION: 'tenant_isolation_policy',
  USER_VIEW_OWN_ORGS: 'users_view_own_organizations',
  USER_MANAGE_OWNED_ORGS: 'users_manage_owned_organizations',
  INDIRECT_TENANT_ISOLATION: 'indirect_tenant_isolation_policy',
} as const;

/**
 * RLS function names in the database
 */
export const RLS_FUNCTIONS = {
  CURRENT_ORG_ID: 'current_organization_id',
  CURRENT_USER_ID: 'current_user_id',
  IS_ORG_MEMBER: 'is_organization_member',
} as const;

/**
 * Error messages for RLS operations
 */
export const RLS_ERRORS = {
  INVALID_ORG_ID: 'Invalid organization ID format',
  INVALID_USER_ID: 'Invalid user ID format',
  MISSING_ORG_CONTEXT: 'Organization context is required for this operation',
  MISSING_USER_CONTEXT: 'User context is required for this operation',
  BYPASS_NOT_ALLOWED: 'RLS bypass is not allowed in production',
  SESSION_VAR_FAILED: 'Failed to set RLS session variables',
  POLICY_VIOLATION: 'Row-level security policy violation',
} as const;

/**
 * Regular expression for validating CUID format
 * CUIDs are 25 characters long and contain only lowercase letters and numbers
 */
export const CUID_REGEX = /^[0-9a-z]{25}$/;

/**
 * Maximum length for session variable values to prevent injection
 */
export const MAX_SESSION_VAR_LENGTH = 50;

/**
 * Audit event types for RLS operations
 */
export const RLS_AUDIT_EVENTS = {
  BYPASS_REQUESTED: 'rls.bypass_requested',
  BYPASS_GRANTED: 'rls.bypass_granted',
  BYPASS_DENIED: 'rls.bypass_denied',
  CONTEXT_SET: 'rls.context_set',
  CONTEXT_CLEARED: 'rls.context_cleared',
  VALIDATION_FAILED: 'rls.validation_failed',
} as const;

/**
 * Performance monitoring metrics
 */
export const RLS_METRICS = {
  CONTEXT_SET_DURATION: 'rls.context_set.duration',
  QUERY_DURATION: 'rls.query.duration',
  BYPASS_COUNT: 'rls.bypass.count',
  VALIDATION_ERROR_COUNT: 'rls.validation_error.count',
} as const;
