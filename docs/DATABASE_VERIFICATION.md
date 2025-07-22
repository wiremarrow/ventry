# Database Verification Guide

## Overview

The database verification tool (`pnpm db:verify`) provides a unified interface for inspecting database state, validating data integrity, and testing Row-Level Security (RLS) policies. It respects the dual-user security model and provides flexible querying capabilities.

**Key Features:**
- Count, show, and aggregate data across all tables
- Field-to-field comparisons within tables (e.g., `qtyOnHand <= qtyReserved`)
- RLS policy testing with user simulation
- Multiple output formats (table, JSON, CSV, count)
- Organization-based filtering
- SQL query visibility with `--verbose`

## Quick Start

```bash
# Show help
pnpm db:verify --help

# Count all records in all tables
pnpm db:verify count all

# Show first 5 items
pnpm db:verify show items --limit 5

# Check low stock inventory
pnpm db:verify show inventory --where "qtyOnHand <= 10"
```

## Security Model

The tool works with two database users:

### Admin User (Default)
- Uses `DATABASE_ADMIN_URL` 
- Bypasses all RLS policies
- Sees all data across all organizations
- Use for: debugging, verification after seeding

```bash
# Default behavior uses admin user
pnpm db:verify count items
```

### App User
- Uses `DATABASE_URL`
- Respects RLS policies
- Requires authentication context to see data
- Use for: testing RLS policies, simulating user access

```bash
# Use app user with authentication
pnpm db:verify count items --user app --auth admin@ventry.com
```

## Commands

### count
Count records in a table.

```bash
# Count all items
pnpm db:verify count items

# Count with condition
pnpm db:verify count inventory --where "qtyOnHand <= reorderPoint"

# Count all tables
pnpm db:verify count all

# Output just the number
pnpm db:verify count items --format count
```

### show
Display records from a table.

```bash
# Show first 10 items (default)
pnpm db:verify show items

# Show specific fields
pnpm db:verify show items --select "sku,name,price"

# Show with conditions
pnpm db:verify show orders --where "status = 'PENDING'" --limit 20

# Show with sorting
pnpm db:verify show items --order-by price --order desc

# Export to CSV
pnpm db:verify show customers --format csv > customers.csv

# Include related data
pnpm db:verify show inventory --select "item.sku,item.name,qtyOnHand"
```

### stats
Calculate statistics on a table.

```bash
# Sum inventory by warehouse
pnpm db:verify stats inventory --group-by warehouseId --sum qtyOnHand

# Average order value by status
pnpm db:verify stats orders --group-by status --avg total --count id

# Multiple aggregations
pnpm db:verify stats items --group-by categoryId --min price --max price --avg price
```

### access
Test what a specific user can access.

```bash
# Test employee access
pnpm db:verify access items --as employee@ventry.com

# Test manager access to orders
pnpm db:verify access orders --as manager@ventry.com
```

### compare
Compare access between multiple users.

```bash
# Compare item visibility
pnpm db:verify compare items --users "admin@ventry.com,employee@ventry.com"

# Compare order access
pnpm db:verify compare orders --users "admin@ventry.com,manager@ventry.com,employee@ventry.com"
```

### tables
List all available tables.

```bash
pnpm db:verify tables
```

## Use Cases

### 1. Post-Seed Verification

After running seed scripts, verify the data was created correctly:

```bash
# Quick verification
pnpm db:verify count all

# Detailed verification
pnpm db:verify show items --limit 5
pnpm db:verify show inventory --where "qtyOnHand > 0" --format count
pnpm db:verify stats orders --group-by status --count id

# Check relationships are properly set up
pnpm db:verify count orderItem  # Should have order items
pnpm db:verify count inventory --where "itemId IS NOT NULL"  # All inventory linked to items
pnpm db:verify count purchaseOrder --where "supplierId IS NOT NULL"  # All POs have suppliers
```

### 2. Debugging Data Issues

Find specific records or patterns:

```bash
# Find items without inventory
pnpm db:verify show items --where "id NOT IN (SELECT itemId FROM inventory)"

# Check for orphaned records
pnpm db:verify show orderItems --where "orderId NOT IN (SELECT id FROM orders)"

# Find duplicate SKUs
pnpm db:verify stats items --group-by sku --count id --having "COUNT(id) > 1"
```

### 3. RLS Policy Testing

Test Row-Level Security policies:

```bash
# Test different user roles
pnpm db:verify compare items --users "admin@ventry.com,manager@ventry.com,employee@ventry.com"

# Verify organization isolation
pnpm db:verify count customers --user app --auth alice@techstart.com
pnpm db:verify count customers --user app --auth charlie@globalretail.com
```

### 4. Field-to-Field Comparisons

The tool supports comparing fields both within the same table and across related tables:

#### Same Table Comparisons
```bash
# Find inventory where on-hand quantity is less than reserved
pnpm db:verify count inventory --where "qtyOnHand <= qtyReserved"
pnpm db:verify show inventory --where "qtyOnHand < qtyReserved" --limit 10

# Find items where actual differs from expected
# pnpm db:verify show cycleCountItems --where "actualQty != expectedQty"

# Compare numeric fields
pnpm db:verify count items --where "defaultPrice > defaultCost"
```

#### Cross-Table Comparisons (NEW)
```bash
# Find low stock items (inventory below reorder point)
pnpm db:verify count inventory --where "qtyOnHand <= item.reorderPoint"
pnpm db:verify show inventory --where "qtyOnHand <= item.reorderPoint" --limit 10

# You can also use explicit table names on both sides
pnpm db:verify count inventory --where "inventory.qtyOnHand <= item.reorderPoint"

# Use with stats for analysis
pnpm db:verify stats inventory --where "qtyOnHand <= item.reorderPoint" --sum qtyOnHand --count id
```

**Note**: Cross-table comparisons work when there's a direct relationship between the tables (foreign key). The tool automatically generates the appropriate JOIN clause.

### 5. Inventory Analysis

```bash
# Low stock items (using cross-table comparison)
pnpm db:verify count inventory --where "qtyOnHand <= item.reorderPoint"
pnpm db:verify show inventory \
  --where "qtyOnHand <= item.reorderPoint" \
  --select "item.sku,item.name,qtyOnHand,item.reorderPoint" \
  --limit 20

# Total quantity for low stock items
pnpm db:verify stats inventory \
  --where "qtyOnHand <= item.reorderPoint" \
  --sum qtyOnHand \
  --count id

# Warehouse distribution
pnpm db:verify stats inventory \
  --group-by locationId \
  --sum qtyOnHand \
  --count id

# Items by category
pnpm db:verify stats item \
  --group-by categoryId \
  --count id
```

## Output Formats

### table (default)
Human-readable table format:
```
sku       | name           | price
----------|----------------|-------
LAPTOP001 | Dell Laptop    | 999.99
MOUSE001  | Wireless Mouse | 29.99

Total: 2 records
```

### json
Machine-readable JSON:
```json
[
  {
    "sku": "LAPTOP001",
    "name": "Dell Laptop",
    "price": 999.99
  },
  {
    "sku": "MOUSE001",
    "name": "Wireless Mouse",
    "price": 29.99
  }
]
```

### csv
Excel-compatible CSV:
```csv
sku,name,price
LAPTOP001,Dell Laptop,999.99
MOUSE001,Wireless Mouse,29.99
```

### count
Just the number:
```
42
```

## Advanced Options

### Global Options
- `--user <admin|app>` - Database user context (default: admin)
- `--auth <email>` - Simulate authenticated user (requires --user app)
- `--format <table|json|csv|count>` - Output format (default: table)
- `--org <slug>` - Filter by organization slug
- `--verbose` - Show SQL queries being executed

### WHERE Clause Syntax

Currently supports simple conditions:
- Equality: `field = 'value'`
- Numeric comparison: `field > 10`, `field <= 100`
- Multiple conditions: Use multiple commands or raw SQL

Complex queries planned for future releases.

## Scripting Examples

### Check if seeding worked
```bash
#!/bin/bash
COUNT=$(pnpm db:verify count items --format count)
if [ "$COUNT" -eq "0" ]; then
  echo "Error: No items found after seeding"
  exit 1
fi
echo "Success: Found $COUNT items"
```

### Daily inventory snapshot
```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
pnpm db:verify show inventory \
  --select "item.sku,location.code,qtyOnHand" \
  --format csv > "inventory-snapshot-$DATE.csv"
```

### RLS compliance check
```bash
#!/bin/bash
USERS="admin@ventry.com,alice@techstart.com,charlie@globalretail.com"
pnpm db:verify compare customers --users "$USERS"
```

## Troubleshooting

### "Table 'foo' not found"
Use `pnpm db:verify tables` to see available table names.

### "Field 'bar' not found"
Check available fields with `pnpm db:verify show <table> --limit 1`

### No data visible with --user app
App user requires authentication context. Use `--auth <email>` to simulate a logged-in user.

### Complex WHERE clauses
Currently limited to simple conditions. For complex queries, use multiple commands or export data for external analysis.

## Security Notes

1. **Admin access** bypasses all security - use carefully in production
2. **App access** respects RLS - good for testing actual user experience
3. **Auth simulation** sets PostgreSQL session variables - not actual authentication
4. **Organization filtering** only works with proper auth context

## Common Business Queries

### Inventory Management

```bash
# Low stock analysis (using cross-table comparison)
pnpm db:verify count inventory --where "qtyOnHand <= item.reorderPoint"
pnpm db:verify show inventory --where "qtyOnHand <= item.reorderPoint" \
  --select "item.sku,item.name,item.category.name,qtyOnHand,item.reorderPoint" \
  --order-by qtyOnHand --limit 20

# Over-reserved inventory (potential issues)
pnpm db:verify show inventory --where "qtyReserved > qtyOnHand" \
  --select "item.sku,qtyOnHand,qtyReserved,location.code"

# Dead stock (items not moving)
pnpm db:verify show inventory --where "lastCountedAt < NOW() - INTERVAL '90 days'" \
  --select "item.sku,qtyOnHand,lastCountedAt"

# Inventory value by warehouse
pnpm db:verify stats inventory --group-by locationId \
  --sum qtyOnHand --count id

# Items with no inventory records
pnpm db:verify count item --where "id NOT IN (SELECT itemId FROM inventory)"
```

### Order Management

```bash
# Order status distribution
pnpm db:verify stats order --group-by status --count id --sum grandTotal

# High-value pending orders
pnpm db:verify show order --where "status = 'PENDING' AND grandTotal > 5000" \
  --select "orderNumber,customer.companyName,grandTotal,orderDate" \
  --order-by grandTotal --order desc

# Orders awaiting shipment
pnpm db:verify count order --where "status = 'APPROVED' AND id NOT IN (SELECT orderId FROM shipment)"

# Average order value by customer
pnpm db:verify stats order --group-by customerId --avg grandTotal --count id

# Unfulfilled order items
pnpm db:verify show orderItem --where "qtyOrdered > qtyShipped" \
  --select "order.orderNumber,item.sku,qtyOrdered,qtyShipped"
```

### Supplier Performance

```bash
# Overdue purchase orders
pnpm db:verify show purchaseOrder \
  --where "status = 'ORDERED' AND expectedDate < NOW()" \
  --select "poNumber,supplier.name,expectedDate,grandTotal"

# Supplier order volume
pnpm db:verify stats purchaseOrder --group-by supplierId \
  --count id --sum grandTotal

# Items by supplier
pnpm db:verify stats item --group-by defaultSupplierId --count id

# Purchase order fulfillment rate
pnpm db:verify stats purchaseOrderItem \
  --where "qtyReceived > 0" \
  --sum qtyReceived --sum qtyOrdered
```

### Customer Analytics

```bash
# Top customers by revenue
pnpm db:verify stats order --group-by customerId \
  --sum grandTotal --count id \
  --having "SUM(grandTotal) > 10000"

# Customers with recent returns
pnpm db:verify show return --where "returnDate > NOW() - INTERVAL '30 days'" \
  --select "customer.companyName,returnNumber,refundAmount,reason"

# Customer order frequency
pnpm db:verify stats order --group-by customerId \
  --count id --min orderDate --max orderDate

# Inactive customers
pnpm db:verify show customer \
  --where "id NOT IN (SELECT customerId FROM order WHERE orderDate > NOW() - INTERVAL '180 days')" \
  --select "customerCode,companyName,email"
```

### Financial Analysis

```bash
# Profit margin analysis
pnpm db:verify show item --where "defaultPrice > defaultCost" \
  --select "sku,name,defaultCost,defaultPrice,(defaultPrice - defaultCost) AS margin" \
  --order-by margin --order desc

# Pending payments
pnpm db:verify stats payment --where "status = 'PENDING'" \
  --sum amount --count id

# Daily sales totals
pnpm db:verify stats order --where "orderDate >= NOW() - INTERVAL '7 days'" \
  --group-by "DATE(orderDate)" --sum grandTotal --count id

# Unpaid invoices
pnpm db:verify show order \
  --where "status != 'CANCELLED' AND grandTotal > (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE orderId = order.id)" \
  --select "orderNumber,customer.companyName,grandTotal"
```

### Warehouse Operations

```bash
# Upcoming shipments
pnpm db:verify show shipment \
  --where "status = 'PENDING' AND shipDate <= NOW() + INTERVAL '3 days'" \
  --select "shipmentNumber,order.orderNumber,carrier.name,shipDate"

# Location utilization
pnpm db:verify stats inventory --group-by locationId \
  --sum qtyOnHand --count "DISTINCT itemId"

# Cycle count accuracy
pnpm db:verify show cycleCountItem --where "variance != 0" \
  --select "cycleCount.countNumber,item.sku,expectedQty,actualQty,variance" \
  --order-by "ABS(variance)" --order desc

# Stock movements by type
pnpm db:verify stats stockMovement --group-by movementType \
  --count id --sum qty

# Returns by condition
pnpm db:verify stats returnItem --group-by condition \
  --count id --sum refundAmount
```

### Data Quality Checks

```bash
# Items missing required fields
pnpm db:verify count item --where "reorderPoint IS NULL OR reorderQty IS NULL"

# Customers without addresses
pnpm db:verify count customer --where "id NOT IN (SELECT customerId FROM address)"

# Orders without items
pnpm db:verify count order --where "id NOT IN (SELECT orderId FROM orderItem)"

# Duplicate SKUs
pnpm db:verify stats item --group-by sku --count id --having "COUNT(id) > 1"

# Invalid inventory quantities
pnpm db:verify count inventory --where "qtyOnHand < 0 OR qtyReserved < 0"
```

## Advanced Patterns

### Multi-Table Analysis

```bash
# Inventory value by category (3-table join)
pnpm db:verify show inventory --where "qtyOnHand > 0" \
  --select "item.category.name,item.sku,qtyOnHand,item.defaultCost" \
  --format json | jq 'group_by(.category_name)'

# Order fulfillment by warehouse
pnpm db:verify show orderItem \
  --select "order.orderNumber,item.sku,shipmentItem.shipment.shippedFromLocation.warehouse.name" \
  --where "shipmentItem.qtyShipped > 0"

# Supplier performance by category
pnpm db:verify stats purchaseOrderItem \
  --select "purchaseOrder.supplier.name,item.category.name" \
  --group-by "supplierId,categoryId" \
  --sum qtyReceived --avg "qtyReceived/qtyOrdered"
```

### Time-Based Analysis

```bash
# Monthly sales trend
pnpm db:verify stats order \
  --where "orderDate >= NOW() - INTERVAL '12 months'" \
  --group-by "DATE_TRUNC('month', orderDate)" \
  --sum grandTotal --count id

# Aging inventory
pnpm db:verify show inventory \
  --where "lastCountedAt < NOW() - INTERVAL '180 days'" \
  --select "item.sku,qtyOnHand,lastCountedAt,EXTRACT(days FROM NOW() - lastCountedAt) AS days_old"

# Purchase order lead times
pnpm db:verify show purchaseOrder \
  --where "status = 'RECEIVED'" \
  --select "poNumber,supplier.name,EXTRACT(days FROM receivedDate - orderDate) AS lead_days"
```

## Future Enhancements

- Complex WHERE clause parser with AND/OR support
- Multi-hop JOIN support for deeper relationships
- Raw SQL mode for advanced queries
- Performance analysis commands
- Data validation rules
- Export to Excel format
- Scheduled verification reports
- Query history and saved queries
- Interactive mode with autocomplete
- Data anomaly detection