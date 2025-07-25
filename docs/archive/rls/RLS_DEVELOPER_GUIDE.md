# Row-Level Security (RLS) Developer Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Usage Guide](#usage-guide)
4. [Security Considerations](#security-considerations)
5. [Performance Guidelines](#performance-guidelines)
6. [Troubleshooting](#troubleshooting)
7. [Migration Guide](#migration-guide)

## Overview

Row-Level Security (RLS) is a PostgreSQL feature that provides fine-grained access control at the database level. In Ventry, RLS ensures that users can only access data belonging to their organization, providing strong multi-tenant isolation.

### Key Benefits

- **Database-level security**: Even if application code has bugs, the database enforces access control
- **Performance**: PostgreSQL optimizes queries with RLS policies
- **Transparency**: Application code doesn't need to manually filter by organization
- **Auditability**: All access is logged and can be traced

## Architecture

### Components

```
┌─────────────────────┐
│   tRPC Context      │
│ (Authentication)    │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   RLS Proxy         │
│ (Type-safe wrapper) │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   RLS Service       │
│ (Context & Validation)│
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  PostgreSQL with    │
│  RLS Policies       │
└─────────────────────┘
```

### File Structure

```
src/lib/rls/
├── constants.ts       # RLS constants and configuration
├── types.ts          # TypeScript types and validation
├── rls-service.ts    # Core RLS service implementation
├── rls-proxy.ts      # Type-safe Prisma proxy
├── transaction-manager.ts # Transaction handling
├── index.ts          # Public API exports
└── __tests__/        # Comprehensive test suite
```

## Usage Guide

### Basic Usage

The RLS system is automatically integrated with the tRPC context. When you use the Prisma client from the context, RLS is applied:

```typescript
// In a tRPC router
export const itemsRouter = createTRPCRouter({
  list: organizationProcedure.query(async ({ ctx }) => {
    // This automatically filters by the user's organization
    return ctx.prisma.item.findMany();
  }),
});
```

### Manual RLS Operations

For special cases where you need more control:

```typescript
import { withRLS } from '@/lib/rls';

// Execute a query with specific RLS context
const result = await withRLS(
  prisma,
  {
    organizationId: 'org_123',
    userId: 'user_456',
  },
  async (tx) => {
    return tx.item.findMany();
  }
);

// Access timing information
console.log(`Query took ${result.timing.queryMs}ms`);
```

### Bypassing RLS (Use with Caution!)

Some system operations need to bypass RLS:

```typescript
import { withRLS } from '@/lib/rls';

// Bypass RLS for system maintenance
const result = await withRLS(
  prisma,
  {
    bypassRLS: true,
    bypassReason: 'System data migration for all organizations',
  },
  async (tx) => {
    // This can access all data
    return tx.organization.findMany();
  }
);
```

**Important**: All RLS bypasses are logged for security auditing.

### Testing with RLS

In tests, you can create specific RLS contexts:

```typescript
import { createIntegrationContext } from '@/test-utils/trpc-test-client';

describe('Items Router', () => {
  it('should only return organization items', async () => {
    const { ctx, organization } = await createIntegrationContext();

    // Create items in different organizations
    await ctx.prisma.item.create({
      data: {
        name: 'Visible Item',
        organizationId: organization.id,
      },
    });

    await ctx.prisma.item.create({
      data: {
        name: 'Invisible Item',
        organizationId: 'other-org-id',
      },
    });

    // This should only return the visible item
    const items = await ctx.prisma.item.findMany();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Visible Item');
  });
});
```

## Security Considerations

### Input Validation

All inputs are validated to prevent SQL injection:

```typescript
// ✅ Good - Uses validated CUID format
const context = {
  organizationId: 'clh3sa7gu0000qzrmn831i7rn',
  userId: 'clh3sa7gu0000qzrmn831i7ro',
};

// ❌ Bad - Invalid format will be rejected
const context = {
  organizationId: '../../../etc/passwd',
  userId: "'; DROP TABLE items; --",
};
```

### Audit Logging

All RLS operations are logged:

- Context setting
- Bypass requests
- Validation failures
- Performance metrics

### Best Practices

1. **Never bypass RLS in production code** unless absolutely necessary
2. **Always provide a reason** when bypassing RLS
3. **Use the type-safe API** - avoid raw SQL queries
4. **Test with multiple organizations** to ensure proper isolation
5. **Monitor RLS performance** using the built-in metrics

## Performance Guidelines

### Query Optimization

RLS policies are automatically optimized by PostgreSQL, but you can help:

1. **Use indexes** on organizationId columns (already done)
2. **Avoid complex RLS policies** - keep them simple
3. **Batch operations** within transactions
4. **Monitor slow queries** with performance logging

### Connection Pooling

The RLS system is designed to work with connection pooling:

```typescript
import { createPoolAwareTransactionExecutor } from '@/lib/rls';

const executeWithPool = createPoolAwareTransactionExecutor(prisma, {
  maxConnections: 20,
  connectionTimeout: 5000,
});

// Use for all RLS operations
const result = await executeWithPool(context, async (tx) => {
  return tx.item.findMany();
});
```

### Caching Considerations

RLS context is set per-transaction, so caching must be organization-aware:

```typescript
// ✅ Good - Cache key includes organization
const cacheKey = `items:${ctx.organizationId}:list`;

// ❌ Bad - Cache key doesn't include organization
const cacheKey = 'items:list';
```

## Troubleshooting

### Common Issues

#### 1. "Invalid RLS context" Error

**Cause**: Missing or invalid organization ID
**Solution**: Ensure user is authenticated and has selected an organization

```typescript
// Check context before queries
if (!ctx.organizationId) {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'No organization selected',
  });
}
```

#### 2. "Row-level security policy violation"

**Cause**: Trying to access data from another organization
**Solution**: This is working as intended! Check your query logic

#### 3. Performance Issues

**Cause**: Missing indexes or complex policies
**Solution**: Check query plans and ensure indexes exist

```sql
-- Check if RLS is causing slow queries
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM items WHERE organization_id = 'xxx';
```

### Debugging RLS

Enable debug logging to see RLS operations:

```typescript
// In development
process.env.LOG_LEVEL = 'debug';

// You'll see logs like:
// [rls-service] RLS context set for transaction
// [rls-proxy] RLS operation completed
```

### Validating RLS Configuration

Run the validation check:

```typescript
import { validateRLSConfiguration } from '@/lib/rls';

const isValid = await validateRLSConfiguration(prisma);
if (!isValid) {
  console.error('RLS is not properly configured!');
}
```

## Migration Guide

### From Legacy Code

If you're migrating from the old RLS implementation:

```typescript
// Old way (deprecated)
import { createRLSMiddleware, withRLS } from '@/lib/rls-middleware';

// New way
import { createRLSProxy, withRLS } from '@/lib/rls';
```

The API is mostly compatible, but the new version provides:

- Better type safety (no `any` types)
- Input validation
- Audit logging
- Performance metrics

### Database Migration

1. Apply the RLS migration:

```bash
pnpm db:migrate deploy
```

2. Verify RLS is enabled:

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relkind = 'r'
AND relnamespace = 'public'::regnamespace;
```

3. Test with multiple organizations to ensure isolation

### Rollback Plan

If you need to disable RLS temporarily:

```sql
-- Disable RLS (emergency only!)
ALTER TABLE items DISABLE ROW LEVEL SECURITY;

-- Re-enable when fixed
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
```

**Warning**: Disabling RLS removes all access control!

## Testing Checklist

Before deploying RLS changes:

- [ ] All unit tests pass (`pnpm test src/lib/rls`)
- [ ] Integration tests pass with RLS enabled
- [ ] Manual testing with multiple organizations
- [ ] Performance benchmarks are acceptable
- [ ] Audit logs are being generated
- [ ] No RLS bypasses in production code
- [ ] Documentation is updated

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma Middleware Documentation](https://www.prisma.io/docs/concepts/components/prisma-client/middleware)
- [OWASP Multi-Tenancy Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Multitenancy.html)
