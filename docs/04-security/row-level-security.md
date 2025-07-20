# Row-Level Security (RLS) Guide

This guide covers Ventry's implementation of PostgreSQL Row-Level Security for multi-tenant data isolation.

## Overview

Row-Level Security (RLS) ensures that users can only access data belonging to their organization. It provides database-level enforcement of data isolation, making it impossible to accidentally expose data across tenants.

## Architecture

### Security Layers

```
┌─────────────────────────────────────────┐
│          Application Layer              │
│  - tRPC procedures filter by org        │
│  - JWT contains organizationId          │
└────────────────┬───────────────────────┘
                 │
┌────────────────▼───────────────────────┐
│          Database Layer (RLS)           │
│  - Policies enforce organization scope  │
│  - Session variables set context        │
│  - BYPASSRLS disabled for app user      │
└─────────────────────────────────────────┘
```

### User Architecture

```typescript
// Two database users with different privileges
const ADMIN_USER = 'ventry';           // BYPASSRLS for migrations
const APP_USER = 'ventry_app';         // No BYPASSRLS, subject to RLS
```

## Implementation

### 1. RLS Functions

```sql
-- Set RLS context for current transaction
CREATE OR REPLACE FUNCTION set_rls_context(
  p_user_id TEXT,
  p_organization_id TEXT
) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', p_user_id, true);
  PERFORM set_config('app.current_organization_id', p_organization_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear RLS context
CREATE OR REPLACE FUNCTION clear_rls_context() RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', '', true);
  PERFORM set_config('app.current_organization_id', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current organization (used in policies)
CREATE OR REPLACE FUNCTION current_organization_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_organization_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;
```

### 2. RLS Policies

```sql
-- Enable RLS on table
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Create policy for organization-scoped access
CREATE POLICY items_org_isolation ON items
  USING (organization_id = current_organization_id());

-- Create policy for user's own data
CREATE POLICY users_self_access ON users
  USING (id = current_user_id());

-- Create policy for organization members
CREATE POLICY org_members_access ON organization_members
  USING (
    organization_id = current_organization_id() 
    AND user_id = current_user_id()
  );
```

### 3. Application Integration

```typescript
// Backend: Set RLS context for each request
export async function createContext({ req, res }: CreateContextOptions) {
  const auth = await authenticateRequest(req);
  
  if (auth) {
    // Set RLS context in database
    await prisma.$executeRawUnsafe(
      'SELECT set_rls_context($1, $2)',
      auth.user.id,
      auth.organizationId
    );
  }
  
  return {
    prisma,
    user: auth?.user,
    organizationId: auth?.organizationId,
  };
}

// Cleanup after request
server.addHook('onResponse', async () => {
  await prisma.$executeRawUnsafe('SELECT clear_rls_context()');
});
```

## Policy Patterns

### 1. Simple Organization Scope

```sql
-- Most common pattern
CREATE POLICY table_org_isolation ON table_name
  USING (organization_id = current_organization_id());
```

### 2. User-Specific Access

```sql
-- For user profile data
CREATE POLICY users_self_or_org ON users
  USING (
    id = current_user_id() 
    OR id IN (
      SELECT user_id FROM organization_members 
      WHERE organization_id = current_organization_id()
    )
  );
```

### 3. Role-Based Access

```sql
-- Different access based on role
CREATE POLICY items_write_access ON items
  FOR INSERT
  USING (
    organization_id = current_organization_id()
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = current_user_id()
        AND organization_id = items.organization_id
        AND role IN ('OWNER', 'ADMIN', 'MEMBER')
    )
  );
```

### 4. Hierarchical Access

```sql
-- Access to child records through parent
CREATE POLICY order_items_through_order ON order_items
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.organization_id = current_organization_id()
    )
  );
```

## Testing RLS

### 1. Unit Tests

```typescript
describe('RLS Policies', () => {
  it('should isolate data by organization', async () => {
    // Set context for org1
    await prisma.$executeRawUnsafe(
      'SELECT set_rls_context($1, $2)',
      'user1',
      'org1'
    );
    
    const org1Items = await prisma.item.findMany();
    
    // Switch to org2
    await prisma.$executeRawUnsafe(
      'SELECT set_rls_context($1, $2)',
      'user2',
      'org2'
    );
    
    const org2Items = await prisma.item.findMany();
    
    // Verify isolation
    expect(org1Items).not.toEqual(org2Items);
    expect(org1Items.every(i => i.organizationId === 'org1')).toBe(true);
    expect(org2Items.every(i => i.organizationId === 'org2')).toBe(true);
  });
});
```

### 2. Integration Tests

```typescript
describe('Multi-tenant isolation', () => {
  it('should prevent cross-organization access', async () => {
    // Create test data
    const org1Item = await createItemForOrg('org1');
    const org2Item = await createItemForOrg('org2');
    
    // Login as org1 user
    const caller1 = await createCallerForOrg('org1');
    const items1 = await caller1.items.list();
    
    // Should only see org1 items
    expect(items1.items).toContainEqual(
      expect.objectContaining({ id: org1Item.id })
    );
    expect(items1.items).not.toContainEqual(
      expect.objectContaining({ id: org2Item.id })
    );
  });
});
```

### 3. SQL Testing

```sql
-- Test as org1
SELECT set_rls_context('user1', 'org1');
SELECT COUNT(*) FROM items; -- Should only count org1 items

-- Test as org2
SELECT set_rls_context('user2', 'org2');
SELECT COUNT(*) FROM items; -- Should only count org2 items

-- Test with no context (should return nothing)
SELECT clear_rls_context();
SELECT COUNT(*) FROM items; -- Should be 0
```

## Common Issues

### 1. "permission denied for table"

**Cause**: RLS enabled but no policies defined

**Solution**:
```sql
-- Always create at least one policy when enabling RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_org_isolation ON items
  USING (organization_id = current_organization_id());
```

### 2. No data returned

**Cause**: RLS context not set or incorrect

**Solution**:
```typescript
// Verify context is set
const [context] = await prisma.$queryRaw`
  SELECT current_setting('app.current_organization_id', true) as org_id
`;
console.log('Current context:', context);
```

### 3. Can see all organizations' data

**Cause**: Using admin user with BYPASSRLS

**Solution**:
```typescript
// Use app user for runtime queries
const APP_DATABASE_URL = process.env.DATABASE_URL.replace(
  'postgresql://ventry:',
  'postgresql://ventry_app:'
);
```

## Performance Considerations

### 1. Index Organization ID

```sql
-- Critical for RLS performance
CREATE INDEX idx_items_organization_id ON items(organization_id);
CREATE INDEX idx_orders_organization_id ON orders(organization_id);
-- Create for all tables with RLS
```

### 2. Optimize Policies

```sql
-- Prefer direct column comparison
CREATE POLICY fast_policy ON items
  USING (organization_id = current_organization_id());

-- Over complex JOINs
CREATE POLICY slow_policy ON items
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON om.organization_id = o.id
      WHERE om.user_id = current_user_id()
        AND o.id = items.organization_id
    )
  );
```

### 3. Monitor Performance

```sql
-- Check policy execution time
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM items 
WHERE organization_id = 'org-id';

-- Look for RLS filter in plan
-- -> Filter: (organization_id = current_organization_id())
```

## Security Checklist

- [ ] All business tables have RLS enabled
- [ ] Each table has appropriate policies
- [ ] App user does NOT have BYPASSRLS
- [ ] Admin user only used for migrations
- [ ] RLS context set for every request
- [ ] RLS context cleared after request
- [ ] Organization ID indexed on all tables
- [ ] Policies tested for data isolation
- [ ] No hardcoded organization IDs
- [ ] Audit logs track RLS context

## Debugging RLS

### 1. Check Current Context

```sql
-- What context is currently set?
SELECT 
  current_setting('app.current_user_id', true) as user_id,
  current_setting('app.current_organization_id', true) as org_id;
```

### 2. Test Policies Directly

```sql
-- Test what a specific user/org can see
BEGIN;
SELECT set_rls_context('user-id', 'org-id');
SELECT * FROM items LIMIT 10;
ROLLBACK;
```

### 3. Bypass RLS for Debugging

```sql
-- As superuser only, for debugging
SET row_security = off;
SELECT * FROM items WHERE organization_id = 'org-id';
SET row_security = on;
```

## Best Practices

1. **Always use RLS context functions** - Don't set session variables directly
2. **Test with multiple organizations** - Verify isolation works
3. **Index organization_id** - Critical for performance
4. **Keep policies simple** - Complex policies hurt performance
5. **Use SECURITY DEFINER carefully** - Only for RLS functions
6. **Monitor slow queries** - RLS can impact performance
7. **Document policy logic** - Explain why each policy exists
8. **Regular security audits** - Verify RLS is working correctly

## Related Documentation

- [Authentication Guide](./authentication.md) - How auth provides context
- [Security Overview](./security-overview.md) - Overall security architecture
- [Database Schema](../02-architecture/database-schema.md) - Table structures
- [Testing Guide](../03-development/testing-guide.md) - Testing strategies