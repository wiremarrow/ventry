# Supabase Migration Plan for Ventry

## Overview

This document outlines the comprehensive plan for migrating Ventry's inventory management system to Supabase while maintaining the existing tRPC architecture.

## Migration Scope

- **Tables**: 40+ tables covering inventory, procurement, sales, fulfillment, and POS operations
- **Data Volume**: Expected to handle enterprise-scale inventory operations
- **Timeline**: 3-4 weeks for complete migration (gradual approach)
- **Risk Level**: Low to Moderate (using proven migration patterns)

## Phase 1: Foundation Setup (Week 1)

### 1.1 Supabase Project Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase in project
supabase init

# Link to Supabase project
supabase link --project-ref <project-ref>
```

### 1.2 Environment Configuration

```env
# Add to .env.local
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_KEY]

# Keep existing for Prisma
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

### 1.3 Prisma Configuration

- Update existing Prisma schema (✅ Already completed)
- Configure Prisma to use Supabase PostgreSQL
- Generate initial migrations

### 1.4 Authentication Migration Strategy

- Keep existing JWT auth temporarily
- Create user mapping table
- Implement gradual auth migration

## Phase 2: Core Tables Migration (Week 1-2)

### 2.1 Migration Order (Dependencies First)

1. **Base Tables** (No foreign keys)
   - UnitOfMeasure
   - Carrier
   - PaymentMethod
   - Discount

2. **User & Organization**
   - User (map existing users)
   - Employee
   - UserRole
   - Warehouse

3. **Master Data**
   - ItemCategory (self-referencing)
   - Supplier
   - Customer
   - Location

4. **Core Inventory**
   - Item
   - ItemImage
   - Lot
   - SerialNumber
   - Inventory

### 2.2 Data Migration Script

```typescript
// Example migration for Items
async function migrateItems() {
  const oldItems = await oldPrisma.product.findMany({
    include: { category: true },
  });

  for (const oldItem of oldItems) {
    await newPrisma.item.create({
      data: {
        sku: oldItem.sku,
        name: oldItem.name,
        description: oldItem.description,
        categoryId: mapCategoryId(oldItem.categoryId),
        defaultPrice: oldItem.unitPrice,
        // Map other fields
      },
    });
  }
}
```

## Phase 3: Row Level Security (Week 2)

### 3.1 RLS Policies Structure

```sql
-- Example: Items table RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Read access based on role
CREATE POLICY "Users can view active items" ON items
  FOR SELECT
  USING (is_active = true);

-- Write access for managers
CREATE POLICY "Managers can manage items" ON items
  FOR ALL
  USING (auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGER'));

-- Warehouse staff can update inventory
CREATE POLICY "Warehouse can update inventory" ON inventory
  FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('ADMIN', 'WAREHOUSE'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('ADMIN', 'WAREHOUSE'));
```

### 3.2 Multi-tenant Considerations

- Add `organizationId` to relevant tables if needed
- Implement organization-based RLS policies
- Consider data isolation requirements

## Phase 4: Supabase Features Integration (Week 2-3)

### 4.1 Realtime Subscriptions

```typescript
// Subscribe to inventory changes
const inventorySubscription = supabase
  .channel('inventory-updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'inventory',
      filter: 'location_id=eq.warehouse-1',
    },
    (payload) => {
      // Update UI with real-time inventory changes
      handleInventoryUpdate(payload);
    }
  )
  .subscribe();
```

### 4.2 Storage Integration

```typescript
// Upload item images to Supabase Storage
async function uploadItemImage(itemId: string, file: File) {
  const { data, error } = await supabase.storage
    .from('item-images')
    .upload(`${itemId}/${file.name}`, file);

  if (data) {
    // Save URL to database
    await prisma.itemImage.create({
      data: {
        itemId,
        url: data.path,
        isPrimary: false,
      },
    });
  }
}
```

### 4.3 Edge Functions (Optional)

- Inventory alerts
- Reorder point notifications
- Automated purchase order generation

## Phase 5: tRPC Integration Updates (Week 3)

### 5.1 Update tRPC Context

```typescript
// Add Supabase client to context
export async function createContext(opts: CreateContextOptions) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => opts.req.cookies[name],
      },
    }
  );

  return {
    ...existingContext,
    supabase,
    prisma, // Keep Prisma for now
  };
}
```

### 5.2 Gradual Procedure Migration

```typescript
// Example: Migrate inventory procedures
export const inventoryRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        warehouseId: z.string().optional(),
        includeRealtime: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      // Use Prisma for data
      const inventory = await ctx.prisma.inventory.findMany({
        where: input.warehouseId
          ? {
              location: { warehouseId: input.warehouseId },
            }
          : undefined,
        include: {
          item: true,
          location: true,
          lot: true,
        },
      });

      // Optionally subscribe to realtime
      if (input.includeRealtime) {
        // Return subscription details
      }

      return inventory;
    }),
});
```

## Phase 6: Testing & Validation (Week 3-4)

### 6.1 Testing Strategy

1. **Unit Tests**: Update existing tests for new schema
2. **Integration Tests**: Test Supabase-specific features
3. **Performance Tests**: Validate query performance
4. **Security Tests**: Verify RLS policies

### 6.2 Migration Validation

```typescript
// Validation script
async function validateMigration() {
  // Compare record counts
  const oldCount = await oldPrisma.product.count();
  const newCount = await newPrisma.item.count();

  assert(oldCount === newCount, 'Item count mismatch');

  // Validate relationships
  const itemsWithCategories = await newPrisma.item.findMany({
    include: { category: true },
  });

  // More validations...
}
```

## Phase 7: Cutover Plan (Week 4)

### 7.1 Pre-cutover Checklist

- [ ] All data migrated and validated
- [ ] RLS policies tested
- [ ] Performance benchmarks met
- [ ] Backup strategy in place
- [ ] Rollback plan documented

### 7.2 Cutover Steps

1. Enable maintenance mode
2. Final data sync
3. Update environment variables
4. Deploy new code
5. Validate critical paths
6. Monitor for issues

### 7.3 Rollback Plan

- Keep old database for 30 days
- Maintain ability to switch DATABASE_URL
- Have reverse migration scripts ready

## Benefits After Migration

### 1. Real-time Features

- Live inventory updates across locations
- Instant stock movement notifications
- Collaborative cycle counting

### 2. Enhanced Security

- Database-level RLS
- Built-in auth with MFA
- Audit trails via Supabase

### 3. Scalability

- Auto-scaling database
- Global edge functions
- CDN for file storage

### 4. Developer Experience

- Type-safe database access (Prisma)
- Built-in admin panel
- SQL editor for complex queries

## Risk Mitigation

### Identified Risks

1. **Data Loss**: Mitigated by comprehensive backups and validation
2. **Performance Issues**: Addressed by indexing and query optimization
3. **Auth Migration**: Gradual migration with fallback
4. **Downtime**: Minimized with blue-green deployment

### Monitoring Plan

- Set up Supabase dashboard alerts
- Monitor query performance
- Track error rates
- Watch for RLS policy violations

## Next Steps

1. Review and approve migration plan
2. Set up Supabase project
3. Begin Phase 1 implementation
4. Schedule regular progress reviews

## Appendix: Useful Resources

- [Supabase Docs](https://supabase.com/docs)
- [Prisma + Supabase Guide](https://supabase.com/docs/guides/integrations/prisma)
- [RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Migration Tools](https://supabase.com/docs/guides/migrations)
