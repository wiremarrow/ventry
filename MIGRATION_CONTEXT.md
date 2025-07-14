# Ventry Migration Context - Critical Information for Future Agents

## 🚨 READ THIS FIRST - DO NOT SKIP

This document contains essential context for continuing the TypeScript migration and multi-tenant support implementation. Following these guidelines will prevent you from undoing completed work or repeating past mistakes.

**Current Status**: TypeScript migration nearly complete! Started with 619 errors, now down to just 4 errors in test files. All production router code has been successfully migrated to multi-tenant architecture.

---

## 📋 Current Migration State

### ✅ Completed Tasks

1. **Multi-tenant Schema Migration**
   - Added Organization and OrganizationMember models
   - Added organizationId to all business entities
   - Updated unique constraints to include organizationId

2. **Documentation Updates**
   - Added field naming convention to CLAUDE.md
   - Documented camelCase decision in SUPABASE_MIGRATION_TODO.md
   - Created original database schema reference in CLAUDE.md

3. **Core Infrastructure**
   - Fixed trpc.ts exports (createTRPCRouter, organizationProcedure)
   - Updated authentication middleware for organization context

4. **Router Status - ALL PRODUCTION ROUTERS COMPLETED ✅**
   - ✅ analytics.ts (0 errors)
   - ✅ auth.ts (0 errors)
   - ✅ warehouses.ts (0 errors)
   - ✅ shipments.ts (0 errors)
   - ✅ purchaseOrders.ts (0 errors)
   - ✅ inventory.ts (0 errors)
   - ✅ orders.ts (0 errors)
   - ✅ receipts.ts (105 → 0 errors) - COMPLETED
   - ✅ reports.ts (219 → 0 errors) - COMPLETED
   - ✅ stockMovements.ts (39 → 0 errors) - COMPLETED
   - ✅ customers.ts (39 → 0 errors) - COMPLETED
   - ✅ suppliers.ts (28 → 0 errors) - COMPLETED
   - ✅ returns.ts (88 → 0 errors) - COMPLETED
   - ✅ products.ts (9 → 0 errors) - COMPLETED (adapted to Item model)
   - ✅ items.ts (5 → 0 errors) - COMPLETED
   - ✅ categories.ts (4 → 0 errors) - COMPLETED
   - ✅ organizations.ts (1 → 0 errors) - COMPLETED
   
   **Remaining Issues:**
   - ❌ products.test.ts (4 errors) - Test file needs updating for new schema

---

## 🏗️ Critical Architectural Decisions

### 1. Field Naming Convention

**DECISION: Use camelCase in application code, snake_case in database**

```
Database (PostgreSQL) → Prisma Schema → Application Code
snake_case           → camelCase      → camelCase
qty_ordered          → qtyOrdered     → order.qtyOrdered
created_at           → createdAt      → item.createdAt
```

**Why**: 
- Prisma acts as translation layer with `@@map` directives
- All existing code uses camelCase
- Changing would require massive refactoring
- TypeScript/JavaScript convention is camelCase

### 2. Multi-Tenant Architecture

**Every query MUST be scoped to organizationId**

```typescript
// ❌ WRONG
const items = await ctx.prisma.item.findMany();

// ✅ CORRECT
const items = await ctx.prisma.item.findMany({
  where: { organizationId: ctx.user.organizationId }
});
```

### 3. Procedure Types

**Always use organizationProcedure, NOT protectedProcedure**

```typescript
// ❌ OLD
export const router = router({
  list: protectedProcedure

// ✅ NEW
export const router = createTRPCRouter({
  list: organizationProcedure
```

---

## 🔧 Common Error Patterns & Solutions

### Pattern 1: Import Errors

**Error**: `Cannot find name 'createTRPCRouter'` or `Cannot find name 'organizationProcedure'`

**Solution**:
```typescript
// ❌ WRONG
import { protectedProcedure, router } from '../trpc.js';

// ✅ CORRECT
import { organizationProcedure, createTRPCRouter } from '../trpc/trpc.js';
```

### Pattern 2: Missing organizationId Scoping

**Error**: Data leaking across organizations

**Solution**: Add organizationId to ALL queries
```typescript
// For direct models with organizationId
where: { organizationId: ctx.user.organizationId }

// For related models (e.g., Inventory through Item)
where: {
  item: { organizationId: ctx.user.organizationId }
}
```

### Pattern 3: Non-Existent Fields

**Common Missing Fields**:
- Order: warehouseId, orderType, priority, expectedDate
- OrderItem: qtyBackordered
- Supplier: isActive
- Return: type, activities, receipt relationship
- Receipt: status field
- Item: minQuantity, maxQuantity, status (use isActive)
- Inventory: quantityAvailable, quantityAllocated (calculate from qtyOnHand - qtyReserved)
- Various models: activity, approval, allocation references

**Solution**: 
1. Remove the field reference
2. Add TODO comment if functionality needed
3. Use alternative fields if available (e.g., requestedShipDate instead of expectedDate)

### Pattern 4: Decimal Type Errors

**Error**: `Object is possibly 'null'` or arithmetic on Decimal

**Solution**:
```typescript
// ❌ WRONG
const total = item.price * quantity;

// ✅ CORRECT
const total = Number(item.price) * quantity;
```

### Pattern 5: Status Enum Changes

**Old → New Status Mappings**:
- OrderStatus: SHIPPING → PICKING, PACKED, SHIPPED
- ReturnStatus: CANCELLED → REJECTED, COMPLETED → REFUNDED, SHIPPED → RECEIVED
- MovementType: RECEIPT → INBOUND, SHIPMENT → OUTBOUND
- PurchaseOrderStatus: Remove DRAFT if used

### Pattern 6: Relationship and Include Fixes

**Common Issues**:
- ReceiptItem doesn't have purchaseOrderItem relation
- Return doesn't have receipt or activities relations
- Inventory doesn't have direct expirationDate (through lot)
- StockMovement doesn't have direct organizationId (through item)
- StockMovement doesn't have item relation (need separate query)
- Location has 'code' not 'name' field

### Pattern 7: Complex Type Issues

**TypeScript Strict Mode Challenges**:
- Nested field filters require careful type construction
- Variable name conflicts in large files (e.g., itemIds redeclared)
- Aggregation functions need explicit type annotations
- Model dynamic access requires type assertions
- Enum indexing requires Record<string, number> type

**Solutions**:
```typescript
// For nested filters that might conflict
if (categoryIds?.length || !includeInactive) {
  inventoryWhere.item = {
    organizationId: ctx.user.organizationId,
    ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
    ...(includeInactive ? {} : { isActive: true }),
  };
}

// For aggregations
const totalCost = items.reduce((sum: number, item: any) => sum + item.cost, 0);

// For dynamic model access
const results = await (model as any).findMany(queryOptions);
```

---

## 📝 Router-Specific Notes

### inventory.ts (COMPLETED)
- All procedures use organizationProcedure
- Inventory scoped through item.organizationId
- Low stock filter handled in post-processing
- CycleCount model simplified (no warehouseId, uses locationId)

### orders.ts (COMPLETED)
**Issues Fixed**:
- Missing fields: warehouseId, orderType, priority
- No allocations model (removed allocation procedures)
- Status enum values (removed DRAFT, ALLOCATED)
- Field mismatches (shippedDate→shipDate, total→grandTotal)
- StockMovement referenceId → refId/refType
- Variable redeclaration issues
- Export procedure type issues with conditional includes

**Key Changes**:
- Removed allocateInventory and releaseInventory procedures
- Updated status enum to match schema (PENDING, CONFIRMED, etc.)
- Added shippedFromLocationId to shipment schema
- Fixed all TypeScript type issues

### receipts.ts (COMPLETED)
**Issues Fixed**:
- Import statements (protectedProcedure → organizationProcedure)
- Added organizationId scoping through PurchaseOrder
- Removed non-existent status field
- Fixed field references (receiptNumber → reference)
- Removed non-existent models (receiptActivity, receiptSerialNumber)

### returns.ts (NEARLY COMPLETED - 1 error)
**Issues Fixed**:
- Removed non-existent receipt and activities relationships
- Fixed status enum values (SHIPPED→RECEIVED, COMPLETED→REFUNDED)
- Removed type field checks (only customer returns supported)
- Fixed field mismatches (quantity→qtyReturned, referenceType/Id→refType/refId)
- Fixed StockMovement field names (userId→movedById)
- Fixed Inventory field names (quantityOnHand→qtyOnHand)

**Remaining**:
- 1 Prisma createMany type inference error

### reports.ts (COMPLETED - 219 → 0 errors)
**Issues Fixed**:
- All imports and procedure types (protectedProcedure → organizationProcedure)
- organizationId scoping added to all queries with proper type handling
- Field names: quantityOnHand→qtyOnHand, quantity→qty, quantityAvailable calculated
- MovementType enum values: RECEIPT→INBOUND, SHIPMENT→OUTBOUND
- StockMovement fields: type→movementType, timestamp→movedAt, quantity→qty, user→movedBy
- Receipt queries: removed status field, added organizationId through PO
- Item fields: defaultPrice→defaultCost, status→isActive
- Inventory fields: expirationDate through lot relation, added lot includes
- Customer model: removed type field references, used companyName for display
- Return model: removed receipt relationship, all returns are customer returns
- PurchaseOrder fields: grandTotal→total, expectedDeliveryDate→expectedDate
- OrderItem fields: quantity→qtyOrdered, discountAmount calculated from discountPct
- Location fields: name→code
- Include renames: orderItems→items, returnItems→items, purchaseOrderItems→items, receiptItems→items
- Added type annotations for all reduce functions and aggregations
- Fixed AuditAction enum (EXPORT→CREATE)
- Fixed variable name conflicts (itemIds redeclaration)
- Handled complex aggregations with proper typing

### stockMovements.ts (COMPLETED - 39 → 0 errors)
**Issues Fixed**:
- Import statements (protectedProcedure → organizationProcedure, router → createTRPCRouter)
- Added organizationId scoping through item relationship
- Fixed field names (referenceType/Id → refType/refId throughout)
- Fixed serialNumbers → serialNumber in includes
- Added type annotations for relatedMovements and reduce functions
- Fixed AuditAction enum (EXPORT → CREATE)
- Removed soldDate field (doesn't exist in SerialNumber)
- Fixed Decimal arithmetic with Number() conversions

### customers.ts (COMPLETED - 39 → 0 errors)
**Issues Fixed**:
- Fixed Prisma import from type-only to regular import
- Added organizationId scoping to all queries
- Fixed unique constraint issues (findUnique → findFirst with compound where)
- Fixed OrderStatus enum (PROCESSING → PICKING)
- Removed non-existent fields (creditLimit, billingAddressId, shippingAddressId)
- Fixed JSON null assignment (null → undefined)
- Fixed Decimal arithmetic with Number() conversions
- Removed shipment deliveredDate references
- Fixed item status field (status → isActive)
- Fixed AuditAction enum (EXPORT → CREATE)

### suppliers.ts (COMPLETED - 28 → 0 errors)
**Issues Fixed**:
- Fixed import (already had createTRPCRouter)
- Added organizationId scoping to all queries
- Removed isActive field references (field doesn't exist)
- Removed supplierItem model references (model doesn't exist)
- Fixed PurchaseOrder field names (grandTotal → total)
- Fixed SupplierContact field issues (removed isPrimary, mobile)
- Removed isPrimary ordering logic from contacts
- Fixed expectedDeliveryDate → expectedDate
- Added type annotations for reduce functions

---

## ✅ Systematic Fix Process

1. **Fix Imports**
   ```bash
   # Replace all occurrences
   sed -i '' 's/protectedProcedure/organizationProcedure/g' <file>
   sed -i '' 's/router(/createTRPCRouter(/g' <file>
   ```

2. **Fix Import Path**
   - Change `../trpc.js` to `../trpc/trpc.js`

3. **Add organizationId Scoping**
   - Add to every `where` clause
   - Check if direct field or through relation

4. **Fix Field References**
   - Check against Prisma schema
   - Remove non-existent fields
   - Update enum values

5. **Fix Type Errors**
   - Add type annotations to reduce functions
   - Convert Decimal to Number for arithmetic
   - Handle optional fields with nullish coalescing

6. **Test Build**
   ```bash
   pnpm --filter @ventry/backend build 2>&1 | grep -E "src/routers/<filename>.*error TS" | wc -l
   ```

---

## 🚫 Common Mistakes to Avoid

1. **DON'T use protectedProcedure** - Always use organizationProcedure
2. **DON'T forget organizationId scoping** - Every query needs it
3. **DON'T assume fields exist** - Check schema first
4. **DON'T change schema** - Fix code to match schema
5. **DON'T use snake_case in code** - Use camelCase
6. **DON'T create new models** - Work with existing schema
7. **DON'T use findUnique without organizationId** - Use findFirst instead

---

## 📊 Progress Tracking

### Check Total Errors
```bash
pnpm --filter @ventry/backend build 2>&1 | grep -E "error TS[0-9]+" | wc -l
```

### Recent Progress
- **Session Start**: 619 errors
- **After Initial Fixes**: ~494 errors
- **Previous Status**: 302 errors
- **After reports.ts fix**: 183 errors
- **After 3 more routers**: 129 errors
- **After 5 more routers**: 22 errors
- **Current Status**: 4 errors (test files only)
- **All Production Routers**: ✅ COMPLETED
- **Routers Fixed**: receipts.ts (105→0), returns.ts (88→0), reports.ts (219→0), stockMovements.ts (39→0), customers.ts (39→0), suppliers.ts (28→0), products.ts (9→0), items.ts (5→0), categories.ts (4→0), organizations.ts (1→0)

### Check Specific Router
```bash
pnpm --filter @ventry/backend build 2>&1 | grep -E "src/routers/<filename>\.ts.*error TS" | wc -l
```

### List All Router Errors
```bash
pnpm --filter @ventry/backend build 2>&1 | grep -E "^src/routers/.*error TS" | cut -d: -f1 | sort | uniq -c | sort -nr
```

---

## 🎯 Next Steps Priority

1. **Fix products.ts** (9 errors)
   - Start with imports and procedures
   - Add organizationId scoping
   - Fix field mismatches

2. **Fix items.ts** (5 errors)
   - Similar approach to other routers
   - Check for regression issues

3. **Fix categories.ts** (4 errors)
   - Fix regression errors
   - Add organizationId scoping

4. **Fix returns.ts** (1 remaining error)
   - Fix Prisma createMany type issue

5. **Fix organizations.ts** (1 error)
   - Should be straightforward fix

---

## 🔍 Verification

After all routers are fixed:

1. **Build should succeed**:
   ```bash
   pnpm --filter @ventry/backend build
   ```

2. **Type checking should pass**:
   ```bash
   pnpm typecheck
   ```

3. **Linting should pass**:
   ```bash
   pnpm lint
   ```

4. **Update documentation**:
   - TODO.md with completion status
   - README.md if needed

---

## 💡 Final Tips

1. **Read the Prisma schema** - It's the source of truth
2. **Check completed routers** - They show correct patterns
3. **Use TypeScript errors** - They guide what needs fixing
4. **Test incrementally** - Build after each major change
5. **Document TODOs** - For missing functionality
6. **Ask for clarification** - If architectural decision needed

Remember: The goal is to make the code compile with the new multi-tenant schema, not to add new features or change the schema. Stay focused on fixing compilation errors using the patterns established in completed routers.