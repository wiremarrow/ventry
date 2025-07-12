-- Authentication and User Management Policies

-- Users table policies
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from changing their own role
    role = (SELECT role FROM users WHERE id = auth.uid())
  );

-- Admins can update any user
CREATE POLICY "Admins can update any user" ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Admins can create users
CREATE POLICY "Admins can create users" ON users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Employee policies
-- Users can view their own employee record
CREATE POLICY "Users can view own employee record" ON employees
  FOR SELECT
  USING (userId = auth.uid());

-- Managers can view their subordinates
CREATE POLICY "Managers can view subordinates" ON employees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e1
      JOIN employees e2 ON e1.id = e2.managerId
      WHERE e1.userId = auth.uid() AND e2.id = employees.id
    )
  );

-- HR and Admins can view all employees
CREATE POLICY "HR can view all employees" ON employees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Notifications policies
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (userId = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (userId = auth.uid())
  WITH CHECK (userId = auth.uid());

-- System can create notifications for any user
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT
  WITH CHECK (true); -- Will be restricted by service role key