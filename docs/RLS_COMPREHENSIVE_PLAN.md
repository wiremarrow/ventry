# Comprehensive Row-Level Security (RLS) Implementation Plan

## Current Status
- ✅ RLS migration file created with all policies
- ✅ RLS middleware (rls-middleware.ts) implemented
- ✅ tRPC context updated to use RLS-enabled Prisma
- ✅ Integration test file created but not yet working
- ❌ Migration not applied to test database
- ❌ Tests not passing
- ❌ No unit tests for middleware
- ❌ Not tested with actual routers

## Phase 1: Database Setup and Migration (Task 2.1)

### 1.1 Apply RLS Migration to Test Database
```bash
# First, check current migration status
DATABASE_URL="postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test" pnpm --filter @ventry/database prisma migrate status

# Apply all migrations including RLS
DATABASE_URL="postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test" pnpm --filter @ventry/database prisma migrate deploy

# Verify RLS functions exist
psql -U ventry -h localhost -p 5487 -d ventry_integration_test -c "\df current_organization_id"
```

### 1.2 Verify Database Schema
- Check that all tables have RLS enabled
- Verify helper functions are created
- Confirm policies are in place

## Phase 2: Fix Integration Tests (Task 2.2)

### 2.1 Understand Test Database State
- Check if RLS policies already exist from migration
- Determine if we need to manually enable RLS in tests
- Verify column types (text vs uuid)

### 2.2 Fix Test Data Creation
1. Create organizations first
2. Create users
3. Create organization memberships
4. Create categories and UOMs with proper fields
5. Create items with valid foreign keys
6. Handle cleanup properly

### 2.3 Test Scenarios to Cover
- ✅ Organization isolation (can't see other org's data)
- ✅ Cross-organization prevention (can't modify other org's data)
- ✅ Empty results without context
- ✅ Raw query support
- ✅ Transaction support
- ✅ RLS bypass for system operations
- ❌ Nested queries (items with categories)
- ❌ Aggregation queries
- ❌ Complex joins

## Phase 3: Run and Verify Tests (Task 2.3)

### 3.1 Integration Tests
```bash
# Run RLS integration tests
pnpm test:integration rls

# Run all integration tests to ensure no regression
pnpm test:integration
```

### 3.2 Debug Any Failures
- Check PostgreSQL logs for RLS violations
- Verify session variables are being set
- Ensure proper type casting in policies

## Phase 4: Create Unit Tests (Task 2.4)

### 4.1 Test RLS Middleware Functions
- `createRLSMiddleware()` - Middleware creation
- `withRLS()` - Transaction wrapper
- `createRLSProxy()` - Proxy creation
- `bypassRLS()` - System operations

### 4.2 Test Edge Cases
- Missing organization context
- Invalid UUIDs
- Concurrent requests with different contexts
- Error handling

## Phase 5: Test with Real Routers (Task 2.5)

### 5.1 Create Router Integration Tests
- Test items router with RLS
- Test orders router with RLS
- Test inventory operations
- Verify audit logs respect RLS

### 5.2 Manual Testing Checklist
- [ ] Login as user in Org A
- [ ] Create items - verify only visible in Org A
- [ ] Switch to Org B - verify can't see Org A items
- [ ] Try to access Org A item via direct ID - should fail
- [ ] Test bulk operations respect RLS

## Phase 6: Documentation (Task 2.6)

### 6.1 Update Technical Documentation
- Add RLS section to ARCHITECTURE.md
- Document RLS policies in DATABASE.md
- Create RLS troubleshooting guide

### 6.2 Developer Guide
- How to write RLS-aware code
- When to use bypassRLS
- Testing with RLS enabled
- Common pitfalls

## Phase 7: Development Environment Verification (Task 2.7)

### 7.1 Apply to Development Database
```bash
# Apply migration to dev database
pnpm db:migrate deploy
```

### 7.2 Test Full Application Flow
- Start backend: `pnpm --filter @ventry/backend dev`
- Start frontend: `pnpm --filter @ventry/web dev`
- Test complete user flows with multiple organizations

### 7.3 Performance Testing
- Measure query performance with RLS
- Identify any slow queries
- Add indexes if needed

## Success Criteria
1. All RLS integration tests pass
2. All existing tests continue to pass
3. Manual testing confirms proper isolation
4. No performance regression
5. Documentation is complete
6. Can be safely deployed to production

## Risk Mitigation
1. **Rollback Plan**: Migration includes DOWN script to disable RLS
2. **Monitoring**: Add logs for RLS context setting
3. **Gradual Rollout**: Test in staging before production
4. **Escape Hatch**: bypassRLS for critical operations

## Timeline Estimate
- Phase 1: 30 minutes
- Phase 2: 1 hour
- Phase 3: 30 minutes
- Phase 4: 1 hour
- Phase 5: 2 hours
- Phase 6: 1 hour
- Phase 7: 1 hour
Total: ~6.5 hours

## Next Steps
1. Start with Phase 1 - Apply migration to test database
2. Fix the integration test data setup
3. Get all tests passing before moving to next phases