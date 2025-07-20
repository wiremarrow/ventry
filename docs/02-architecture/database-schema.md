# Database Schema Reference

This document provides an overview of the Ventry database schema. For the complete, detailed schema documentation, see [DATABASE.md](/DATABASE.md).

## Overview

The Ventry database uses PostgreSQL 16 with Prisma ORM, implementing a comprehensive inventory management system with multi-tenant architecture.

### Schema Statistics
- **Total Models**: 42
- **Business Models**: 32 (with organizationId)
- **System Models**: 10 (users, auth, etc.)
- **Enums**: 17

## Multi-Tenant Design

Every business entity includes `organizationId` for complete data isolation:

```prisma
model Item {
  id             String       @id @default(cuid())
  organizationId String       // Multi-tenant isolation
  // ... other fields
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

## Core Domain Models

### Inventory Management

#### Items (Products)
- Central product catalog
- SKU management
- Categories and units of measure
- Default suppliers and pricing
- Reorder points and quantities

#### Warehouses & Locations
- Hierarchical storage structure
- Zone/Aisle/Shelf/Bin organization
- Capacity tracking
- Multi-location support

#### Inventory
- Real-time stock levels by location
- Quantity on hand, reserved, available
- Lot and serial number tracking
- Stock valuation

#### Stock Movements
- Complete audit trail
- Movement types (IN, OUT, TRANSFER, ADJUSTMENT)
- Reference tracking (PO, Order, etc.)
- User accountability

### Procurement

#### Suppliers
- Vendor management
- Lead times and payment terms
- Performance tracking
- Contact information

#### Purchase Orders
- Multi-line orders
- Approval workflow
- Receipt tracking
- Status management

### Sales

#### Customers
- Customer profiles
- Credit limits
- Billing/shipping addresses
- Order history

#### Orders
- Sales order processing
- Line item management
- Allocation and fulfillment
- Shipping integration

### Supporting Models

#### Organization
- Multi-tenant root entity
- Subscription management
- Settings and configuration

#### Users & Auth
- User profiles
- Organization membership
- Role-based permissions
- Authentication tokens

## Naming Conventions

### Database Level
- Tables: snake_case (via Prisma @@map)
- Columns: snake_case
- Indexes: descriptive names with table prefix
- Constraints: table_column_type format

### Application Level
- Models: PascalCase
- Fields: camelCase
- Relations: descriptive names
- Enums: UPPER_SNAKE_CASE values

## Key Relationships

### One-to-Many
- Organization → Items, Warehouses, Customers, etc.
- Warehouse → Locations
- Item → Inventory records
- Customer → Orders

### Many-to-Many
- Items ↔ Categories (future)
- Orders ↔ Items (via OrderItem)
- PurchaseOrders ↔ Items (via PurchaseOrderItem)

### Self-Referential
- Category → Category (parent/children)
- Location → Location (hierarchical)

## Database Indexes

All foreign keys are indexed for performance:
- `organizationId` on all business tables
- Lookup fields (sku, code, email)
- Date fields used in queries
- Composite indexes for common filters

See [Database Indexes](../08-reference/database-indexes.md) for the complete list.

## Row-Level Security

RLS policies enforce organization isolation:

```sql
CREATE POLICY tenant_isolation ON items
  USING (organization_id = current_setting('app.current_organization_id'));
```

See [Row-Level Security](../04-security/row-level-security.md) for implementation details.

## Migration Strategy

### Development
```bash
# Push schema changes (dev only)
pnpm db:push

# Create migration
pnpm db:migrate:dev
```

### Production
```bash
# Apply migrations
pnpm db:migrate:deploy
```

## Performance Considerations

1. **Denormalization**: organizationId on all tables for RLS performance
2. **Indexes**: Strategic indexes on all query patterns
3. **Constraints**: Foreign keys with CASCADE options
4. **Archival**: Soft deletes where appropriate

## Future Enhancements

1. **Time-series Data**: For analytics and forecasting
2. **Audit Tables**: Comprehensive change tracking
3. **Partitioning**: For large-scale deployments
4. **Read Replicas**: For reporting workloads

## Related Documentation

- [Complete Schema Reference](/DATABASE.md)
- [RLS Implementation](../04-security/row-level-security.md)
- [Database Indexes](../08-reference/database-indexes.md)
- [Migration Guide](../05-deployment/environment-configuration.md#database-migrations)