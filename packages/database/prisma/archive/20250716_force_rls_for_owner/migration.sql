-- Force RLS for table owner to ensure all connections follow security policies
-- This ensures that even the database owner (ventry user) must follow RLS rules

-- Force RLS on all tables that have RLS enabled
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE items FORCE ROW LEVEL SECURITY;
ALTER TABLE item_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE warehouses FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory FORCE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Add comment explaining why this is necessary
COMMENT ON TABLE items IS 
'Inventory items table with FORCED RLS to ensure even the table owner follows security policies. 
This is critical for multi-tenant security when the application connects as the database owner.';

-- Verify the changes
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relrowsecurity = true 
    AND c.relforcerowsecurity = false
    AND c.relkind = 'r';
    
    IF v_count > 0 THEN
        RAISE WARNING 'There are still % tables with RLS enabled but not forced', v_count;
    ELSE
        RAISE NOTICE 'All tables with RLS now have FORCE ROW LEVEL SECURITY enabled';
    END IF;
END $$;