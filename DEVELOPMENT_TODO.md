# Ventry Development TODO List

## Guiding Principles & Meta-Goals

### Primary Objective
Build an **elegant, secure MVP** that **STRONGLY adheres** to our technology stack's current recommended standards and best practices.

### Core Values
1. **Maintainability First** - Code should be easy to understand, modify, and extend
2. **Minimize Complexity** - Choose simple solutions over clever ones
3. **Standardization** - One consistent pattern for each concern across the codebase
4. **Security by Design** - Database-level RLS, signed cookies, proper authentication
5. **Type Safety** - Leverage TypeScript and Zod for compile-time and runtime safety

### Technical Standards We Follow
- **tRPC + Fastify** for type-safe APIs (NOT REST)
- **Database-level RLS** for multi-tenancy (NOT application-level filtering)
- **Signed httpOnly cookies** for auth tokens (NOT localStorage)
- **Prisma with PostgreSQL** (NOT raw SQL or other ORMs)
- **Zod validation** on all inputs (NOT manual validation)
- **Structured logging with Pino** (NOT console.log)

## Overview
This document provides an exhaustive and comprehensive guide for implementing Ventry's core infrastructure with a focus on authentication, tRPC, RLS, middleware, and database patterns. Features come AFTER infrastructure is solid.

## Status Legend
- 🚧 In Progress
- ⏳ Pending
- ✅ Completed
- ❌ Blocked
- 🔍 Needs Investigation

## Phase 0: Core Infrastructure Foundation (CRITICAL) - 2-3 days

### 0.1 RLS Implementation Standardization 🚧

#### Current State Analysis
- **Canonical Implementation**: `/apps/backend/src/lib/rls/` (USE THIS)
- **Deprecated**: `rls-middleware-v2.ts`, `rls-middleware.ts` (REMOVE)
- **Working Test Pattern**: `rls-simple.integration.spec.ts` (FOLLOW THIS)
- **Failing Test Pattern**: `rls-e2e.integration.spec.ts` (FIX THIS)

#### Specific Tasks
- [ ] Fix `rls-e2e.integration.spec.ts` database connection isolation
  ```typescript
  // WRONG - Current pattern causing issues
  await adminPrisma.$disconnect(); // This breaks visibility
  adminPrisma = new PrismaClient({...}); // Creates new connection
  
  // CORRECT - Pattern from rls-simple.integration.spec.ts
  const { adminPrisma, appPrisma } = createTestConnections();
  // Use adminPrisma for setup WITHOUT disconnecting
  // Use appPrisma with withRLS for assertions
  ```
- [ ] Remove all disconnect/reconnect patterns in tests
- [ ] Update all tests to use dual-connection pattern consistently
- [ ] Ensure all RLS tests use `withRLS` wrapper for context setting
- [ ] Verify `basePrisma` from `@ventry/database` sees committed test data

#### RLS Context Management Pattern
```typescript
// CORRECT - Use withRLS for explicit transactions
const result = await withRLS(appPrisma, {
  userId: 'cuid...',
  organizationId: 'cuid...',
  bypassRLS: false
}, async (tx) => {
  return await tx.item.findMany();
});

// CORRECT - Use RLS proxy in tRPC context
const prisma = createRLSProxy(basePrisma, () => rlsContext);
```

### 0.2 Authentication & JWT Standardization ⏳

#### Current Issues
1. **Cookie Handling**: Multiple implementations with inconsistent error handling
2. **JWT Payload**: Optional fields causing confusion
3. **Organization Context**: Using `window.__organizationId` (anti-pattern)
4. **Race Conditions**: Auth provider timing issues

#### Canonical Patterns to Implement
- [ ] JWT Payload Structure (from `/apps/backend/src/auth/jwt.ts`):
  ```typescript
  interface JWTPayload {
    userId: string;              // REQUIRED - CUID format
    organizationId?: string;     // OPTIONAL - can change
    email?: string;              // OPTIONAL - advisory only
    role?: string;               // OPTIONAL - advisory only
  }
  ```
- [ ] Token Extraction Priority (from `/apps/backend/src/lib/auth/token-extractor.ts`):
  1. Signed httpOnly cookie (`auth-token`)
  2. Authorization header (`Bearer <token>`)
- [ ] Organization Context Resolution Order:
  1. `x-organization-id` header
  2. `active-organization` signed cookie  
  3. JWT payload `organizationId`

#### Specific Implementation Tasks
- [ ] Create unified `AuthService` class in `/apps/backend/src/services/auth-service.ts`:
  ```typescript
  export class AuthService {
    // Core methods
    async login(credentials: LoginInput): Promise<AuthResult>
    async logout(userId: string): Promise<void>
    async refreshToken(refreshToken: string): Promise<AuthResult>
    async verifyToken(token: string): Promise<JWTPayload>
    
    // Cookie management
    setAuthCookie(res: FastifyReply, token: string): void
    clearAuthCookie(res: FastifyReply): void
    getAuthToken(req: FastifyRequest): string | undefined
    
    // Organization context
    setOrganizationContext(res: FastifyReply, orgId: string): void
    getOrganizationContext(req: FastifyRequest): string | undefined
  }
  ```
- [ ] Replace all direct cookie operations with AuthService methods
- [ ] Implement proper error handling for cookie failures
- [ ] Add retry logic with exponential backoff for auth operations

### 0.3 tRPC Context & Middleware Patterns ⏳

#### Current Architecture
- **Context Creation**: `/apps/backend/src/trpc/context.ts`
- **Middleware**: `/apps/backend/src/trpc/middleware.ts`
- **Procedures**: `/apps/backend/src/trpc/procedures.ts`

#### Canonical Procedure Hierarchy
```typescript
publicProcedure         // No auth required
    ↓
protectedProcedure      // Requires valid JWT
    ↓
organizationProcedure   // Requires organization context
    ↓
organizationAdminProcedure  // Requires ADMIN or OWNER role
    ↓
organizationOwnerProcedure  // Requires OWNER role only
```

#### Specific Tasks
- [ ] Ensure all routers use appropriate base procedures
- [ ] Standardize error codes across all procedures:
  ```typescript
  - UNAUTHORIZED: No valid auth
  - FORBIDDEN: No permission
  - NOT_FOUND: Resource missing
  - BAD_REQUEST: Invalid input
  - CONFLICT: Duplicate/conflict
  - PRECONDITION_FAILED: Business rule violation
  ```
- [ ] Add consistent audit logging for mutations
- [ ] Implement transaction patterns for complex operations

### 0.4 Database Connection & Testing Patterns ⏳

#### Dual-Role Architecture
1. **Admin Role** (`ventry`): Superuser for migrations and test setup
2. **App Role** (`ventry_app`): Limited privileges with RLS enforcement

#### Connection Patterns
```typescript
// CORRECT - Integration test setup
export function createTestConnections() {
  const adminPrisma = new PrismaClient({
    datasources: { db: { url: DATABASE_ADMIN_URL } }
  });
  
  const appPrisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } }
  });
  
  return { adminPrisma, appPrisma };
}

// CORRECT - Test pattern
beforeEach(async () => {
  const { adminPrisma, appPrisma } = createTestConnections();
  // Setup with adminPrisma
  await adminPrisma.organization.create({...});
  // DO NOT DISCONNECT HERE
});

it('enforces RLS', async () => {
  // Test with appPrisma
  const result = await withRLS(appPrisma, context, async (tx) => {
    return await tx.item.findMany();
  });
});
```

#### Specific Tasks
- [ ] Document connection URL requirements in `.env.example`
- [ ] Update all integration tests to use dual connections
- [ ] Remove any `prisma.$disconnect()` calls in beforeEach/afterEach
- [ ] Ensure proper cleanup in afterEach without breaking connections
- [ ] Add connection pooling configuration for production

## Phase 1: Fix Current Breakages (High Priority) - 1-2 days

### 1.1 Immediate Code Fixes 🚧

#### Remove Console Logs from Production
- [ ] Remove temporary debug logging from `/apps/backend/src/trpc/context.ts`
- [ ] Add ESLint rule to prevent console.log in production code
- [ ] Replace with Pino logger where needed

#### Fix Failing RLS E2E Test
- [ ] Update `rls-e2e.integration.spec.ts` to match working pattern:
  ```typescript
  // REMOVE this pattern:
  await adminPrisma.$disconnect();
  adminPrisma = new PrismaClient({...});
  
  // REPLACE with persistent connections:
  let adminPrisma: PrismaClient;
  let appPrisma: PrismaClient;
  
  beforeAll(() => {
    const connections = createTestConnections();
    adminPrisma = connections.adminPrisma;
    appPrisma = connections.appPrisma;
  });
  
  afterAll(async () => {
    await adminPrisma.$disconnect();
    await appPrisma.$disconnect();
  });
  ```

### 1.2 Remove All Deprecated Code ⏳
- [ ] Delete `/apps/backend/src/lib/rls-middleware-v2.ts`
- [ ] Delete `/apps/backend/src/lib/rls-middleware.ts` (keep only `/lib/rls/`)
- [ ] Remove all imports of deprecated middleware
- [ ] Update any remaining references to use `/lib/rls/index.js`
- [ ] Delete unused test utilities that don't follow dual-connection pattern

### 1.3 Fix Auth Provider Race Conditions ⏳
- [ ] In `/apps/web/src/providers/auth-provider.tsx`:
  ```typescript
  // Add proper state synchronization
  const login = useCallback(async (credentials) => {
    const result = await loginMutation.mutateAsync(credentials);
    // Add delay before refetch to ensure cookies are set
    await new Promise(resolve => setTimeout(resolve, 100));
    await authQuery.refetch();
    return result;
  }, []);
  ```
- [ ] Replace `window.__organizationId` with Zustand store
- [ ] Add proper error boundaries around auth operations

## Phase 2: Standardize Core Patterns (High Priority) - 2-3 days

### 2.1 tRPC Router Standardization ⏳

#### Canonical Router Pattern
All routers MUST follow this structure (from working routers like `items.ts`):

```typescript
// 1. Imports (specific order)
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

// 2. Input schemas (create, update, filter)
const itemCreateSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  // ...
});

// 3. Router export (no type annotation)
export const itemsRouter = createTRPCRouter({
  // List with filters
  list: organizationProcedure
    .input(filterSchema)
    .query(async ({ ctx, input }) => {
      // Always include pagination metadata
      return {
        items: result,
        pagination: {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),
    
  // Standard CRUD operations...
});
```

#### Specific Tasks
- [ ] Audit all routers for consistency
- [ ] Ensure all use `organizationProcedure` (not `protectedProcedure`) for business operations
- [ ] Add pagination to all list operations
- [ ] Standardize error messages across routers
- [ ] Add audit logging to all mutations

### 2.2 Unified Cookie & Token Management ⏳

#### Create Centralized Services
- [ ] Create `/apps/backend/src/services/cookie-service.ts`:
  ```typescript
  export class CookieService {
    static readonly COOKIE_NAMES = {
      AUTH_TOKEN: 'auth-token',
      ACTIVE_ORGANIZATION: 'active-organization',
      REFRESH_TOKEN: 'refresh-token',
    } as const;
    
    static setSignedCookie(res: FastifyReply, name: string, value: string, options?: CookieOptions): void
    static getSignedCookie(req: FastifyRequest, name: string): string | undefined
    static clearCookie(res: FastifyReply, name: string): void
  }
  ```

- [ ] Update all cookie operations to use CookieService
- [ ] Remove duplicate cookie handling code
- [ ] Add proper TypeScript types for all cookie operations

### 2.3 RLS Testing Pattern Enforcement ⏳

#### Standardize All RLS Tests
- [ ] Create test template in `/apps/backend/src/test-utils/rls-test-template.ts`
- [ ] Update all RLS tests to follow the template:
  ```typescript
  describe('Entity RLS', () => {
    let adminPrisma: PrismaClient;
    let appPrisma: PrismaClient;
    let testContext: RLSContext;
    
    beforeAll(() => {
      const connections = createTestConnections();
      adminPrisma = connections.adminPrisma;
      appPrisma = connections.appPrisma;
    });
    
    beforeEach(async () => {
      // Setup test data with adminPrisma
      const org = await adminPrisma.organization.create({...});
      testContext = { userId: user.id, organizationId: org.id, bypassRLS: false };
    });
    
    afterEach(async () => {
      // Cleanup with adminPrisma
      await adminPrisma.$executeRawUnsafe('DELETE FROM ...');
    });
    
    afterAll(async () => {
      await adminPrisma.$disconnect();
      await appPrisma.$disconnect();
    });
    
    it('enforces organization isolation', async () => {
      const result = await withRLS(appPrisma, testContext, async (tx) => {
        return await tx.entity.findMany();
      });
      expect(result.data).toHaveLength(1);
    });
  });
  ```

### 2.4 Frontend Auth State Management ⏳

#### Replace Global State Anti-patterns
- [ ] Create `/apps/web/src/stores/organization-store.ts`:
  ```typescript
  interface OrganizationStore {
    activeOrganizationId: string | null;
    setActiveOrganization: (id: string) => void;
    clearActiveOrganization: () => void;
  }
  ```
- [ ] Remove ALL `window.__organizationId` usage
- [ ] Update tRPC client to include organization header:
  ```typescript
  headers: () => ({
    'x-organization-id': organizationStore.getState().activeOrganizationId,
  })
  ```

## Phase 3: Security & Performance Foundation - 2-3 days

### 3.1 Implement Proper Authentication Flow ⏳

#### Auth Service Implementation
- [ ] Create `/apps/backend/src/services/auth-service.ts` with:
  ```typescript
  export class AuthService {
    private readonly cookieService = new CookieService();
    private readonly logger = createLogger('auth-service');
    
    async login(credentials: LoginInput): Promise<AuthResult> {
      // 1. Validate credentials
      // 2. Generate JWT with minimal payload
      // 3. Set signed httpOnly cookie
      // 4. Create audit log entry
      // 5. Return user data (no sensitive info)
    }
    
    async refreshToken(token: string): Promise<AuthResult> {
      // Currently throws NOT_IMPLEMENTED - implement this
    }
    
    async logout(userId: string, res: FastifyReply): Promise<void> {
      // 1. Clear auth cookie
      // 2. Clear organization cookie
      // 3. Invalidate any sessions
      // 4. Audit log
    }
  }
  ```

#### Refresh Token Implementation
- [ ] Add refresh token table to Prisma schema:
  ```prisma
  model RefreshToken {
    id        String   @id @default(cuid())
    token     String   @unique @db.VarChar(500)
    userId    String   @map("user_id")
    user      User     @relation(fields: [userId], references: [id])
    expiresAt DateTime @map("expires_at")
    createdAt DateTime @default(now()) @map("created_at")
    
    @@map("refresh_tokens")
  }
  ```
- [ ] Implement secure refresh token generation
- [ ] Add token rotation on each refresh
- [ ] Set 30-day expiration with sliding window

### 3.2 Database Performance & Connection Management ⏳

#### Connection Pooling Configuration
- [ ] Update `/packages/database/client.ts`:
  ```typescript
  export const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Production pooling settings
    ...(process.env.NODE_ENV === 'production' && {
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
          connectionLimit: parseInt(process.env.DB_POOL_SIZE || '20'),
          connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10'),
        },
      },
    }),
  });
  ```

#### Add Missing Indexes for RLS Performance
- [ ] Create migration for RLS policy optimization:
  ```sql
  -- Indexes for RLS policy evaluation
  CREATE INDEX CONCURRENTLY idx_organization_members_user_org 
    ON organization_members(user_id, organization_id);
  
  CREATE INDEX CONCURRENTLY idx_items_org_sku 
    ON items(organization_id, sku);
  
  CREATE INDEX CONCURRENTLY idx_inventory_org_location 
    ON inventory(organization_id, location_id);
  ```

### 3.3 Security Hardening ⏳

#### Rate Limiting Implementation
- [ ] Add rate limiting middleware using `@fastify/rate-limit`:
  ```typescript
  // Auth endpoints - strict limits
  app.register(rateLimit, {
    max: 5,
    timeWindow: '1 minute',
    skipSuccessfulRequests: false,
  });
  
  // API endpoints - reasonable limits  
  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.user?.id || req.ip,
  });
  ```

#### Security Headers & CSRF Protection
- [ ] Configure security headers in Fastify
- [ ] Implement CSRF token for state-changing operations
- [ ] Add Content Security Policy
- [ ] Enable HSTS for production

### 3.4 Monitoring & Observability ⏳

#### Structured Logging Enhancement
- [ ] Add request ID to all log entries
- [ ] Include organization context in logs
- [ ] Add performance metrics to critical operations:
  ```typescript
  const startTime = Date.now();
  const result = await operation();
  logger.info({
    operation: 'items.list',
    duration: Date.now() - startTime,
    organizationId: ctx.organizationId,
    resultCount: result.length,
  }, 'Operation completed');
  ```

#### Health Checks
- [ ] Create `/health` endpoint with:
  - Database connectivity check
  - Redis connectivity check (when added)
  - Disk space check
  - Memory usage

## Phase 4: MVP Features (After Infrastructure) - 3-5 days

### 4.1 Core Inventory Features ⏳
Focus on the essentials only:
- [ ] Items CRUD with proper RLS
- [ ] Inventory levels and adjustments
- [ ] Basic stock movement tracking
- [ ] Low stock alerts
- [ ] Simple reporting dashboard

### 4.2 Organization Management ⏳
- [ ] Organization switching UI
- [ ] Basic member management
- [ ] Role-based permissions (using existing roles)

### 4.3 Testing & Documentation ⏳
- [ ] Integration tests for all critical paths
- [ ] E2E tests for auth flow
- [ ] API documentation generation
- [ ] Update README.md and TODO.md

## Critical Patterns Reference

### RLS Pattern Summary
```typescript
// ALWAYS use this pattern for RLS operations
import { withRLS } from '@/lib/rls/index.js';

// In tests: dual connections
const { adminPrisma, appPrisma } = createTestConnections();

// In production: RLS proxy
const prisma = createRLSProxy(basePrisma, () => rlsContext);
```

### Authentication Pattern Summary
```typescript
// JWT minimal payload
{ userId: string, organizationId?: string }

// Cookie priority
1. Signed httpOnly cookie
2. Authorization header

// Organization context priority
1. x-organization-id header
2. active-organization cookie
3. JWT organizationId
```

### tRPC Pattern Summary
```typescript
// Procedure hierarchy
publicProcedure → protectedProcedure → organizationProcedure → adminProcedure → ownerProcedure

// Always return pagination
return { items, pagination: { page, limit, total, totalPages } }

// Consistent errors
throw new TRPCError({ code: 'FORBIDDEN', message: 'Clear user message' })
```

## Current Blockers & Immediate Actions

### Critical Issues Blocking Development
1. **RLS E2E Test Failure** ❌
   - **Issue**: Database connection isolation in `rls-e2e.integration.spec.ts`
   - **Root Cause**: `adminPrisma.$disconnect()` breaks transaction visibility
   - **Fix**: Remove disconnect/reconnect pattern, use persistent connections
   
2. **Auth Provider Race Condition** ❌
   - **Issue**: Login → immediate auth check fails intermittently
   - **Root Cause**: Cookies not fully set before refetch
   - **Fix**: Add 100ms delay after login before auth query refetch

3. **Global State Anti-pattern** ❌
   - **Issue**: `window.__organizationId` breaks in SSR and is fragile
   - **Root Cause**: Quick hack that became technical debt
   - **Fix**: Replace with Zustand store + tRPC header

## Success Criteria for MVP

### Infrastructure (Must Have)
- ✅ Database-level RLS working correctly
- ✅ Dual-role database architecture
- ✅ Signed httpOnly cookies for auth
- ✅ Type-safe tRPC procedures
- ❌ All tests passing (currently blocked)
- ❌ Consistent patterns across codebase
- ❌ No console.log in production
- ❌ Proper error handling everywhere

### Features (Nice to Have)
- ⏳ Basic inventory CRUD
- ⏳ Organization switching
- ⏳ Simple reporting
- ⏳ Member management

### Documentation
- ❌ Updated README.md
- ❌ Updated TODO.md
- ❌ Environment variables documented
- ❌ Deployment guide

## Development Philosophy

1. **Fix infrastructure before features** - A broken foundation means fragile features
2. **One pattern per concern** - Not three ways to handle cookies
3. **Test the hard stuff** - RLS and multi-tenancy are critical
4. **Security is not optional** - Database-level enforcement only
5. **Type safety everywhere** - If it compiles, it should work

## Notes for Developers

### When Working on RLS
- ALWAYS use dual connections in tests
- NEVER disconnect in beforeEach
- ALWAYS clean up with admin connection
- NEVER create backdoor policies

### When Working on Auth
- ALWAYS use signed cookies
- NEVER store tokens in localStorage  
- ALWAYS include minimal JWT payload
- NEVER trust client-side org context

### When Working on tRPC
- ALWAYS use appropriate procedure type
- NEVER use protectedProcedure for org data
- ALWAYS include pagination metadata
- NEVER throw generic errors

---

Last Updated: 2025-01-17
Next Review: After Phase 1 completion

**Remember**: An elegant MVP is better than a complex mess. Keep it simple, secure, and standardized.