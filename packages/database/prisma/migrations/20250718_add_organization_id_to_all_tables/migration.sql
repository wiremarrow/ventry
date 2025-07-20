-- Add organization_id to all business tables for RLS
-- This migration denormalizes organization_id to enable simple, performant RLS policies

-- Step 1: Add organization_id columns to tables that need it

-- Inventory table
ALTER TABLE inventory ADD COLUMN organization_id TEXT;

-- Locations table
ALTER TABLE locations ADD COLUMN organization_id TEXT;

-- Stock movements table
ALTER TABLE stock_movements ADD COLUMN organization_id TEXT;

-- Stock adjustments table
ALTER TABLE stock_adjustments ADD COLUMN organization_id TEXT;

-- Order items table
ALTER TABLE order_items ADD COLUMN organization_id TEXT;

-- Purchase order items table
ALTER TABLE purchase_order_items ADD COLUMN organization_id TEXT;

-- Receipts table
ALTER TABLE receipts ADD COLUMN organization_id TEXT;

-- Receipt items table
ALTER TABLE receipt_items ADD COLUMN organization_id TEXT;

-- Payments table
ALTER TABLE payments ADD COLUMN organization_id TEXT;

-- Addresses table
ALTER TABLE addresses ADD COLUMN organization_id TEXT;

-- Lots table
ALTER TABLE lots ADD COLUMN organization_id TEXT;

-- Serial numbers table
ALTER TABLE serial_numbers ADD COLUMN organization_id TEXT;

-- Item images table
ALTER TABLE item_images ADD COLUMN organization_id TEXT;

-- Price history table
ALTER TABLE price_history ADD COLUMN organization_id TEXT;

-- Cycle counts table
ALTER TABLE cycle_counts ADD COLUMN organization_id TEXT;

-- Cycle count items table
ALTER TABLE cycle_count_items ADD COLUMN organization_id TEXT;

-- Shipment items table
ALTER TABLE shipment_items ADD COLUMN organization_id TEXT;

-- Return items table
ALTER TABLE return_items ADD COLUMN organization_id TEXT;

-- Supplier contacts table
ALTER TABLE supplier_contacts ADD COLUMN organization_id TEXT;

-- POS transaction items table
ALTER TABLE pos_transaction_items ADD COLUMN organization_id TEXT;

-- Step 2: Populate organization_id from parent relationships

-- Inventory gets org from item
UPDATE inventory i
SET organization_id = items.organization_id
FROM items
WHERE items.id = i.item_id;

-- Locations get org from warehouse
UPDATE locations l
SET organization_id = w.organization_id
FROM warehouses w
WHERE w.id = l.warehouse_id;

-- Stock movements get org from item
UPDATE stock_movements sm
SET organization_id = i.organization_id
FROM items i
WHERE i.id = sm.item_id;

-- Stock adjustments get org from item
UPDATE stock_adjustments sa
SET organization_id = i.organization_id
FROM items i
WHERE i.id = sa.item_id;

-- Order items get org from order
UPDATE order_items oi
SET organization_id = o.organization_id
FROM orders o
WHERE o.id = oi.order_id;

-- Purchase order items get org from purchase order
UPDATE purchase_order_items poi
SET organization_id = po.organization_id
FROM purchase_orders po
WHERE po.id = poi.po_id;

-- Receipts get org from purchase order
UPDATE receipts r
SET organization_id = po.organization_id
FROM purchase_orders po
WHERE po.id = r.po_id;

-- Receipt items get org from receipt (after receipt is populated)
UPDATE receipt_items ri
SET organization_id = r.organization_id
FROM receipts r
WHERE r.id = ri.receipt_id;

-- Payments get org from order
UPDATE payments p
SET organization_id = o.organization_id
FROM orders o
WHERE o.id = p.order_id;

-- Addresses get org from customer or supplier
UPDATE addresses a
SET organization_id = COALESCE(c.organization_id, s.organization_id)
FROM addresses a2
LEFT JOIN customers c ON c.id = a2.customer_id
LEFT JOIN suppliers s ON s.id = a2.supplier_id
WHERE a2.id = a.id;

-- Lots get org from item
UPDATE lots l
SET organization_id = i.organization_id
FROM items i
WHERE i.id = l.item_id;

-- Serial numbers get org from item
UPDATE serial_numbers sn
SET organization_id = i.organization_id
FROM items i
WHERE i.id = sn.item_id;

-- Item images get org from item
UPDATE item_images ii
SET organization_id = i.organization_id
FROM items i
WHERE i.id = ii.item_id;

-- Price history get org from item
UPDATE price_history ph
SET organization_id = i.organization_id
FROM items i
WHERE i.id = ph.item_id;

-- Cycle counts get org from location (after locations are populated)
UPDATE cycle_counts cc
SET organization_id = l.organization_id
FROM locations l
WHERE l.id = cc.location_id;

-- Cycle count items get org from cycle count (after cycle count is populated)
UPDATE cycle_count_items cci
SET organization_id = cc.organization_id
FROM cycle_counts cc
WHERE cc.id = cci.count_id;

-- Shipment items get org from shipment
UPDATE shipment_items si
SET organization_id = s.organization_id
FROM shipments s
WHERE s.id = si.shipment_id;

-- Return items get org from return
UPDATE return_items ri
SET organization_id = r.organization_id
FROM returns r
WHERE r.id = ri.return_id;

-- Supplier contacts get org from supplier
UPDATE supplier_contacts sc
SET organization_id = s.organization_id
FROM suppliers s
WHERE s.id = sc.supplier_id;

-- POS transaction items get org from POS transaction
UPDATE pos_transaction_items pti
SET organization_id = pt.organization_id
FROM pos_transactions pt
WHERE pt.id = pti.pos_tx_id;

-- Step 3: Add NOT NULL constraints (now that all data is populated)
ALTER TABLE inventory ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE locations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE stock_adjustments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE purchase_order_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE receipts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE receipt_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE addresses ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE lots ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE serial_numbers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE item_images ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE price_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE cycle_counts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE cycle_count_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE shipment_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE return_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE supplier_contacts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE pos_transaction_items ALTER COLUMN organization_id SET NOT NULL;

-- Step 4: Add foreign key constraints
ALTER TABLE inventory ADD CONSTRAINT fk_inventory_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE locations ADD CONSTRAINT fk_locations_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE stock_adjustments ADD CONSTRAINT fk_stock_adjustments_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE purchase_order_items ADD CONSTRAINT fk_purchase_order_items_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE receipts ADD CONSTRAINT fk_receipts_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE receipt_items ADD CONSTRAINT fk_receipt_items_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE addresses ADD CONSTRAINT fk_addresses_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE lots ADD CONSTRAINT fk_lots_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE serial_numbers ADD CONSTRAINT fk_serial_numbers_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE item_images ADD CONSTRAINT fk_item_images_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE price_history ADD CONSTRAINT fk_price_history_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE cycle_counts ADD CONSTRAINT fk_cycle_counts_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE cycle_count_items ADD CONSTRAINT fk_cycle_count_items_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE shipment_items ADD CONSTRAINT fk_shipment_items_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE return_items ADD CONSTRAINT fk_return_items_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE supplier_contacts ADD CONSTRAINT fk_supplier_contacts_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE pos_transaction_items ADD CONSTRAINT fk_pos_transaction_items_organization 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Step 5: Create indexes for performance
CREATE INDEX idx_inventory_organization_id ON inventory(organization_id);
CREATE INDEX idx_locations_organization_id ON locations(organization_id);
CREATE INDEX idx_stock_movements_organization_id ON stock_movements(organization_id);
CREATE INDEX idx_stock_adjustments_organization_id ON stock_adjustments(organization_id);
CREATE INDEX idx_order_items_organization_id ON order_items(organization_id);
CREATE INDEX idx_purchase_order_items_organization_id ON purchase_order_items(organization_id);
CREATE INDEX idx_receipts_organization_id ON receipts(organization_id);
CREATE INDEX idx_receipt_items_organization_id ON receipt_items(organization_id);
CREATE INDEX idx_payments_organization_id ON payments(organization_id);
CREATE INDEX idx_addresses_organization_id ON addresses(organization_id);
CREATE INDEX idx_lots_organization_id ON lots(organization_id);
CREATE INDEX idx_serial_numbers_organization_id ON serial_numbers(organization_id);
CREATE INDEX idx_item_images_organization_id ON item_images(organization_id);
CREATE INDEX idx_price_history_organization_id ON price_history(organization_id);
CREATE INDEX idx_cycle_counts_organization_id ON cycle_counts(organization_id);
CREATE INDEX idx_cycle_count_items_organization_id ON cycle_count_items(organization_id);
CREATE INDEX idx_shipment_items_organization_id ON shipment_items(organization_id);
CREATE INDEX idx_return_items_organization_id ON return_items(organization_id);
CREATE INDEX idx_supplier_contacts_organization_id ON supplier_contacts(organization_id);
CREATE INDEX idx_pos_transaction_items_organization_id ON pos_transaction_items(organization_id);