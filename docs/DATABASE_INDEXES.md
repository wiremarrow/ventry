# Database Indexes Documentation

This document describes the database indexes implemented in the Ventry system for optimal query performance.

## Overview

The Ventry system uses PostgreSQL indexes to optimize query performance, especially for multi-tenant queries where most operations are filtered by `organizationId`. All indexes are created with the `CONCURRENTLY` option to avoid locking tables during index creation in production.

## Index Strategy

### 1. Multi-Tenant Indexes
Every table that contains `organizationId` has an index on this column as the first column, enabling efficient tenant isolation.

### 2. Foreign Key Indexes
All foreign key columns have indexes to optimize JOIN operations and referential integrity checks.

### 3. Composite Indexes
Frequently used query patterns have composite indexes that match the WHERE clause conditions.

### 4. Text Search Indexes
GIN indexes are used for full-text search on name fields for items, customers, and suppliers.

## Critical Indexes by Table

### Organization Members
- `idx_organization_members_user_id`: For user login lookups
- `idx_organization_members_org_user`: For authorization checks

### Items
- `idx_items_organization_id`: Tenant isolation
- `idx_items_org_sku`: SKU lookups within organization
- `idx_items_org_active`: Filter active items
- `idx_items_category`: Category filtering
- `idx_items_supplier`: Supplier filtering
- `idx_items_name_gin`: Full-text search on item names

### Inventory
- `idx_inventory_organization_id`: Tenant isolation
- `idx_inventory_item_id`: Item stock lookups
- `idx_inventory_warehouse_id`: Warehouse stock queries
- `idx_inventory_location_id`: Location-based queries
- `idx_inventory_org_item_warehouse`: Common query pattern

### Orders
- `idx_orders_organization_id`: Tenant isolation
- `idx_orders_customer_id`: Customer order history
- `idx_orders_org_status`: Order status filtering
- `idx_orders_org_created`: Recent orders query
- `idx_orders_order_number`: Order number lookups

### Stock Movements
- `idx_stock_movements_organization_id`: Tenant isolation
- `idx_stock_movements_item_id`: Item movement history
- `idx_stock_movements_warehouse_id`: Warehouse movements
- `idx_stock_movements_org_created`: Recent movements
- `idx_stock_movements_reference`: Reference lookups

## Performance Impact

### Expected Improvements
- Multi-tenant queries: 10-100x faster
- JOIN operations: 5-50x faster
- Full-text searches: 20-200x faster
- Order history queries: 10-50x faster

### Index Maintenance
- Indexes are automatically maintained by PostgreSQL
- Regular `VACUUM ANALYZE` should be run to update statistics
- Monitor index usage with `pg_stat_user_indexes`

## Applying Indexes

### Development
Indexes are automatically created when running migrations:
```bash
pnpm prisma migrate dev
```

### Production
Use the provided script for safe index creation:
```bash
# Dry run to see what will be created
DATABASE_URL=your_production_url ./tools/scripts/apply-indexes.sh --dry-run

# Apply indexes
DATABASE_URL=your_production_url ./tools/scripts/apply-indexes.sh
```

## Monitoring Index Usage

### Check Index Usage
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Find Missing Indexes
```sql
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
    AND n_distinct > 100
    AND correlation < 0.1
ORDER BY n_distinct DESC;
```

### Index Size
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Best Practices

1. **Don't Over-Index**: Each index adds overhead to INSERT/UPDATE/DELETE operations
2. **Monitor Usage**: Remove unused indexes that aren't being utilized
3. **Composite Index Order**: Place most selective columns first
4. **Partial Indexes**: Use WHERE clauses for indexes on subset of data
5. **Regular Maintenance**: Run `VACUUM ANALYZE` regularly

## Future Considerations

1. **Partitioning**: For very large tables, consider partitioning by organization or date
2. **Materialized Views**: For complex analytics queries
3. **Index-Only Scans**: Design indexes to support index-only scans for read-heavy queries
4. **BRIN Indexes**: For large tables with natural ordering (like timestamps)