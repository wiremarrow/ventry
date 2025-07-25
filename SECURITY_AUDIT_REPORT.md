# Security Audit Report: tRPC/Supabase Authentication & RLS Implementation

**Date:** January 16, 2025  
**Auditor:** Senior Backend Architect & Security Engineer  
**Scope:** Authentication flow, Row-Level Security (RLS), JWT handling, and error management

## Executive Summary

This audit reveals several critical security vulnerabilities and architectural inconsistencies in the authentication and RLS implementation. The most significant findings include:

1. **Critical:** Unhandled exceptions in cookie unsigning could crash the authentication flow
2. **High:** No differentiation between expired and invalid JWT tokens
3. **Medium:** Over-use of RLS bypass without proper auditing
4. **Low:** Inconsistent error messages across the application

## 1. End-to-End Authentication Flow Analysis

### 1.1 Cookie Parsing & Unsigning Vulnerabilities

**Finding:** The `unsignCookie` method is called without error handling in multiple locations.

**Location:** `/apps/backend/src/trpc/context.ts:35,71`

```typescript
// VULNERABLE CODE
const cookieToken = authCookie ? request.unsignCookie(authCookie)?.value : undefined;
```

**Risk:** If `unsignCookie` throws an exception (e.g., malformed cookie), the entire context creation fails with a 500 error instead of treating it as an authentication failure.

**Recommendation:** Wrap cookie unsigning in try-catch blocks:

```typescript
const getCookieValue = (request: FastifyRequestWithCookies, name: string): string | undefined => {
  try {
    const cookie = request.cookies[name];
    return cookie ? request.unsignCookie(cookie)?.value : undefined;
  } catch (error) {
    logger.warn({ error, cookieName: name }, 'Failed to unsign cookie');
    return undefined;
  }
};
```

### 1.2 JWT Verification Gaps

**Finding:** JWT verification swallows all errors and returns null, losing valuable error context.

**Location:** `/apps/backend/src/auth/jwt.ts:18-24`

```typescript
export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null; // All errors treated the same
  }
}
```

**Risk:** Cannot distinguish between:

- Expired tokens (user needs to re-login)
- Invalid signatures (potential attack)
- Malformed tokens (client error)

**Recommendation:** Return detailed error information:

```typescript
export type JWTVerifyResult =
  | { success: true; payload: JWTPayload }
  | { success: false; error: 'EXPIRED' | 'INVALID_SIGNATURE' | 'MALFORMED' };

export function verifyJWT(token: string): JWTVerifyResult {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return { success: true, payload };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { success: false, error: 'EXPIRED' };
    } else if (error instanceof jwt.JsonWebTokenError) {
      return { success: false, error: 'INVALID_SIGNATURE' };
    }
    return { success: false, error: 'MALFORMED' };
  }
}
```

### 1.3 Header Fallback Security

**Finding:** The system correctly prioritizes cookies over headers, but lacks rate limiting on header-based auth.

**Location:** `/apps/backend/src/trpc/context.ts:40`

**Risk:** API clients using header authentication could be more vulnerable to brute force attacks.

**Recommendation:** Implement rate limiting specifically for header-based authentication attempts.

## 2. RLS Context & Policies Analysis

### 2.1 RLS Context Building

**Finding:** RLS context defaults to bypass mode for unauthenticated requests without proper distinction.

**Location:** `/apps/backend/src/trpc/context.ts:43-46`

```typescript
let rlsContext: RLSContext = {
  bypassRLS: true,
  bypassReason: 'No authentication token - public endpoint',
};
```

**Risk:** All unauthenticated requests bypass RLS with the same generic reason, making it difficult to audit legitimate vs illegitimate bypass cases.

**Recommendation:** Use more specific bypass reasons:

```typescript
enum RLSBypassReason {
  PUBLIC_ENDPOINT = 'Public endpoint - no auth required',
  SYSTEM_OPERATION = 'System operation - elevated privileges',
  MIGRATION = 'Database migration',
  HEALTH_CHECK = 'Health check endpoint',
}
```

### 2.2 Circular Dependencies

**Finding:** The organization_members table has a circular dependency that was partially fixed.

**Location:** `/packages/database/prisma/migrations/20250116_fix_org_members_rls_policy/migration.sql`

**Status:** ✅ Properly addressed with a read-only policy using only user_id.

### 2.3 RLS Bypass Overuse

**Finding:** Multiple instances of RLS bypass without proper auditing.

**Locations:**

- Auth queries bypass RLS (`/apps/backend/src/trpc/context.ts:53,79`)
- Legacy functions bypass without audit (`/apps/backend/src/lib/rls/index.ts:87-98`)

**Risk:** Bypassed queries could leak data if not carefully controlled.

**Recommendation:**

1. Minimize bypass usage - use filtered queries instead
2. Implement mandatory audit logging for all bypasses
3. Consider using a separate "system" Prisma client for administrative operations

## 3. Middleware & Routing Inconsistencies

### 3.1 Error Message Inconsistency

**Finding:** Different error messages for similar conditions across procedures.

**Examples:**

- `hasOrganization`: "No organization selected. Please select an organization to continue."
- `isOrganizationAdmin`: "No organization selected"

**Location:** `/apps/backend/src/trpc/middleware.ts:32,51`

**Recommendation:** Centralize error messages:

```typescript
const AUTH_ERRORS = {
  NO_AUTH: 'Authentication required',
  NO_ORG: 'No organization selected. Please select an organization to continue.',
  INSUFFICIENT_PERMS: 'Insufficient permissions for this operation',
} as const;
```

### 3.2 Redundant Checks

**Finding:** Organization procedures check for user authentication redundantly.

**Location:** `/apps/backend/src/trpc/middleware.ts`

**Recommendation:** Chain middleware to avoid redundancy:

```typescript
const hasOrganization = isAuthed.pipe(({ ctx, next }) => {
  // Already authenticated from isAuthed
  if (!ctx.user.organizationId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: AUTH_ERRORS.NO_ORG });
  }
  return next({ ctx });
});
```

## 4. Edge Cases & Error Handling

### 4.1 Uncaught Exceptions

**Critical Finding:** Multiple locations where exceptions could crash the request:

1. `unsignCookie` calls without try-catch
2. Direct type assertions without validation
3. Missing null checks before property access

**Locations:**

- `/apps/backend/src/trpc/context.ts:35,71`
- `/apps/backend/src/lib/cookies.ts:73` (getSignedCookie)

### 4.2 Invalid Token Response

**Finding:** Invalid tokens return 401 but expired tokens are indistinguishable.

**Impact:** Poor user experience - users don't know if they need to login again or if there's an error.

**Recommendation:** Return specific error codes:

```typescript
// In context creation
if (jwtResult.success === false) {
  if (jwtResult.error === 'EXPIRED') {
    // Set a response header to indicate token expiration
    res.header('X-Auth-Error', 'TOKEN_EXPIRED');
  }
}
```

## 5. Simplification & Best Practices

### 5.1 Unified Token Extraction

**Recommendation:** Create a centralized token extraction utility:

```typescript
// lib/auth/token-extractor.ts
export function extractAuthToken(req: FastifyRequestWithCookies): {
  token?: string;
  source: 'cookie' | 'header' | 'none';
  error?: string;
} {
  try {
    // Try cookie first
    const cookieToken = req.cookies[COOKIE_NAMES.AUTH_TOKEN];
    if (cookieToken) {
      const unsigned = req.unsignCookie(cookieToken);
      if (unsigned.valid && unsigned.value) {
        return { token: unsigned.value, source: 'cookie' };
      }
    }

    // Fallback to header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return { token: authHeader.slice(7), source: 'header' };
    }

    return { source: 'none' };
  } catch (error) {
    return { source: 'none', error: error.message };
  }
}
```

### 5.2 Type-Safe RLS Bypass

**Recommendation:** Use const assertions for bypass reasons:

```typescript
const RLS_BYPASS_REASONS = {
  AUTH_CHECK: 'Authentication verification',
  PUBLIC_DATA: 'Public data access',
  SYSTEM_TASK: 'System maintenance task',
  MIGRATION: 'Database migration',
} as const;

type RLSBypassReason = (typeof RLS_BYPASS_REASONS)[keyof typeof RLS_BYPASS_REASONS];
```

### 5.3 Centralized Error Handling

**Recommendation:** Implement a global error handler for auth failures:

```typescript
// lib/auth/error-handler.ts
export function handleAuthError(error: unknown, reply: FastifyReply) {
  if (error instanceof JWTExpiredError) {
    reply.code(401).send({
      error: 'TOKEN_EXPIRED',
      message: 'Your session has expired. Please login again.',
    });
  } else if (error instanceof JWTError) {
    reply.code(401).send({
      error: 'INVALID_TOKEN',
      message: 'Invalid authentication token.',
    });
  } else {
    // Log and return generic error
    logger.error({ error }, 'Unexpected auth error');
    reply.code(500).send({
      error: 'AUTH_ERROR',
      message: 'Authentication failed.',
    });
  }
}
```

## 6. Recommended Test Cases

### 6.1 Authentication Edge Cases

```typescript
describe('Authentication Edge Cases', () => {
  it('should handle malformed cookies gracefully', async () => {
    const response = await request(app)
      .get('/api/protected')
      .set('Cookie', 'auth-token=malformed_value')
      .expect(401);

    expect(response.body.error).toBe('INVALID_TOKEN');
  });

  it('should distinguish expired tokens', async () => {
    const expiredToken = generateExpiredToken();
    const response = await request(app)
      .get('/api/protected')
      .set('Cookie', `auth-token=${sign(expiredToken)}`)
      .expect(401);

    expect(response.body.error).toBe('TOKEN_EXPIRED');
  });

  it('should handle concurrent organization switches', async () => {
    // Test race conditions in organization context setting
  });
});
```

### 6.2 RLS Bypass Auditing

```typescript
describe('RLS Bypass Auditing', () => {
  it('should log all RLS bypasses with reasons', async () => {
    const auditSpy = jest.spyOn(auditLogger, 'warn');

    await authService.verifyUserWithoutRLS(userId);

    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'RLS_BYPASS',
        reason: 'Authentication verification',
        userId,
      })
    );
  });
});
```

## 7. Security Risk Summary

| Finding                               | Severity | Impact                    | Effort to Fix |
| ------------------------------------- | -------- | ------------------------- | ------------- |
| Unhandled cookie unsigning exceptions | Critical | Service crashes           | Low           |
| No JWT error differentiation          | High     | Poor security visibility  | Medium        |
| RLS bypass overuse                    | Medium   | Potential data leaks      | High          |
| Inconsistent error messages           | Low      | User confusion            | Low           |
| Missing rate limiting on header auth  | Medium   | Brute force vulnerability | Medium        |

## 8. Implementation Priority

1. **Immediate (Week 1)**
   - Add error handling to all `unsignCookie` calls
   - Implement JWT error differentiation
   - Standardize error messages

2. **Short-term (Week 2-3)**
   - Create unified token extraction utility
   - Add comprehensive audit logging for RLS bypasses
   - Implement suggested test cases

3. **Medium-term (Month 1-2)**
   - Refactor RLS bypass usage to minimize occurrences
   - Implement rate limiting for API authentication
   - Create separate system Prisma client for admin operations

## Conclusion

The authentication and RLS implementation is generally well-structured but has several critical gaps in error handling and security visibility. The recommended changes will significantly improve security posture, debugging capability, and user experience. Priority should be given to fixing the unhandled exceptions and improving JWT error handling as these pose immediate risks to service stability and security monitoring.
