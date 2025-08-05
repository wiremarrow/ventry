# API Design

Ventry uses tRPC for type-safe APIs, providing end-to-end TypeScript type inference between frontend and backend.

## tRPC Architecture

### Why tRPC?

1. **Type Safety**: Automatic type inference, no code generation
2. **Developer Experience**: IntelliSense across the full stack
3. **Performance**: HTTP batching, no over-fetching
4. **Simplicity**: No GraphQL complexity or REST boilerplate

### API Structure

```typescript
// Backend router definition
export const itemsRouter = createTRPCRouter({
  list: organizationProcedure.input(itemFilterSchema).query(async ({ ctx, input }) => {
    // Implementation
  }),

  create: organizationProcedure.input(itemCreateSchema).mutation(async ({ ctx, input }) => {
    // Implementation
  }),
});

// Frontend usage with full type inference
const { data } = trpc.items.list.useQuery({
  search: 'widget',
  page: 1,
});
```

## Router Organization

### Root Router (`AppRouter`)

```typescript
export const appRouter = createTRPCRouter({
  // Core routers
  auth: authRouter,
  health: healthRouter,
  organizations: organizationsRouter,

  // Business logic routers
  items: itemsRouter,
  warehouses: warehousesRouter,
  inventory: inventoryRouter,
  stockMovements: stockMovementsRouter,
  suppliers: suppliersRouter,
  customers: customersRouter,
  orders: ordersRouter,
  purchaseOrders: purchaseOrdersRouter,
  returns: returnsRouter,
  shipments: shipmentsRouter,

  // Analytics routers
  reports: reportsRouter,
  analytics: analyticsRouter,
  categories: categoriesRouter,
});
```

## API Design Patterns

### 1. Input Validation

All inputs use Zod schemas for runtime validation:

```typescript
const itemFilterSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'sku', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
```

### 2. Consistent Response Format

#### List Endpoints

```typescript
{
  items: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
  }
}
```

#### Single Item Endpoints

```typescript
{
  id: string,
  // ... entity fields
  createdAt: Date,
  updatedAt: Date,
}
```

### 3. Error Handling

Using TRPCError with appropriate codes:

```typescript
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Item not found',
});

// Common codes:
// - UNAUTHORIZED: No valid auth
// - FORBIDDEN: No permission
// - NOT_FOUND: Resource missing
// - BAD_REQUEST: Invalid input
// - CONFLICT: Duplicate/conflict
// - INTERNAL_SERVER_ERROR: Unexpected error
```

### 4. Middleware Pattern

#### Authentication Middleware

```typescript
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});
```

#### Organization Context

```typescript
export const organizationProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const organizationId = await extractOrganizationId(ctx);
  return next({
    ctx: {
      ...ctx,
      organizationId,
    },
  });
});
```

## API Conventions

### Naming Conventions

#### Procedures

- `list` - Get paginated list
- `getById` - Get single item
- `create` - Create new item
- `update` - Update existing item
- `delete` - Delete item
- `archive` - Soft delete

#### Custom Actions

- `approve` - Approve workflow
- `cancel` - Cancel operation
- `duplicate` - Copy item
- `export` - Export data
- `import` - Import data

### Query vs Mutation

#### Queries (Read Operations)

- `list`
- `getById`
- `search`
- `getStats`
- `export`

#### Mutations (Write Operations)

- `create`
- `update`
- `delete`
- `archive`
- `approve`
- `import`

## Real-time Subscriptions (Future)

```typescript
// Planned WebSocket support
subscription: organizationProcedure
  .subscription(({ ctx }) => {
    return observable<StockUpdate>((emit) => {
      // Subscribe to stock updates
      const unsubscribe = subscribeToStock(ctx.organizationId, emit);
      return unsubscribe;
    });
  }),
```

## API Security

### Authentication

- JWT tokens in signed httpOnly cookies
- Automatic token refresh
- Session management

### Authorization

- Role-based access control (RBAC)
- Organization-scoped operations
- Row-Level Security at database

### Rate Limiting (Future)

```typescript
const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
```

## API Documentation

### Self-Documenting

tRPC provides automatic type documentation through TypeScript:

- Hover over any procedure for full type info
- IntelliSense shows available procedures
- Type errors catch API misuse at compile time

### OpenAPI Export (Future)

```typescript
import { generateOpenApiDocument } from 'trpc-openapi';

const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'Ventry API',
  version: '1.0.0',
  baseUrl: 'http://localhost:6060',
});
```

## Performance Optimization

### Query Batching

tRPC automatically batches multiple queries in a single HTTP request:

```typescript
// These execute in one request
const [items, warehouses, categories] = await Promise.all([
  trpc.items.list.query(),
  trpc.warehouses.list.query(),
  trpc.categories.list.query(),
]);
```

### Caching Strategy

React Query integration provides:

- Automatic caching
- Background refetching
- Optimistic updates
- Request deduplication

### Database Optimization

- Indexed queries
- Pagination limits
- Field selection (future)
- Query complexity limits

## Testing API Endpoints

### Unit Tests

```typescript
describe('Items Router', () => {
  it('should create item', async () => {
    const caller = appRouter.createCaller(mockContext);
    const item = await caller.items.create({
      name: 'Test Item',
      sku: 'TEST-001',
    });
    expect(item.id).toBeDefined();
  });
});
```

### Integration Tests

```typescript
it('should enforce organization isolation', async () => {
  const caller = appRouter.createCaller(integrationContext);
  const items = await caller.items.list({});
  expect(items.items).toHaveLength(0); // Only org items
});
```

## API Versioning Strategy

### Current Approach

- Single version with backward compatibility
- Deprecation warnings for breaking changes
- Migration guides for updates

### Future Versioning

```typescript
// Potential v2 router structure
export const appRouterV2 = createTRPCRouter({
  v1: appRouterV1, // Legacy support
  v2: {
    // New procedures
  },
});
```

## Related Documentation

- [Authentication](../04-security/authentication.md)
- [Testing Guide](../03-development/testing-guide.md)
- [Performance Optimization](../05-deployment/performance-optimization.md)
