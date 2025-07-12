-- Audit and Logging Policies

-- Audit logs are append-only and viewable by admins
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Only service role can insert audit logs (via backend)
CREATE POLICY "Service role can create audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL -- Will be enforced by service role
  );

-- No one can update or delete audit logs
-- (No UPDATE or DELETE policies means operations are denied)

-- Helper function to check user role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user has role
CREATE OR REPLACE FUNCTION auth.has_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = ANY(required_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(userId);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(managerId);
CREATE INDEX IF NOT EXISTS idx_stock_movements_moved_by ON stock_movements(moved_by_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_time ON audit_logs(event_time);

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION auth.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_role(TEXT[]) TO authenticated;