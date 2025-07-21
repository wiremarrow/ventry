# Organization Cookie Migration Plan

## Overview
This document outlines the migration from localStorage-based organization persistence to cookie-based persistence, following the documented security architecture.

## Current Status
- **Problem**: Organization state is currently persisted in localStorage via Zustand's persist middleware
- **Security Violation**: This violates the documented architecture requiring httpOnly cookies for all state
- **TypeScript Errors**: 47 TypeScript errors due to missing `organizationId` in Prisma operations
- **User Impact**: Users experiencing organization state loss on refresh and "Select Organization" issues

## Goals
1. **Security Compliance**: Implement cookie-based organization persistence per documented architecture
2. **Type Safety**: Fix all TypeScript errors related to missing organizationId fields
3. **User Experience**: Ensure organization selection persists across page refreshes
4. **Architecture Alignment**: Make server the single source of truth for organization state

## Deliverables

### Phase 1: Backend TypeScript Fixes (47 errors)
Fix missing `organizationId` in all Prisma create operations:

#### Routers to Fix:
- [ ] **customers.ts** - Add organizationId to Address creation (line 624)
- [ ] **inventory.ts** - Multiple fixes needed:
  - [ ] StockAdjustment creation (line 620)
  - [ ] Inventory creation (line 891)
  - [ ] StockMovement creation (line 904)
  - [ ] CycleCount creation (line 995)
  - [ ] CycleCountItem creation (line 1040)
- [ ] **items.ts** - PriceHistory creation (lines 258, 359)
- [ ] **orders.ts** - Order, OrderItem, StockMovement creations
- [ ] **purchaseOrders.ts** - PO, POItem, Receipt creations
- [ ] **receipts.ts** - Receipt, ReceiptItem, StockMovement creations
- [ ] **shipments.ts** - Shipment, ShipmentItem, StockMovement creations
- [ ] **stockMovements.ts** - StockMovement, Inventory creations
- [ ] **suppliers.ts** - SupplierContact creation (line 497)
- [ ] **warehouses.ts** - Location creation (line 807)

#### Seed Scripts to Fix:
- [ ] **seed-multi-org.ts** - Location creation (lines 153, 265)
- [ ] **seed-multi-org.ts** - Inventory creation (lines 192, 304)

### Phase 2: Frontend Organization Store Refactoring

#### Store Updates:
- [x] Remove persist middleware from organization-store.ts
- [x] Update organizations.list router to return activeOrganizationId from cookie
- [ ] Remove activeOrganizationId from store state
- [ ] Update store to only cache organizations list
- [ ] Remove setActiveOrganization action (no local state changes)

#### Provider Updates:
- [ ] Update OrganizationProvider to:
  - [ ] Remove local active organization state management
  - [ ] Use activeOrganizationId from server response
  - [ ] Remove activeOrganization dependencies in useEffect
  - [ ] Update setOrganization to only call mutation

#### Component Updates:
- [ ] Update organization-switcher to:
  - [ ] Use activeOrganizationId from organizations.list response
  - [ ] Remove local state dependencies
  - [ ] Show loading state while switching

### Phase 3: Testing & Verification

#### Manual Testing:
- [ ] Login and verify organization cookie is set
- [ ] Refresh page and verify organization persists
- [ ] Check DevTools Network tab - no localStorage usage
- [ ] Verify httpOnly cookie exists for organization
- [ ] Test organization switching (normal speed)
- [ ] Test rapid organization switching (debounce working)
- [ ] Test logout clears organization cookie

#### Data Isolation Testing:
- [ ] Switch between organizations and verify data changes
- [ ] Verify no cross-organization data leakage
- [ ] Test with multiple browser tabs

### Phase 4: Documentation Updates
- [ ] Update CLAUDE.md with cookie persistence details
- [ ] Update README.md architecture section
- [ ] Document the cookie-based organization flow
- [ ] Add troubleshooting guide for organization issues

## Technical Details

### Cookie Configuration
```typescript
// Cookie name: 'active-organization'
// Properties:
- httpOnly: true (prevents XSS)
- signed: true (prevents tampering)
- sameSite: 'lax' (CSRF protection)
- secure: true (in production)
- maxAge: 30 days
```

### Data Flow
1. User logs in → Auth cookie set
2. Organizations.list called → Returns list + active org from cookie
3. User switches org → switchOrganization mutation → Cookie updated
4. All subsequent requests use organization from cookie via context

### Error Handling
- Missing organization cookie → First organization selected automatically
- Invalid organization in cookie → Cookie cleared, first org selected
- No organizations → User prompted to create/join organization

## Success Criteria
1. All TypeScript errors resolved
2. No localStorage usage for organization state
3. Organization persists across page refreshes
4. Organization switching works reliably
5. No data leakage between organizations
6. All tests passing

## Rollback Plan
If issues arise:
1. Revert Zustand store changes
2. Re-enable persist middleware temporarily
3. Document issues for resolution
4. Plan incremental migration

## Timeline
- Phase 1: 1-2 hours (TypeScript fixes)
- Phase 2: 1 hour (Frontend refactoring)
- Phase 3: 30 minutes (Testing)
- Phase 4: 30 minutes (Documentation)

**Total Estimated Time**: 3-4 hours

## Current Todo List

### In Progress
- [115] Fix organization persistence to use cookies not localStorage
- [147] Fix TypeScript errors - add missing organizationId fields

### Completed
- [144] Remove localStorage persistence from organization store ✅
- [145] Update organizations.list to return active organization ✅

### Pending (High Priority)
- [146] Fix organization switcher to use server state
- [148] Test organization cookie persistence after fixes
- [150-158] Fix all router TypeScript errors (9 routers)
- [160] Simplify organization store to only cache server data
- [161] Update OrganizationProvider to trust server state
- [162] Update organization-switcher to use server response

### Pending (Medium Priority)
- [149] Update documentation for organization cookie changes
- [159] Fix seed scripts - add organizationId to create operations

### Other Pending Tasks
- [115] Update documentation for Shipments page
- [5] Create E2E tests for auth flow
- [6] Create E2E tests for RLS isolation

## Notes
- All changes must maintain backward compatibility during migration
- Test thoroughly with multiple organizations before deploying
- Monitor for any localStorage migration issues in production