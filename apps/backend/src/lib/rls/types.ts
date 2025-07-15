/**
 * RLS (Row-Level Security) Type Definitions
 * 
 * This file contains all TypeScript types and interfaces for the RLS implementation,
 * including validation functions and type guards.
 */

import { z } from 'zod';
import { CUID_REGEX, MAX_SESSION_VAR_LENGTH, RLS_ERRORS } from './constants.js';

/**
 * Zod schema for validating CUID format
 */
export const cuidSchema = z
  .string()
  .min(25)
  .max(25)
  .regex(CUID_REGEX, RLS_ERRORS.INVALID_ORG_ID);

/**
 * RLS Context containing user and organization information
 */
export interface RLSContext {
  /** User ID (CUID format) */
  userId?: string;
  /** Organization ID (CUID format) */
  organizationId?: string;
  /** Whether to bypass RLS (use with extreme caution) */
  bypassRLS?: boolean;
  /** Reason for bypassing RLS (required if bypassRLS is true) */
  bypassReason?: string;
}

/**
 * Validated RLS Context with guaranteed valid IDs
 */
export interface ValidatedRLSContext {
  userId?: string;
  organizationId: string;
  bypassRLS: false;
}

/**
 * RLS Bypass Context for system operations
 */
export interface RLSBypassContext {
  bypassRLS: true;
  bypassReason: string;
  /** Optional user ID for audit trail */
  auditUserId?: string;
}

/**
 * Combined type for all RLS contexts
 */
export type AnyRLSContext = ValidatedRLSContext | RLSBypassContext | RLSContext;

/**
 * Schema for validating RLS context
 */
export const rlsContextSchema = z.object({
  userId: cuidSchema.optional(),
  organizationId: cuidSchema.optional(),
  bypassRLS: z.boolean().optional().default(false),
  bypassReason: z.string().optional(),
});

/**
 * Schema for validated RLS context (stricter)
 */
export const validatedRLSContextSchema = z.object({
  userId: cuidSchema.optional(),
  organizationId: cuidSchema,
  bypassRLS: z.literal(false),
});

/**
 * Schema for RLS bypass context
 */
export const rlsBypassContextSchema = z.object({
  bypassRLS: z.literal(true),
  bypassReason: z.string().min(1).max(200),
  auditUserId: cuidSchema.optional(),
});

/**
 * Type guard to check if context is validated
 */
export function isValidatedContext(
  context: AnyRLSContext
): context is ValidatedRLSContext {
  return (
    !context.bypassRLS &&
    typeof context.organizationId === 'string' &&
    cuidSchema.safeParse(context.organizationId).success
  );
}

/**
 * Type guard to check if context is bypass
 */
export function isBypassContext(
  context: AnyRLSContext
): context is RLSBypassContext {
  return (
    context.bypassRLS === true &&
    typeof (context as RLSBypassContext).bypassReason === 'string'
  );
}

/**
 * Validates and sanitizes an RLS context
 */
export function validateRLSContext(
  context: RLSContext
): ValidatedRLSContext | RLSBypassContext {
  // Handle bypass context
  if (context.bypassRLS) {
    const result = rlsBypassContextSchema.safeParse(context);
    if (!result.success) {
      throw new Error(
        `Invalid RLS bypass context: ${result.error.errors
          .map((e) => e.message)
          .join(', ')}`
      );
    }
    return result.data;
  }

  // Validate normal context
  if (!context.organizationId) {
    throw new Error(RLS_ERRORS.MISSING_ORG_CONTEXT);
  }

  const result = validatedRLSContextSchema.safeParse(context);
  if (!result.success) {
    throw new Error(
      `Invalid RLS context: ${result.error.errors
        .map((e) => e.message)
        .join(', ')}`
    );
  }

  return result.data;
}

/**
 * Safely formats a value for use in SQL session variables
 * This function provides defense-in-depth security by:
 * 1. Validating the value is a proper CUID format
 * 2. Ensuring the value isn't too long
 * 3. Escaping any SQL special characters (even though CUIDs shouldn't contain them)
 */
export function sanitizeSessionValue(value: string): string {
  // Ensure the value is not too long
  if (value.length > MAX_SESSION_VAR_LENGTH) {
    throw new Error(
      `Session variable value too long: ${value.length} > ${MAX_SESSION_VAR_LENGTH}`
    );
  }

  // Ensure it's a valid CUID
  if (!CUID_REGEX.test(value)) {
    throw new Error(`Invalid session variable value format: ${value}`);
  }

  // Additional safety: escape single quotes (defense in depth)
  // Even though CUIDs should never contain quotes, this adds an extra layer of security
  const escaped = value.replace(/'/g, "''");

  return escaped;
}

/**
 * RLS operation result with timing information
 */
export interface RLSOperationResult<T> {
  data: T;
  timing: {
    contextSetMs: number;
    queryMs: number;
    totalMs: number;
  };
  context: {
    organizationId?: string;
    userId?: string;
    bypassed: boolean;
  };
}

/**
 * RLS audit log entry
 */
export interface RLSAuditEntry {
  timestamp: Date;
  event: string;
  userId?: string;
  organizationId?: string;
  bypassReason?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}