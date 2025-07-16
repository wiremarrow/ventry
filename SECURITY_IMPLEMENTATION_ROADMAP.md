# Security Implementation Roadmap

**Purpose:** This document provides a concrete, phased implementation plan for addressing all security findings from the audit report. Each task is broken down into specific, testable subtasks following test-driven development (TDD) principles.

**Goal:** Build an MVP of a secure, elegant, and functional authentication & RLS system that gives enterprise clients peace of mind while maintaining codebase agility.

---

## Phase 0: Critical Security Fixes (2-3 days)
**Objective:** Fix critical vulnerabilities that could crash the service or expose security flaws.

### Task 0.1: Fix Cookie Unsigning Exception Handling
**Priority:** CRITICAL  
**Estimated Time:** 2 hours  
**Files to Modify:**
- `/apps/backend/src/trpc/context.ts`
- `/apps/backend/src/lib/cookies.ts`

#### Subtasks:
1. **Create test file:** `/apps/backend/src/lib/__tests__/cookies.test.ts`
   ```typescript
   // Test cases to implement:
   - 'should return undefined for malformed cookie without throwing'
   - 'should log warning when cookie unsigning fails'
   - 'should handle null/undefined cookies gracefully'
   - 'should successfully unsign valid cookies'
   ```

2. **Implement safe cookie utilities in** `/apps/backend/src/lib/cookies.ts`:
   - Add `safeUnsignCookie()` function that wraps unsignCookie in try-catch
   - Update `getSignedCookie()` to use the safe version
   - Add proper logging for failures

3. **Update context.ts** to use safe cookie functions:
   - Replace line 35: `request.unsignCookie(authCookie)?.value`
   - Replace line 71: `request.unsignCookie(orgCookie)?.value`
   - Use new `safeUnsignCookie()` function

4. **Validation:**
   - Run tests: `pnpm --filter @ventry/backend test cookies.test.ts`
   - Test with malformed cookie: `curl -H "Cookie: auth-token=malformed" http://localhost:6060/trpc/auth.me`
   - Verify 401 response (not 500)

### Task 0.2: Implement JWT Error Differentiation
**Priority:** HIGH  
**Estimated Time:** 3 hours  
**Files to Modify:**
- `/apps/backend/src/auth/jwt.ts`
- `/apps/backend/src/trpc/context.ts`

#### Subtasks:
1. **Create test file:** `/apps/backend/src/auth/__tests__/jwt.test.ts`
   ```typescript
   // Test cases to implement:
   - 'should return EXPIRED error for expired tokens'
   - 'should return INVALID_SIGNATURE error for tampered tokens'
   - 'should return MALFORMED error for invalid format'
   - 'should successfully verify valid tokens'
   - 'should include original error details in result'
   ```

2. **Refactor JWT verification in** `/apps/backend/src/auth/jwt.ts`:
   - Create `JWTVerifyResult` type union
   - Update `verifyJWT()` to return detailed error information
   - Preserve error details for logging

3. **Update context creation** to handle JWT errors:
   - Modify context.ts to check `jwtResult.success`
   - Add response headers for token expiration
   - Log specific JWT errors with appropriate levels

4. **Create integration test:** `/apps/backend/src/trpc/__tests__/auth-errors.integration.test.ts`
   ```typescript
   // Test the full flow:
   - 'should return 401 with TOKEN_EXPIRED header for expired JWT'
   - 'should return 401 with INVALID_TOKEN for tampered JWT'
   - 'should handle malformed tokens gracefully'
   ```

5. **Validation:**
   - Run all auth tests
   - Generate expired token and verify proper error response
   - Check logs for detailed error information

### Task 0.3: Emergency Error Message Standardization
**Priority:** MEDIUM  
**Estimated Time:** 1 hour  
**Files to Modify:**
- `/apps/backend/src/lib/auth/constants.ts` (create new)
- `/apps/backend/src/trpc/middleware.ts`

#### Subtasks:
1. **Create constants file** with standardized messages:
   ```typescript
   export const AUTH_ERRORS = {
     NO_AUTH: 'Authentication required',
     NO_ORG: 'No organization selected. Please select an organization to continue.',
     INSUFFICIENT_PERMS: 'Insufficient permissions for this operation',
     TOKEN_EXPIRED: 'Your session has expired. Please login again.',
     INVALID_TOKEN: 'Invalid authentication token.',
   } as const;
   ```

2. **Update middleware** to use constants:
   - Replace all hardcoded error messages
   - Ensure consistent formatting

3. **Validation:**
   - Grep codebase for duplicate error strings
   - Run E2E tests to verify error messages

---

## Phase 1: Foundation Improvements (Week 1)
**Objective:** Build robust utilities and comprehensive test coverage for authentication.

### Task 1.1: Create Unified Token Extraction Utility
**Priority:** HIGH  
**Estimated Time:** 4 hours  
**Files to Create/Modify:**
- `/apps/backend/src/lib/auth/token-extractor.ts` (new)
- `/apps/backend/src/lib/auth/__tests__/token-extractor.test.ts` (new)

#### Subtasks:
1. **Write comprehensive tests first:**
   ```typescript
   // Test scenarios:
   - 'should prefer cookie over header'
   - 'should handle missing cookies gracefully'
   - 'should validate Bearer token format'
   - 'should return error details for debugging'
   - 'should track token source for metrics'
   - 'should handle concurrent requests safely'
   ```

2. **Implement token extractor** with:
   - Safe cookie unsigning
   - Header validation
   - Source tracking for analytics
   - Detailed error information

3. **Create type definitions:**
   ```typescript
   interface TokenExtractionResult {
     token?: string;
     source: 'cookie' | 'header' | 'none';
     error?: string;
     metadata?: {
       cookieSigned: boolean;
       headerFormat: string;
     };
   }
   ```

4. **Integrate into context.ts:**
   - Replace current token extraction logic
   - Add metrics collection for token sources
   - Improve debugging with extraction metadata

5. **Validation:**
   - Unit tests pass
   - Integration test with both cookie and header auth
   - Performance test with 1000 concurrent requests

### Task 1.2: Implement Auth Error Handler
**Priority:** MEDIUM  
**Estimated Time:** 3 hours  
**Files to Create:**
- `/apps/backend/src/lib/auth/error-handler.ts`
- `/apps/backend/src/lib/auth/__tests__/error-handler.test.ts`

#### Subtasks:
1. **Define error response schema:**
   ```typescript
   interface AuthErrorResponse {
     error: 'TOKEN_EXPIRED' | 'INVALID_TOKEN' | 'NO_AUTH' | 'AUTH_ERROR';
     message: string;
     details?: {
       expiredAt?: string;
       tokenAge?: number;
     };
   }
   ```

2. **Implement error handler** with:
   - Specific handling for each JWT error type
   - Consistent response format
   - Security-safe error messages
   - Detailed logging for debugging

3. **Add Fastify error hook:**
   - Global error handling for auth failures
   - Proper status codes
   - Security headers

4. **Create E2E tests** for error responses

### Task 1.3: Comprehensive Auth Test Suite
**Priority:** HIGH  
**Estimated Time:** 6 hours  
**Files to Create:**
- `/apps/backend/src/auth/__tests__/auth-flow.e2e.test.ts`
- `/apps/backend/src/auth/__tests__/auth-edge-cases.test.ts`

#### Subtasks:
1. **Test complete auth flows:**
   - Login → Use API → Logout
   - Token expiration handling
   - Organization switching
   - Concurrent requests

2. **Edge case testing:**
   - Malformed cookies
   - Tampered tokens
   - Race conditions
   - Network failures

3. **Performance tests:**
   - 1000 concurrent auth checks
   - Token extraction bottlenecks
   - Context creation timing

---

## Phase 2: RLS Security Hardening (Week 2)
**Objective:** Implement proper audit logging and type-safe RLS bypass handling.

### Task 2.1: Type-Safe RLS Bypass Reasons
**Priority:** HIGH  
**Estimated Time:** 3 hours  
**Files to Modify:**
- `/apps/backend/src/lib/rls/constants.ts`
- `/apps/backend/src/lib/rls/types.ts`

#### Subtasks:
1. **Create bypass reason enum:**
   ```typescript
   export const RLS_BYPASS_REASONS = {
     PUBLIC_ENDPOINT: 'Public endpoint - no auth required',
     AUTH_VERIFICATION: 'Authentication verification',
     SYSTEM_HEALTH_CHECK: 'System health check',
     DATABASE_MIGRATION: 'Database migration',
     AUDIT_LOG_WRITE: 'Audit log write operation',
   } as const;
   ```

2. **Update RLSContext type** to use enum
3. **Add compile-time validation** for bypass reasons
4. **Update all bypass usages** to use constants

### Task 2.2: Implement RLS Audit Logging
**Priority:** HIGH  
**Estimated Time:** 6 hours  
**Files to Create/Modify:**
- `/apps/backend/src/lib/rls/audit-logger.ts` (new)
- `/apps/backend/src/lib/rls/__tests__/audit-logger.test.ts` (new)
- Database migration for audit_logs table

#### Subtasks:
1. **Create audit log schema:**
   ```sql
   CREATE TABLE rls_audit_logs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     event_type VARCHAR(50) NOT NULL,
     user_id VARCHAR(255),
     organization_id VARCHAR(255),
     bypass_reason VARCHAR(255),
     operation_type VARCHAR(50),
     table_name VARCHAR(100),
     success BOOLEAN NOT NULL,
     error_message TEXT,
     metadata JSONB
   );
   ```

2. **Implement audit logger** with:
   - Async write to avoid blocking
   - Structured logging format
   - Automatic context capture
   - Batch writing for performance

3. **Integration with RLS service:**
   - Log all bypass operations
   - Track context switches
   - Monitor performance impact

4. **Create monitoring dashboard queries:**
   - Bypass frequency by reason
   - Unusual access patterns
   - Failed RLS operations

### Task 2.3: Minimize RLS Bypasses
**Priority:** MEDIUM  
**Estimated Time:** 8 hours  
**Files to Modify:** Multiple router files

#### Subtasks:
1. **Audit current bypasses:**
   - List all locations using `basePrisma`
   - Categorize by necessity
   - Plan refactoring approach

2. **Refactor unnecessary bypasses:**
   - Use filtered queries instead
   - Add organization context where possible
   - Document why bypass is necessary

3. **Create system Prisma client:**
   ```typescript
   // For true system operations only
   export const systemPrisma = new PrismaClient({
     log: ['warn', 'error'],
     // Special logging for audit
   });
   ```

4. **Add bypass alerts:**
   - Slack notification for production bypasses
   - Weekly bypass report
   - Anomaly detection

---

## Phase 3: Middleware Refactoring (Week 3)
**Objective:** Streamline middleware chain and remove redundancies.

### Task 3.1: Implement Middleware Chaining
**Priority:** MEDIUM  
**Estimated Time:** 4 hours  
**Files to Modify:**
- `/apps/backend/src/trpc/middleware.ts`
- `/apps/backend/src/trpc/procedures.ts`

#### Subtasks:
1. **Create middleware composition utilities:**
   ```typescript
   // Enable elegant chaining
   const requiresOrg = pipe(isAuthed, hasOrganization);
   const requiresOrgAdmin = pipe(requiresOrg, isOrgAdmin);
   ```

2. **Refactor redundant checks:**
   - Remove duplicate auth checks
   - Use composition for complex requirements
   - Add type inference for chained context

3. **Update all procedures** to use new patterns

4. **Performance testing:**
   - Measure middleware overhead
   - Optimize hot paths
   - Add middleware timing logs

### Task 3.2: Create Middleware Test Suite
**Priority:** HIGH  
**Estimated Time:** 4 hours  
**Files to Create:**
- `/apps/backend/src/trpc/__tests__/middleware.test.ts`
- `/apps/backend/src/trpc/__tests__/procedures.test.ts`

#### Subtasks:
1. **Unit tests for each middleware:**
   - Auth validation
   - Organization checks
   - Permission verification
   - Error handling

2. **Integration tests for chains:**
   - Full procedure flows
   - Error propagation
   - Context transformation

3. **Edge case testing:**
   - Missing headers
   - Invalid contexts
   - Concurrent requests

---

## Phase 4: Advanced Security Features (Week 4)
**Objective:** Implement rate limiting, monitoring, and advanced security features.

### Task 4.1: Implement Rate Limiting
**Priority:** MEDIUM  
**Estimated Time:** 6 hours  
**Dependencies:** `@fastify/rate-limit`

#### Subtasks:
1. **Design rate limit strategy:**
   ```typescript
   // Different limits for:
   - Authentication attempts (strict)
   - API calls (per org)
   - Public endpoints (IP-based)
   ```

2. **Implement rate limiters:**
   - Redis-backed for distributed systems
   - Configurable per endpoint
   - Bypass for trusted IPs

3. **Add rate limit headers:**
   - X-RateLimit-Limit
   - X-RateLimit-Remaining
   - X-RateLimit-Reset

4. **Create monitoring:**
   - Track rate limit hits
   - Alert on suspicious patterns
   - Auto-block repeat offenders

### Task 4.2: Security Monitoring Dashboard
**Priority:** LOW  
**Estimated Time:** 8 hours  

#### Subtasks:
1. **Create security metrics:**
   - Failed auth attempts
   - RLS bypasses
   - Rate limit violations
   - Token usage patterns

2. **Implement Prometheus metrics:**
   ```typescript
   // Key metrics:
   auth_attempts_total
   auth_failures_total
   rls_bypasses_total
   jwt_errors_by_type
   ```

3. **Create Grafana dashboards:**
   - Real-time security overview
   - Historical trends
   - Anomaly detection

4. **Set up alerts:**
   - Unusual bypass patterns
   - Spike in auth failures
   - Performance degradation

### Task 4.3: Security Hardening
**Priority:** MEDIUM  
**Estimated Time:** 4 hours  

#### Subtasks:
1. **Add security headers:**
   - Strict-Transport-Security
   - X-Frame-Options
   - X-Content-Type-Options
   - CSP headers

2. **Implement CSRF protection:**
   - Double-submit cookies
   - Origin validation
   - SameSite cookie attributes

3. **Add request signing:**
   - HMAC for sensitive operations
   - Replay attack prevention
   - Request timestamp validation

---

## Testing Strategy

### Unit Tests (Per Feature)
- Write tests BEFORE implementation
- Aim for 100% coverage of auth/RLS code
- Mock external dependencies
- Test error conditions extensively

### Integration Tests (Per Phase)
- Test complete flows
- Use real database (test instance)
- Verify security boundaries
- Performance benchmarks

### E2E Tests (End of Each Phase)
- Full user journeys
- Cross-browser testing
- Load testing
- Security scanning

---

## Validation Checkpoints

### After Each Task:
1. All tests passing
2. No TypeScript errors
3. ESLint compliance
4. Performance benchmarks met

### After Each Phase:
1. Security scan (OWASP ZAP)
2. Load test (k6)
3. Code review
4. Documentation update

### Before Production:
1. Penetration testing
2. Security audit
3. Performance profiling
4. Disaster recovery test

---

## Rollback Strategies

### For Each Change:
1. Feature flags for gradual rollout
2. Database migrations with down scripts
3. Git tags for each stable version
4. Automated rollback scripts

### Emergency Procedures:
1. Revert to last known good state
2. Clear Redis cache
3. Restart services
4. Notify on-call team

---

## Success Metrics

### Security Metrics:
- 0 unhandled exceptions in auth flow
- 100% RLS bypass operations audited
- < 0.1% auth failure rate (excluding invalid credentials)
- < 10ms auth check latency (p99)

### Code Quality Metrics:
- 95%+ test coverage for auth/RLS
- 0 any types in auth code
- All errors properly typed
- Consistent error messages

### Operational Metrics:
- 99.99% auth service uptime
- < 1s detection of security issues
- Complete audit trail
- Automated security reports

---

## Next Steps After Completion

1. **Security Audit:** External penetration testing
2. **Performance Optimization:** Caching strategies
3. **Feature Enhancement:** MFA, SSO, OAuth
4. **Documentation:** API docs, security guides
5. **Training:** Team security workshops

This roadmap provides a clear, actionable path to implementing enterprise-grade security while maintaining development velocity. Each task is concrete, testable, and incrementally improves the system's security posture.