# Database Schema Reference

Complete database schema documentation for Ventry, including all tables, relationships, and constraints.

## Overview

Ventry uses PostgreSQL 16+ with the following key features:
- Row-Level Security (RLS) for multi-tenant isolation
- UUID primary keys for all tables
- Comprehensive audit fields
- Optimized indexes for performance
- Check constraints for data integrity

## Core Tables

### organizations

Multi-tenant root entity for all business data.

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY DEFAULT concat('org_', cuid()),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  
  -- Details
  description TEXT,
  website TEXT,
  logo_url TEXT,
  
  -- Settings
  timezone TEXT NOT NULL DEFAULT 'UTC',
  currency TEXT NOT NULL DEFAULT 'USD',
  locale TEXT NOT NULL DEFAULT 'en-US',
  fiscal_year_start INTEGER DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED')),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  
  -- Indexes
  INDEX idx_organizations_slug (slug),
  INDEX idx_organizations_status (status)
);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_isolation ON organizations
  USING (id = current_organization_id());
```

### users

User accounts that can belong to multiple organizations.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT concat('usr_', cuid()),
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash TEXT,
  
  -- Profile
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  
  -- Settings
  timezone TEXT DEFAULT 'UTC',
  locale TEXT DEFAULT 'en-US',
  
  -- Security
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'DELETED')),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_users_email (email),
  INDEX idx_users_status (status)
);
```

### organization_members

Junction table for users belonging to organizations with roles.

```sql
CREATE TABLE organization_members (
  id TEXT PRIMARY KEY DEFAULT concat('om_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role and permissions
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
  permissions TEXT[] DEFAULT '{}',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED')),
  invited_by TEXT REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, user_id),
  
  -- Indexes
  INDEX idx_org_members_org (organization_id),
  INDEX idx_org_members_user (user_id),
  INDEX idx_org_members_role (role),
  INDEX idx_org_members_status (status)
);

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_members_isolation ON organization_members
  USING (organization_id = current_organization_id());
```

## Inventory Tables

### categories

Product categories for organizing items.

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY DEFAULT concat('cat_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  
  -- Hierarchy
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  path TEXT[], -- Materialized path for efficient queries
  level INTEGER NOT NULL DEFAULT 0,
  
  -- Display
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT,
  
  -- Constraints
  UNIQUE(organization_id, slug),
  CHECK (parent_id != id),
  
  -- Indexes
  INDEX idx_categories_org (organization_id),
  INDEX idx_categories_parent (parent_id),
  INDEX idx_categories_path (path),
  INDEX idx_categories_active (is_active)
);
```

### units_of_measure

Units for measuring quantities.

```sql
CREATE TABLE units_of_measure (
  id TEXT PRIMARY KEY DEFAULT concat('uom_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('COUNT', 'WEIGHT', 'LENGTH', 'VOLUME', 'AREA')),
  
  -- Conversion
  base_unit_id TEXT REFERENCES units_of_measure(id),
  conversion_factor DECIMAL(20, 10) DEFAULT 1,
  
  -- Display
  decimal_places INTEGER DEFAULT 2,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, abbreviation),
  
  -- Indexes
  INDEX idx_uom_org (organization_id),
  INDEX idx_uom_type (type)
);
```

### items

Products or materials tracked in inventory.

```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY DEFAULT concat('itm_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identification
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Classification
  category_id TEXT NOT NULL REFERENCES categories(id),
  unit_of_measure_id TEXT NOT NULL REFERENCES units_of_measure(id),
  
  -- Inventory settings
  track_inventory BOOLEAN DEFAULT TRUE,
  track_serial_numbers BOOLEAN DEFAULT FALSE,
  track_batch_numbers BOOLEAN DEFAULT FALSE,
  
  -- Reorder settings
  reorder_point DECIMAL(20, 4),
  reorder_quantity DECIMAL(20, 4),
  lead_time_days INTEGER,
  
  -- Costing
  costing_method TEXT DEFAULT 'AVERAGE' CHECK (costing_method IN ('FIFO', 'LIFO', 'AVERAGE', 'SPECIFIC')),
  standard_cost DECIMAL(20, 4),
  last_purchase_price DECIMAL(20, 4),
  
  -- Physical attributes
  weight DECIMAL(20, 4),
  length DECIMAL(20, 4),
  width DECIMAL(20, 4),
  height DECIMAL(20, 4),
  
  -- Images
  images TEXT[] DEFAULT '{}',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED')),
  
  -- Supplier
  default_supplier_id TEXT REFERENCES suppliers(id),
  manufacturer_part_number TEXT,
  
  -- Custom fields
  custom_fields JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT,
  
  -- Constraints
  UNIQUE(organization_id, sku),
  
  -- Indexes
  INDEX idx_items_org (organization_id),
  INDEX idx_items_sku (sku),
  INDEX idx_items_barcode (barcode),
  INDEX idx_items_category (category_id),
  INDEX idx_items_status (status),
  INDEX idx_items_reorder (organization_id, reorder_point) WHERE track_inventory = TRUE
);

-- Enable RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY items_org_isolation ON items
  USING (organization_id = current_organization_id());
```

### warehouses

Physical or virtual storage locations.

```sql
CREATE TABLE warehouses (
  id TEXT PRIMARY KEY DEFAULT concat('wh_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('WAREHOUSE', 'STORE', 'VIRTUAL', 'TRANSIT')),
  
  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Contact
  phone TEXT,
  email TEXT,
  manager_name TEXT,
  
  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  timezone TEXT,
  
  -- Capacity
  total_capacity DECIMAL(20, 4),
  capacity_unit TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT,
  
  -- Constraints
  UNIQUE(organization_id, code),
  
  -- Indexes
  INDEX idx_warehouses_org (organization_id),
  INDEX idx_warehouses_type (type),
  INDEX idx_warehouses_active (is_active)
);
```

### locations

Specific storage locations within warehouses.

```sql
CREATE TABLE locations (
  id TEXT PRIMARY KEY DEFAULT concat('loc_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BIN', 'RACK', 'SHELF', 'ZONE', 'STAGING')),
  
  -- Hierarchy
  parent_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  path TEXT[], -- Materialized path
  level INTEGER NOT NULL DEFAULT 0,
  
  -- Position
  aisle TEXT,
  rack TEXT,
  shelf TEXT,
  bin TEXT,
  
  -- Capacity
  max_weight DECIMAL(20, 4),
  max_volume DECIMAL(20, 4),
  current_weight DECIMAL(20, 4) DEFAULT 0,
  current_volume DECIMAL(20, 4) DEFAULT 0,
  
  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  allow_mixing BOOLEAN DEFAULT TRUE, -- Multiple items in same location
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(warehouse_id, code),
  CHECK (parent_id != id),
  
  -- Indexes
  INDEX idx_locations_org (organization_id),
  INDEX idx_locations_warehouse (warehouse_id),
  INDEX idx_locations_parent (parent_id),
  INDEX idx_locations_active (is_active)
);
```

### inventory

Current stock levels by location.

```sql
CREATE TABLE inventory (
  id TEXT PRIMARY KEY DEFAULT concat('inv_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  
  -- Quantities
  qty_on_hand DECIMAL(20, 4) NOT NULL DEFAULT 0,
  qty_reserved DECIMAL(20, 4) NOT NULL DEFAULT 0,
  qty_available DECIMAL(20, 4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  
  -- Batch/Serial tracking
  batch_number TEXT,
  serial_number TEXT,
  expiration_date DATE,
  manufacture_date DATE,
  
  -- Costing
  unit_cost DECIMAL(20, 4) NOT NULL DEFAULT 0,
  total_value DECIMAL(20, 4) GENERATED ALWAYS AS (qty_on_hand * unit_cost) STORED,
  
  -- Tracking
  last_count_date TIMESTAMPTZ,
  last_movement_date TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(item_id, location_id, batch_number, serial_number),
  CHECK (qty_on_hand >= 0),
  CHECK (qty_reserved >= 0),
  CHECK (qty_reserved <= qty_on_hand),
  
  -- Indexes
  INDEX idx_inventory_org (organization_id),
  INDEX idx_inventory_item (item_id),
  INDEX idx_inventory_location (location_id),
  INDEX idx_inventory_batch (batch_number),
  INDEX idx_inventory_serial (serial_number),
  INDEX idx_inventory_expiration (expiration_date),
  INDEX idx_inventory_available (qty_available) WHERE qty_available > 0
);

-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_org_isolation ON inventory
  USING (organization_id = current_organization_id());
```

### stock_movements

All inventory transactions.

```sql
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY DEFAULT concat('sm_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Movement type
  type TEXT NOT NULL CHECK (type IN (
    'RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 
    'COUNT', 'RETURN', 'SCRAP', 'PRODUCTION'
  )),
  
  -- Item and locations
  item_id TEXT NOT NULL REFERENCES items(id),
  from_location_id TEXT REFERENCES locations(id),
  to_location_id TEXT REFERENCES locations(id),
  
  -- Quantities and values
  quantity DECIMAL(20, 4) NOT NULL,
  unit_cost DECIMAL(20, 4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(20, 4) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  
  -- Context
  reason TEXT NOT NULL,
  reference_type TEXT CHECK (reference_type IN (
    'ORDER', 'PURCHASE_ORDER', 'TRANSFER', 'ADJUSTMENT', 'PRODUCTION'
  )),
  reference_id TEXT,
  notes TEXT,
  
  -- Tracking
  batch_number TEXT,
  serial_numbers TEXT[],
  expiration_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN (
    'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  )),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  
  -- Constraints
  CHECK (
    (type = 'TRANSFER' AND from_location_id IS NOT NULL AND to_location_id IS NOT NULL) OR
    (type IN ('RECEIPT', 'RETURN', 'PRODUCTION') AND to_location_id IS NOT NULL) OR
    (type IN ('ISSUE', 'SCRAP') AND from_location_id IS NOT NULL) OR
    (type IN ('ADJUSTMENT', 'COUNT') AND (from_location_id IS NOT NULL OR to_location_id IS NOT NULL))
  ),
  
  -- Indexes
  INDEX idx_movements_org (organization_id),
  INDEX idx_movements_item (item_id),
  INDEX idx_movements_from_loc (from_location_id),
  INDEX idx_movements_to_loc (to_location_id),
  INDEX idx_movements_type (type),
  INDEX idx_movements_reference (reference_type, reference_id),
  INDEX idx_movements_created (created_at),
  INDEX idx_movements_batch (batch_number)
);
```

## Order Management Tables

### customers

Customer accounts.

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY DEFAULT concat('cust_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identification
  customer_number TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  
  -- Contact
  email TEXT,
  phone TEXT,
  fax TEXT,
  website TEXT,
  
  -- Addresses
  billing_address JSONB,
  shipping_addresses JSONB[] DEFAULT '{}',
  
  -- Classification
  type TEXT CHECK (type IN ('INDIVIDUAL', 'COMPANY')),
  industry TEXT,
  customer_group_id TEXT,
  
  -- Credit
  credit_limit DECIMAL(20, 2),
  payment_terms TEXT DEFAULT 'NET30',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  
  -- Metrics
  first_order_date DATE,
  last_order_date DATE,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(20, 2) DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT,
  
  -- Constraints
  UNIQUE(organization_id, customer_number),
  
  -- Indexes
  INDEX idx_customers_org (organization_id),
  INDEX idx_customers_number (customer_number),
  INDEX idx_customers_name (name),
  INDEX idx_customers_email (email),
  INDEX idx_customers_status (status)
);
```

### orders

Sales orders.

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY DEFAULT concat('ord_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Order details
  order_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SALES' CHECK (type IN ('SALES', 'RETURN', 'EXCHANGE')),
  
  -- Customer
  customer_id TEXT NOT NULL REFERENCES customers(id),
  customer_po_number TEXT,
  
  -- Dates
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_date DATE,
  promised_date DATE,
  
  -- Addresses
  billing_address JSONB NOT NULL,
  shipping_address JSONB NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 
    'PARTIALLY_FULFILLED', 'FULFILLED', 'COMPLETED', 
    'CANCELLED', 'REFUNDED'
  )),
  
  -- Financials
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal DECIMAL(20, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  
  -- Payment
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN (
    'PENDING', 'PARTIAL', 'PAID', 'REFUNDED', 'VOID'
  )),
  payment_method TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  
  -- Fulfillment
  fulfillment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (fulfillment_status IN (
    'PENDING', 'PARTIAL', 'FULFILLED', 'SHIPPED', 'DELIVERED'
  )),
  warehouse_id TEXT REFERENCES warehouses(id),
  
  -- Source
  source TEXT CHECK (source IN ('WEB', 'POS', 'PHONE', 'EMAIL', 'API', 'IMPORT')),
  channel TEXT,
  
  -- Notes
  internal_notes TEXT,
  customer_notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT,
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  
  -- Constraints
  UNIQUE(organization_id, order_number),
  
  -- Indexes
  INDEX idx_orders_org (organization_id),
  INDEX idx_orders_number (order_number),
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_date (order_date),
  INDEX idx_orders_warehouse (warehouse_id)
);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_org_isolation ON orders
  USING (organization_id = current_organization_id());
```

### order_items

Line items within orders.

```sql
CREATE TABLE order_items (
  id TEXT PRIMARY KEY DEFAULT concat('oi_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Item
  item_id TEXT NOT NULL REFERENCES items(id),
  description TEXT NOT NULL,
  
  -- Quantities
  qty_ordered DECIMAL(20, 4) NOT NULL,
  qty_reserved DECIMAL(20, 4) DEFAULT 0,
  qty_picked DECIMAL(20, 4) DEFAULT 0,
  qty_packed DECIMAL(20, 4) DEFAULT 0,
  qty_shipped DECIMAL(20, 4) DEFAULT 0,
  qty_delivered DECIMAL(20, 4) DEFAULT 0,
  qty_returned DECIMAL(20, 4) DEFAULT 0,
  
  -- Pricing
  unit_price DECIMAL(20, 4) NOT NULL,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(20, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(20, 2) DEFAULT 0,
  line_total DECIMAL(20, 2) NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'RESERVED', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'
  )),
  
  -- Fulfillment
  location_id TEXT REFERENCES locations(id),
  lot_numbers TEXT[],
  serial_numbers TEXT[],
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_order_items_org (organization_id),
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_item (item_id),
  INDEX idx_order_items_status (status)
);
```

### suppliers

Supplier/vendor accounts.

```sql
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY DEFAULT concat('supp_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identification
  supplier_code TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  
  -- Contact
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  
  -- Addresses
  address JSONB,
  
  -- Classification
  type TEXT CHECK (type IN ('MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'OTHER')),
  categories TEXT[],
  
  -- Terms
  payment_terms TEXT DEFAULT 'NET30',
  currency TEXT DEFAULT 'USD',
  minimum_order_value DECIMAL(20, 2),
  
  -- Performance
  lead_time_days INTEGER,
  on_time_delivery_rate DECIMAL(5, 2),
  quality_rating DECIMAL(3, 2),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  
  -- Metrics
  first_order_date DATE,
  last_order_date DATE,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(20, 2) DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT,
  
  -- Constraints
  UNIQUE(organization_id, supplier_code),
  
  -- Indexes
  INDEX idx_suppliers_org (organization_id),
  INDEX idx_suppliers_code (supplier_code),
  INDEX idx_suppliers_name (name),
  INDEX idx_suppliers_status (status)
);
```

### purchase_orders

Purchase orders to suppliers.

```sql
CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY DEFAULT concat('po_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Order details
  po_number TEXT NOT NULL,
  revision INTEGER DEFAULT 0,
  
  -- Supplier
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  supplier_reference TEXT,
  
  -- Dates
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_date DATE,
  
  -- Delivery
  ship_to_warehouse_id TEXT REFERENCES warehouses(id),
  shipping_method TEXT,
  shipping_terms TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 
    'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 
    'COMPLETED', 'CANCELLED'
  )),
  
  -- Financials
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal DECIMAL(20, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  other_charges DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  
  -- Terms
  payment_terms TEXT,
  
  -- Approval
  approval_status TEXT CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Notes
  internal_notes TEXT,
  supplier_notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_by TEXT,
  sent_at TIMESTAMPTZ,
  sent_by TEXT,
  
  -- Constraints
  UNIQUE(organization_id, po_number),
  
  -- Indexes
  INDEX idx_purchase_orders_org (organization_id),
  INDEX idx_purchase_orders_number (po_number),
  INDEX idx_purchase_orders_supplier (supplier_id),
  INDEX idx_purchase_orders_status (status),
  INDEX idx_purchase_orders_date (order_date),
  INDEX idx_purchase_orders_warehouse (ship_to_warehouse_id)
);
```

## Audit and System Tables

### audit_logs

Comprehensive audit trail for all actions.

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY DEFAULT concat('aud_', cuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Actor
  user_id TEXT NOT NULL REFERENCES users(id),
  user_email TEXT NOT NULL,
  
  -- Action
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  session_id TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_audit_logs_org (organization_id),
  INDEX idx_audit_logs_user (user_id),
  INDEX idx_audit_logs_entity (entity_type, entity_id),
  INDEX idx_audit_logs_action (action),
  INDEX idx_audit_logs_created (created_at)
);

-- Partitioning by month for performance
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### settings

Organization and user settings.

```sql
CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT concat('set_', cuid()),
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  
  -- Scope
  scope TEXT NOT NULL CHECK (scope IN ('SYSTEM', 'ORGANIZATION', 'USER')),
  category TEXT NOT NULL,
  
  -- Setting
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  
  -- Metadata
  description TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  
  -- Constraints
  UNIQUE(organization_id, user_id, category, key),
  CHECK (
    (scope = 'SYSTEM' AND organization_id IS NULL AND user_id IS NULL) OR
    (scope = 'ORGANIZATION' AND organization_id IS NOT NULL AND user_id IS NULL) OR
    (scope = 'USER' AND user_id IS NOT NULL)
  ),
  
  -- Indexes
  INDEX idx_settings_org (organization_id),
  INDEX idx_settings_user (user_id),
  INDEX idx_settings_scope (scope),
  INDEX idx_settings_category (category),
  INDEX idx_settings_key (key)
);
```

## Functions and Triggers

### Updated Timestamp Trigger

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ... (apply to all tables)
```

### RLS Helper Functions

```sql
-- Get current user ID from session
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- Get current organization ID from session
CREATE OR REPLACE FUNCTION current_organization_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_organization_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- Set RLS context
CREATE OR REPLACE FUNCTION set_rls_context(p_user_id TEXT, p_organization_id TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', p_user_id, true);
  PERFORM set_config('app.current_organization_id', p_organization_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear RLS context
CREATE OR REPLACE FUNCTION clear_rls_context()
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', '', true);
  PERFORM set_config('app.current_organization_id', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Inventory Update Functions

```sql
-- Update inventory quantities after stock movement
CREATE OR REPLACE FUNCTION update_inventory_from_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle different movement types
  CASE NEW.type
    WHEN 'RECEIPT', 'RETURN', 'PRODUCTION' THEN
      -- Increase inventory at destination
      INSERT INTO inventory (
        organization_id, item_id, location_id, 
        qty_on_hand, unit_cost, batch_number, serial_number
      ) VALUES (
        NEW.organization_id, NEW.item_id, NEW.to_location_id,
        NEW.quantity, NEW.unit_cost, NEW.batch_number, NEW.serial_numbers[1]
      )
      ON CONFLICT (item_id, location_id, batch_number, serial_number)
      DO UPDATE SET
        qty_on_hand = inventory.qty_on_hand + NEW.quantity,
        unit_cost = (
          (inventory.qty_on_hand * inventory.unit_cost) + 
          (NEW.quantity * NEW.unit_cost)
        ) / (inventory.qty_on_hand + NEW.quantity),
        last_movement_date = NOW();
        
    WHEN 'ISSUE', 'SCRAP' THEN
      -- Decrease inventory at source
      UPDATE inventory SET
        qty_on_hand = qty_on_hand - NEW.quantity,
        last_movement_date = NOW()
      WHERE item_id = NEW.item_id 
        AND location_id = NEW.from_location_id
        AND qty_on_hand >= NEW.quantity;
        
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient inventory for item % at location %', 
          NEW.item_id, NEW.from_location_id;
      END IF;
      
    WHEN 'TRANSFER' THEN
      -- Decrease at source
      UPDATE inventory SET
        qty_on_hand = qty_on_hand - NEW.quantity,
        last_movement_date = NOW()
      WHERE item_id = NEW.item_id 
        AND location_id = NEW.from_location_id
        AND qty_on_hand >= NEW.quantity;
        
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient inventory for transfer';
      END IF;
      
      -- Increase at destination
      INSERT INTO inventory (
        organization_id, item_id, location_id, 
        qty_on_hand, unit_cost, batch_number, serial_number
      )
      SELECT 
        NEW.organization_id, NEW.item_id, NEW.to_location_id,
        NEW.quantity, unit_cost, batch_number, serial_number
      FROM inventory
      WHERE item_id = NEW.item_id AND location_id = NEW.from_location_id
      LIMIT 1
      ON CONFLICT (item_id, location_id, batch_number, serial_number)
      DO UPDATE SET
        qty_on_hand = inventory.qty_on_hand + NEW.quantity,
        last_movement_date = NOW();
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movement_inventory_update
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  WHEN (NEW.status = 'COMPLETED')
  EXECUTE FUNCTION update_inventory_from_movement();
```

## Indexes

### Performance Indexes

```sql
-- Composite indexes for common queries
CREATE INDEX idx_inventory_item_location ON inventory(item_id, location_id);
CREATE INDEX idx_movements_item_date ON stock_movements(item_id, created_at);
CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date);
CREATE INDEX idx_order_items_order_status ON order_items(order_id, status);

-- Partial indexes for filtered queries
CREATE INDEX idx_active_items ON items(organization_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_pending_orders ON orders(organization_id) WHERE status IN ('PENDING', 'CONFIRMED');
CREATE INDEX idx_low_stock ON inventory(item_id) WHERE qty_available < 10;

-- Full-text search indexes
CREATE INDEX idx_items_search ON items USING gin(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);
CREATE INDEX idx_customers_search ON customers USING gin(
  to_tsvector('english', name || ' ' || COALESCE(email, ''))
);
```

## Data Types and Constraints

### Custom Types

```sql
-- Address type
CREATE TYPE address AS (
  line1 TEXT,
  line2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT
);

-- Money type with currency
CREATE TYPE money_amount AS (
  amount DECIMAL(20, 4),
  currency TEXT
);
```

### Check Constraints

```sql
-- Ensure positive quantities
ALTER TABLE inventory ADD CONSTRAINT positive_qty 
  CHECK (qty_on_hand >= 0 AND qty_reserved >= 0);

-- Ensure valid email format
ALTER TABLE users ADD CONSTRAINT valid_email 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure future dates for expected delivery
ALTER TABLE purchase_orders ADD CONSTRAINT future_expected_date 
  CHECK (expected_date IS NULL OR expected_date >= order_date::date);
```

## Migration Guidelines

### Adding New Tables

1. Always include organization_id for multi-tenant tables
2. Add RLS policies immediately after table creation
3. Include audit fields (created_at, updated_at, created_by)
4. Create appropriate indexes for foreign keys and common queries
5. Add update trigger for updated_at timestamp

### Modifying Existing Tables

1. Use ALTER TABLE for schema changes
2. Always perform changes in a transaction
3. Update RLS policies if needed
4. Rebuild indexes if column types change
5. Test migrations on a copy of production data

### Data Migration Example

```sql
-- Example: Adding a new required field with data migration
BEGIN;

-- Add column as nullable first
ALTER TABLE items ADD COLUMN item_type TEXT;

-- Populate with default values
UPDATE items SET item_type = 'STANDARD' WHERE item_type IS NULL;

-- Now make it required
ALTER TABLE items ALTER COLUMN item_type SET NOT NULL;

-- Add check constraint
ALTER TABLE items ADD CONSTRAINT valid_item_type 
  CHECK (item_type IN ('STANDARD', 'SERVICE', 'BUNDLE'));

COMMIT;
```