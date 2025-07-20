-- Fix RLS implementation to use TEXT types matching actual database schema
-- This migration corrects the type mismatches from previous RLS migrations

-- =====================================================
-- STEP 1: Drop incorrect UUID-returning functions if they exist
-- =====================================================
DROP FUNCTION IF EXISTS current_organization_id() CASCADE;
DROP FUNCTION IF EXISTS current_user_id() CASCADE;
DROP FUNCTION IF EXISTS is_organization_member(UUID) CASCADE;

-- =====================================================
-- STEP 2: Create corrected helper functions returning TEXT
-- =====================================================

-- Function to get current organization ID as TEXT (matching CUID type)
CREATE OR REPLACE FUNCTION current_organization_id() 
RETURNS TEXT AS $$
BEGIN
  -- Get organization ID from session context set by app
  RETURN NULLIF(current_setting('app.current_organization_id', true), '');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get current user ID as TEXT (matching CUID type)
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS TEXT AS $$
BEGIN
  -- Get user ID from session context set by app
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if current user is member of organization (TEXT parameters)
CREATE OR REPLACE FUNCTION is_organization_member(org_id TEXT) 
RETURNS BOOLEAN AS $$
BEGIN
  -- Return false if no user context
  IF current_user_id() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE organization_id = org_id 
    AND user_id = current_user_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- STEP 3: Add missing columns
-- =====================================================

-- Add organization_id to audit_logs if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' 
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN organization_id TEXT;
    
    -- Add index for performance
    CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
    
    -- Add foreign key constraint
    ALTER TABLE audit_logs 
      ADD CONSTRAINT fk_audit_logs_organization 
      FOREIGN KEY (organization_id) 
      REFERENCES organizations(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================
-- STEP 4: Fix existing organization_members policies
-- =====================================================

-- Drop existing policies on organization_members to recreate with consistent naming
DROP POLICY IF EXISTS org_members_read ON organization_members;
DROP POLICY IF EXISTS org_members_read_own ON organization_members;
DROP POLICY IF EXISTS users_view_own_memberships ON organization_members;

-- Create clean policy for organization_members
CREATE POLICY users_view_own_memberships ON organization_members
  FOR SELECT
  USING (user_id = current_user_id());

-- =====================================================
-- STEP 5: Enable RLS on critical tables with TEXT-based policies
-- =====================================================

-- 1. Organizations table - users see orgs they're members of
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start clean
DROP POLICY IF EXISTS users_view_own_organizations ON organizations;
DROP POLICY IF EXISTS users_manage_owned_organizations ON organizations;

CREATE POLICY users_view_member_organizations ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = current_user_id()
    )
  );

-- 2. Users table - users can see other users in same organization
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS users_self_select ON users;
DROP POLICY IF EXISTS tenant_isolation_policy ON users;

-- Users can always see their own record
CREATE POLICY users_view_self ON users
  FOR SELECT
  USING (id = current_user_id());

-- Users can see other users in their organization
CREATE POLICY users_view_organization_members ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = users.id
      AND om2.user_id = current_user_id()
    )
  );

-- 3. Items table - standard tenant isolation
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON items;

CREATE POLICY tenant_isolation ON items
  FOR ALL
  USING (organization_id = current_organization_id());

-- 4. Item Categories table - standard tenant isolation
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON item_categories;

CREATE POLICY tenant_isolation ON item_categories
  FOR ALL
  USING (organization_id = current_organization_id());

-- 5. Warehouses table - standard tenant isolation
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON warehouses;

CREATE POLICY tenant_isolation ON warehouses
  FOR ALL
  USING (organization_id = current_organization_id());

-- 6. Inventory table - uses warehouse relationship for tenant isolation
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON inventory;

CREATE POLICY tenant_isolation ON inventory
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM locations l
      JOIN warehouses w ON l.warehouse_id = w.id
      WHERE l.id = inventory.location_id
      AND w.organization_id = current_organization_id()
    )
  );

-- 7. Locations table - uses warehouse relationship
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON locations;

CREATE POLICY tenant_isolation ON locations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouses w
      WHERE w.id = locations.warehouse_id
      AND w.organization_id = current_organization_id()
    )
  );

-- 8. Audit logs table - standard tenant isolation (once column is added)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON audit_logs;
DROP POLICY IF EXISTS users_view_own_audit_logs ON audit_logs;

-- Users can view audit logs for their organization
CREATE POLICY tenant_isolation ON audit_logs
  FOR SELECT
  USING (organization_id = current_organization_id());

-- System can insert audit logs (with RLS bypass when needed)
CREATE POLICY system_insert ON audit_logs
  FOR INSERT
  WITH CHECK (organization_id = current_organization_id() OR current_organization_id() IS NULL);

-- =====================================================
-- STEP 6: Create verification function
-- =====================================================

CREATE OR REPLACE FUNCTION verify_rls_status()
RETURNS TABLE(
  table_name text,
  rls_enabled boolean,
  policy_count bigint,
  has_org_id_column boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH rls_tables AS (
    SELECT 
      schemaname,
      tablename,
      rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
  ),
  policy_counts AS (
    SELECT 
      schemaname,
      tablename,
      COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename
  ),
  org_id_columns AS (
    SELECT DISTINCT
      table_name,
      true as has_org_id
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'organization_id'
  )
  SELECT 
    rt.tablename::text,
    rt.rowsecurity,
    COALESCE(pc.policy_count, 0),
    COALESCE(oc.has_org_id, false)
  FROM rls_tables rt
  LEFT JOIN policy_counts pc ON rt.tablename = pc.tablename
  LEFT JOIN org_id_columns oc ON rt.tablename = oc.table_name
  WHERE rt.tablename NOT LIKE '_prisma%'
  ORDER BY rt.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_rls_status() IS 
'Shows RLS enablement status, policy count, and organization_id column presence for all tables';

-- =====================================================
-- STEP 7: Add helpful comments
-- =====================================================

COMMENT ON FUNCTION current_organization_id() IS 
'Returns the current organization ID from session context (TEXT/CUID format)';

COMMENT ON FUNCTION current_user_id() IS 
'Returns the current user ID from session context (TEXT/CUID format)';

COMMENT ON FUNCTION is_organization_member(TEXT) IS 
'Checks if the current user is a member of the specified organization';