-- Performance indexes for multi-tenant queries
-- These indexes are critical for query performance in a multi-tenant system

-- Organization Members - for auth lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_members_user_id 
ON organization_members(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_members_org_user 
ON organization_members(organization_id, user_id);

-- Items - Core entity indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_organization_id 
ON items(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_org_sku 
ON items(organization_id, sku);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_org_active 
ON items(organization_id, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_category 
ON items(category_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_supplier 
ON items(default_supplier_id);

-- Inventory - Critical for stock queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_organization_id 
ON inventory(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_item_id 
ON inventory(item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_warehouse_id 
ON inventory(warehouse_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_location_id 
ON inventory(location_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_org_item_warehouse 
ON inventory(organization_id, item_id, warehouse_id);

-- Orders - For order management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_organization_id 
ON orders(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_id 
ON orders(customer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_status 
ON orders(organization_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_org_created 
ON orders(organization_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_number 
ON orders(order_number);

-- Order Items - For order details
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id 
ON order_items(order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_item_id 
ON order_items(item_id);

-- Purchase Orders - For procurement
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_organization_id 
ON purchase_orders(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_supplier_id 
ON purchase_orders(supplier_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_org_status 
ON purchase_orders(organization_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_po_number 
ON purchase_orders(po_number);

-- Purchase Order Items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_order_items_po_id 
ON purchase_order_items(purchase_order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_order_items_item_id 
ON purchase_order_items(item_id);

-- Stock Movements - For tracking history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_organization_id 
ON stock_movements(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_item_id 
ON stock_movements(item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_warehouse_id 
ON stock_movements(warehouse_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_org_created 
ON stock_movements(organization_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_reference 
ON stock_movements(reference_type, reference_id);

-- Shipments - For fulfillment
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_organization_id 
ON shipments(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_order_id 
ON shipments(order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_tracking 
ON shipments(tracking_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shipments_org_status 
ON shipments(organization_id, status);

-- Receipts - For receiving
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_organization_id 
ON receipts(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_po_id 
ON receipts(purchase_order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_org_created 
ON receipts(organization_id, created_at DESC);

-- Suppliers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_organization_id 
ON suppliers(organization_id);

-- Customers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_organization_id 
ON customers(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email 
ON customers(email);

-- Warehouses
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouses_organization_id 
ON warehouses(organization_id);

-- Locations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_warehouse_id 
ON locations(warehouse_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_parent_id 
ON locations(parent_location_id);

-- Audit Logs - For compliance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_organization_id 
ON audit_logs(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id 
ON audit_logs(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_org_created 
ON audit_logs(organization_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity 
ON audit_logs(entity_type, entity_id);

-- Notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read 
ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- Text search indexes for common searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_name_gin 
ON items USING gin(to_tsvector('english', name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_gin 
ON customers USING gin(to_tsvector('english', name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_name_gin 
ON suppliers USING gin(to_tsvector('english', name));