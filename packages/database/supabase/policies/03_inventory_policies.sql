-- Inventory Management Policies

-- Items policies
-- All authenticated users can view active items
CREATE POLICY "Users can view active items" ON items
  FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- Managers and above can view all items
CREATE POLICY "Managers can view all items" ON items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
    )
  );

-- Managers can create and update items
CREATE POLICY "Managers can create items" ON items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Managers can update items" ON items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Inventory policies
-- All authenticated users can view inventory levels
CREATE POLICY "Users can view inventory" ON inventory
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Warehouse staff can update inventory
CREATE POLICY "Warehouse can update inventory" ON inventory
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
    )
  );

-- Stock movements policies
-- All authenticated users can view stock movements
CREATE POLICY "Users can view stock movements" ON stock_movements
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Warehouse staff can create stock movements
CREATE POLICY "Warehouse can create stock movements" ON stock_movements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
    ) AND
    moved_by_id = auth.uid()
  );

-- Stock adjustments policies
-- Only managers can create stock adjustments
CREATE POLICY "Managers can create stock adjustments" ON stock_adjustments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    ) AND
    adjusted_by_id = auth.uid()
  );

-- Warehouse and Location policies
-- All authenticated users can view warehouses and locations
CREATE POLICY "Users can view warehouses" ON warehouses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view locations" ON locations
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can manage warehouses and locations
CREATE POLICY "Admins can manage warehouses" ON warehouses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can manage locations" ON locations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Cycle counts policies
-- Warehouse staff can create and update cycle counts
CREATE POLICY "Warehouse can manage cycle counts" ON cycle_counts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
    )
  );

CREATE POLICY "Warehouse can manage cycle count items" ON cycle_count_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cycle_counts cc
      JOIN users u ON u.id = auth.uid()
      WHERE cc.id = cycle_count_items.count_id
      AND u.role IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
    )
  );