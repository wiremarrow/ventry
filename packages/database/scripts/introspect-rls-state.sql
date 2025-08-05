-- Database RLS State Introspection Script
-- This script checks the actual database state for RLS configuration
-- Fixed based on review feedback to avoid errors and provide accurate results

-- Check PostgreSQL version
SELECT version();

-- List all tables with RLS status (using pg_class for accurate info)
SELECT 
    n.nspname AS schemaname,
    c.relname AS tablename,
    c.relrowsecurity AS rowsecurity,
    c.relforcerowsecurity AS forcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
    AND c.relkind = 'r'  -- regular tables only
ORDER BY c.relname;

-- Show ALL columns for key RLS tables (not filtered)
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN (
        'users', 
        'organization_members', 
        'audit_logs', 
        'organizations',
        'items',
        'inventory',
        'warehouses'
    )
ORDER BY table_name, ordinal_position;

-- List all RLS policies with full details
SELECT 
    schemaname,
    tablename,
    policyname,
    roles,
    cmd AS policy_cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check for RLS-related functions (simplified output first)
SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS returns,
    obj_description(p.oid, 'pg_proc') AS comment
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'current_user_id',
        'current_organization_id',
        'set_rls_context',
        'clear_rls_context',
        'get_rls_context',
        'is_organization_member'
    )
ORDER BY p.proname;

-- Get full function definitions (commented out by default to reduce noise)
-- Uncomment if you need to see full function bodies
/*
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'current_user_id',
        'current_organization_id',
        'set_rls_context',
        'clear_rls_context',
        'get_rls_context',
        'is_organization_member'
    )
ORDER BY p.proname;
*/

-- Check migration history
SELECT 
    id,
    migration_name,
    logs,
    rolled_back_at,
    started_at,
    applied_steps_count,
    finished_at
FROM public._prisma_migrations
ORDER BY started_at DESC
LIMIT 20;

-- Check for any failed or rolled back migrations
SELECT 
    id,
    migration_name,
    logs,
    started_at,
    finished_at,
    rolled_back_at
FROM public._prisma_migrations
WHERE finished_at IS NULL 
    OR rolled_back_at IS NOT NULL
    OR logs IS NOT NULL;

-- Test current session variables
SELECT 
    current_setting('app.current_organization_id', true) AS current_org_id,
    current_setting('app.current_user_id', true) AS current_user_id;

-- Check indexes on foreign keys used in RLS policies (fixed WHERE clause)
SELECT 
    t.relname AS tablename,
    i.indexname,
    i.indexdef
FROM pg_indexes i
JOIN pg_class t ON i.tablename = t.relname::text
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE i.schemaname = 'public'
    AND n.nspname = 'public'
    AND (
        i.indexdef ILIKE '%organization_id%'
        OR i.indexdef ILIKE '%user_id%'
    )
ORDER BY t.relname, i.indexname;

-- Audit table analysis - check if tables have expected RLS columns
WITH expected_columns AS (
    SELECT 'users' AS table_name, 'id' AS column_name
    UNION ALL SELECT 'organization_members', 'user_id'
    UNION ALL SELECT 'organization_members', 'organization_id'
    UNION ALL SELECT 'audit_logs', 'user_id'
    UNION ALL SELECT 'audit_logs', 'organization_id'  -- This might be missing!
    UNION ALL SELECT 'items', 'organization_id'
    UNION ALL SELECT 'inventory', 'organization_id'
    UNION ALL SELECT 'warehouses', 'organization_id'
)
SELECT 
    ec.table_name,
    ec.column_name,
    CASE 
        WHEN c.column_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END AS status,
    c.data_type
FROM expected_columns ec
LEFT JOIN information_schema.columns c 
    ON c.table_schema = 'public'
    AND c.table_name = ec.table_name
    AND c.column_name = ec.column_name
ORDER BY ec.table_name, ec.column_name;

-- Check for table name variations (PascalCase vs snake_case)
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND (
        table_name ILIKE '%user%'
        OR table_name ILIKE '%organization%'
        OR table_name ILIKE '%audit%'
        OR table_name ILIKE '%member%'
    )
ORDER BY table_name;

-- Summary of RLS readiness
WITH rls_status AS (
    SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS has_rls,
        COUNT(p.polname) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE n.nspname = 'public'
        AND c.relkind = 'r'
    GROUP BY c.relname, c.relrowsecurity
)
SELECT 
    table_name,
    has_rls,
    policy_count,
    CASE 
        WHEN has_rls AND policy_count > 0 THEN 'READY'
        WHEN has_rls AND policy_count = 0 THEN 'RLS ENABLED BUT NO POLICIES'
        ELSE 'RLS NOT ENABLED'
    END AS rls_status
FROM rls_status
ORDER BY 
    CASE 
        WHEN table_name IN ('users', 'organization_members', 'organizations', 'audit_logs') 
        THEN 0 
        ELSE 1 
    END,
    table_name;