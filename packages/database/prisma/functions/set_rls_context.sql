-- RLS Context Setting Function with SECURITY DEFINER
-- This function provides a secure way to set session variables for Row-Level Security
-- It validates inputs at the database level and prevents SQL injection

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
  -- Using set_config with 'true' makes it transaction-local (same as SET LOCAL)
  PERFORM set_config('app.current_organization_id', v_organization_id, true);
  
  IF v_user_id IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', v_user_id, true);
  END IF;
  
  -- Log successful context setting (optional - can be commented out in production)
  RAISE DEBUG 'RLS context set - org: %, user: %', v_organization_id, v_user_id;
  
EXCEPTION
  WHEN data_exception THEN
    -- Re-raise data validation errors
    RAISE;
  WHEN OTHERS THEN
    -- Log unexpected errors and re-raise
    RAISE WARNING 'Unexpected error in set_rls_context: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER
   SET search_path = public, pg_temp
   PARALLEL SAFE
   STABLE;

-- Grant execute permission to the application role
-- Replace 'app_user' with your actual application database user
-- GRANT EXECUTE ON FUNCTION set_rls_context(TEXT, TEXT) TO app_user;

-- Add function comment for documentation
COMMENT ON FUNCTION set_rls_context(TEXT, TEXT) IS 
'Securely sets RLS context variables for the current transaction. 
Validates CUID format and prevents SQL injection.
Used by the application to establish tenant context for multi-tenant isolation.';

-- Create a companion function to clear RLS context
CREATE OR REPLACE FUNCTION clear_rls_context() RETURNS void AS $$
BEGIN
  -- Reset the session variables
  PERFORM set_config('app.current_organization_id', NULL, true);
  PERFORM set_config('app.current_user_id', NULL, true);
  
  RAISE DEBUG 'RLS context cleared';
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER
   SET search_path = public, pg_temp
   PARALLEL SAFE
   STABLE;

-- Grant execute permission to the application role
-- GRANT EXECUTE ON FUNCTION clear_rls_context() TO app_user;

COMMENT ON FUNCTION clear_rls_context() IS 
'Clears RLS context variables for the current transaction.
Used for cleanup and testing purposes.';

-- Create a function to get current RLS context (useful for debugging)
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

-- Grant execute permission to the application role
-- GRANT EXECUTE ON FUNCTION get_rls_context() TO app_user;

COMMENT ON FUNCTION get_rls_context() IS 
'Returns the current RLS context variables.
Useful for debugging and verification.';