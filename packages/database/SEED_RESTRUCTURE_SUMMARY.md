# Seed Structure Restructuring Summary

## Changes Made

### 1. Restructured Seed Files

- **Basic Seed** (`seed.ts`): Creates 4 users + empty Ventry Corporation
- **Single Comprehensive** (`seed-single-comprehensive.ts`): Full demo data for Ventry org
- **Multi Comprehensive** (`seed-multi-comprehensive.ts`): Full demo data for 3 organizations

### 2. Fixed Schema Mismatches

Fixed numerous field name mismatches between seed data and actual Prisma schema:

#### Carrier Model

- Removed `code` field
- Changed `trackingUrlTemplate` → `trackingUrlTpl`
- Added required `phone` and `website` fields

#### ShippingMethod Model

- Changed `name` → `serviceName`
- Changed `estimatedDays` → `transitDays`

#### PaymentMethod Model

- Changed `name` → `methodName`
- Removed `code` and `type` fields

#### Warehouse Model

- Removed `isActive` field (doesn't exist in schema)

#### Item Model

- Removed `leadTimeDays` (belongs on supplier)

#### Inventory Model

- Removed computed fields: `qtyAvailable`, `avgCost`, `lastCost`, `lastCountDate`
- Added correct fields: `qtyInTransit`, `lastCountedAt`

#### Lot Model

- Changed `expiryDate` → `expirationDate`
- Changed `manufacturingDate` → `manufactureDate`
- Made lot numbers more unique to avoid constraint violations

#### Customer Model

- Changed `code` → `customerCode`
- Changed `name` → `companyName`
- Removed `creditLimit` and `paymentTerms`

#### Address Model

- Changed `type` → `addressType`
- Changed `isPrimary` → `isDefault`

#### Order Model

- Removed `warehouseId`
- Changed `requestedDate` → `requestedShipDate`
- Changed `taxAmount` → `taxTotal`
- Changed `shippingAmount` → `shippingTotal`
- Changed `totalAmount` → `grandTotal`
- Fixed OrderStatus enum values

#### OrderItem Model

- Changed `lineTotal` → `totalPrice`

#### PurchaseOrder Model

- Removed `warehouseId`
- Changed `taxAmount` → `tax`
- Changed `totalAmount` → `total`
- Fixed POStatus enum values

#### PurchaseOrderItem Model

- Changed `purchaseOrderId` → `poId`
- Changed `lineTotal` → `totalCost`

#### StockMovement Model

- Changed `quantity` → `qty`
- Changed `locationId` → `fromLocationId`/`toLocationId`
- Changed `referenceType` → `refType`
- Changed `referenceId` → `refId`
- Changed `createdById` → `movedById`
- Changed `movementDate` → `movedAt`
- Removed `unitCost` and `totalCost` fields
- Fixed MovementType enum values

### 3. Updated Package Scripts

```json
"db:seed": "./scripts/db-admin.sh seed",
"db:seed:single": "./scripts/db-admin.sh seed-single",
"db:seed:multi": "./scripts/db-admin.sh seed-multi"
```

### 4. Key Features

- Each seed completely clears the database first (not additive)
- Multi-org is a superset of single-comprehensive
- Single-comprehensive is a superset of basic
- All seeds use the admin database connection for proper privileges

## Demo Accounts

All accounts use password: `password123`

### Basic Seed

- admin@ventry.com (ADMIN role, OWNER in org)
- manager@ventry.com (MANAGER role, ADMIN in org)
- employee@ventry.com (EMPLOYEE role, MEMBER in org)
- user@ventry.com (USER role, no org access)

### Single/Multi Comprehensive

Same as basic + full demo data

## Usage

```bash
# Basic seed - users + empty org
pnpm db:seed

# Single org with full data
pnpm db:seed:single

# Multiple orgs with full data
pnpm db:seed:multi
```
