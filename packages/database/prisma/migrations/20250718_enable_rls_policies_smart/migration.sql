-- Enable Row Level Security on remaining business tables and create missing policies

-- First, ensure we have the helper functions (these already exist from previous migration)
-- Using IF NOT EXISTS pattern via DO block
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_organization_id') THEN
    CREATE FUNCTION current_organization_id() 
    RETURNS TEXT AS $func$
    BEGIN
      RETURN current_setting('app.current_organization_id', true);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_id') THEN
    CREATE FUNCTION current_user_id() 
    RETURNS TEXT AS $func$
    BEGIN
      RETURN current_setting('app.current_user_id', true);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END
$$;

-- Enable RLS only on tables that don't have it yet
-- (items, warehouses, customers, orders, suppliers, purchase_orders, item_categories, units_of_measure already have RLS)

-- Tables that still need RLS enabled:
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transaction_items ENABLE ROW LEVEL SECURITY;

-- Create policies only for tables that don't have them yet
-- Using DO blocks to check existence before creating

-- Shipments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipments' AND policyname = 'shipments_org_isolation') THEN
    CREATE POLICY shipments_org_isolation ON shipments
      FOR ALL
      USING (organization_id = current_organization_id());
  END IF;
END $$;

-- Returns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'returns' AND policyname = 'returns_org_isolation') THEN
    CREATE POLICY returns_org_isolation ON returns
      FOR ALL
      USING (organization_id = current_organization_id());
  END IF;
END $$;

-- POS transactions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pos_transactions' AND policyname = 'pos_transactions_org_isolation') THEN
    CREATE POLICY pos_transactions_org_isolation ON pos_transactions
      FOR ALL
      USING (organization_id = current_organization_id());
  END IF;
END $$;

-- Inventory
CREATE POLICY inventory_org_isolation ON inventory
  FOR ALL
  USING (organization_id = current_organization_id());

-- Locations
CREATE POLICY locations_org_isolation ON locations
  FOR ALL
  USING (organization_id = current_organization_id());

-- Stock movements
CREATE POLICY stock_movements_org_isolation ON stock_movements
  FOR ALL
  USING (organization_id = current_organization_id());

-- Stock adjustments
CREATE POLICY stock_adjustments_org_isolation ON stock_adjustments
  FOR ALL
  USING (organization_id = current_organization_id());

-- Order items
CREATE POLICY order_items_org_isolation ON order_items
  FOR ALL
  USING (organization_id = current_organization_id());

-- Purchase order items
CREATE POLICY purchase_order_items_org_isolation ON purchase_order_items
  FOR ALL
  USING (organization_id = current_organization_id());

-- Receipts
CREATE POLICY receipts_org_isolation ON receipts
  FOR ALL
  USING (organization_id = current_organization_id());

-- Receipt items
CREATE POLICY receipt_items_org_isolation ON receipt_items
  FOR ALL
  USING (organization_id = current_organization_id());

-- Payments
CREATE POLICY payments_org_isolation ON payments
  FOR ALL
  USING (organization_id = current_organization_id());

-- Addresses
CREATE POLICY addresses_org_isolation ON addresses
  FOR ALL
  USING (organization_id = current_organization_id());

-- Lots
CREATE POLICY lots_org_isolation ON lots
  FOR ALL
  USING (organization_id = current_organization_id());

-- Serial numbers
CREATE POLICY serial_numbers_org_isolation ON serial_numbers
  FOR ALL
  USING (organization_id = current_organization_id());

-- Item images
CREATE POLICY item_images_org_isolation ON item_images
  FOR ALL
  USING (organization_id = current_organization_id());

-- Price history
CREATE POLICY price_history_org_isolation ON price_history
  FOR ALL
  USING (organization_id = current_organization_id());

-- Cycle counts
CREATE POLICY cycle_counts_org_isolation ON cycle_counts
  FOR ALL
  USING (organization_id = current_organization_id());

-- Cycle count items
CREATE POLICY cycle_count_items_org_isolation ON cycle_count_items
  FOR ALL
  USING (organization_id = current_organization_id());

-- Shipment items
CREATE POLICY shipment_items_org_isolation ON shipment_items
  FOR ALL
  USING (organization_id = current_organization_id());

-- Return items
CREATE POLICY return_items_org_isolation ON return_items
  FOR ALL
  USING (organization_id = current_organization_id());

-- Supplier contacts
CREATE POLICY supplier_contacts_org_isolation ON supplier_contacts
  FOR ALL
  USING (organization_id = current_organization_id());

-- POS transaction items
CREATE POLICY pos_transaction_items_org_isolation ON pos_transaction_items
  FOR ALL
  USING (organization_id = current_organization_id());