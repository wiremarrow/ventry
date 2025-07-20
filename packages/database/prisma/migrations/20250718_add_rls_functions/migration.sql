-- Add RLS (Row-Level Security) Functions
-- These functions are required for multi-tenant data isolation

-- Function to set RLS context for the current transaction
CREATE OR REPLACE FUNCTION set_rls_context(
  p_organization_id TEXT,
  p_user_id TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_organization_id TEXT;
  v_user_id TEXT;
BEGIN
  -- Validate organization_id format (CUID: 25 chars, lowercase alphanumeric)
  IF p_organization_id !~ '^[0-9a-z]{25}$' THEN
    RAISE EXCEPTION 'Invalid organization_id format: %', p_organization_id
      USING ERRCODE = 'data_exception',
            HINT = 'Organization ID must be a valid CUID (25 lowercase alphanumeric characters)';
  END IF;
  
  -- Validate user_id if provided
  IF p_user_id IS NOT NULL THEN
    IF p_user_id !~ '^[0-9a-z]{25}$' THEN
      RAISE EXCEPTION 'Invalid user_id format: %', p_user_id
        USING ERRCODE = 'data_exception',
              HINT = 'User ID must be a valid CUID (25 lowercase alphanumeric characters)';
    END IF;
    v_user_id := p_user_id;
  END IF;
  
  v_organization_id := p_organization_id;
  
  -- Set the session variables for RLS
  PERFORM set_config('app.current_organization_id', v_organization_id, true);
  
  IF v_user_id IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', v_user_id, true);
  END IF;
  
  RAISE DEBUG 'RLS context set - org: %, user: %', v_organization_id, v_user_id;
  
EXCEPTION
  WHEN data_exception THEN
    RAISE;
  WHEN OTHERS THEN
    RAISE WARNING 'Unexpected error in set_rls_context: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER
   SET search_path = public, pg_temp
   PARALLEL SAFE
   STABLE;

COMMENT ON FUNCTION set_rls_context(TEXT, TEXT) IS 
'Securely sets RLS context variables for the current transaction. 
Validates CUID format and prevents SQL injection.
Used by the application to establish tenant context for multi-tenant isolation.';

-- Function to clear RLS context
CREATE OR REPLACE FUNCTION clear_rls_context() RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_organization_id', NULL, true);
  PERFORM set_config('app.current_user_id', NULL, true);
  RAISE DEBUG 'RLS context cleared';
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER
   SET search_path = public, pg_temp
   PARALLEL SAFE
   STABLE;

COMMENT ON FUNCTION clear_rls_context() IS 
'Clears RLS context variables for the current transaction.
Used for cleanup and testing purposes.';

-- Function to get current RLS context (for debugging)
CREATE OR REPLACE FUNCTION get_rls_context() 
RETURNS TABLE(organization_id TEXT, user_id TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    current_setting('app.current_organization_id', true),
    current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql 
   SECURITY INVOKER
   SET search_path = public, pg_temp
   PARALLEL SAFE
   STABLE;

COMMENT ON FUNCTION get_rls_context() IS 
'Returns the current RLS context variables.
Useful for debugging and verification.';