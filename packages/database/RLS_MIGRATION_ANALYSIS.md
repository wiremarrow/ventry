# RLS Migration Analysis - July 16, 2025

## Current Database State vs Expected State

### 1. RLS Enablement Status

**Current State:**
- Only `organization_members` table has RLS enabled
- All other tables (41 total) have RLS disabled

**Expected State (from migrations):**
- Multiple tables should have RLS enabled
- Critical tables like `users`, `organizations`, `items`, etc. should be protected

### 2. RLS Functions

**Currently Exists:**
```sql
- set_rls_context(p_organization_id text, p_user_id text) -> void
- clear_rls_context() -> void  
- get_rls_context() -> TABLE(organization_id text, user_id text)
```

**Missing but Required:**
```sql
- current_organization_id() -> UUID  -- TYPE MISMATCH: should return TEXT
- current_user_id() -> UUID          -- TYPE MISMATCH: should return TEXT
- is_organization_member(org_id UUID) -> BOOLEAN
```

### 3. Critical Column Issues

**Missing Columns:**
1. `audit_logs` table - missing `organization_id` column
2. `inventory` table - missing `organization_id` column

These missing columns will cause RLS policies to fail if we try to apply tenant isolation.

### 4. Type Mismatches

The database uses `TEXT` type for all IDs (CUID format - 25 character strings), but the migrations assume `UUID` type. This will cause:
- Function return type mismatches
- Policy comparison failures
- Type casting errors

### 5. Existing Policies

**Current Policies on `organization_members`:**
```sql
- org_members_read: (user_id = current_setting('app.current_user_id'::text, true))
- org_members_read_own: (user_id = current_setting('app.current_user_id'::text, true))
```

These policies directly use `current_setting` instead of helper functions.

## Migration Issues Found

### Issue 1: Type Incompatibility
- Migration `20250115_add_row_level_security` creates functions returning UUID
- Database uses TEXT for all ID columns
- This will cause all policies to fail

### Issue 2: Missing Prerequisites  
- `audit_logs` needs `organization_id` column before RLS can work
- `inventory` needs `organization_id` column (or different RLS approach)

### Issue 3: Function Conflicts
- We already have `set_rls_context` but migrations try to create it again
- Existing functions use TEXT, new ones use UUID

### Issue 4: Migration Order
- Need to fix column issues before applying RLS policies
- Need to fix type issues in functions before creating policies

## Recommended Approach

### Step 1: Fix Type Issues
Create corrected functions that return TEXT instead of UUID:
```sql
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_organization_id() 
RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_organization_id', true), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 2: Add Missing Columns
1. Add `organization_id` to `audit_logs` table
2. Determine approach for `inventory` table (it might use location -> warehouse -> organization relationship)

### Step 3: Create Corrected Migration
Write a new migration that:
- Uses TEXT types consistently
- Handles existing functions/policies
- Adds columns where needed
- Creates policies appropriate for actual schema

### Step 4: Test Thoroughly
- Verify type compatibility
- Test with actual CUID values
- Ensure no breaking changes
- Validate all policies work as expected

## Conclusion

**DO NOT apply the existing migrations as-is.** They have fundamental type mismatches and missing prerequisites that will cause failures. We need to create corrected migrations that match the actual database schema (TEXT-based IDs, not UUIDs).