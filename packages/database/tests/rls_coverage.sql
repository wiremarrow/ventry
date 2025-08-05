-- pgTAP test to ensure all tenant-scoped tables have RLS enabled
-- This test will fail CI if any table with organization_id ships without RLS

BEGIN;
SELECT plan(2);

-- Test 1: All tables with organization_id column must have RLS enabled
SELECT is(
    COUNT(*)::integer,
    0::integer,
    'All tables with organization_id must have RLS enabled'
)
FROM information_schema.columns c
JOIN pg_class pc ON pc.relname = c.table_name
JOIN pg_namespace pn ON pn.oid = pc.relnamespace
WHERE c.column_name = 'organization_id'
  AND c.table_schema = 'public'
  AND pc.relkind = 'r'  -- regular tables only
  AND NOT pc.relrowsecurity  -- RLS not enabled
  AND c.table_name NOT IN ('_prisma_migrations');  -- exclude Prisma internals

-- Test 2: All RLS-enabled tables must have at least one policy
SELECT is(
    COUNT(*)::integer,
    0::integer,
    'All RLS-enabled tables must have at least one policy'
)
FROM pg_class pc
JOIN pg_namespace pn ON pn.oid = pc.relnamespace
WHERE pn.nspname = 'public'
  AND pc.relkind = 'r'
  AND pc.relrowsecurity  -- RLS is enabled
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies pp
    WHERE pp.schemaname = 'public'
      AND pp.tablename = pc.relname
  );

SELECT * FROM finish();
ROLLBACK;