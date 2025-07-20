# Row-Level Security Guide

## Overview

Ventry uses PostgreSQL Row-Level Security (RLS) for enterprise-grade tenant isolation. Every query automatically filters by organization context - no application code needed.

## Architecture

1. **One SECURITY DEFINER function** (`set_rls_context`) validates IDs and sets session variables
2. **One Prisma wrapper** calls this function once per transaction
3. **One policy per table** checks `organization_id = current_setting('app.current_organization_id')`

That's it. No roles, no complexity.

## Usage

```typescript
// The withRLS wrapper handles everything
const warehouses = await withRLS(prisma, context, async (tx) => {
  return tx.warehouse.findMany(); // Automatically filtered by organization
});
```

## Adding a New Table

1. Add to migration:
```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON new_table
  USING (organization_id = current_setting('app.current_organization_id'));
```

2. That's it. The pgTAP test will catch if you forget.

## Future Extensions (When Needed)

### JWT Claims Support
```sql
-- Add this function when you need JWT support
CREATE FUNCTION current_jwt_claim(claim TEXT) RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>claim;
$$ LANGUAGE sql;
```

### Header Injection
```typescript
// Add to tRPC context when needed
const orgId = req.headers['x-organization-id'] || context.organizationId;
```

### Supabase Compatibility
```sql
-- Add these aliases if migrating from Supabase
CREATE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT current_setting('app.current_user_id', true)::uuid;
$$ LANGUAGE sql;
```

## Testing

Run pgTAP tests to verify RLS coverage:
```bash
psql $DATABASE_URL -f packages/database/tests/rls_coverage.sql
```

## Security

- Database validates CUID format
- Session variables are transaction-scoped
- No SQL injection possible with SECURITY DEFINER
- Policies enforced at query time, not application time