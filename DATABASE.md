# Ventry Database Schema Documentation

> **Single Source of Truth** for database structure, relationships, and constraints.
> 
> Generated from `packages/database/prisma/schema.prisma` - Last updated: July 2025

## Overview

Ventry uses PostgreSQL with Prisma ORM, implementing a comprehensive inventory management system with multi-tenant architecture. The database contains **32 models** and **17 enums** covering all aspects of inventory, procurement, sales, and business operations.

### Architecture Principles

- **Multi-Tenant**: All business entities scoped by `organizationId`
- **Enterprise-Grade**: Comprehensive audit trails, user roles, and data integrity
- **Full Lifecycle**: Complete inventory flow from procurement to fulfillment
- **Type Safety**: Strong typing with Prisma + TypeScript integration

## Multi-Tenant Design

Every business entity includes `organizationId` for complete data isolation:

```typescript
// All business models follow this pattern
model Item {
  id             String       @id @default(cuid())
  organizationId String       // Multi-tenant isolation
  // ... other fields
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

## Models by Domain

### Core Organization & Users

#### Organization
**Table**: `organizations`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key (cuid) |
| `name` | String | Organization display name |
| `slug` | String | Unique URL slug |
| `domain` | String? | Custom domain (optional) |
| `logoUrl` | String? | Logo image URL |
| `settings` | Json | Configuration settings |
| `subscriptionTier` | String | Subscription level (default: "free") |
| `subscriptionStatus` | String | Account status (default: "active") |
| `trialEndsAt` | DateTime? | Trial expiration |
| `billingEmail` | String? | Billing contact |
| `createdAt` | DateTime | Record creation |
| `updatedAt` | DateTime | Last modification |

**Relationships**: Contains all business entities (items, warehouses, orders, etc.)

#### OrganizationMember
**Table**: `organization_members`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `organizationId` | String | Organization reference |
| `userId` | String | User reference |
| `role` | OrganizationRole | Member role (OWNER, ADMIN, MEMBER, VIEWER) |
| `joinedAt` | DateTime | Membership start |
| `invitedById` | String? | Inviting user |
| `invitationToken` | String? | Invitation token |
| `invitationAcceptedAt` | DateTime? | Invitation acceptance |

**Constraints**: 
- Unique: `[organizationId, userId]`
- Maps to: `organization_members`

#### User
**Table**: `users`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `email` | String | Unique email address |
| `username` | String | Unique username |
| `firstName` | String | First name |
| `lastName` | String | Last name |
| `password` | String | Hashed password |
| `role` | Role | System role (ADMIN, MANAGER, USER, EMPLOYEE, WAREHOUSE, SALES) |
| `isActive` | Boolean | Account status (default: true) |
| `createdAt` | DateTime | Account creation |
| `updatedAt` | DateTime | Last modification |
| `lastLoginAt` | DateTime? | Last login timestamp |

**Relationships**: Can belong to multiple organizations, perform various operations

#### Employee
**Table**: `employees`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `userId` | String | User reference (unique) |
| `hireDate` | DateTime | Employment start |
| `hourlyRate` | Decimal? | Hourly compensation |
| `salary` | Decimal? | Annual salary |
| `managerId` | String? | Manager reference |
| `status` | EmployeeStatus | Employment status (ACTIVE, INACTIVE, TERMINATED) |

**Relationships**: Self-referencing hierarchy (manager/subordinates)

### Inventory Management

#### Item
**Table**: `items`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `organizationId` | String | Organization scope |
| `sku` | String | Stock Keeping Unit |
| `upc` | String? | Universal Product Code |
| `name` | String | Product name |
| `description` | String? | Product description |
| `categoryId` | String | Category reference |
| `uomId` | String | Unit of measure reference |
| `defaultSupplierId` | String? | Default supplier |
| `defaultCost` | Decimal? | Standard cost |
| `defaultPrice` | Decimal? | Standard selling price |
| `weightKg` | Decimal? | Weight in kilograms |
| `lengthCm` | Decimal? | Length in centimeters |
| `widthCm` | Decimal? | Width in centimeters |
| `heightCm` | Decimal? | Height in centimeters |
| `reorderPoint` | Int | Minimum stock level (default: 0) |
| `reorderQty` | Int | Reorder quantity (default: 0) |
| `isActive` | Boolean | Product status (default: true) |

**Constraints**: 
- Unique: `[organizationId, sku]`
- Index: `[organizationId]`

#### ItemCategory
**Table**: `item_categories`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `organizationId` | String | Organization scope |
| `parentId` | String? | Parent category (hierarchical) |
| `name` | String | Category name |
| `description` | String? | Category description |

**Constraints**: 
- Unique: `[organizationId, name]`
- Self-referencing hierarchy via `parentId`

#### UnitOfMeasure
**Table**: `units_of_measure`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `organizationId` | String | Organization scope |
| `code` | String | Unit code (EA, CS, BOX, etc.) |
| `description` | String | Unit description |
| `isBase` | Boolean | Base unit flag (default: false) |
| `conversionFactorToBase` | Decimal | Conversion factor (default: 1) |

**Constraints**: Unique: `[organizationId, code]`

#### Warehouse
**Table**: `warehouses`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `organizationId` | String | Organization scope |
| `code` | String | Warehouse code |
| `name` | String | Warehouse name |
| `phone` | String? | Contact phone |
| `line1` | String | Address line 1 |
| `line2` | String? | Address line 2 |
| `city` | String | City |
| `state` | String | State/Province |
| `postalCode` | String | Postal code |
| `country` | String | Country |
| `notes` | String? | Additional notes |

**Constraints**: Unique: `[organizationId, code]`

#### Location
**Table**: `locations`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `warehouseId` | String | Warehouse reference |
| `code` | String | Location code (unique) |
| `description` | String? | Location description |
| `zone` | String? | Zone identifier |
| `aisle` | String? | Aisle identifier |
| `shelf` | String? | Shelf identifier |
| `bin` | String? | Bin identifier |
| `isTempControlled` | Boolean | Temperature control (default: false) |
| `maxCapacity` | Int? | Maximum capacity |

#### Inventory
**Table**: `inventory`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `itemId` | String | Item reference |
| `lotId` | String? | Lot reference (optional) |
| `serialId` | String? | Serial number reference (optional) |
| `locationId` | String | Location reference |
| `qtyOnHand` | Int | Available quantity (default: 0) |
| `qtyReserved` | Int | Reserved quantity (default: 0) |
| `qtyInTransit` | Int | In-transit quantity (default: 0) |
| `lastCountedAt` | DateTime? | Last physical count |

**Constraints**: Unique: `[itemId, lotId, serialId, locationId]` (compound key)

#### Lot
**Table**: `lots`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `itemId` | String | Item reference |
| `lotNumber` | String | Unique lot identifier |
| `manufactureDate` | DateTime? | Manufacturing date |
| `expirationDate` | DateTime? | Expiration date |
| `receivedDate` | DateTime | Received date |
| `supplierId` | String? | Supplier reference |
| `unitCost` | Decimal | Cost per unit |
| `qtyInitial` | Int | Initial quantity |
| `qtyOnHand` | Int | Current quantity |
| `status` | LotStatus | Lot status (AVAILABLE, QUARANTINE, EXPIRED, DEPLETED) |

#### SerialNumber
**Table**: `serial_numbers`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `itemId` | String | Item reference |
| `serialNumber` | String | Unique serial number |
| `lotId` | String? | Associated lot |
| `purchaseDate` | DateTime? | Purchase date |
| `warrantyExpiration` | DateTime? | Warranty end date |
| `status` | SerialStatus | Status (AVAILABLE, SOLD, RETURNED, DEFECTIVE, LOST) |
| `locationId` | String? | Current location |

#### StockMovement
**Table**: `stock_movements`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `itemId` | String | Item reference |
| `lotId` | String? | Lot reference |
| `serialId` | String? | Serial reference |
| `fromLocationId` | String? | Source location |
| `toLocationId` | String? | Destination location |
| `qty` | Int | Quantity moved |
| `movementType` | MovementType | Movement type |
| `refType` | String? | Reference type |
| `refId` | String? | Reference ID |
| `movedById` | String | User who moved |
| `movedAt` | DateTime | Movement timestamp |
| `notes` | String? | Additional notes |

### Procurement

#### Supplier
**Table**: `suppliers`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `organizationId` | String | Organization scope |
| `supplierCode` | String | Supplier code |
| `name` | String | Supplier name |
| `phone` | String? | Contact phone |
| `email` | String? | Contact email |
| `website` | String? | Website URL |
| `currencyId` | String | Currency code (default: "USD") |
| `paymentTerms` | String? | Payment terms |
| `leadTimeDays` | Int | Lead time (default: 0) |
| `line1` | String | Address line 1 |
| `line2` | String? | Address line 2 |
| `city` | String | City |
| `state` | String | State |
| `postalCode` | String | Postal code |
| `country` | String | Country |
| `notes` | String? | Additional notes |

**Constraints**: Unique: `[organizationId, supplierCode]`

#### PurchaseOrder
**Table**: `purchase_orders`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `organizationId` | String | Organization scope |
| `supplierId` | String | Supplier reference |
| `poNumber` | String | PO number |
| `status` | POStatus | PO status (DRAFT, SUBMITTED, APPROVED, etc.) |
| `orderDate` | DateTime | Order date |
| `expectedDate` | DateTime? | Expected delivery |
| `currencyId` | String | Currency (default: "USD") |
| `subtotal` | Decimal | Subtotal (default: 0) |
| `tax` | Decimal | Tax amount (default: 0) |
| `total` | Decimal | Total amount (default: 0) |
| `notes` | String? | Order notes |
| `createdById` | String | Creator user |
| `approvedById` | String? | Approver user |

**Constraints**: Unique: `[organizationId, poNumber]`

### Sales & Fulfillment

#### Customer
**Table**: `customers`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `organizationId` | String | Organization scope |
| `customerCode` | String | Customer code |
| `companyName` | String? | Company name |
| `firstName` | String? | First name |
| `lastName` | String? | Last name |
| `email` | String? | Email address |
| `phone` | String? | Phone number |
| `taxId` | String? | Tax ID |
| `currencyId` | String | Currency (default: "USD") |
| `defaultPaymentTerms` | String? | Payment terms |
| `defaultShipMethodId` | String? | Default shipping method |
| `website` | String? | Website URL |

**Constraints**: Unique: `[organizationId, customerCode]`

#### Order
**Table**: `orders`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Primary key |
| `organizationId` | String | Organization scope |
| `customerId` | String | Customer reference |
| `orderNumber` | String | Order number |
| `status` | OrderStatus | Order status |
| `orderDate` | DateTime | Order date |
| `requestedShipDate` | DateTime? | Requested ship date |
| `currencyId` | String | Currency (default: "USD") |
| `subtotal` | Decimal | Subtotal (default: 0) |
| `discountTotal` | Decimal | Discount amount (default: 0) |
| `taxTotal` | Decimal | Tax amount (default: 0) |
| `shippingTotal` | Decimal | Shipping cost (default: 0) |
| `grandTotal` | Decimal | Total amount (default: 0) |
| `notes` | String? | Order notes |
| `createdById` | String | Creator user |
| `updatedById` | String? | Last updater |

**Constraints**: Unique: `[organizationId, orderNumber]`

## Enums Reference

### Role
System-wide user roles:
- `ADMIN` - System administrator
- `MANAGER` - Department manager  
- `USER` - Regular user
- `EMPLOYEE` - Company employee
- `WAREHOUSE` - Warehouse worker
- `SALES` - Sales representative

### OrganizationRole
Organization-specific roles:
- `OWNER` - Organization owner
- `ADMIN` - Organization admin
- `MEMBER` - Regular member
- `VIEWER` - Read-only access

### MovementType
Stock movement types:
- `INBOUND` - Receiving inventory
- `OUTBOUND` - Shipping inventory
- `TRANSFER` - Location transfers
- `ADJUSTMENT` - Quantity adjustments
- `RETURN` - Returned items
- `DAMAGE` - Damaged goods
- `LOSS` - Lost inventory

### OrderStatus
Order processing states:
- `PENDING` - Awaiting processing
- `CONFIRMED` - Order confirmed
- `PICKING` - Being picked
- `PACKED` - Packed for shipping
- `SHIPPED` - Shipped to customer
- `DELIVERED` - Delivered
- `CANCELLED` - Cancelled order

### POStatus (Purchase Order Status)
- `DRAFT` - Draft PO
- `SUBMITTED` - Submitted to supplier
- `APPROVED` - Approved for ordering
- `PARTIAL` - Partially received
- `RECEIVED` - Fully received
- `CANCELLED` - Cancelled PO

### LotStatus
- `AVAILABLE` - Available for use
- `QUARANTINE` - Under quarantine
- `EXPIRED` - Past expiration
- `DEPLETED` - Fully consumed

### SerialStatus
- `AVAILABLE` - Available
- `SOLD` - Sold to customer
- `RETURNED` - Returned by customer
- `DEFECTIVE` - Defective unit
- `LOST` - Lost/missing

## Database Conventions

### Field Naming
- **Prisma Models**: camelCase (`firstName`, `organizationId`)
- **PostgreSQL Tables**: snake_case via `@@map` directive
- **Relationships**: Descriptive names (`createdBy`, `defaultSupplier`)

### Primary Keys
- All models use `String` type with `@default(cuid())`
- Provides globally unique, URL-safe identifiers

### Timestamps
- `createdAt`: Record creation (automatic)
- `updatedAt`: Last modification (automatic via `@updatedAt`)
- Domain-specific: `orderDate`, `shipDate`, `movedAt`

### Multi-Tenant Isolation
- Every business entity includes `organizationId`
- Cascade deletes via `onDelete: Cascade`
- Unique constraints scoped by organization

### Relationships
- Foreign keys use descriptive names
- Optional relationships marked with `?`
- Self-referencing hierarchies (categories, employees)
- Many-to-many via junction tables

## Migration Notes

This schema represents the current state as of July 2025. Key architectural decisions:

1. **Multi-tenant by design** - Complete data isolation
2. **Comprehensive tracking** - Lots, serials, movements
3. **Full business cycle** - Procurement through fulfillment  
4. **Audit trail** - Complete operation logging
5. **Type safety** - Strong typing throughout

For schema changes, always:
1. Update this documentation
2. Run Prisma migrations
3. Update application code
4. Test multi-tenant scenarios

---

**Last Updated**: July 2025  
**Schema Version**: Current as of `packages/database/prisma/schema.prisma`  
**Total Models**: 32 | **Total Enums**: 17