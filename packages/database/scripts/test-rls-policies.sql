-- RLS Policy Test Script
-- This script tests if RLS policies are working correctly

-- Test Setup
BEGIN;

-- Create test data
DO $$
DECLARE
    test_org_id UUID := gen_random_uuid();
    test_user1_id UUID := gen_random_uuid();
    test_user2_id UUID := gen_random_uuid();
    other_org_id UUID := gen_random_uuid();
BEGIN
    -- Display test IDs
    RAISE NOTICE 'Test Organization ID: %', test_org_id;
    RAISE NOTICE 'Test User 1 ID: %', test_user1_id;
    RAISE NOTICE 'Test User 2 ID: %', test_user2_id;
    RAISE NOTICE 'Other Organization ID: %', other_org_id;
    
    -- Store in temp table for use in tests
    CREATE TEMP TABLE test_context (
        test_org_id UUID,
        test_user1_id UUID,
        test_user2_id UUID,
        other_org_id UUID
    );
    
    INSERT INTO test_context VALUES (test_org_id, test_user1_id, test_user2_id, other_org_id);
END $$;

-- Test 1: Verify current_user_id() function works
RAISE NOTICE '=== Test 1: Testing current_user_id() function ===';
SELECT current_setting('app.current_user_id', true) AS before_setting;

-- Set user context
SET LOCAL app.current_user_id = 'test_user_123';
SELECT 
    current_setting('app.current_user_id', true) AS after_setting,
    current_user_id() AS function_result;

-- Test 2: Verify current_organization_id() function works
RAISE NOTICE '=== Test 2: Testing current_organization_id() function ===';
SET LOCAL app.current_organization_id = 'test_org_123';
SELECT 
    current_setting('app.current_organization_id', true) AS org_setting,
    current_organization_id() AS function_result;

-- Test 3: Test self-select on users table (if RLS is enabled)
RAISE NOTICE '=== Test 3: Testing self-select on users table ===';
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    -- Check if RLS is enabled on users table
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'users';
    
    IF rls_enabled THEN
        RAISE NOTICE 'RLS is enabled on users table';
        -- Would test actual queries here, but need real user data
    ELSE
        RAISE NOTICE 'RLS is NOT enabled on users table';
    END IF;
END $$;

-- Test 4: Test organization_members policies
RAISE NOTICE '=== Test 4: Testing organization_members policies ===';
DO $$
DECLARE
    rls_enabled BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Check if RLS is enabled
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'organization_members';
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'organization_members';
    
    RAISE NOTICE 'RLS enabled: %, Policy count: %', rls_enabled, policy_count;
    
    -- List policies
    FOR policy_name, using_expr IN 
        SELECT policyname, qual 
        FROM pg_policies 
        WHERE tablename = 'organization_members'
    LOOP
        RAISE NOTICE 'Policy: % - Expression: %', policy_name, using_expr;
    END LOOP;
END $$;

-- Test 5: Check for missing organization_id in audit_logs
RAISE NOTICE '=== Test 5: Checking audit_logs structure ===';
SELECT 
    column_name,
    data_type,
    CASE 
        WHEN column_name = 'organization_id' THEN 'FOUND'
        WHEN column_name = 'user_id' THEN 'FOUND'
        ELSE 'other'
    END AS rls_column_status
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND column_name IN ('user_id', 'organization_id', 'id')
ORDER BY ordinal_position;

-- Test 6: Verify RLS context can be set and cleared
RAISE NOTICE '=== Test 6: Testing RLS context functions ===';
DO $$
BEGIN
    -- Test set_rls_context if it exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_rls_context') THEN
        -- This would test the function but we need valid CUID format
        RAISE NOTICE 'set_rls_context function exists';
        
        -- Test clear_rls_context
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'clear_rls_context') THEN
            PERFORM clear_rls_context();
            RAISE NOTICE 'RLS context cleared';
        END IF;
        
        -- Verify it's cleared
        RAISE NOTICE 'After clear - org: %, user: %', 
            current_setting('app.current_organization_id', true),
            current_setting('app.current_user_id', true);
    ELSE
        RAISE NOTICE 'set_rls_context function does not exist';
    END IF;
END $$;

-- Test 7: Summary of RLS readiness
RAISE NOTICE '=== Test 7: RLS Readiness Summary ===';
WITH rls_check AS (
    SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS has_rls,
        COUNT(p.polname) AS policy_count,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns col
                WHERE col.table_name = c.relname
                    AND col.column_name IN ('organization_id', 'user_id')
            ) THEN true
            ELSE false
        END AS has_rls_columns
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname IN (
            'users', 
            'organizations', 
            'organization_members',
            'audit_logs',
            'items',
            'inventory',
            'warehouses'
        )
    GROUP BY c.oid, c.relname, c.relrowsecurity
)
SELECT 
    table_name,
    has_rls,
    policy_count,
    has_rls_columns,
    CASE 
        WHEN has_rls AND policy_count > 0 AND has_rls_columns THEN '✓ READY'
        WHEN has_rls AND policy_count > 0 AND NOT has_rls_columns THEN '⚠ MISSING RLS COLUMNS'
        WHEN has_rls AND policy_count = 0 THEN '⚠ NO POLICIES'
        WHEN NOT has_rls AND has_rls_columns THEN '⚠ RLS NOT ENABLED'
        ELSE '✗ NOT READY'
    END AS status
FROM rls_check
ORDER BY 
    CASE table_name
        WHEN 'users' THEN 1
        WHEN 'organizations' THEN 2
        WHEN 'organization_members' THEN 3
        WHEN 'audit_logs' THEN 4
        ELSE 5
    END;

-- Clean up
ROLLBACK;

-- Final message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== RLS Policy Test Complete ===';
    RAISE NOTICE 'Review the output above for any issues.';
    RAISE NOTICE 'Key things to check:';
    RAISE NOTICE '1. Are RLS functions (current_user_id, etc.) working?';
    RAISE NOTICE '2. Do critical tables have RLS enabled?';
    RAISE NOTICE '3. Are there policies defined for RLS-enabled tables?';
    RAISE NOTICE '4. Do tables have the necessary columns (user_id, organization_id)?';
END $$;