-- Enable RLS on all tenant-scoped tables
-- This migration enables row-level security and creates simple, consistent policies

-- High Priority Tables (Direct Organization Reference)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Medium Priority Tables (Indirect Organization Reference)
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- Reference Tables (Organization-scoped)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjustment_reasons ENABLE ROW LEVEL SECURITY;

-- Create simple tenant isolation policies
-- Pattern: One policy per table, checking organization_id matches session variable

-- Items
CREATE POLICY tenant_isolation ON items
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Inventory
CREATE POLICY tenant_isolation ON inventory
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Warehouses
CREATE POLICY tenant_isolation ON warehouses
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Locations
CREATE POLICY tenant_isolation ON locations
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Suppliers
CREATE POLICY tenant_isolation ON suppliers
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Customers
CREATE POLICY tenant_isolation ON customers
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Orders
CREATE POLICY tenant_isolation ON orders
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Order Items (via order relationship)
CREATE POLICY tenant_isolation ON order_items
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.organization_id = current_setting('app.current_organization_id')::uuid
    )
  );

-- Purchase Orders
CREATE POLICY tenant_isolation ON purchase_orders
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Purchase Order Items (via purchase_order relationship)
CREATE POLICY tenant_isolation ON purchase_order_items
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE purchase_orders.id = purchase_order_items.purchase_order_id 
      AND purchase_orders.organization_id = current_setting('app.current_organization_id')::uuid
    )
  );

-- Stock Movements
CREATE POLICY tenant_isolation ON stock_movements
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Shipments
CREATE POLICY tenant_isolation ON shipments
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Shipment Items (via shipment relationship)
CREATE POLICY tenant_isolation ON shipment_items
  USING (
    EXISTS (
      SELECT 1 FROM shipments 
      WHERE shipments.id = shipment_items.shipment_id 
      AND shipments.organization_id = current_setting('app.current_organization_id')::uuid
    )
  );

-- Inventory Adjustments
CREATE POLICY tenant_isolation ON inventory_adjustments
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Inventory Transfers
CREATE POLICY tenant_isolation ON inventory_transfers
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Transfer Items (via transfer relationship)
CREATE POLICY tenant_isolation ON transfer_items
  USING (
    EXISTS (
      SELECT 1 FROM inventory_transfers 
      WHERE inventory_transfers.id = transfer_items.transfer_id 
      AND inventory_transfers.organization_id = current_setting('app.current_organization_id')::uuid
    )
  );

-- Stock Alerts
CREATE POLICY tenant_isolation ON stock_alerts
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Purchase Order Receipts
CREATE POLICY tenant_isolation ON purchase_order_receipts
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Receipt Items (via receipt relationship)
CREATE POLICY tenant_isolation ON receipt_items
  USING (
    EXISTS (
      SELECT 1 FROM purchase_order_receipts 
      WHERE purchase_order_receipts.id = receipt_items.receipt_id 
      AND purchase_order_receipts.organization_id = current_setting('app.current_organization_id')::uuid
    )
  );

-- Categories
CREATE POLICY tenant_isolation ON categories
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Units of Measure
CREATE POLICY tenant_isolation ON units_of_measure
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Tax Rates
CREATE POLICY tenant_isolation ON tax_rates
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Payment Terms
CREATE POLICY tenant_isolation ON payment_terms
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Shipping Methods
CREATE POLICY tenant_isolation ON shipping_methods
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Adjustment Reasons
CREATE POLICY tenant_isolation ON adjustment_reasons
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- System tables need special handling
-- Organizations: Users can only see organizations they belong to
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_access ON organizations
  USING (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_members.organization_id = organizations.id 
      AND organization_members.user_id = current_setting('app.current_user_id', true)::uuid
    )
  );

-- Organization Members: Can only see members of your organizations
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_access ON organization_members
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Audit Logs: Organization-scoped
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs
  USING (organization_id = current_setting('app.current_organization_id')::uuid);