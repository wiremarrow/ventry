-- Fix missing RLS policies for tables that have FORCE RLS enabled but no policies
-- This migration adds the policies that should have been created in the original RLS migration

-- =====================================================
-- WAREHOUSES TABLE
-- =====================================================
-- Drop any existing policy to ensure clean state
DROP POLICY IF EXISTS "tenant_isolation_policy" ON warehouses;

-- Warehouses have direct organization_id
CREATE POLICY "tenant_isolation_policy" ON warehouses
  FOR ALL TO ventry_app
  USING (organization_id = current_organization_id());

COMMENT ON POLICY "tenant_isolation_policy" ON warehouses IS 
'Ensures users can only access warehouses belonging to their current organization';

-- =====================================================
-- LOCATIONS TABLE
-- =====================================================
-- Drop any existing policy to ensure clean state
DROP POLICY IF EXISTS "tenant_isolation_via_warehouse" ON locations;

-- Locations reference warehouse which has organization_id
CREATE POLICY "tenant_isolation_via_warehouse" ON locations
  FOR ALL TO ventry_app
  USING (
    EXISTS (
      SELECT 1 FROM warehouses 
      WHERE warehouses.id = locations.warehouse_id 
      AND warehouses.organization_id = current_organization_id()
    )
  );

COMMENT ON POLICY "tenant_isolation_via_warehouse" ON locations IS 
'Ensures users can only access locations in warehouses belonging to their organization';

-- =====================================================
-- INVENTORY TABLE
-- =====================================================
-- Drop any incorrectly created policies
DROP POLICY IF EXISTS "inventory_org_isolation" ON inventory;
DROP POLICY IF EXISTS "tenant_isolation_via_item" ON inventory;

-- Inventory references items which have organization_id
CREATE POLICY "tenant_isolation_via_item" ON inventory
  FOR ALL TO ventry_app
  USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = inventory.item_id 
      AND items.organization_id = current_organization_id()
    )
  );

COMMENT ON POLICY "tenant_isolation_via_item" ON inventory IS 
'Ensures users can only access inventory for items belonging to their organization';

-- =====================================================
-- AUDIT_LOGS TABLE
-- =====================================================
-- Drop any incorrectly created policies
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON audit_logs;

-- Audit logs have organization_id for tenant isolation
CREATE POLICY "tenant_isolation_policy" ON audit_logs
  FOR ALL TO ventry_app
  USING (organization_id = current_organization_id());

COMMENT ON POLICY "tenant_isolation_policy" ON audit_logs IS 
'Ensures users can only access audit logs for their current organization';

-- =====================================================
-- USERS TABLE
-- =====================================================
-- Drop any existing policy to ensure clean state
DROP POLICY IF EXISTS "users_select_same_org" ON users;

-- Users table needs special handling - only SELECT allowed, and restricted
-- Users can see:
-- 1. Themselves (always)
-- 2. Other users who are members of their current organization
CREATE POLICY "users_select_same_org" ON users
  FOR SELECT TO ventry_app
  USING (
    id = current_user_id()
    OR EXISTS (
      SELECT 1
      FROM organization_members om
      WHERE om.user_id = users.id
        AND om.organization_id = current_organization_id()
    )
  );

COMMENT ON POLICY "users_select_same_org" ON users IS 
'Users can see themselves and other users who are members of their current organization. No INSERT/UPDATE/DELETE allowed through app role.';

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Verify all tables with FORCE RLS now have policies
DO $$
DECLARE
    v_table RECORD;
    v_policy_count INTEGER;
    v_missing_count INTEGER := 0;
BEGIN
    FOR v_table IN 
        SELECT c.relname as table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relrowsecurity = true 
        AND c.relforcerowsecurity = true
        AND c.relkind = 'r'
    LOOP
        SELECT COUNT(*) INTO v_policy_count
        FROM pg_policy p
        WHERE p.polrelid = (v_table.table_name)::regclass;
        
        IF v_policy_count = 0 THEN
            RAISE WARNING 'Table % has FORCE RLS but no policies!', v_table.table_name;
            v_missing_count := v_missing_count + 1;
        END IF;
    END LOOP;
    
    IF v_missing_count = 0 THEN
        RAISE NOTICE 'All tables with FORCE RLS now have at least one policy';
    ELSE
        RAISE EXCEPTION '% tables still have FORCE RLS but no policies', v_missing_count;
    END IF;
END $$;