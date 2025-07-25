# Order Processing

Complete guide to Ventry's order processing features, including sales orders, purchase orders, and fulfillment workflows.

## Overview

Ventry's order processing system handles the complete lifecycle of sales and purchase orders, from creation through fulfillment, with real-time inventory integration and automated workflows.

### Key Features

- **Sales Order Management**: Complete order lifecycle from quote to cash
- **Purchase Order Automation**: Automated procurement and receiving
- **Real-time Inventory**: Live stock allocation and availability
- **Fulfillment Workflows**: Pick, pack, and ship processes
- **Multi-channel Support**: Orders from various sales channels
- **Drop Shipping**: Direct supplier fulfillment

## Order Types

### Sales Orders

Sales orders represent customer purchases.

```typescript
interface Order {
  id: string;
  orderNumber: string;
  type: 'SALES';
  status: OrderStatus;

  // Customer information
  customerId: string;
  customer: Customer;

  // Addresses
  billingAddress: Address;
  shippingAddress: Address;

  // Order details
  orderDate: Date;
  requestedDate?: Date;

  // Line items
  items: OrderItem[];

  // Totals
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;

  // Payment
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentReference?: string;

  // Fulfillment
  fulfillmentStatus: FulfillmentStatus;
  shipments: Shipment[];

  // Metadata
  source: OrderSource;
  channel?: string;
  notes?: string;
  tags?: string[];
}

enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  PARTIALLY_FULFILLED = 'PARTIALLY_FULFILLED',
  FULFILLED = 'FULFILLED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}
```

### Purchase Orders

Purchase orders represent orders to suppliers.

```typescript
interface PurchaseOrder {
  id: string;
  poNumber: string;
  type: 'PURCHASE';
  status: POStatus;

  // Supplier information
  supplierId: string;
  supplier: Supplier;

  // Order details
  orderDate: Date;
  expectedDate?: Date;

  // Line items
  items: PurchaseOrderItem[];

  // Totals
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;

  // Receiving
  receivingStatus: ReceivingStatus;
  receipts: Receipt[];

  // Terms
  paymentTerms?: string;
  shippingTerms?: string;

  // Approval
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
}

enum POStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  SENT = 'SENT',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
```

## Order Workflows

### 1. Sales Order Creation

```typescript
// POST /api/orders/create
const createSalesOrder = async (orderData: CreateOrderInput) => {
  // Validate customer
  const customer = await trpc.customers.get.query({
    id: orderData.customerId,
  });

  // Check inventory availability
  const availability = await trpc.inventory.checkBulkAvailability.query({
    items: orderData.items.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
      locationId: orderData.warehouseId,
    })),
  });

  if (!availability.allAvailable) {
    return {
      error: 'Insufficient inventory',
      unavailableItems: availability.unavailable,
    };
  }

  // Create order with reservation
  const order = await trpc.orders.create.mutate({
    ...orderData,
    reserveInventory: true,
  });

  // Send order confirmation
  await sendOrderConfirmation(order);

  return order;
};

// Bulk order import
const importOrders = async (file: File) => {
  const orders = await parseOrderFile(file);

  const results = await trpc.orders.bulkCreate.mutate({
    orders,
    validateOnly: false,
    continueOnError: true,
  });

  return {
    created: results.successful.length,
    failed: results.failed.length,
    errors: results.errors,
  };
};
```

### 2. Order Processing

```typescript
// Process order through workflow
const processOrder = async (orderId: string) => {
  const order = await trpc.orders.get.query({ id: orderId });

  switch (order.status) {
    case 'PENDING':
      // Verify payment
      const paymentVerified = await verifyPayment(order);
      if (!paymentVerified) {
        throw new Error('Payment verification failed');
      }

      // Confirm order
      await trpc.orders.confirm.mutate({ id: orderId });
      break;

    case 'CONFIRMED':
      // Allocate inventory
      await trpc.orders.allocateInventory.mutate({ id: orderId });

      // Generate pick list
      const pickList = await trpc.fulfillment.generatePickList.mutate({
        orderId,
      });

      // Update status
      await trpc.orders.updateStatus.mutate({
        id: orderId,
        status: 'PROCESSING',
      });
      break;

    case 'PROCESSING':
      // Check if ready to ship
      const fulfillment = await trpc.fulfillment.getStatus.query({
        orderId,
      });

      if (fulfillment.packed) {
        await trpc.orders.readyToShip.mutate({ id: orderId });
      }
      break;
  }
};
```

### 3. Order Fulfillment

```typescript
// Pick process
const pickOrder = async (pickListId: string) => {
  const pickList = await trpc.fulfillment.getPickList.query({
    id: pickListId,
  });

  // Mobile app scanning
  for (const item of pickList.items) {
    // Scan location barcode
    await scanLocation(item.location);

    // Scan item barcode
    await scanItem(item.itemCode);

    // Confirm quantity
    await confirmPick({
      pickListId,
      itemId: item.id,
      quantity: item.quantity,
      serialNumbers: item.serialNumbers,
    });
  }

  // Complete picking
  await trpc.fulfillment.completePicking.mutate({ pickListId });
};

// Pack process
const packOrder = async (orderId: string) => {
  // Get packing suggestions
  const suggestions = await trpc.fulfillment.getPackingSuggestions.query({
    orderId,
  });

  // Create shipment
  const shipment = await trpc.shipments.create.mutate({
    orderId,
    boxes: suggestions.boxes.map((box) => ({
      type: box.boxType,
      weight: box.weight,
      dimensions: box.dimensions,
      items: box.items,
    })),
    carrier: suggestions.recommendedCarrier,
    service: suggestions.recommendedService,
  });

  // Print shipping labels
  const labels = await trpc.shipments.generateLabels.mutate({
    shipmentId: shipment.id,
  });

  return { shipment, labels };
};

// Ship process
const shipOrder = async (shipmentId: string) => {
  // Mark as shipped
  const tracking = await trpc.shipments.ship.mutate({
    id: shipmentId,
    actualWeight: 5.2,
    actualCost: 12.5,
  });

  // Update order status
  await trpc.orders.updateFulfillmentStatus.mutate({
    orderId: tracking.orderId,
    status: 'FULFILLED',
  });

  // Send shipping notification
  await sendShippingNotification(tracking);

  return tracking;
};
```

### 4. Purchase Order Workflow

```typescript
// Create purchase order
const createPurchaseOrder = async (items: POItem[]) => {
  // Group by supplier
  const itemsBySupplier = groupBy(items, 'supplierId');

  const purchaseOrders = [];

  for (const [supplierId, supplierItems] of Object.entries(itemsBySupplier)) {
    const po = await trpc.purchaseOrders.create.mutate({
      supplierId,
      items: supplierItems,
      expectedDate: calculateExpectedDate(supplierId),
    });

    purchaseOrders.push(po);
  }

  return purchaseOrders;
};

// Auto-generate from reorder points
const generatePurchaseOrders = async () => {
  const needed = await trpc.inventory.getItemsBelowReorderPoint.query();

  const suggestions = await trpc.purchaseOrders.generateSuggestions.query({
    items: needed.map((item) => ({
      itemId: item.itemId,
      quantity: item.reorderQuantity,
      urgency: item.stockoutRisk,
    })),
    consolidate: true,
    considerLeadTime: true,
  });

  // Review and approve
  for (const suggestion of suggestions) {
    if (suggestion.totalAmount < 5000) {
      // Auto-approve small orders
      await trpc.purchaseOrders.approve.mutate({
        id: suggestion.id,
      });
    } else {
      // Send for approval
      await sendForApproval(suggestion);
    }
  }
};

// Receive purchase order
const receivePurchaseOrder = async (poId: string, receipt: ReceiptData) => {
  // Create receipt
  const receiptRecord = await trpc.purchaseOrders.receive.mutate({
    purchaseOrderId: poId,
    items: receipt.items.map((item) => ({
      poItemId: item.poItemId,
      receivedQuantity: item.quantity,
      location: item.location,
      batchNumber: item.batchNumber,
      expirationDate: item.expirationDate,
      notes: item.notes,
    })),
    packingSlipNumber: receipt.packingSlipNumber,
  });

  // Quality check if required
  if (receipt.requiresQC) {
    await trpc.qualityControl.createInspection.mutate({
      receiptId: receiptRecord.id,
      items: receipt.items,
    });
  }

  // Update inventory
  await trpc.inventory.processReceipt.mutate({
    receiptId: receiptRecord.id,
  });

  return receiptRecord;
};
```

## Advanced Features

### 1. Multi-Channel Integration

```typescript
// Import orders from multiple channels
const syncChannelOrders = async () => {
  const channels = ['shopify', 'amazon', 'ebay', 'website'];

  for (const channel of channels) {
    const connector = getChannelConnector(channel);
    const orders = await connector.fetchNewOrders();

    // Transform to Ventry format
    const ventryOrders = orders.map((order) => transformChannelOrder(channel, order));

    // Import orders
    await trpc.orders.importFromChannel.mutate({
      channel,
      orders: ventryOrders,
      updateInventory: true,
    });
  }
};

// Channel-specific rules
const channelRules = {
  amazon: {
    autoConfirm: true,
    priorityFulfillment: true,
    shippingMethod: 'AMAZON_PRIME',
  },
  shopify: {
    syncInventory: true,
    syncTracking: true,
    webhooks: ['order.created', 'order.cancelled'],
  },
};
```

### 2. Drop Shipping

```typescript
// Create drop ship order
const createDropShipOrder = async (order: Order) => {
  // Identify drop ship items
  const dropShipItems = order.items.filter((item) => item.fulfillmentMethod === 'DROP_SHIP');

  if (dropShipItems.length === 0) return;

  // Group by supplier
  const bySupplier = groupBy(dropShipItems, 'supplierId');

  for (const [supplierId, items] of Object.entries(bySupplier)) {
    // Create supplier order
    const supplierOrder = await trpc.dropShip.createOrder.mutate({
      supplierId,
      originalOrderId: order.id,
      items,
      shipTo: order.shippingAddress,
      customerInfo: {
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
      },
    });

    // Send to supplier
    await sendToSupplier(supplierOrder);
  }
};

// Track drop ship fulfillment
const trackDropShipment = async (supplierOrderId: string) => {
  const tracking = await trpc.dropShip.getTracking.query({
    id: supplierOrderId,
  });

  // Update original order
  await trpc.orders.updateDropShipTracking.mutate({
    orderId: tracking.originalOrderId,
    trackingNumber: tracking.trackingNumber,
    carrier: tracking.carrier,
    items: tracking.items,
  });
};
```

### 3. Subscription Orders

```typescript
// Manage subscription orders
const processSubscriptions = async () => {
  // Get due subscriptions
  const due = await trpc.subscriptions.getDue.query({
    date: new Date(),
  });

  for (const subscription of due) {
    try {
      // Create order
      const order = await trpc.orders.createFromSubscription.mutate({
        subscriptionId: subscription.id,
        items: subscription.items,
        shippingAddress: subscription.shippingAddress,
        billingAddress: subscription.billingAddress,
      });

      // Process payment
      const payment = await processSubscriptionPayment(subscription);

      if (payment.success) {
        // Confirm order
        await trpc.orders.confirm.mutate({ id: order.id });

        // Update next order date
        await trpc.subscriptions.updateNextDate.mutate({
          id: subscription.id,
          nextDate: calculateNextDate(subscription),
        });
      }
    } catch (error) {
      // Handle subscription failure
      await handleSubscriptionError(subscription, error);
    }
  }
};
```

### 4. Order Modifications

```typescript
// Modify existing order
const modifyOrder = async (orderId: string, changes: OrderChanges) => {
  const order = await trpc.orders.get.query({ id: orderId });

  // Check if modification allowed
  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw new Error('Order cannot be modified in current status');
  }

  // Apply changes
  if (changes.items) {
    // Check inventory for new items
    const newItems = changes.items.filter((i) => i.action === 'ADD');
    const availability = await checkAvailability(newItems);

    if (!availability.allAvailable) {
      throw new Error('Some items are not available');
    }

    // Update order
    await trpc.orders.modifyItems.mutate({
      orderId,
      changes: changes.items,
    });
  }

  if (changes.shippingAddress) {
    await trpc.orders.updateShippingAddress.mutate({
      orderId,
      address: changes.shippingAddress,
    });

    // Recalculate shipping
    await recalculateShipping(orderId);
  }

  // Send modification notification
  await sendOrderModificationNotification(order, changes);
};

// Cancel order
const cancelOrder = async (orderId: string, reason: string) => {
  const order = await trpc.orders.get.query({ id: orderId });

  // Check if cancellation allowed
  if (order.status === 'SHIPPED') {
    throw new Error('Cannot cancel shipped orders');
  }

  // Release inventory reservations
  await trpc.inventory.releaseReservations.mutate({
    orderId,
  });

  // Cancel order
  await trpc.orders.cancel.mutate({
    id: orderId,
    reason,
  });

  // Process refund if paid
  if (order.paymentStatus === 'PAID') {
    await processRefund(order);
  }

  // Notify customer
  await sendCancellationNotification(order, reason);
};
```

## Reporting & Analytics

### 1. Order Reports

```typescript
// Sales analysis
const getSalesAnalysis = async (period: DateRange) => {
  const analysis = await trpc.reports.salesAnalysis.query({
    dateFrom: period.from,
    dateTo: period.to,
    groupBy: ['date', 'channel', 'customer_segment'],
    metrics: ['revenue', 'orders', 'units', 'avg_order_value'],
  });

  return analysis;
};

// Order status report
const getOrderStatusReport = async () => {
  const report = await trpc.reports.orderStatus.query({
    includeAging: true,
    includeValue: true,
  });

  return {
    summary: report.summary,
    aging: report.agingBuckets,
    bottlenecks: report.processingBottlenecks,
  };
};
```

### 2. Fulfillment Metrics

```typescript
// Fulfillment performance
const getFulfillmentMetrics = async () => {
  const metrics = await trpc.reports.fulfillmentMetrics.query({
    period: 'LAST_30_DAYS',
  });

  return {
    onTimeShipment: metrics.onTimeRate,
    averageFulfillmentTime: metrics.avgFulfillmentHours,
    perfectOrderRate: metrics.perfectOrderRate,
    backorderRate: metrics.backorderRate,
    returnRate: metrics.returnRate,
  };
};
```

## Best Practices

### 1. Order Management

- **Validate Early**: Check inventory before confirming
- **Reserve Inventory**: Prevent overselling
- **Clear Statuses**: Use consistent status workflows
- **Audit Trail**: Log all order changes
- **Error Handling**: Graceful degradation

### 2. Performance Optimization

```typescript
// Batch operations
const batchUpdateOrders = async (updates: OrderUpdate[]) => {
  // Group by operation type
  const grouped = groupBy(updates, 'operation');

  // Execute in parallel where possible
  await Promise.all([
    trpc.orders.batchUpdateStatus.mutate(grouped.status),
    trpc.orders.batchUpdateShipping.mutate(grouped.shipping),
    trpc.orders.batchUpdatePriority.mutate(grouped.priority),
  ]);
};

// Optimize queries
const getOrdersOptimized = async (filters: OrderFilters) => {
  return trpc.orders.list.query({
    ...filters,
    // Only include necessary relations
    include: {
      customer: true,
      items: filters.includeItems,
      shipments: filters.includeShipments,
    },
    // Use cursor pagination
    cursor: filters.cursor,
    take: 50,
  });
};
```

### 3. Integration Patterns

```typescript
// Webhook handling
const handleOrderWebhook = async (event: WebhookEvent) => {
  // Verify webhook signature
  if (!verifyWebhookSignature(event)) {
    throw new Error('Invalid webhook signature');
  }

  // Process based on event type
  switch (event.type) {
    case 'order.created':
      await processNewOrder(event.data);
      break;
    case 'order.cancelled':
      await processCancellation(event.data);
      break;
    case 'shipment.delivered':
      await processDelivery(event.data);
      break;
  }

  // Acknowledge webhook
  return { received: true };
};
```

## Troubleshooting

### Common Issues

1. **Inventory Allocation Failures**
   - Check reservation status
   - Verify location availability
   - Review allocation rules

2. **Order Import Errors**
   - Validate data format
   - Check customer existence
   - Verify product mappings

3. **Fulfillment Delays**
   - Monitor pick queue
   - Check printer connectivity
   - Verify carrier integration

### Diagnostic Queries

```sql
-- Orders stuck in processing
SELECT
  o.id,
  o.order_number,
  o.status,
  o.created_at,
  AGE(NOW(), o.updated_at) as time_in_status
FROM orders o
WHERE o.status = 'PROCESSING'
  AND o.updated_at < NOW() - INTERVAL '24 hours'
ORDER BY o.updated_at;

-- Unfulfilled items
SELECT
  oi.order_id,
  oi.item_id,
  oi.quantity_ordered,
  COALESCE(SUM(si.quantity), 0) as quantity_shipped,
  oi.quantity_ordered - COALESCE(SUM(si.quantity), 0) as unfulfilled
FROM order_items oi
LEFT JOIN shipment_items si ON oi.id = si.order_item_id
JOIN orders o ON oi.order_id = o.id
WHERE o.status NOT IN ('CANCELLED', 'COMPLETED')
GROUP BY oi.order_id, oi.item_id, oi.quantity_ordered
HAVING oi.quantity_ordered > COALESCE(SUM(si.quantity), 0);
```

## Next Steps

1. Configure [Multi-Channel Integration](#multi-channel-integration)
2. Set up [Automated Workflows](#order-workflows)
3. Implement [Custom Reports](./reporting-analytics.md)
4. Enable [Real-time Notifications](#order-notifications)
