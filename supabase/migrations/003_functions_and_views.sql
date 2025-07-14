-- Function to calculate available stock
CREATE OR REPLACE FUNCTION calculate_available_stock(p_item_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT 
    SUM(qty_on_hand - qty_reserved) 
  INTO v_total
  FROM inventory
  WHERE item_id = p_item_id
    AND organization_id = auth.organization_id();
    
  RETURN COALESCE(v_total, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to adjust stock
CREATE OR REPLACE FUNCTION adjust_stock(
  p_item_id UUID,
  p_location_id UUID,
  p_qty_change INTEGER,
  p_reason TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_qty INTEGER;
  v_new_qty INTEGER;
  v_org_id UUID;
BEGIN
  -- Get organization ID
  SELECT organization_id INTO v_org_id
  FROM items WHERE id = p_item_id;
  
  -- Get current quantity
  SELECT qty_on_hand INTO v_current_qty
  FROM inventory
  WHERE item_id = p_item_id 
    AND location_id = p_location_id
    AND lot_id IS NULL
    AND serial_id IS NULL;
    
  -- Calculate new quantity
  v_new_qty := COALESCE(v_current_qty, 0) + p_qty_change;
  
  -- Prevent negative inventory
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested change: %', v_current_qty, p_qty_change;
  END IF;
  
  -- Update or insert inventory record
  INSERT INTO inventory (
    item_id, location_id, qty_on_hand, organization_id
  ) VALUES (
    p_item_id, p_location_id, v_new_qty, v_org_id
  )
  ON CONFLICT (item_id, lot_id, serial_id, location_id)
  DO UPDATE SET
    qty_on_hand = EXCLUDED.qty_on_hand,
    updated_at = NOW();
    
  -- Record stock movement
  INSERT INTO stock_movements (
    item_id, 
    from_location_id,
    to_location_id,
    qty,
    movement_type,
    moved_by_id,
    notes,
    organization_id
  ) VALUES (
    p_item_id,
    CASE WHEN p_qty_change < 0 THEN p_location_id ELSE NULL END,
    CASE WHEN p_qty_change > 0 THEN p_location_id ELSE NULL END,
    ABS(p_qty_change),
    'ADJUSTMENT',
    p_user_id,
    p_reason,
    v_org_id
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to transfer stock between locations
CREATE OR REPLACE FUNCTION transfer_stock(
  p_item_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_qty INTEGER,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_from_qty INTEGER;
  v_org_id UUID;
BEGIN
  -- Get organization ID
  SELECT organization_id INTO v_org_id
  FROM items WHERE id = p_item_id;
  
  -- Check source stock
  SELECT qty_on_hand INTO v_from_qty
  FROM inventory
  WHERE item_id = p_item_id 
    AND location_id = p_from_location_id
    AND lot_id IS NULL
    AND serial_id IS NULL;
    
  IF COALESCE(v_from_qty, 0) < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock at source. Available: %, Requested: %', v_from_qty, p_qty;
  END IF;
  
  -- Reduce source location
  UPDATE inventory
  SET qty_on_hand = qty_on_hand - p_qty
  WHERE item_id = p_item_id 
    AND location_id = p_from_location_id
    AND lot_id IS NULL
    AND serial_id IS NULL;
    
  -- Increase destination location
  INSERT INTO inventory (
    item_id, location_id, qty_on_hand, organization_id
  ) VALUES (
    p_item_id, p_to_location_id, p_qty, v_org_id
  )
  ON CONFLICT (item_id, lot_id, serial_id, location_id)
  DO UPDATE SET
    qty_on_hand = inventory.qty_on_hand + EXCLUDED.qty_on_hand,
    updated_at = NOW();
    
  -- Record movement
  INSERT INTO stock_movements (
    item_id,
    from_location_id,
    to_location_id,
    qty,
    movement_type,
    moved_by_id,
    notes,
    organization_id
  ) VALUES (
    p_item_id,
    p_from_location_id,
    p_to_location_id,
    p_qty,
    'TRANSFER',
    p_user_id,
    p_notes,
    v_org_id
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for inventory summary
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
  i.id as item_id,
  i.name as item_name,
  i.sku,
  COALESCE(SUM(inv.qty_on_hand), 0) as total_on_hand,
  COALESCE(SUM(inv.qty_reserved), 0) as total_reserved,
  COALESCE(SUM(inv.qty_on_hand - inv.qty_reserved), 0) as total_available,
  COUNT(DISTINCT inv.location_id) as location_count,
  i.reorder_point,
  i.reorder_qty,
  i.organization_id,
  CASE 
    WHEN COALESCE(SUM(inv.qty_on_hand - inv.qty_reserved), 0) <= i.reorder_point 
    THEN true 
    ELSE false 
  END as needs_reorder
FROM items i
LEFT JOIN inventory inv ON i.id = inv.item_id
GROUP BY i.id, i.name, i.sku, i.reorder_point, i.reorder_qty, i.organization_id;

-- View for low stock items
CREATE OR REPLACE VIEW low_stock_items AS
SELECT * FROM inventory_summary
WHERE needs_reorder = true
ORDER BY total_available ASC;

-- View for stock valuation
CREATE OR REPLACE VIEW stock_valuation AS
SELECT 
  i.id as item_id,
  i.name as item_name,
  i.sku,
  c.name as category_name,
  COALESCE(SUM(inv.qty_on_hand), 0) as total_qty,
  i.default_cost,
  COALESCE(SUM(inv.qty_on_hand * i.default_cost), 0) as total_value,
  i.organization_id
FROM items i
JOIN item_categories c ON i.category_id = c.id
LEFT JOIN inventory inv ON i.id = inv.item_id
WHERE i.default_cost IS NOT NULL
GROUP BY i.id, i.name, i.sku, c.name, i.default_cost, i.organization_id;

-- Grant permissions on views
GRANT SELECT ON inventory_summary TO authenticated;
GRANT SELECT ON low_stock_items TO authenticated;
GRANT SELECT ON stock_valuation TO authenticated;