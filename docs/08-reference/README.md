# Reference Documentation

This section provides detailed technical reference documentation for developers working with Ventry.

## 📚 Reference Guides

### [API Reference](./api-reference.md)

Complete API documentation including all endpoints, request/response formats, and authentication.

### [Database Schema](./database-schema.md)

Detailed database schema documentation with all tables, relationships, and constraints.

### [Configuration Reference](./configuration-reference.md)

All configuration options, environment variables, and settings.

### [Error Codes](./error-codes.md)

Comprehensive list of error codes, their meanings, and resolution steps.

### [Glossary](./glossary.md)

Definitions of technical terms and business concepts used in Ventry.

## 🔍 Quick Links

### API Endpoints

| Category       | Base Path            | Description                     |
| -------------- | -------------------- | ------------------------------- |
| Authentication | `/api/auth`          | Login, logout, token management |
| Organizations  | `/api/organizations` | Organization management         |
| Inventory      | `/api/inventory`     | Stock levels, movements         |
| Orders         | `/api/orders`        | Sales and purchase orders       |
| Reports        | `/api/reports`       | Analytics and reporting         |

### Database Tables

| Table           | Purpose                    | Key Fields                     |
| --------------- | -------------------------- | ------------------------------ |
| `users`         | User accounts              | id, email, password_hash       |
| `organizations` | Multi-tenant organizations | id, name, settings             |
| `items`         | Products/materials         | id, sku, name, category_id     |
| `inventory`     | Stock levels               | item_id, location_id, quantity |
| `orders`        | Sales orders               | id, customer_id, status        |

### Configuration

| Variable       | Type   | Description                          |
| -------------- | ------ | ------------------------------------ |
| `DATABASE_URL` | string | PostgreSQL connection string         |
| `JWT_SECRET`   | string | Secret for JWT signing               |
| `REDIS_URL`    | string | Redis connection string              |
| `NODE_ENV`     | string | Environment (development/production) |

### Common Error Codes

| Code      | Description            | Resolution              |
| --------- | ---------------------- | ----------------------- |
| `AUTH001` | Invalid credentials    | Check username/password |
| `AUTH002` | Token expired          | Refresh token           |
| `INV001`  | Insufficient stock     | Check availability      |
| `ORG001`  | Organization not found | Verify organization ID  |

## 📖 Documentation Standards

### API Documentation Format

```yaml
endpoint:
  path: /api/resource/{id}
  method: GET
  description: Retrieve a specific resource

  parameters:
    - name: id
      type: string
      required: true
      description: Resource identifier

  headers:
    - name: Authorization
      required: true
      description: Bearer token

  responses:
    200:
      description: Success
      schema: ResourceSchema
    404:
      description: Not found
      schema: ErrorSchema
```

### Database Documentation Format

```sql
-- Table: table_name
-- Description: What this table stores

CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Column descriptions as comments
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_table_column ON table_name(column);

-- Constraints
ALTER TABLE table_name
  ADD CONSTRAINT fk_relation
  FOREIGN KEY (column) REFERENCES other_table(id);
```

### Error Documentation Format

```typescript
interface ErrorReference {
  code: string;
  message: string;
  category: 'AUTH' | 'VALIDATION' | 'BUSINESS' | 'SYSTEM';
  httpStatus: number;
  userMessage: string;
  technicalDetails?: string;
  resolution: string;
  relatedErrors?: string[];
}
```

## 🔧 Developer Resources

### Code Examples

```typescript
// Authentication example
const authenticate = async (email: string, password: string) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const { token, user } = await response.json();
  return { token, user };
};

// Inventory query example
const checkStock = async (itemId: string, locationId?: string) => {
  const params = new URLSearchParams({ itemId });
  if (locationId) params.append('locationId', locationId);

  const response = await fetch(`/api/inventory/check?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.json();
};
```

### SDK Usage

```typescript
import { VentryClient } from '@ventry/sdk';

const client = new VentryClient({
  apiUrl: 'https://api.ventry.app',
  apiKey: process.env.VENTRY_API_KEY,
});

// Use typed methods
const items = await client.inventory.listItems({
  page: 1,
  limit: 50,
  filters: { category: 'electronics' },
});

const order = await client.orders.create({
  customerId: 'cust_123',
  items: [{ itemId: 'item_456', quantity: 5 }],
});
```

### Webhooks

```typescript
// Webhook handler example
app.post('/webhooks/ventry', async (req, res) => {
  const signature = req.headers['x-ventry-signature'];

  // Verify webhook signature
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
  switch (req.body.event) {
    case 'inventory.low_stock':
      await handleLowStock(req.body.data);
      break;
    case 'order.created':
      await handleNewOrder(req.body.data);
      break;
  }

  res.status(200).send({ received: true });
});
```

## 🎯 Quick Reference

### HTTP Status Codes

| Code | Meaning       | Usage                    |
| ---- | ------------- | ------------------------ |
| 200  | OK            | Successful GET/PUT       |
| 201  | Created       | Successful POST          |
| 204  | No Content    | Successful DELETE        |
| 400  | Bad Request   | Invalid input            |
| 401  | Unauthorized  | Missing/invalid auth     |
| 403  | Forbidden     | Insufficient permissions |
| 404  | Not Found     | Resource doesn't exist   |
| 409  | Conflict      | Duplicate/conflict       |
| 422  | Unprocessable | Validation error         |
| 500  | Server Error  | Internal error           |

### Date/Time Formats

- **ISO 8601**: `2024-01-20T15:30:00Z`
- **Unix Timestamp**: `1705764600`
- **Date Only**: `2024-01-20`
- **Timezone**: Always UTC in API, local in UI

### Pagination

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Filtering

```
GET /api/items?category=electronics&status=active&minPrice=100&maxPrice=500
```

### Sorting

```
GET /api/items?sortBy=createdAt&sortOrder=desc
```

## 📚 Additional Resources

### External Documentation

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Next.js Documentation](https://nextjs.org/docs)

### Community Resources

- [GitHub Repository](https://github.com/ventry/ventry)
- [Discord Community](https://discord.gg/ventry)
- [Stack Overflow Tag](https://stackoverflow.com/questions/tagged/ventry)

### Support Channels

- **Documentation**: You're here!
- **API Status**: https://status.ventry.app
- **Support Email**: support@ventry.com
- **Enterprise Support**: enterprise@ventry.com

## Next Steps

1. Review the [API Reference](./api-reference.md)
2. Understand the [Database Schema](./database-schema.md)
3. Configure using [Configuration Reference](./configuration-reference.md)
4. Handle errors with [Error Codes](./error-codes.md)
5. Learn terminology in the [Glossary](./glossary.md)
