# Ventry Development TODO List

## Primary Goal
Get **authentication + RLS working end-to-end** from user login to viewing data in the UI with proper multi-tenant isolation.

## Current State (2025-01-17)

### ✅ What's Working
- Frontend authentication (login form, auth store, middleware)
- Backend JWT generation and signed cookie handling
- Database-level RLS policies are in place and verified working
- Production RLS module (`/lib/rls/`) is ready
- tRPC context creation with organization resolution
- RLS E2E tests now passing with dual-connection pattern
- All TypeScript errors in backend resolved
- Audit log organizationId migration completed

### ✅ Recently Completed (Phase 0: COMPLETE)
1. **Fixed RLS E2E test** - Now uses dual-connection pattern correctly
2. **Cleaned up deprecated code** - Removed old `rls-middleware.ts`, updated all imports to use `/lib/rls/`
3. **Created test helpers** - `createTestOrg`, `createTestUser`, `linkUserToOrg` in `test-db-helpers.ts`
4. **Fixed items integration test** - Updated to use dual-connection pattern
5. **Fixed missing RLS policies** - Added policies for warehouses, locations, inventory, audit_logs, users
6. **Fixed build pipeline** - Regenerated Prisma client and rebuilt packages
7. **Fixed TypeScript errors** - Resolved all type issues in auth, RLS, and transaction modules
8. **Created audit log migration** - Made organizationId non-nullable with proper FK and index
9. **Updated all routers** - All 56 audit log entries now include `organizationId: ctx.user.organizationId!`
10. **Fixed frontend build errors** - Resolved type mismatches, missing dependencies, and enum inconsistencies

### ❌ Remaining Issues
1. **Cookie handling inconsistencies** - Multiple implementations causing auth failures
2. **Organization context issues** - `window.__organizationId` anti-pattern exists
3. **View dialogs expect full data** - Order/Customer view dialogs need proper data fetching

## Status Legend
- 🚧 In Progress
- ⏳ Pending
- ✅ Completed
- ❌ Blocked

## The Focused Fix Plan (3-4 days total)

### Phase 0: Fix RLS Foundation (Day 1) ✅ COMPLETED
**Goal: Get RLS tests passing to ensure database isolation works**

#### 0.1 Fix RLS E2E Test (2 hours) ✅
- [x] Opened `/apps/backend/src/trpc/__tests__/rls-e2e.integration.spec.ts`
- [x] Deleted disconnect/reconnect block (lines 162-170)
- [x] Removed all usage of `createIntegrationContext`
- [x] Rewrote test to follow `rls-simple.integration.spec.ts` pattern:
  - Now uses dual connections: `adminPrisma` for setup, `appPrisma` for RLS testing
  - Uses `withRLS(appPrisma, context, operation)` for all assertions
  - No tRPC context - tests RLS directly
- [x] Ran: `pnpm --filter @ventry/backend test:integration rls-e2e`
- [x] Result: All 3 tests pass ✅

#### 0.2 Clean Up Deprecated Code (1 hour) ✅
- [x] Deleted `/apps/backend/src/lib/rls-middleware.ts`
- [x] No `rls-middleware-v2.ts` file found (already removed)
- [x] Updated all imports to use `/lib/rls/index.js`:
  - `src/lib/__tests__/rls.integration.spec.ts`
  - `src/lib/__tests__/rls-simple.integration.spec.ts`
  - `src/trpc/context.ts`
  - `src/trpc/__tests__/context.test.ts`
- [x] All RLS tests still passing

#### 0.3 Create Test Helpers (1 hour) ✅
- [x] Created `/apps/backend/src/test-utils/test-db-helpers.ts`:
  - `createTestOrg()` - Creates test organizations
  - `createTestUser()` - Creates test users with proper defaults
  - `linkUserToOrg()` - Links users to organizations
  - `createTestSetup()` - All-in-one helper for common test setup
- [x] Documented the dual-connection pattern in the file

#### 0.4 Fix Items Integration Test (2 hours) ✅
- [x] Updated to use dual-connection pattern
- [x] Fixed role permissions (default to ADMIN for tests)
- [x] Converted User to AuthenticatedUser type
- [x] All 26 tests passing

#### 0.5 Fix Missing RLS Policies (1 hour) ✅
- [x] Created migration `20250117_fix_missing_rls_policies`
- [x] Added policies for: warehouses, locations, inventory, audit_logs, users
- [x] Applied to both dev and integration test databases

#### 0.6 Fix Build Pipeline (30 min) ✅
- [x] Regenerated Prisma client to include organizationId on AuditLog
- [x] Rebuilt database package

#### 0.7 Fix TypeScript Errors (2 hours) ✅
- [x] Fixed FastifyRequestWithCookies interface issues
- [x] Fixed RLS proxy type predicate with symbol handling
- [x] Fixed transaction manager types (custom RLSTransactionOptions)
- [x] Backend now passes all type checks

#### 0.8 Create Audit Log Migration (1 hour) ✅
- [x] Created migration `20250117_audit_log_organization_id`
- [x] Made organizationId non-nullable
- [x] Added foreign key to organizations table
- [x] Added index for performance
- [x] Applied to both databases

#### 0.9 Update Routers for Audit Logs (2 hours) ✅
- [x] Found 56 audit log entries across 13 router files
- [x] Updated all to use `organizationId: ctx.user.organizationId!`
- [x] Affected routers: customers, inventory, items, locations, orders, payments, 
  purchaseOrders, returns, shipments, stockMovements, suppliers, transfers, warehouses

#### 0.10 Fix Frontend Build Errors (3 hours) ✅
- [x] Added @ventry/database dependency to web app
- [x] Fixed backend build configuration to emit to dist/
- [x] Resolved TypeScript errors in customers and organizations pages
- [x] Fixed type mismatches (null vs undefined, missing fields)
- [x] Updated enums to match database schema (OrderStatus, PaymentStatus)
- [x] Fixed missing API response fields (added email to customer select)
- [x] Replaced non-existent mutations (confirm → updateStatus)
- [x] Simplified ViewOrderDialog to work with partial data
- [x] Build now completes successfully (with ESLint warnings)

### Phase 1: Standardize Auth Flow (Day 2) ⏳
**Goal: One consistent way to handle auth across the system**

#### 1.1 Create Unified AuthService (3 hours) ⏳
- [ ] Create `/apps/backend/src/services/auth-service.ts`:
  ```typescript
  export class AuthService {
    private readonly logger = createLogger('auth-service');
    
    // Core auth operations
    async login(credentials: LoginInput): Promise<AuthResult>
    async logout(userId: string, res: FastifyReply): Promise<void>
    async verifyToken(token: string): Promise<JWTPayload>
    
    // Cookie management
    setAuthCookie(res: FastifyReply, token: string): void
    clearAuthCookie(res: FastifyReply): void
    getAuthToken(req: FastifyRequest): string | undefined
  }
  ```
- [ ] Move auth logic from router to service
- [ ] Replace all direct JWT operations with service methods
- [ ] Test: `pnpm --filter @ventry/backend test auth-service`

#### 1.2 Fix Cookie Handling (2 hours) ⏳
- [ ] Create `/apps/backend/src/services/cookie-service.ts`:
  ```typescript
  export class CookieService {
    static readonly COOKIE_NAMES = {
      AUTH_TOKEN: 'auth-token',
      ACTIVE_ORGANIZATION: 'active-organization',
    };
    
    static setSignedCookie(res: FastifyReply, name: string, value: string): void
    static getSignedCookie(req: FastifyRequest, name: string): string | undefined
    static clearCookie(res: FastifyReply, name: string): void
  }
  ```
- [ ] Replace all direct cookie operations
- [ ] Ensure consistent error handling for missing/invalid cookies
- [ ] Fix the common "signed cookie string must be provided" error

#### 1.3 Fix Organization Context (2 hours) ⏳
- [ ] Search for `window.__organizationId` usage: `grep -r "__organizationId" apps/web`
- [ ] Create `/apps/web/src/stores/organization-store.ts` using Zustand
- [ ] Update tRPC client to include organization header:
  ```typescript
  headers: () => ({
    'x-organization-id': organizationStore.getState().activeOrganizationId,
  })
  ```
- [ ] Test organization switching in UI

### Phase 2: Verify End-to-End Flow (Day 3) ⏳
**Goal: Ensure complete flow works from UI to database**

#### 2.1 Test Login → Dashboard Flow (2 hours) ⏳
- [ ] Start the app: `pnpm dev`
- [ ] Login with test account: `admin@ventry.com` / `password123`
- [ ] Open browser DevTools Network tab
- [ ] Verify:
  - [ ] `auth-token` cookie is set (signed, httpOnly)
  - [ ] `/api/trpc/auth.me` returns user data
  - [ ] Dashboard loads without auth errors
  - [ ] Organization context is resolved correctly
- [ ] Document any issues found

#### 2.2 Verify RLS in UI (2 hours) ⏳
- [ ] Create test data for multiple organizations using admin scripts
- [ ] Login as `admin@ventry.com` (has access to Demo Company)
- [ ] Navigate to inventory page
- [ ] Verify only Demo Company items are visible
- [ ] Login as `user@ventry.com` (no organization)
- [ ] Verify appropriate "no access" message
- [ ] Test with different users/orgs

#### 2.3 Add E2E Tests (3 hours) ⏳
- [ ] Create `/apps/e2e/tests/auth-flow.spec.ts`:
  - Test successful login
  - Test failed login
  - Test logout
  - Test session persistence
- [ ] Create `/apps/e2e/tests/rls-isolation.spec.ts`:
  - Test data isolation between orgs
  - Test unauthorized access attempts
- [ ] Run: `pnpm test:e2e`

### Phase 3: Production Hardening (Day 4) ⏳
**Goal: Make the system production-ready**

#### 3.1 Add Missing Pieces (3 hours) ⏳
- [ ] Implement refresh token in auth router:
  ```typescript
  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify refresh token
      // Generate new JWT
      // Rotate refresh token
      // Set new cookies
    })
  ```
- [ ] Add proper logout that clears all cookies
- [ ] Fix register to create default organization:
  ```typescript
  // After user creation
  const org = await ctx.prisma.organization.create({
    data: { name: `${user.firstName}'s Organization`, slug: generateSlug() }
  });
  await ctx.prisma.organizationMember.create({
    data: { userId: user.id, organizationId: org.id, role: 'OWNER' }
  });
  ```

#### 3.2 Security Enhancements (2 hours) ⏳
- [ ] Add rate limiting on `/api/trpc/auth.*` endpoints
- [ ] Implement CSRF protection for mutations
- [ ] Add security headers (HSTS, CSP, etc.)
- [ ] Enable request ID tracking for debugging

#### 3.3 Documentation (2 hours) ⏳
- [ ] Update README with auth setup instructions
- [ ] Document required environment variables
- [ ] Create troubleshooting guide for common auth issues
- [ ] Add architecture diagram of auth flow

## Critical Success Path

To achieve working auth + RLS, these are the MINIMUM required fixes:

1. **Fix RLS Test Pattern** → Ensures RLS actually works at database level
2. **Standardize Cookie Handling** → Prevents "signed cookie string must be provided" errors
3. **Fix Organization Context** → Ensures correct data isolation in UI
4. **Test End-to-End** → Verifies everything works together

## Key Patterns to Follow

### RLS Testing Pattern
```typescript
// ALWAYS use dual connections in tests
const { adminPrisma, appPrisma } = createTestConnections();

// ALWAYS use withRLS for RLS testing
const result = await withRLS(appPrisma, {
  userId: user.id,
  organizationId: org.id,
  bypassRLS: false
}, async (tx) => {
  return await tx.item.findMany();
});

// ALWAYS assert on result.data
expect(result.data).toHaveLength(expected);
```

### Cookie Handling Pattern
```typescript
// ALWAYS unsign cookies before use
const authCookie = request.cookies['auth-token'];
const token = authCookie ? request.unsignCookie(authCookie)?.value : undefined;

// NEVER read signed cookies directly
const token = request.cookies['auth-token']; // WRONG - includes signature!
```

### Organization Context Pattern
```typescript
// Priority order for organization resolution:
// 1. x-organization-id header (explicit selection)
// 2. active-organization cookie (persistent selection)
// 3. JWT organizationId (default from login)
```


## First Immediate Actions

1. **Fix the failing RLS E2E test** by switching to dual-connection pattern
2. **Delete deprecated RLS middleware files** to eliminate confusion
3. **Create unified AuthService** to centralize auth logic
4. **Test login → view data flow** manually to verify it works

## Expected Outcome

After implementing this plan:
- ✅ Users can log in and auth persists across requests
- ✅ Organization context is properly maintained
- ✅ Database RLS filters data correctly (VERIFIED with dual-connection tests)
- ✅ UI shows only the user's organization data
- ✅ Tests prove the isolation works (RLS E2E tests now passing)

## Technical Standards We Follow
- **tRPC + Fastify** for type-safe APIs (NOT REST)
- **Database-level RLS** for multi-tenancy (NOT application-level filtering)
- **Signed httpOnly cookies** for auth tokens (NOT localStorage)
- **Prisma with PostgreSQL** (NOT raw SQL or other ORMs)
- **Zod validation** on all inputs (NOT manual validation)
- **Structured logging with Pino** (NOT console.log)

## Notes for Developers

### When Working on RLS
- ALWAYS use dual connections in tests
- NEVER disconnect/reconnect in tests
- ALWAYS use `withRLS()` for RLS operations
- NEVER use singleton `prisma` from `@ventry/database` in tests

### When Working on Auth
- ALWAYS unsign cookies before reading JWT
- NEVER read signed cookies directly
- ALWAYS verify organization membership
- NEVER trust client-side org context alone

### When Working on tRPC
- ALWAYS use `organizationProcedure` for business data
- NEVER use `protectedProcedure` for org-scoped operations
- ALWAYS verify user belongs to the organization
- NEVER bypass RLS checks in application code

## Progress Summary

### Completed Today
1. **Fixed RLS E2E Test** - Now properly tests database-level RLS with dual connections
2. **Verified RLS Working** - Database correctly enforces tenant isolation with `ventry_app` role
3. **Cleaned Up Deprecated Code** - Removed old `rls-middleware.ts`, updated all imports

### Still To Do
1. **Test Helpers** - Create simple data creation functions (Phase 0.3)
2. **Auth Centralization** - Unified AuthService and CookieService (Phase 1)
3. **Frontend Verification** - Test complete login-to-data flow (Phase 2)
4. **Remove Anti-patterns** - Fix `window.__organizationId` usage

---

Last Updated: 2025-01-18 (Phase 0 COMPLETE ✅)
Next Review: After Phase 1 completion

**Remember**: The goal is working auth + RLS from login to UI. Everything else can wait.

## Summary of Phase 0 Completion

Phase 0 is now complete! All foundational RLS work has been finished:
- ✅ RLS tests passing with dual-connection pattern
- ✅ All deprecated code cleaned up
- ✅ Test helpers created for consistent testing
- ✅ All integration tests updated and passing
- ✅ Missing RLS policies added
- ✅ Build pipeline fixed
- ✅ All TypeScript errors resolved
- ✅ Audit log migration completed
- ✅ All 56 audit log entries updated with organizationId
- ✅ Frontend build errors fixed

The system now has a solid RLS foundation at the database level. Next step is Phase 1: Standardize Auth Flow.