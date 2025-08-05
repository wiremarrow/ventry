# API Reference

Complete API documentation for Ventry's RESTful and tRPC APIs.

## Base URLs

```
Production: https://api.ventry.app
Staging: https://api-staging.ventry.app
Development: http://localhost:6060
```

## Authentication

All API requests require authentication using JWT tokens passed in the Authorization header.

```http
Authorization: Bearer <jwt_token>
```

### Obtain Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "usr_123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "organization": {
    "id": "org_456",
    "name": "Acme Corp",
    "role": "ADMIN"
  }
}
```

## tRPC API

Ventry uses tRPC for type-safe API calls. The tRPC endpoint is available at `/trpc`.

### Client Setup

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@ventry/backend';

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'https://api.ventry.app/trpc',
      headers() {
        return {
          authorization: `Bearer ${getToken()}`,
        };
      },
    }),
  ],
});
```

### Available Procedures

#### Authentication

```typescript
// Login
const session = await client.auth.login.mutate({
  email: 'user@example.com',
  password: 'password',
});

// Logout
await client.auth.logout.mutate();

// Get current user
const user = await client.auth.me.query();

// Switch organization
await client.auth.switchOrganization.mutate({
  organizationId: 'org_789',
});
```

#### Organizations

```typescript
// List user's organizations
const orgs = await client.organizations.list.query();

// Get organization details
const org = await client.organizations.getById.query({
  id: 'org_456',
});

// Update organization
await client.organizations.update.mutate({
  id: 'org_456',
  name: 'New Name',
  settings: { timezone: 'America/New_York' },
});

// Invite members
await client.organizations.inviteMembers.mutate({
  organizationId: 'org_456',
  invites: [{ email: 'newuser@example.com', role: 'MEMBER' }],
});
```

#### Inventory

```typescript
// List items
const items = await client.items.list.query({
  page: 1,
  limit: 50,
  search: 'widget',
  categoryId: 'cat_123',
  sortBy: 'name',
  sortOrder: 'asc',
});

// Get item details
const item = await client.items.getById.query({ id: 'itm_123' });

// Create item
const newItem = await client.items.create.mutate({
  sku: 'WID-001',
  name: 'Blue Widget',
  categoryId: 'cat_123',
  unitOfMeasureId: 'uom_456',
  trackInventory: true,
  reorderPoint: 100,
  reorderQuantity: 500,
});

// Check stock levels
const stock = await client.inventory.getStockLevels.query({
  itemId: 'itm_123',
  locationId: 'loc_456', // optional
});

// Record stock movement
await client.inventory.createMovement.mutate({
  type: 'RECEIPT',
  itemId: 'itm_123',
  locationId: 'loc_456',
  quantity: 100,
  unitCost: 25.5,
  reference: 'PO-2024-001',
});
```

#### Orders

```typescript
// List orders
const orders = await client.orders.list.query({
  page: 1,
  limit: 20,
  status: ['PENDING', 'CONFIRMED'],
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
});

// Create order
const order = await client.orders.create.mutate({
  customerId: 'cust_123',
  items: [
    { itemId: 'itm_123', quantity: 5, price: 29.99 },
    { itemId: 'itm_456', quantity: 3, price: 49.99 },
  ],
  shippingAddress: {
    line1: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    postalCode: '12345',
    country: 'US',
  },
});

// Update order status
await client.orders.updateStatus.mutate({
  id: 'ord_789',
  status: 'CONFIRMED',
});

// Get order details
const orderDetails = await client.orders.getById.query({
  id: 'ord_789',
  include: ['items', 'customer', 'shipments'],
});
```

#### Reports

```typescript
// Generate inventory valuation
const valuation = await client.reports.inventoryValuation.query({
  asOfDate: '2024-01-31',
  groupBy: ['category', 'location'],
});

// Get sales analysis
const sales = await client.reports.salesAnalysis.query({
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
  groupBy: 'day',
  includeComparison: true,
});

// Export report
const exportUrl = await client.reports.export.mutate({
  reportId: 'rpt_123',
  format: 'EXCEL',
  parameters: { year: 2024, month: 1 },
});
```

## REST API Endpoints (For External Integration)

**Note**: Ventry primarily uses tRPC for type-safe API calls. These REST-style endpoints are provided for external integration and third-party systems that cannot use tRPC.

### Items

#### List Items

```http
GET /api/items?page=1&limit=50&search=widget&category=electronics
```

**Response:**

```json
{
  "data": [
    {
      "id": "itm_123",
      "sku": "WID-001",
      "name": "Blue Widget",
      "description": "A blue widget",
      "categoryId": "cat_123",
      "unitOfMeasureId": "uom_456",
      "status": "ACTIVE",
      "createdAt": "2024-01-20T10:00:00Z",
      "updatedAt": "2024-01-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5
  }
}
```

#### Get Item

```http
GET /api/items/{id}
```

#### Create Item

```http
POST /api/items
Content-Type: application/json

{
  "sku": "WID-002",
  "name": "Red Widget",
  "categoryId": "cat_123",
  "unitOfMeasureId": "uom_456"
}
```

#### Update Item

```http
PUT /api/items/{id}
Content-Type: application/json

{
  "name": "Updated Widget Name",
  "description": "Updated description"
}
```

#### Delete Item

```http
DELETE /api/items/{id}
```

### Inventory

#### Get Stock Levels

```http
GET /api/inventory/stock?itemId=itm_123&locationId=loc_456
```

**Response:**

```json
{
  "itemId": "itm_123",
  "locationId": "loc_456",
  "quantityOnHand": 150,
  "quantityReserved": 20,
  "quantityAvailable": 130,
  "reorderPoint": 100,
  "lastMovement": "2024-01-20T15:30:00Z"
}
```

#### Record Movement

```http
POST /api/inventory/movements
Content-Type: application/json

{
  "type": "RECEIPT",
  "itemId": "itm_123",
  "locationId": "loc_456",
  "quantity": 100,
  "unitCost": 25.50,
  "reference": "PO-2024-001",
  "notes": "Received from supplier"
}
```

#### Transfer Stock

```http
POST /api/inventory/transfer
Content-Type: application/json

{
  "itemId": "itm_123",
  "fromLocationId": "loc_456",
  "toLocationId": "loc_789",
  "quantity": 50,
  "reason": "Replenishment"
}
```

### Orders

#### List Orders

```http
GET /api/orders?status=PENDING,CONFIRMED&dateFrom=2024-01-01&dateTo=2024-01-31
```

#### Create Order

```http
POST /api/orders
Content-Type: application/json

{
  "customerId": "cust_123",
  "items": [
    {
      "itemId": "itm_123",
      "quantity": 5,
      "price": 29.99
    }
  ],
  "shippingAddress": {
    "line1": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "postalCode": "12345",
    "country": "US"
  }
}
```

#### Update Order

```http
PATCH /api/orders/{id}
Content-Type: application/json

{
  "status": "CONFIRMED",
  "notes": "Customer confirmed via phone"
}
```

#### Cancel Order

```http
POST /api/orders/{id}/cancel
Content-Type: application/json

{
  "reason": "Customer requested cancellation"
}
```

### Warehouses

#### List Warehouses

```http
GET /api/warehouses
```

#### Get Warehouse Details

```http
GET /api/warehouses/{id}?include=locations,stats
```

**Response:**

```json
{
  "id": "wh_123",
  "name": "Main Warehouse",
  "type": "WAREHOUSE",
  "address": {
    "line1": "100 Industrial Way",
    "city": "Commerce City",
    "state": "CA",
    "postalCode": "90040",
    "country": "US"
  },
  "locations": [
    {
      "id": "loc_456",
      "name": "A-01-01",
      "type": "BIN",
      "parentId": "wh_123"
    }
  ],
  "stats": {
    "totalLocations": 150,
    "occupiedLocations": 89,
    "utilizationRate": 0.593,
    "totalItems": 1234,
    "totalValue": 567890.5
  }
}
```

### Reports

#### Generate Report

```http
POST /api/reports/generate
Content-Type: application/json

{
  "reportId": "inventory_valuation",
  "parameters": {
    "asOfDate": "2024-01-31",
    "locationId": "wh_123"
  },
  "format": "PDF"
}
```

**Response:**

```json
{
  "reportId": "rpt_generated_123",
  "status": "PROCESSING",
  "estimatedTime": 30,
  "pollUrl": "/api/reports/status/rpt_generated_123"
}
```

#### Get Report Status

```http
GET /api/reports/status/{reportId}
```

**Response (when complete):**

```json
{
  "reportId": "rpt_generated_123",
  "status": "COMPLETE",
  "downloadUrl": "https://reports.ventry.app/download/abc123",
  "expiresAt": "2024-02-01T00:00:00Z"
}
```

## Webhooks (Planned Feature)

**Note**: Webhook support is planned for a future release and is not yet implemented.

### Webhook Events

When implemented, Ventry will be able to send webhooks for the following events:

| Event                    | Description              | Payload                  |
| ------------------------ | ------------------------ | ------------------------ |
| `item.created`           | New item created         | Item object              |
| `item.updated`           | Item details updated     | Item object with changes |
| `inventory.low_stock`    | Item below reorder point | Stock level details      |
| `inventory.out_of_stock` | Item has zero stock      | Item and location        |
| `order.created`          | New order placed         | Order object             |
| `order.confirmed`        | Order confirmed          | Order object             |
| `order.fulfilled`        | Order shipped            | Order with shipment      |
| `order.cancelled`        | Order cancelled          | Order with reason        |

### Webhook Payload

```json
{
  "id": "evt_123",
  "type": "order.created",
  "created": "2024-01-20T15:30:00Z",
  "data": {
    // Event-specific data
  },
  "organization": {
    "id": "org_456",
    "name": "Acme Corp"
  }
}
```

### Webhook Security

All webhooks include a signature header for verification:

```http
X-Ventry-Signature: sha256=f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8
```

Verify webhooks using:

```typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string) {
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return `sha256=${expectedSignature}` === signature;
}
```

## Rate Limiting

API requests are rate limited based on your subscription plan:

| Plan       | Requests/Hour | Burst   |
| ---------- | ------------- | ------- |
| Free       | 1,000         | 20/sec  |
| Pro        | 10,000        | 50/sec  |
| Enterprise | 100,000       | 200/sec |

Rate limit information is included in response headers:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1705764600
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "INV001",
    "message": "Insufficient stock available",
    "details": {
      "itemId": "itm_123",
      "requested": 100,
      "available": 50
    }
  },
  "timestamp": "2024-01-20T15:30:00Z",
  "requestId": "req_abc123"
}
```

### Common Error Codes

| Code      | HTTP Status | Description              |
| --------- | ----------- | ------------------------ |
| `AUTH001` | 401         | Invalid credentials      |
| `AUTH002` | 401         | Token expired            |
| `AUTH003` | 403         | Insufficient permissions |
| `VAL001`  | 422         | Validation error         |
| `INV001`  | 409         | Insufficient stock       |
| `ORG001`  | 404         | Organization not found   |
| `SYS001`  | 500         | Internal server error    |

## SDK Libraries

Official SDKs are available for:

- **JavaScript/TypeScript**: `npm install @ventry/sdk`
- **Python**: `pip install ventry-sdk`
- **Go**: `go get github.com/ventry/ventry-go`
- **Ruby**: `gem install ventry`

### TypeScript SDK Example

```typescript
import { VentryClient } from '@ventry/sdk';

const client = new VentryClient({
  apiKey: process.env.VENTRY_API_KEY,
  organizationId: process.env.VENTRY_ORG_ID,
});

// Fully typed API calls
const items = await client.inventory.items.list({
  page: 1,
  limit: 50,
});

const order = await client.orders.create({
  customerId: 'cust_123',
  items: [{ itemId: 'itm_123', quantity: 5 }],
});
```

## API Versioning

The API uses URL versioning. The current version is v1.

```
https://api.ventry.app/v1/items
```

Breaking changes will result in a new API version. Previous versions are supported for at least 12 months after a new version is released.

## Testing

Use the sandbox environment for testing:

```
Base URL: https://sandbox-api.ventry.app
Test Credentials: Available in your dashboard
```

The sandbox environment is reset daily and can be used for integration testing without affecting production data.
