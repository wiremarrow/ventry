# Row-Level Security (RLS) Implementation Guide for Ventry

## 🚨 Critical Context for New Claude Code Agents

This document contains everything you need to know about the RLS implementation in Ventry. Read this completely before making any changes to the security infrastructure.

## Table of Contents
1. [Current State Overview](#current-state-overview)
2. [Database Architecture](#database-architecture)
3. [RLS Implementation Details](#rls-implementation-details)
4. [Migration Management](#migration-management)
5. [Testing Infrastructure](#testing-infrastructure)
6. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
7. [Next Steps](#next-steps)

---

## Current State Overview

### ✅ Implementation Status (As of 2025-07-17)
- **Production RLS Module**: Fully implemented in `/apps/backend/src/lib/rls/`
- **Middleware Migration**: Complete - all code using canonical RLS implementation
- **Test Migration**: All RLS tests updated to use dual-connection pattern
- **Database Policies**: Basic organization isolation policies in place
- **ID Format**: Enforces CUID format (25 lowercase alphanumeric) at database level

### What We've Implemented
- **Row-Level Security (RLS)** at the PostgreSQL database level
- **Dual-role architecture**: `ventry` (superuser) and `ventry_app` (application role)
- **Text-based RLS functions** (NOT UUID - we use CUID format)
- **Minimal organization policies** for secure multi-tenancy
- **Dual connection testing pattern** for proper RLS validation
- **Production-ready RLS service** with audit logging and metrics hooks

### Key Architecture Decisions
1. **Database-level RLS** (not just application level) for true security
2. **FORCE ROW LEVEL SECURITY** on all protected tables
3. **No test backdoors** in production schema
4. **Minimal policies** - start secure, expand carefully
5. **Strict CUID validation** at database level via `set_rls_context()` function

---

## Database Architecture

### Database Roles

#### 1. `ventry` (Superuser)
- **Purpose**: Migrations, admin tasks, test data setup
- **Privileges**: Full superuser access
- **When to use**: 
  - Running migrations
  - Test data setup in beforeAll()
  - Administrative tasks

#### 2. `ventry_app` (Application Role)
- **Purpose**: Runtime application connections
- **Privileges**: 
  - NO superuser
  - NO BYPASSRLS
  - NO CREATE on schema
  - SELECT, INSERT, UPDATE, DELETE on tables
  - EXECUTE on RLS functions
- **When to use**: 
  - All application runtime queries
  - Test assertions
  - Production connections

### Creating Roles (if needed)
```sql
-- Create application role
CREATE ROLE ventry_app LOGIN PASSWORD 'ventry_app_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE ventry_dev TO ventry_app;
GRANT USAGE ON SCHEMA public TO ventry_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ventry_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ventry_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ventry_app;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ventry_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ventry_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ventry_app;
```

### Connection URLs
```bash
# Admin/Superuser connection
DATABASE_ADMIN_URL=postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev

# Application connection (limited privileges)
DATABASE_URL=postgresql://ventry_app:ventry_app_password@localhost:5487/ventry_dev

# Test databases
DATABASE_ADMIN_URL=postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test
DATABASE_URL=postgresql://ventry_app:ventry_app_password@localhost:5487/ventry_integration_test
```

---

## RLS Implementation Details

### Core RLS Functions

All located in `/packages/database/prisma/migrations/20250716_fix_rls_text_types/migration.sql`:

```sql
-- Returns current organization context (TEXT/CUID format)
current_organization_id() RETURNS TEXT

-- Returns current user context (TEXT/CUID format)  
current_user_id() RETURNS TEXT

-- Sets RLS context for the session
set_rls_context(p_organization_id TEXT, p_user_id TEXT) RETURNS VOID
```

**CRITICAL**: These return TEXT not UUID! We use CUID format (25 character strings).

### Current Policies

#### Organizations Table
```sql
-- Members can view their organizations
CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = public.organizations.id
      AND m.user_id = current_user_id()
    )
  );

-- Owners can update their organizations  
CREATE POLICY organizations_update_owner ON public.organizations
  FOR UPDATE
  USING (...) WITH CHECK (...);
```

**NO INSERT POLICY** - Organizations are created through admin connections only.

#### Organization Members Table
```sql
-- Simplified to avoid recursion
CREATE POLICY organization_members_view_own ON public.organization_members
  FOR SELECT
  USING (user_id = current_user_id());
```

#### Other Tables with RLS
- `items` - Standard tenant isolation
- `item_categories` - Standard tenant isolation  
- `warehouses` - Standard tenant isolation
- `inventory` - Via warehouse relationship
- `locations` - Via warehouse relationship
- `audit_logs` - Tenant isolation + system insert

### How RLS Context Works

1. **Application sets context** via `set_rls_context()` in each transaction
2. **Policies read context** via `current_organization_id()` and `current_user_id()`
3. **Automatic filtering** happens at database level

Example from tRPC context (`/apps/backend/src/trpc/context.ts`):
```typescript
const prisma = createRLSProxy(basePrisma, () => ({
  userId: user.id,
  organizationId: user.organizationId,
  bypassRLS: false
}));
```

---

## Migration Management

### Migration Files Location
`/packages/database/prisma/migrations/`

### Key Migrations (in order)
1. `20250115_add_rls_functions` - Initial RLS functions (UUID-based, deprecated)
2. `20250115_add_row_level_security` - Initial policies
3. `20250716_fix_rls_text_types` - **CRITICAL**: Fixed functions to return TEXT
4. `20250716_add_self_select_policies` - User self-selection policies
5. `20250716_force_rls_for_owner` - FORCE ROW LEVEL SECURITY on all tables
6. `20250716_add_minimal_org_policies` - Organization/membership policies
7. `20250716_fix_org_members_recursion` - Fixed infinite recursion bug

### Applying Migrations

**Schema Operations with Admin User**

All Prisma schema operations now automatically use the admin connection through the `migrate-with-admin.sh` script:

```bash
# These commands use DATABASE_ADMIN_URL automatically
pnpm db:push         # Safe to use - uses admin connection
pnpm db:migrate      # Create and apply migrations
pnpm db:reset        # Reset database

# The commands above internally use:
# /packages/database/scripts/migrate-with-admin.sh

# For manual SQL migrations (if needed)
psql $DATABASE_ADMIN_URL -f /path/to/migration.sql
```

### Current Schema State

**IMPORTANT**: The Prisma schema was updated to include:
```prisma
model AuditLog {
  // ... other fields ...
  organizationId String? @map("organization_id") // Added for RLS
  // Note: Relation intentionally omitted until FK verified
}
```

---

## Testing Infrastructure

### Multi-Organization Test Seed

**Purpose**: Test Row-Level Security (RLS) and multi-tenant isolation

```bash
# Create multi-org test data
pnpm --filter @ventry/database db:seed:multi-org
```

**Creates**:
- Multiple organizations (TechStart Inc, GlobalRetail Co)
- Users in different organizations
- Isolated inventory data per organization

**Test Accounts**:
```
# TechStart Inc
- alice@techstart.com / password123 (Admin)
- bob@techstart.com / password123 (Manager)

# GlobalRetail Co
- charlie@globalretail.com / password123 (Admin)
- david@globalretail.com / password123 (Manager)
```

**Testing RLS Isolation**:
1. Login as alice@techstart.com
2. Should only see TechStart data
3. Login as charlie@globalretail.com
4. Should only see GlobalRetail data
5. Data should be completely isolated between orgs

### Dual Connection Pattern

**CRITICAL**: Tests must use two connections:
1. **Admin connection** for test setup (bypasses RLS)
2. **App connection** for test assertions (enforces RLS)

#### Helper: `/apps/backend/src/test-utils/dual-connection.ts`
```typescript
const { adminPrisma, appPrisma } = createTestConnections();

// Use adminPrisma for setup
await adminPrisma.organization.create({...});

// Use appPrisma for testing RLS
const items = await withRLS(appPrisma, context, async (tx) => {
  return tx.item.findMany();
});
```

### Test Patterns

#### ✅ CORRECT Pattern
```typescript
beforeAll(async () => {
  const { adminPrisma } = createTestConnections();
  
  // Setup with admin connection
  await adminPrisma.organization.create({...});
  await adminPrisma.user.create({...});
  await adminPrisma.organizationMember.create({...});
  
  await adminPrisma.$disconnect();
});

it('enforces RLS', async () => {
  // Test with app connection
  const result = await withRLS(appPrisma, context, async (tx) => {
    return tx.item.findMany();
  });
  expect(result).toHaveLength(1); // Only see own org's items
});
```

#### ❌ WRONG Pattern
```typescript
// DON'T try to create orgs with app connection
await appPrisma.organization.create({...}); // FAILS - no INSERT policy

// DON'T use DDL in tests
await prisma.$executeRaw`ALTER TABLE...`; // FAILS - no permissions

// DON'T create test backdoor policies
CREATE POLICY test_bypass USING (current_user_id() IS NULL); // SECURITY HOLE!
```

### Current Test Status

✅ **Working**:
- `rls-e2e.integration.spec.ts` - Uses dual connections correctly
- `rls-simple.integration.spec.ts` - Updated to use dual connections and DB-generated IDs (passing)
- `rls.integration.spec.ts` - Updated to use dual connections and DB-generated IDs (passing)

✅ **Cleanup Complete**:
- Removed `rls-v2.integration.spec.ts` - Was using deprecated middleware
- Removed `rls-middleware-v2.ts` - Deprecated in favor of production RLS module
- Removed `rls-test-helpers.ts` - Unused test utilities

---

## Common Pitfalls & Solutions

### 1. "new row violates row-level security policy"
**Cause**: Trying to INSERT with app role
**Solution**: Use admin connection for test setup

### 2. "infinite recursion detected in policy"
**Cause**: Self-referential policy (policy queries same table)
**Solution**: Simplify policy or use security definer function

### 3. "permission denied for schema public"
**Cause**: App role trying to CREATE/ALTER
**Solution**: Don't grant CREATE privileges; use admin for schema changes

### 4. UUID vs TEXT mismatch
**Cause**: Old migrations assumed UUID
**Solution**: All IDs are TEXT (CUID format) - use current_user_id()::text if needed

### 5. Prisma schema drift
**Cause**: Database has columns Prisma doesn't know about
**Solution**: Update Prisma schema to match, use nullable fields initially

---

## Next Steps

### ✅ Completed Tasks
1. **Update remaining tests** to use dual connection pattern ✓
2. **Migrate to production RLS module** ✓
3. **Remove deprecated middleware** ✓
4. **Enforce CUID format validation** ✓

### 📋 Remaining Tasks
1. **Document RLS in main README.md** and TODO.md (CI requirement)
2. **Add INSERT policies** carefully when needed for specific tables
3. **Test with actual multi-tenant data** to verify isolation

### Future Enhancements
1. **Organization member viewing** - Add policy to see other members (avoiding recursion)
2. **Audit log policies** - Ensure proper isolation with org context  
3. **Performance optimization** - Add indexes for RLS policy conditions
4. **Monitoring** - Add RLS bypass detection and logging
5. **Consider ID format flexibility** - Evaluate supporting both CUID and UUID formats

### Security Checklist
- [ ] NO policies with `current_user_id() IS NULL` conditions
- [ ] NO `WITH CHECK (true)` for INSERT policies
- [ ] NO BYPASSRLS attribute on app role
- [ ] NO CREATE privileges for app role
- [ ] ALL sensitive tables have FORCE ROW LEVEL SECURITY
- [ ] TEST data setup uses admin connection only

---

## Quick Command Reference

```bash
# Check RLS status
psql $DATABASE_URL -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'organizations';"

# Check policies
psql $DATABASE_URL -c "SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename = 'organizations';"

# Check current user privileges
psql $DATABASE_URL -c "SELECT current_user, current_setting('is_superuser')::boolean as is_superuser;"

# Apply migration
psql $DATABASE_URL -f migrations/20250716_add_minimal_org_policies/migration.sql

# Test RLS context
psql $DATABASE_URL -c "SELECT set_rls_context('org_id', 'user_id'); SELECT current_organization_id();"
```

---

## Final Notes

1. **RLS is now REAL** - The database will enforce isolation
2. **Test carefully** - Use dual connections to verify
3. **Start minimal** - Add policies only as needed
4. **No backdoors** - Production schema must be secure
5. **Document everything** - Update docs after any RLS change

**Remember**: With great RLS comes great responsibility. Every policy is a security boundary. Test thoroughly!