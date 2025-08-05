-- Sales and Order Management Policies

-- Customers policies
-- Sales and management can view all customers
CREATE POLICY "Sales can view customers" ON customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SALES')
    )
  );

-- Sales can create and update customers
CREATE POLICY "Sales can create customers" ON customers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SALES')
    )
  );

CREATE POLICY "Sales can update customers" ON customers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SALES')
    )
  );

-- Orders policies
-- Sales can view all orders
CREATE POLICY "Sales can view orders" ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE')
    )
  );

-- Sales can create orders
CREATE POLICY "Sales can create orders" ON orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SALES')
    ) AND
    created_by_id = auth.uid()
  );

-- Sales can update their own orders or managers can update any
CREATE POLICY "Sales can update orders" ON orders
  FOR UPDATE
  USING (
    created_by_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Order items policies follow order policies
CREATE POLICY "Users can view order items" ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN users u ON u.id = auth.uid()
      WHERE o.id = order_items.order_id
      AND (o.created_by_id = u.id OR u.role IN ('ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE'))
    )
  );

CREATE POLICY "Sales can manage order items" ON order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN users u ON u.id = auth.uid()
      WHERE o.id = order_items.order_id
      AND (o.created_by_id = u.id OR u.role IN ('ADMIN', 'MANAGER'))
    )
  );

-- Shipments policies
-- Warehouse staff can manage shipments
CREATE POLICY "Warehouse can view shipments" ON shipments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'WAREHOUSE', 'SALES')
    )
  );

CREATE POLICY "Warehouse can create shipments" ON shipments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
    ) AND
    shipped_by_id = auth.uid()
  );

CREATE POLICY "Warehouse can update shipments" ON shipments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
    )
  );

-- POS transactions policies
-- Sales staff can create POS transactions
CREATE POLICY "Sales can create POS transactions" ON pos_transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SALES')
    ) AND
    employee_id = auth.uid()
  );

-- Users can view their own POS transactions
CREATE POLICY "Users can view own POS transactions" ON pos_transactions
  FOR SELECT
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
  );