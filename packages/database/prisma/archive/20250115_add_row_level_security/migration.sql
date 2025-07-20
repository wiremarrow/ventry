-- Enable RLS (Row Level Security) on all tables with organizationId
-- This ensures multi-tenant data isolation at the database level

-- =====================================================
-- STEP 1: Create helper functions for RLS
-- =====================================================

-- Function to safely get current organization ID with fallback
CREATE OR REPLACE FUNCTION current_organization_id() 
RETURNS UUID AS $$
BEGIN
  -- Try to get the organization ID from the current setting
  -- Return NULL if not set (allows queries to fail safely)
  RETURN NULLIF(current_setting('app.current_organization_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely get current user ID with fallback
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS UUID AS $$
BEGIN
  -- Try to get the user ID from the current setting
  -- Return NULL if not set (allows queries to fail safely)
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is member of organization
CREATE OR REPLACE FUNCTION is_organization_member(org_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE organization_id = org_id 
    AND user_id = current_user_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 2: Enable RLS on tables with direct organizationId
-- =====================================================

-- Organizations table (special handling - users see their own orgs)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_organizations" ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = current_user_id()
    )
  );

CREATE POLICY "users_manage_owned_organizations" ON organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = current_user_id()
      AND organization_members.role IN ('OWNER', 'ADMIN')
    )
  );

-- Items table
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON items
  FOR ALL
  USING (organization_id = current_organization_id());

-- Item Categories table
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON item_categories
  FOR ALL
  USING (organization_id = current_organization_id());

-- Units of Measure table
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON units_of_measure
  FOR ALL
  USING (organization_id = current_organization_id());

-- Warehouses table
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON warehouses
  FOR ALL
  USING (organization_id = current_organization_id());

-- Suppliers table
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON suppliers
  FOR ALL
  USING (organization_id = current_organization_id());

-- Customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON customers
  FOR ALL
  USING (organization_id = current_organization_id());

-- Orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON orders
  FOR ALL
  USING (organization_id = current_organization_id());

-- Purchase Orders table
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON purchase_orders
  FOR ALL
  USING (organization_id = current_organization_id());

-- Shipments table
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON shipments
  FOR ALL
  USING (organization_id = current_organization_id());

-- Returns table
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON returns
  FOR ALL
  USING (organization_id = current_organization_id());

-- Carriers table
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON carriers
  FOR ALL
  USING (organization_id = current_organization_id());

-- Shipping Methods table
ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON shipping_methods
  FOR ALL
  USING (organization_id = current_organization_id());

-- Payment Methods table
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON payment_methods
  FOR ALL
  USING (organization_id = current_organization_id());

-- Discounts table
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON discounts
  FOR ALL
  USING (organization_id = current_organization_id());

-- POS Transactions table
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON pos_transactions
  FOR ALL
  USING (organization_id = current_organization_id());

-- =====================================================
-- STEP 3: Enable RLS on tables with indirect organizationId
-- =====================================================

-- Locations table (via warehouse)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_warehouse" ON locations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouses 
      WHERE warehouses.id = locations.warehouse_id 
      AND warehouses.organization_id = current_organization_id()
    )
  );

-- Inventory table (via item)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_item" ON inventory
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = inventory.item_id 
      AND items.organization_id = current_organization_id()
    )
  );

-- Stock Movements table (via item)
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_item" ON stock_movements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = stock_movements.item_id 
      AND items.organization_id = current_organization_id()
    )
  );

-- Stock Adjustments table (via item)
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_item" ON stock_adjustments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = stock_adjustments.item_id 
      AND items.organization_id = current_organization_id()
    )
  );

-- Lots table (via item)
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_item" ON lots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = lots.item_id 
      AND items.organization_id = current_organization_id()
    )
  );

-- Serial Numbers table (via item)
ALTER TABLE serial_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_item" ON serial_numbers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = serial_numbers.item_id 
      AND items.organization_id = current_organization_id()
    )
  );

-- Order Items table (via order)
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_order" ON order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.organization_id = current_organization_id()
    )
  );

-- Purchase Order Items table (via purchase order)
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_purchase_order" ON purchase_order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE purchase_orders.id = purchase_order_items.purchase_order_id 
      AND purchase_orders.organization_id = current_organization_id()
    )
  );

-- Shipment Items table (via shipment)
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_shipment" ON shipment_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shipments 
      WHERE shipments.id = shipment_items.shipment_id 
      AND shipments.organization_id = current_organization_id()
    )
  );

-- Return Items table (via return)
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_return" ON return_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM returns 
      WHERE returns.id = return_items.return_id 
      AND returns.organization_id = current_organization_id()
    )
  );

-- Receipt Items table (via purchase order)
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_receipt" ON receipt_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN purchase_orders po ON po.id = r.purchase_order_id
      WHERE r.id = receipt_items.receipt_id 
      AND po.organization_id = current_organization_id()
    )
  );

-- POS Transaction Items table (via pos transaction)
ALTER TABLE pos_transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_pos_transaction" ON pos_transaction_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pos_transactions 
      WHERE pos_transactions.id = pos_transaction_items.pos_transaction_id 
      AND pos_transactions.organization_id = current_organization_id()
    )
  );

-- Cycle Counts table (via location -> warehouse)
ALTER TABLE cycle_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_location" ON cycle_counts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM locations l
      JOIN warehouses w ON w.id = l.warehouse_id
      WHERE l.id = cycle_counts.location_id 
      AND w.organization_id = current_organization_id()
    )
  );

-- Cycle Count Items table (via cycle count -> location -> warehouse)
ALTER TABLE cycle_count_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_cycle_count" ON cycle_count_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cycle_counts cc
      JOIN locations l ON l.id = cc.location_id
      JOIN warehouses w ON w.id = l.warehouse_id
      WHERE cc.id = cycle_count_items.cycle_count_id 
      AND w.organization_id = current_organization_id()
    )
  );

-- Price History table (via item)
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_item" ON price_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = price_history.item_id 
      AND items.organization_id = current_organization_id()
    )
  );

-- Item Images table (via item)
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_item" ON item_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM items 
      WHERE items.id = item_images.item_id 
      AND items.organization_id = current_organization_id()
    )
  );

-- Receipts table (via purchase order)
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_purchase_order" ON receipts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE purchase_orders.id = receipts.purchase_order_id 
      AND purchase_orders.organization_id = current_organization_id()
    )
  );

-- Payments table (via order)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_via_order" ON payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = payments.order_id 
      AND orders.organization_id = current_organization_id()
    )
  );

-- =====================================================
-- STEP 4: Special handling for user-related tables
-- =====================================================

-- Organization Members table (users see memberships they're part of)
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_memberships" ON organization_members
  FOR SELECT
  USING (
    user_id = current_user_id() 
    OR organization_id = current_organization_id()
  );

CREATE POLICY "admins_manage_memberships" ON organization_members
  FOR ALL
  USING (
    organization_id = current_organization_id()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = current_user_id()
      AND om.role IN ('OWNER', 'ADMIN')
    )
  );

-- Audit Logs table (organization-scoped)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON audit_logs
  FOR ALL
  USING (organization_id = current_organization_id());

-- Notifications table (user-scoped)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_notifications" ON notifications
  FOR ALL
  USING (user_id = current_user_id());

-- =====================================================
-- STEP 5: Create indexes for RLS performance
-- =====================================================

-- These indexes help PostgreSQL efficiently evaluate RLS policies

-- For join-based policies
CREATE INDEX IF NOT EXISTS idx_warehouses_org_id ON warehouses(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_warehouse_id ON locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_id ON inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_items_org_id ON items(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_id ON orders(organization_id);

-- For organization member checks
CREATE INDEX IF NOT EXISTS idx_org_members_user_org ON organization_members(user_id, organization_id);

-- =====================================================
-- STEP 6: Grant necessary permissions
-- =====================================================

-- Grant USAGE on the helper functions to the application role
-- Replace 'ventry_app' with your actual application database user
GRANT EXECUTE ON FUNCTION current_organization_id() TO ventry_app;
GRANT EXECUTE ON FUNCTION current_user_id() TO ventry_app;
GRANT EXECUTE ON FUNCTION is_organization_member(UUID) TO ventry_app;

-- =====================================================
-- ROLLBACK COMMANDS (Keep for reference)
-- =====================================================
-- To disable RLS on all tables, run:
-- ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE items DISABLE ROW LEVEL SECURITY;
-- ... etc for all tables

-- To drop all policies:
-- DROP POLICY IF EXISTS "tenant_isolation_policy" ON items;
-- ... etc for all policies

-- To drop helper functions:
-- DROP FUNCTION IF EXISTS current_organization_id();
-- DROP FUNCTION IF EXISTS current_user_id();
-- DROP FUNCTION IF EXISTS is_organization_member(UUID);