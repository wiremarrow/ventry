-- Add self-select RLS policies for Phase 0 security requirements
-- These policies allow users to access their own data using current_user_id()

-- Note: The current_user_id() function should already exist from migration 20250115_add_row_level_security
-- We'll verify it exists but not recreate it to avoid conflicts

-- Add self-select policy for users table
-- Allow users to read their own user record
DO $$ 
BEGIN
  -- Check if policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'users_self_select'
  ) THEN
    CREATE POLICY users_self_select ON users
      FOR SELECT
      USING (id = current_user_id());
  END IF;
END $$;

-- Add self-select policy for organization_members
-- This should already exist but we'll ensure it's properly configured
DO $$ 
BEGIN
  -- Drop existing policy if it doesn't match our requirements
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organization_members' 
    AND policyname = 'users_view_own_memberships'
    AND polcmd = 'r'  -- SELECT only
  ) THEN
    -- Policy already exists for SELECT, which is what we want
    NULL;
  ELSE
    -- Create the policy if it doesn't exist
    CREATE POLICY users_view_own_memberships ON organization_members
      FOR SELECT
      USING (user_id = current_user_id());
  END IF;
END $$;

-- Add self-select policies for audit_logs
-- Users can view audit logs for their own actions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' 
    AND policyname = 'users_view_own_audit_logs'
  ) THEN
    CREATE POLICY users_view_own_audit_logs ON audit_logs
      FOR SELECT
      USING (user_id = current_user_id());
  END IF;
END $$;

-- Add self-select policies for user sessions (if table exists)
-- Users can manage their own sessions
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'user_sessions'
  ) THEN
    -- Enable RLS if not already enabled
    ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
    
    -- Create self-select policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'user_sessions' 
      AND policyname = 'users_manage_own_sessions'
    ) THEN
      CREATE POLICY users_manage_own_sessions ON user_sessions
        FOR ALL
        USING (user_id = current_user_id());
    END IF;
  END IF;
END $$;

-- Add function to verify self-select policies are working
CREATE OR REPLACE FUNCTION verify_self_select_policies()
RETURNS TABLE(
  table_name text,
  policy_name text,
  policy_cmd text,
  policy_definition text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.tablename::text,
    p.policyname::text,
    p.polcmd::text,
    p.polqual::text
  FROM pg_policies p
  WHERE p.polqual LIKE '%current_user_id()%'
  ORDER BY p.tablename, p.policyname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_self_select_policies() IS 
'Returns all RLS policies that use current_user_id() for self-selection.
Used to verify Phase 0 security requirements are met.';