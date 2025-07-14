-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    (SELECT organization_id FROM users WHERE id = auth.uid())
  )::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    (SELECT role FROM users WHERE id = auth.uid())
  )::user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations policies
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = auth.organization_id());

CREATE POLICY "Only admins can update organizations"
  ON organizations FOR UPDATE
  USING (id = auth.organization_id() AND auth.user_role() = 'ADMIN');

-- Users policies
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (organization_id = auth.organization_id());

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can update any user in their organization"
  ON users FOR UPDATE
  USING (organization_id = auth.organization_id() AND auth.user_role() = 'ADMIN');

CREATE POLICY "Admins can create users in their organization"
  ON users FOR INSERT
  WITH CHECK (organization_id = auth.organization_id() AND auth.user_role() = 'ADMIN');

-- Item categories policies
CREATE POLICY "Users can view categories in their organization"
  ON item_categories FOR SELECT
  USING (organization_id = auth.organization_id());

CREATE POLICY "Managers can create categories"
  ON item_categories FOR INSERT
  WITH CHECK (
    organization_id = auth.organization_id() 
    AND auth.user_role() IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Managers can update categories"
  ON item_categories FOR UPDATE
  USING (
    organization_id = auth.organization_id() 
    AND auth.user_role() IN ('ADMIN', 'MANAGER')
  );

-- Items policies
CREATE POLICY "Users can view items in their organization"
  ON items FOR SELECT
  USING (organization_id = auth.organization_id());

CREATE POLICY "Managers can create items"
  ON items FOR INSERT
  WITH CHECK (
    organization_id = auth.organization_id() 
    AND auth.user_role() IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Managers can update items"
  ON items FOR UPDATE
  USING (
    organization_id = auth.organization_id() 
    AND auth.user_role() IN ('ADMIN', 'MANAGER')
  );

-- Inventory policies
CREATE POLICY "Users can view inventory in their organization"
  ON inventory FOR SELECT
  USING (organization_id = auth.organization_id());

CREATE POLICY "Warehouse users can update inventory"
  ON inventory FOR UPDATE
  USING (
    organization_id = auth.organization_id() 
    AND auth.user_role() IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
  );

CREATE POLICY "Warehouse users can create inventory records"
  ON inventory FOR INSERT
  WITH CHECK (
    organization_id = auth.organization_id() 
    AND auth.user_role() IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
  );

-- Stock movements policies
CREATE POLICY "Users can view stock movements in their organization"
  ON stock_movements FOR SELECT
  USING (organization_id = auth.organization_id());

CREATE POLICY "Warehouse users can create stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (
    organization_id = auth.organization_id() 
    AND auth.user_role() IN ('ADMIN', 'MANAGER', 'WAREHOUSE')
    AND moved_by_id = auth.uid()
  );

-- Warehouses policies
CREATE POLICY "Users can view warehouses in their organization"
  ON warehouses FOR SELECT
  USING (organization_id = auth.organization_id());

CREATE POLICY "Admins can manage warehouses"
  ON warehouses FOR ALL
  USING (
    organization_id = auth.organization_id() 
    AND auth.user_role() = 'ADMIN'
  );

-- Locations policies
CREATE POLICY "Users can view locations in their organization"
  ON locations FOR SELECT
  USING (organization_id = auth.organization_id());

CREATE POLICY "Managers can manage locations"
  ON locations FOR ALL
  USING (
    organization_id = auth.organization_id() 
    AND auth.user_role() IN ('ADMIN', 'MANAGER')
  );

-- Suppliers policies
CREATE POLICY "Users can view suppliers in their organization"
  ON suppliers FOR SELECT
  USING (organization_id = auth.organization_id());

CREATE POLICY "Managers can manage suppliers"
  ON suppliers FOR ALL
  USING (
    organization_id = auth.organization_id() 
    AND auth.user_role() IN ('ADMIN', 'MANAGER')
  );

-- Units of measure policies
CREATE POLICY "Anyone can view units of measure"
  ON units_of_measure FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage units of measure"
  ON units_of_measure FOR ALL
  USING (auth.user_role() = 'ADMIN');