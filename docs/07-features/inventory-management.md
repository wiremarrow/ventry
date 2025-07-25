# Inventory Management

Comprehensive guide to Ventry's inventory management features, including stock tracking, movements, and optimization.

## Overview

Ventry's inventory management system provides real-time visibility into stock levels across multiple locations, automated tracking of movements, and intelligent insights to optimize inventory levels.

### Key Features

- **Real-time Stock Tracking**: Live inventory levels across all locations
- **Multi-location Support**: Track inventory across warehouses, stores, and virtual locations
- **Movement History**: Complete audit trail of all stock movements
- **Automated Reordering**: Smart reorder points and automated purchase orders
- **Batch/Serial Tracking**: Track items by batch numbers or serial numbers
- **Inventory Valuation**: Multiple costing methods (FIFO, LIFO, Average)

## Core Concepts

### Items

Items are the products or materials you track in inventory.

```typescript
interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: Category;
  unitOfMeasure: UnitOfMeasure;

  // Inventory settings
  trackInventory: boolean;
  trackSerialNumbers: boolean;
  trackBatchNumbers: boolean;

  // Reorder settings
  reorderPoint?: number;
  reorderQuantity?: number;
  leadTimeDays?: number;

  // Costing
  costingMethod: 'FIFO' | 'LIFO' | 'AVERAGE';
  standardCost?: number;

  // Dimensions
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}
```

### Inventory Records

Inventory records track stock levels at specific locations.

```typescript
interface Inventory {
  id: string;
  itemId: string;
  locationId: string;

  // Quantities
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number; // onHand - reserved

  // Batch/Serial tracking
  batchNumber?: string;
  serialNumber?: string;
  expirationDate?: Date;

  // Valuation
  unitCost: number;
  totalValue: number;

  lastCountDate?: Date;
  lastMovementDate?: Date;
}
```

### Stock Movements

All inventory changes are tracked as movements.

```typescript
interface StockMovement {
  id: string;
  type: MovementType;

  // References
  itemId: string;
  fromLocationId?: string;
  toLocationId?: string;

  // Quantities
  quantity: number;
  unitCost: number;

  // Context
  reason: string;
  reference?: string; // Order ID, PO ID, etc.
  notes?: string;

  // Tracking
  batchNumber?: string;
  serialNumbers?: string[];

  // Audit
  createdBy: string;
  createdAt: Date;
}

enum MovementType {
  RECEIPT = 'RECEIPT',
  ISSUE = 'ISSUE',
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT',
  COUNT = 'COUNT',
  RETURN = 'RETURN',
  SCRAP = 'SCRAP',
}
```

## Inventory Operations

### 1. Receiving Stock

```typescript
// POST /api/inventory/receive
const receiveStock = async (receipt: StockReceipt) => {
  const movement = await trpc.inventory.receive.mutate({
    itemId: receipt.itemId,
    locationId: receipt.locationId,
    quantity: receipt.quantity,
    unitCost: receipt.unitCost,
    reference: receipt.purchaseOrderId,
    batchNumber: receipt.batchNumber,
    expirationDate: receipt.expirationDate,
  });

  return movement;
};

// Example receipt
await receiveStock({
  itemId: 'itm_123',
  locationId: 'loc_warehouse_a',
  quantity: 100,
  unitCost: 25.5,
  purchaseOrderId: 'po_456',
  batchNumber: 'BATCH-2024-001',
  expirationDate: '2025-12-31',
});
```

### 2. Issuing Stock

```typescript
// POST /api/inventory/issue
const issueStock = async (issue: StockIssue) => {
  // Check availability
  const availability = await trpc.inventory.checkAvailability.query({
    itemId: issue.itemId,
    locationId: issue.locationId,
    quantity: issue.quantity,
  });

  if (!availability.available) {
    throw new Error(`Insufficient stock: ${availability.message}`);
  }

  // Issue stock
  const movement = await trpc.inventory.issue.mutate({
    itemId: issue.itemId,
    locationId: issue.locationId,
    quantity: issue.quantity,
    reference: issue.orderId,
    serialNumbers: issue.serialNumbers,
  });

  return movement;
};
```

### 3. Transferring Stock

```typescript
// POST /api/inventory/transfer
const transferStock = async (transfer: StockTransfer) => {
  const movement = await trpc.inventory.transfer.mutate({
    itemId: transfer.itemId,
    fromLocationId: transfer.fromLocationId,
    toLocationId: transfer.toLocationId,
    quantity: transfer.quantity,
    reason: 'Inter-warehouse transfer',
  });

  return movement;
};

// Bulk transfer
const bulkTransfer = async (transfers: StockTransfer[]) => {
  const movements = await trpc.inventory.bulkTransfer.mutate({
    transfers,
    reference: 'TRANSFER-BATCH-001',
  });

  return movements;
};
```

### 4. Stock Adjustments

```typescript
// POST /api/inventory/adjust
const adjustStock = async (adjustment: StockAdjustment) => {
  const movement = await trpc.inventory.adjust.mutate({
    itemId: adjustment.itemId,
    locationId: adjustment.locationId,
    quantity: adjustment.quantity, // Can be negative
    reason: adjustment.reason,
    notes: adjustment.notes,
  });

  return movement;
};

// Common adjustment reasons
enum AdjustmentReason {
  CYCLE_COUNT = 'Cycle count variance',
  DAMAGED = 'Damaged goods',
  EXPIRED = 'Expired items',
  THEFT = 'Theft/Loss',
  FOUND = 'Found inventory',
  OTHER = 'Other adjustment',
}
```

### 5. Cycle Counting

```typescript
// POST /api/inventory/count
const performCycleCount = async (count: CycleCount) => {
  const result = await trpc.inventory.cycleCount.mutate({
    locationId: count.locationId,
    counts: count.items.map((item) => ({
      itemId: item.itemId,
      countedQuantity: item.quantity,
      batchNumber: item.batchNumber,
    })),
  });

  // Returns variances and creates adjustments
  return result;
};

// Schedule cycle counts
const scheduleCycleCounts = async () => {
  const schedule = await trpc.inventory.generateCountSchedule.query({
    method: 'ABC', // ABC analysis
    frequency: {
      A: 'WEEKLY',
      B: 'MONTHLY',
      C: 'QUARTERLY',
    },
  });

  return schedule;
};
```

## Inventory Tracking

### 1. Real-time Stock Levels

```typescript
// GET /api/inventory/levels
const getStockLevels = async (filters: StockFilters) => {
  const levels = await trpc.inventory.getLevels.query({
    itemIds: filters.itemIds,
    locationIds: filters.locationIds,
    includeReserved: true,
    includeBatches: filters.trackBatches,
  });

  return levels;
};

// Real-time dashboard data
const getDashboardMetrics = async () => {
  const metrics = await trpc.inventory.getDashboardMetrics.query();

  return {
    totalValue: metrics.totalValue,
    totalItems: metrics.totalItems,
    lowStockAlerts: metrics.lowStockAlerts,
    outOfStock: metrics.outOfStock,
    expiringItems: metrics.expiringItems,
  };
};
```

### 2. Movement History

```typescript
// GET /api/inventory/movements
const getMovementHistory = async (filters: MovementFilters) => {
  const movements = await trpc.inventory.getMovements.query({
    itemId: filters.itemId,
    locationId: filters.locationId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    types: filters.types,
    page: filters.page,
    limit: filters.limit,
  });

  return movements;
};

// Movement analytics
const getMovementAnalytics = async (itemId: string) => {
  const analytics = await trpc.inventory.getMovementAnalytics.query({
    itemId,
    period: 'LAST_90_DAYS',
  });

  return {
    averageDailyUsage: analytics.avgDailyUsage,
    turnoverRate: analytics.turnoverRate,
    leadTime: analytics.avgLeadTime,
    stockoutDays: analytics.stockoutDays,
  };
};
```

### 3. Batch/Serial Tracking

```typescript
// GET /api/inventory/batches
const getBatchInfo = async (batchNumber: string) => {
  const batch = await trpc.inventory.getBatch.query({ batchNumber });

  return {
    items: batch.items,
    locations: batch.locations,
    quantity: batch.totalQuantity,
    expirationDate: batch.expirationDate,
    movements: batch.movements,
  };
};

// Track serial number
const trackSerialNumber = async (serialNumber: string) => {
  const history = await trpc.inventory.trackSerial.query({ serialNumber });

  return {
    currentLocation: history.currentLocation,
    currentStatus: history.status,
    movements: history.movements,
    warranty: history.warrantyInfo,
  };
};
```

## Inventory Optimization

### 1. Reorder Point Calculation

```typescript
// Calculate optimal reorder points
const calculateReorderPoints = async () => {
  const calculations = await trpc.inventory.calculateReorderPoints.mutate({
    method: 'STATISTICAL',
    safetyStockMultiplier: 1.65, // 95% service level
    reviewPeriodDays: 7,
  });

  return calculations;
};

// Auto-generate purchase orders
const generatePurchaseOrders = async () => {
  const orders = await trpc.inventory.generatePurchaseOrders.query({
    includeItems: 'BELOW_REORDER_POINT',
    consolidateBySupplier: true,
  });

  return orders;
};
```

### 2. ABC Analysis

```typescript
// Perform ABC analysis
const performABCAnalysis = async () => {
  const analysis = await trpc.inventory.abcAnalysis.query({
    criteria: 'VALUE', // or 'VELOCITY', 'CRITICALITY'
    period: 'LAST_12_MONTHS',
    distribution: {
      A: 0.2, // Top 20%
      B: 0.3, // Next 30%
      C: 0.5, // Bottom 50%
    },
  });

  return analysis;
};
```

### 3. Demand Forecasting

```typescript
// AI-powered demand forecasting
const forecastDemand = async (itemId: string) => {
  const forecast = await trpc.inventory.forecastDemand.query({
    itemId,
    horizonDays: 90,
    method: 'ML_ENSEMBLE', // Machine learning ensemble
    includeSeasonality: true,
    includePromotion: true,
  });

  return {
    predictions: forecast.dailyPredictions,
    confidence: forecast.confidenceIntervals,
    factors: forecast.influencingFactors,
  };
};
```

## Reporting & Analytics

### 1. Inventory Reports

```typescript
// Generate inventory valuation report
const getValuationReport = async (date: Date) => {
  const report = await trpc.reports.inventoryValuation.query({
    asOfDate: date,
    groupBy: ['category', 'location'],
    costingMethod: 'AVERAGE',
    includeDetails: true,
  });

  return report;
};

// Aging report
const getAgingReport = async () => {
  const report = await trpc.reports.inventoryAging.query({
    buckets: [30, 60, 90, 180, 365],
    groupBy: 'category',
  });

  return report;
};
```

### 2. Movement Reports

```typescript
// Movement summary report
const getMovementSummary = async (period: DateRange) => {
  const summary = await trpc.reports.movementSummary.query({
    dateFrom: period.from,
    dateTo: period.to,
    groupBy: ['item', 'type'],
    includeValues: true,
  });

  return summary;
};
```

## Best Practices

### 1. Inventory Accuracy

- **Regular Cycle Counts**: Schedule based on ABC classification
- **Proper Training**: Ensure staff understand procedures
- **Clear Locations**: Use logical location naming
- **Timely Recording**: Record movements immediately
- **Verification**: Double-check critical transactions

### 2. Stock Organization

```typescript
// Location naming convention
const locationNaming = {
  pattern: '{building}-{zone}-{aisle}-{rack}-{level}-{bin}',
  example: 'WH1-A-01-R01-L3-B05',

  // Virtual locations
  virtual: {
    RECEIVING: 'RECV-DOCK',
    SHIPPING: 'SHIP-DOCK',
    QUARANTINE: 'QC-HOLD',
    RETURNS: 'RET-PROC',
  },
};
```

### 3. Performance Optimization

- **Index frequently searched fields**: SKU, batch, serial
- **Archive old movements**: Keep active data manageable
- **Use pagination**: For large result sets
- **Cache static data**: Categories, UOMs, locations
- **Batch operations**: For bulk updates

## Integration Examples

### 1. Barcode Scanning

```typescript
// Integrate with barcode scanner
const scanBarcode = async (barcode: string) => {
  const result = await trpc.inventory.scanBarcode.query({ barcode });

  if (result.type === 'ITEM') {
    // Show item details and stock levels
    return getStockLevels({ itemIds: [result.itemId] });
  } else if (result.type === 'LOCATION') {
    // Show location contents
    return getLocationInventory(result.locationId);
  }
};
```

### 2. ERP Integration

```typescript
// Sync with external ERP
const syncWithERP = async () => {
  // Export movements
  const movements = await trpc.inventory.getMovements.query({
    syncStatus: 'PENDING',
    limit: 1000,
  });

  // Send to ERP
  const results = await erpClient.importMovements(movements);

  // Mark as synced
  await trpc.inventory.markSynced.mutate({
    movementIds: results.successful,
  });
};
```

## Troubleshooting

### Common Issues

1. **Negative Stock**
   - Check for unrecorded issues
   - Verify movement sequence
   - Review reservation logic

2. **Valuation Discrepancies**
   - Ensure consistent costing method
   - Check for missing costs
   - Verify currency conversions

3. **Performance Issues**
   - Add indexes for common queries
   - Archive historical data
   - Optimize location hierarchy

### Audit Queries

```sql
-- Find negative stock
SELECT i.*, it.name, l.name as location
FROM inventory i
JOIN items it ON i.item_id = it.id
JOIN locations l ON i.location_id = l.id
WHERE i.qty_on_hand < 0;

-- Orphaned movements
SELECT sm.*
FROM stock_movements sm
LEFT JOIN inventory i ON sm.item_id = i.item_id
  AND sm.to_location_id = i.location_id
WHERE i.id IS NULL AND sm.type = 'RECEIPT';

-- Value discrepancies
SELECT
  i.item_id,
  SUM(i.qty_on_hand * i.unit_cost) as calculated,
  iv.total_value as stored,
  ABS(SUM(i.qty_on_hand * i.unit_cost) - iv.total_value) as diff
FROM inventory i
JOIN inventory_valuation iv ON i.organization_id = iv.organization_id
GROUP BY i.item_id, iv.total_value
HAVING ABS(SUM(i.qty_on_hand * i.unit_cost) - iv.total_value) > 0.01;
```

## Next Steps

1. Learn about [Order Processing](./order-processing.md) integration
2. Explore [Reporting & Analytics](./reporting-analytics.md)
3. Configure [Multi-Organization](./multi-organization.md) inventory
4. Set up inventory webhooks and automation
