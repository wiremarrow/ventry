-- Create Application User for Ventry RLS
-- This script creates the ventry_app user with proper permissions for Row-Level Security

-- Check if role exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ventry_app') THEN
        -- Create application role with password
        CREATE ROLE ventry_app LOGIN PASSWORD 'ventry_app_password';
        RAISE NOTICE 'Created ventry_app role';
    ELSE
        RAISE NOTICE 'ventry_app role already exists';
    END IF;
END
$$;

-- Connect to ventry_dev database
\c ventry_dev

-- Grant connection privilege
GRANT CONNECT ON DATABASE ventry_dev TO ventry_app;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO ventry_app;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ventry_app;

-- Grant sequence permissions (for auto-increment fields)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ventry_app;

-- Grant function execution permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ventry_app;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ventry_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ventry_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ventry_app;

-- Verify the user does NOT have BYPASSRLS
DO $$
DECLARE
    bypass_rls boolean;
BEGIN
    SELECT rolbypassrls INTO bypass_rls FROM pg_roles WHERE rolname = 'ventry_app';
    IF bypass_rls THEN
        RAISE WARNING 'ventry_app has BYPASSRLS=true, which defeats RLS! This should be fixed.';
    ELSE
        RAISE NOTICE 'ventry_app correctly has BYPASSRLS=false';
    END IF;
END
$$;

-- Connect to ventry_integration_test database (if it exists)
\c ventry_integration_test

DO $$
BEGIN
    -- Only proceed if we're connected to the integration test database
    IF current_database() = 'ventry_integration_test' THEN
        -- Grant connection privilege
        GRANT CONNECT ON DATABASE ventry_integration_test TO ventry_app;
        
        -- Grant schema usage
        GRANT USAGE ON SCHEMA public TO ventry_app;
        
        -- Grant table permissions
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ventry_app;
        
        -- Grant sequence permissions
        GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ventry_app;
        
        -- Grant function execution permissions
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ventry_app;
        
        -- Set default privileges for future objects
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ventry_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ventry_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ventry_app;
        
        RAISE NOTICE 'Configured ventry_app for integration test database';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Integration test database not found, skipping';
END
$$;

-- Summary
\echo ''
\echo 'Application user setup complete!'
\echo ''
\echo 'The ventry_app user has been created with:'
\echo '  - LOGIN privilege with password'
\echo '  - NO superuser privileges'
\echo '  - NO BYPASSRLS (enforces row-level security)'
\echo '  - SELECT, INSERT, UPDATE, DELETE on all tables'
\echo '  - EXECUTE on all functions'
\echo ''
\echo 'Connection strings:'
\echo '  Admin:  postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev'
\echo '  App:    postgresql://ventry_app:ventry_app_password@localhost:5487/ventry_dev'
\echo ''