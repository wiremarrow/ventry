# Row-Level Security (RLS) Implementation Plan

## Overview

This document outlines the enterprise-grade implementation of Row-Level Security (RLS) for Ventry's multi-tenant architecture. The implementation uses PostgreSQL's native RLS features combined with secure database functions to ensure complete tenant isolation at the database level.

## Architecture

### Security Layers

1. **Database Functions (SECURITY DEFINER)**
   - Validates input at database level
   - Prevents SQL injection
   - Sets session variables securely
   
2. **Row-Level Security Policies**
   - Enforces tenant isolation
   - Transparent to application code
   - Works with all queries automatically

3. **Application Layer Validation**
   - Type-safe context management
   - Audit logging
   - Performance monitoring

## Implementation Status

### ✅ Completed

1. **Secure Context Functions**
   - `set_rls_context(organization_id, user_id)` - Sets session variables
   - `clear_rls_context()` - Clears session variables
   - `get_rls_context()` - Returns current context
   
2. **Application Integration**
   - Updated RLS service to use secure functions
   - Removed SQL injection vulnerabilities
   - Added comprehensive error handling

3. **Migration Scripts**
   - Database function creation
   - Ready for deployment

### ⏳ Pending

1. **RLS Policy Creation**
   - Need to create policies for all 32 tables
   - Test policy effectiveness
   
2. **Integration Testing**
   - Verify tenant isolation
   - Performance benchmarking
   
3. **Production Deployment**
   - Apply migrations
   - Enable RLS on all tables

## Database Functions

### set_rls_context Function

```sql
CREATE OR REPLACE FUNCTION set_rls_context(
  p_organization_id TEXT,
  p_user_id TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_organization_id TEXT;
  v_user_id TEXT;
BEGIN
  -- Validate CUID format at database level
  IF p_organization_id !~ '^[0-9a-z]{25}$' THEN
    RAISE EXCEPTION 'Invalid organization_id format: %', p_organization_id
      USING ERRCODE = 'data_exception';
  END IF;
  
  -- Set session variables securely
  PERFORM set_config('app.current_organization_id', p_organization_id, true);
  
  IF p_user_id IS NOT NULL THEN
    IF p_user_id !~ '^[0-9a-z]{25}$' THEN
      RAISE EXCEPTION 'Invalid user_id format: %', p_user_id
        USING ERRCODE = 'data_exception';
    END IF;
    PERFORM set_config('app.current_user_id', p_user_id, true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Key Security Features:**
- SECURITY DEFINER runs with function owner privileges
- Input validation at database level
- No string concatenation or SQL injection risk
- Transaction-scoped variables (SET LOCAL equivalent)

## Application Integration

### TypeScript Usage

```typescript
// Setting RLS context securely
await tx.$queryRaw`SELECT set_rls_context(${organizationId}, ${userId})`;

// Clearing context
await tx.$queryRaw`SELECT clear_rls_context()`;

// Getting current context (for debugging)
const context = await tx.$queryRaw`SELECT * FROM get_rls_context()`;
```

### Transaction Wrapper

```typescript
export async function withRLS<T>(
  prisma: PrismaClient,
  context: RLSContext,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<RLSOperationResult<T>> {
  return prisma.$transaction(async (tx) => {
    // Set context using secure function
    await tx.$queryRaw`SELECT set_rls_context(${context.organizationId}, ${context.userId})`;
    
    // Execute operation with RLS active
    const result = await operation(tx);
    
    // Context automatically cleared at transaction end
    return result;
  });
}
```

## RLS Policy Implementation

### Base Policy Template

```sql
-- Enable RLS on table
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Create organization isolation policy
CREATE POLICY tenant_isolation ON table_name
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON table_name TO app_user;
```

### Tables Requiring RLS (32 total)

#### High Priority (Direct Organization Reference)
- items
- inventory
- warehouses
- locations
- suppliers
- customers
- orders
- order_items
- purchase_orders
- purchase_order_items

#### Medium Priority (Indirect Organization Reference)
- stock_movements
- shipments
- shipment_items
- inventory_adjustments
- inventory_transfers
- transfer_items
- stock_alerts
- purchase_order_receipts
- receipt_items

#### Low Priority (Reference Tables)
- categories
- units_of_measure
- tax_rates
- payment_terms
- shipping_methods
- adjustment_reasons
- countries
- currencies

#### System Tables (Special Handling)
- organizations
- users
- user_organizations
- organization_invitations
- audit_logs

## Testing Strategy

### Unit Tests

```typescript
describe('RLS Context Functions', () => {
  it('should reject invalid organization IDs', async () => {
    await expect(
      tx.$queryRaw`SELECT set_rls_context(${'invalid-id'}, ${null})`
    ).rejects.toThrow('Invalid organization_id format');
  });
  
  it('should set and retrieve context correctly', async () => {
    const orgId = 'cjld2cjxh0000qzrmn831i7rn';
    await tx.$queryRaw`SELECT set_rls_context(${orgId}, ${null})`;
    
    const context = await tx.$queryRaw`SELECT * FROM get_rls_context()`;
    expect(context[0].organization_id).toBe(orgId);
  });
});
```

### Integration Tests

```typescript
describe('RLS Tenant Isolation', () => {
  it('should prevent cross-tenant data access', async () => {
    // Create data for org1
    await withRLS(prisma, { organizationId: org1Id }, async (tx) => {
      await tx.item.create({ data: itemData });
    });
    
    // Try to access from org2
    await withRLS(prisma, { organizationId: org2Id }, async (tx) => {
      const items = await tx.item.findMany();
      expect(items).toHaveLength(0); // Should not see org1 data
    });
  });
});
```

## Performance Considerations

### Index Requirements

```sql
-- Ensure all tables have indexes on organization_id
CREATE INDEX CONCURRENTLY idx_items_organization_id ON items(organization_id);
CREATE INDEX CONCURRENTLY idx_orders_organization_id ON orders(organization_id);
-- etc. for all tables
```

### Connection Pooling

- RLS context is transaction-scoped
- No session state pollution
- Works perfectly with connection pooling

### Query Performance

- RLS adds minimal overhead
- Policies are optimized by PostgreSQL
- Use EXPLAIN ANALYZE to verify

## Security Best Practices

### 1. Never Bypass RLS in Production
```typescript
// ❌ NEVER do this in production
await prisma.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${orgId}'`);

// ✅ ALWAYS use the secure function
await tx.$queryRaw`SELECT set_rls_context(${orgId}, ${userId})`;
```

### 2. Validate Context at Multiple Levels
- Database function validates CUID format
- Application validates business logic
- RLS policies enforce at query time

### 3. Audit All RLS Operations
```typescript
logger.info({
  event: 'rls.context_set',
  organizationId,
  userId,
  timestamp: new Date()
}, 'RLS context established');
```

### 4. Monitor RLS Performance
```sql
-- Check RLS policy usage
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public';
```

## Deployment Steps

### 1. Development Environment
```bash
# Apply RLS function migration
pnpm db:migrate

# Verify functions exist
psql $DATABASE_URL -c "\\df set_rls_context"
```

### 2. Staging Environment
```bash
# Run migration with safety checks
DATABASE_URL=$STAGING_URL pnpm db:migrate

# Test RLS functionality
pnpm test:integration
```

### 3. Production Deployment
```bash
# Backup database first
./tools/scripts/backup-database.sh

# Apply migrations during maintenance window
DATABASE_URL=$PROD_URL pnpm db:migrate

# Verify and monitor
pnpm test:rls:production
```

## Troubleshooting

### Common Issues

1. **"function set_rls_context does not exist"**
   - Run migrations: `pnpm db:migrate`
   - Check function permissions

2. **"Invalid organization_id format"**
   - Ensure valid CUID format (25 chars, lowercase alphanumeric)
   - Check for null/undefined values

3. **"permission denied for function"**
   - Grant execute permissions: `GRANT EXECUTE ON FUNCTION set_rls_context TO app_user;`

### Debug Queries

```sql
-- Check current RLS context
SELECT * FROM get_rls_context();

-- View all RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relnamespace = 'public'::regnamespace;
```

## Next Steps

1. **Immediate**
   - [ ] Apply function migration to development database
   - [ ] Test RLS service with new functions
   - [ ] Create RLS policies for critical tables

2. **This Week**
   - [ ] Complete RLS policies for all 32 tables
   - [ ] Write comprehensive integration tests
   - [ ] Performance benchmark with RLS enabled

3. **Before Production**
   - [ ] Security audit of RLS implementation
   - [ ] Load test with 1000+ concurrent tenants
   - [ ] Document emergency bypass procedures

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [Multi-tenant Architecture Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/overview)