# Ventry Performance Optimization Guide

This comprehensive guide covers all aspects of performance optimization for the Ventry platform, from database queries to frontend rendering.

## Table of Contents

1. [Database Performance](#database-performance)
2. [API Performance](#api-performance)
3. [Frontend Performance](#frontend-performance)
4. [Caching Strategy](#caching-strategy)
5. [Bundle Optimization](#bundle-optimization)
6. [Runtime Performance](#runtime-performance)
7. [Monitoring & Profiling](#monitoring--profiling)
8. [Performance Checklist](#performance-checklist)

---

## Database Performance

### 1.1 Query Optimization

**Use Proper Indexes:**
```sql
-- Critical indexes for multi-tenant queries
CREATE INDEX CONCURRENTLY idx_items_org_sku ON items(organization_id, sku);
CREATE INDEX CONCURRENTLY idx_inventory_org_item ON inventory(organization_id, item_id);
CREATE INDEX CONCURRENTLY idx_orders_org_status ON orders(organization_id, status);
CREATE INDEX CONCURRENTLY idx_order_items_order ON order_items(order_id) INCLUDE (item_id, quantity);

-- Partial indexes for common filters
CREATE INDEX CONCURRENTLY idx_items_active ON items(organization_id) WHERE is_active = true;
CREATE INDEX CONCURRENTLY idx_orders_pending ON orders(organization_id, created_at) WHERE status = 'PENDING';

-- Full-text search indexes
CREATE INDEX CONCURRENTLY idx_items_search ON items USING gin(to_tsvector('english', name || ' ' || description));
```

**Query Optimization Patterns:**
```typescript
// BAD: N+1 query problem
const orders = await prisma.order.findMany();
for (const order of orders) {
  const items = await prisma.orderItem.findMany({
    where: { orderId: order.id }
  });
}

// GOOD: Eager loading with includes
const orders = await prisma.order.findMany({
  include: {
    items: {
      include: {
        item: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
          }
        }
      }
    },
    customer: {
      select: {
        id: true,
        name: true,
        email: true,
      }
    }
  }
});

// BETTER: Optimized select to reduce data transfer
const orders = await prisma.order.findMany({
  select: {
    id: true,
    orderNumber: true,
    totalAmount: true,
    status: true,
    items: {
      select: {
        quantity: true,
        unitPrice: true,
        item: {
          select: {
            name: true,
            sku: true,
          }
        }
      }
    }
  }
});
```

### 1.2 Connection Pooling

**Prisma Connection Configuration:**
```typescript
// packages/database/src/client.ts
import { PrismaClient } from '@prisma/client';

// Parse connection pool settings from DATABASE_URL
const connectionString = process.env.DATABASE_URL!;
const url = new URL(connectionString);

// Add pooling parameters
url.searchParams.set('connection_limit', '25');
url.searchParams.set('pool_timeout', '10');
url.searchParams.set('connect_timeout', '10');
url.searchParams.set('statement_timeout', '30000');

// Create optimized Prisma client
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: url.toString(),
    },
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'warn', 'error']
    : ['error'],
});

// Implement connection lifecycle hooks
prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    logger.warn({
      query: e.query,
      params: e.params,
      duration: e.duration,
    }, 'Slow query detected');
  }
});

// PgBouncer configuration for production
// pgbouncer.ini
/*
[databases]
ventry = host=localhost port=5432 dbname=ventry

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
max_db_connections = 50
server_idle_timeout = 600
*/
```

### 1.3 Query Batching

**Implement DataLoader Pattern:**
```typescript
// apps/backend/src/lib/dataloaders.ts
import DataLoader from 'dataloader';

export function createDataLoaders(prisma: PrismaClient) {
  return {
    // Batch load items by IDs
    itemLoader: new DataLoader<string, Item>(async (ids) => {
      const items = await prisma.item.findMany({
        where: { id: { in: [...ids] } }
      });
      
      const itemMap = new Map(items.map(item => [item.id, item]));
      return ids.map(id => itemMap.get(id) || null);
    }),
    
    // Batch load inventory by item IDs
    inventoryLoader: new DataLoader<string, Inventory[]>(async (itemIds) => {
      const inventories = await prisma.inventory.findMany({
        where: { itemId: { in: [...itemIds] } }
      });
      
      const inventoryMap = new Map<string, Inventory[]>();
      inventories.forEach(inv => {
        if (!inventoryMap.has(inv.itemId)) {
          inventoryMap.set(inv.itemId, []);
        }
        inventoryMap.get(inv.itemId)!.push(inv);
      });
      
      return itemIds.map(id => inventoryMap.get(id) || []);
    }),
  };
}

// Use in tRPC context
export const createContext = async ({ req, res }: CreateContextOptions) => {
  const loaders = createDataLoaders(prisma);
  
  return {
    prisma,
    loaders,
    req,
    res,
  };
};
```

### 1.4 Database Query Patterns

**Aggregation Optimization:**
```typescript
// BAD: Loading all records to count
const items = await prisma.item.findMany({
  where: { organizationId }
});
const activeCount = items.filter(i => i.isActive).length;

// GOOD: Database aggregation
const activeCount = await prisma.item.count({
  where: { 
    organizationId,
    isActive: true 
  }
});

// BETTER: Multiple aggregations in one query
const stats = await prisma.$queryRaw<{
  total: bigint;
  active: bigint;
  lowStock: bigint;
  outOfStock: bigint;
}[]>`
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_active = true) as active,
    COUNT(*) FILTER (WHERE qty_on_hand < reorder_point) as lowStock,
    COUNT(*) FILTER (WHERE qty_on_hand = 0) as outOfStock
  FROM items
  WHERE organization_id = ${organizationId}
`;
```

**Pagination Optimization:**
```typescript
// Implement cursor-based pagination for large datasets
export async function getCursorPaginatedItems(
  organizationId: string,
  cursor?: string,
  limit: number = 50
) {
  const items = await prisma.item.findMany({
    where: { organizationId },
    take: limit + 1, // Fetch one extra to check if there's next page
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor
    }),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      qtyOnHand: true,
    },
  });
  
  const hasNextPage = items.length > limit;
  const edges = hasNextPage ? items.slice(0, -1) : items;
  
  return {
    edges,
    pageInfo: {
      hasNextPage,
      endCursor: edges[edges.length - 1]?.id,
    },
  };
}
```

---

## API Performance

### 2.1 Response Optimization

**Implement Field Selection:**
```typescript
// apps/backend/src/routers/items.ts
const itemsRouter = createTRPCRouter({
  list: organizationProcedure
    .input(z.object({
      fields: z.array(z.string()).optional(),
      filters: z.object({
        search: z.string().optional(),
        categoryId: z.string().optional(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Build dynamic select object
      const select = input.fields?.reduce((acc, field) => ({
        ...acc,
        [field]: true,
      }), { id: true }) || undefined;
      
      return ctx.prisma.item.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input.filters?.search && {
            OR: [
              { name: { contains: input.filters.search, mode: 'insensitive' } },
              { sku: { contains: input.filters.search, mode: 'insensitive' } },
            ],
          }),
          ...(input.filters?.categoryId && {
            categoryId: input.filters.categoryId,
          }),
        },
        select,
      });
    }),
});
```

**Response Compression:**
```typescript
// apps/backend/src/server.ts
import compress from '@fastify/compress';

await server.register(compress, {
  global: true,
  threshold: 1024, // Only compress responses larger than 1KB
  encodings: ['gzip', 'deflate', 'br'],
  // Compress specific content types
  customTypes: /^text\/|^application\/json/,
  // Brotli settings for better compression
  brotliOptions: {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
    },
  },
});
```

### 2.2 Request Batching

**Implement tRPC Batching:**
```typescript
// apps/web/src/lib/trpc.ts
export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    // Enable batching
    httpBatchLink({
      url: '/api/trpc',
      maxBatchSize: 10, // Maximum number of requests to batch
      maxURLLength: 2083, // Maximum URL length
      headers() {
        return {
          authorization: getAuthToken(),
          'x-organization-id': getOrganizationId(),
        };
      },
    }),
  ],
});

// Queries will be automatically batched
// These three queries will be sent in a single HTTP request
const [items, warehouses, categories] = await Promise.all([
  trpc.items.list.useQuery(),
  trpc.warehouses.list.useQuery(),
  trpc.categories.list.useQuery(),
]);
```

### 2.3 API Caching

**Implement HTTP Caching:**
```typescript
// apps/backend/src/middleware/cache.ts
export const cacheMiddleware = (options: {
  ttl: number;
  varyBy?: string[];
}) => {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Set cache headers
    reply.header('Cache-Control', `public, max-age=${options.ttl}`);
    
    // Add ETag support
    reply.header('ETag', `"${generateETag(req, options.varyBy)}"');
    
    // Check If-None-Match
    const clientETag = req.headers['if-none-match'];
    if (clientETag === reply.getHeader('ETag')) {
      return reply.status(304).send();
    }
  };
};

// Apply to specific routes
server.get('/api/items', {
  preHandler: cacheMiddleware({ ttl: 300, varyBy: ['organization-id'] }),
}, async (request, reply) => {
  // Handler implementation
});
```

### 2.4 Rate Limiting Optimization

**Implement Tiered Rate Limiting:**
```typescript
// apps/backend/src/middleware/rateLimiter.ts
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';

// Use Redis for distributed rate limiting
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 1 minute
  
  // Use insurance limiter for Redis failures
  insuranceLimiter: new RateLimiterMemory({
    points: 50,
    duration: 60,
  }),
});

// Implement sliding window algorithm
export const slidingWindowRateLimiter = async (
  key: string,
  limit: number,
  window: number
) => {
  const now = Date.now();
  const windowStart = now - window * 1000;
  
  // Remove old entries
  await redisClient.zremrangebyscore(key, '-inf', windowStart);
  
  // Count requests in window
  const count = await redisClient.zcard(key);
  
  if (count >= limit) {
    throw new Error('Rate limit exceeded');
  }
  
  // Add current request
  await redisClient.zadd(key, now, `${now}-${Math.random()}`);
  await redisClient.expire(key, window);
  
  return {
    remaining: limit - count - 1,
    reset: new Date(now + window * 1000),
  };
};
```

---

## Frontend Performance

### 3.1 Code Splitting

**Implement Route-Based Splitting:**
```typescript
// apps/web/src/app/layout.tsx
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Lazy load heavy components
const InventoryManager = dynamic(
  () => import('@/components/inventory/inventory-manager'),
  {
    loading: () => <InventoryManagerSkeleton />,
    ssr: false, // Disable SSR for client-only components
  }
);

const AnalyticsDashboard = dynamic(
  () => import('@/components/analytics/dashboard').then(mod => mod.Dashboard),
  {
    loading: () => <DashboardSkeleton />,
  }
);

// Use Suspense for data fetching
export default function InventoryPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <InventoryManager />
    </Suspense>
  );
}
```

**Component-Level Splitting:**
```typescript
// Split heavy dependencies
const Chart = dynamic(() => import('recharts').then(mod => mod.LineChart), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 animate-pulse" />,
});

const PDFViewer = dynamic(() => import('@/components/pdf-viewer'), {
  ssr: false,
});

const ExcelExporter = dynamic(() => import('@/components/excel-exporter'), {
  ssr: false,
});
```

### 3.2 React Optimization

**Memoization Strategies:**
```typescript
// apps/web/src/components/item-list.tsx
import { memo, useMemo, useCallback } from 'react';

// Memoize expensive computations
export const ItemList = memo(({ items, filters }: ItemListProps) => {
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          item.name.toLowerCase().includes(searchLower) ||
          item.sku.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [items, filters.search]);
  
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'sku':
          return a.sku.localeCompare(b.sku);
        case 'price':
          return a.price - b.price;
        default:
          return 0;
      }
    });
  }, [filteredItems, filters.sortBy]);
  
  // Memoize callbacks
  const handleItemClick = useCallback((itemId: string) => {
    router.push(`/inventory/items/${itemId}`);
  }, [router]);
  
  return (
    <VirtualList
      items={sortedItems}
      renderItem={(item) => (
        <ItemCard
          key={item.id}
          item={item}
          onClick={handleItemClick}
        />
      )}
    />
  );
});

// Optimize re-renders with proper memo comparison
export const ItemCard = memo(
  ({ item, onClick }: ItemCardProps) => {
    return (
      <div onClick={() => onClick(item.id)}>
        {/* Card content */}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for better performance
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.name === nextProps.item.name &&
      prevProps.item.qtyOnHand === nextProps.item.qtyOnHand
    );
  }
);
```

### 3.3 Virtual Scrolling

**Implement Virtual Lists:**
```typescript
// apps/web/src/components/virtual-list.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight = 80,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5, // Render 5 items outside visible area
  });
  
  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3.4 Image Optimization

**Next.js Image Component:**
```typescript
// apps/web/src/components/product-image.tsx
import Image from 'next/image';

export function ProductImage({ 
  src, 
  alt, 
  priority = false 
}: ProductImageProps) {
  return (
    <div className="relative aspect-square">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        priority={priority}
        placeholder="blur"
        blurDataURL={generateBlurDataURL()}
        className="object-cover"
        onError={(e) => {
          e.currentTarget.src = '/images/product-placeholder.png';
        }}
      />
    </div>
  );
}

// Generate blur placeholder
function generateBlurDataURL(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  const ctx = canvas.getContext('2d');
  ctx!.fillStyle = '#f3f4f6';
  ctx!.fillRect(0, 0, 10, 10);
  return canvas.toDataURL();
}
```

---

## Caching Strategy

### 4.1 Redis Caching

**Implement Multi-Layer Caching:**
```typescript
// apps/backend/src/lib/cache.ts
import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';

// In-memory cache for hot data
const memoryCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 60 * 1000, // 1 minute
});

// Redis cache for distributed caching
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  keyPrefix: 'ventry:cache:',
});

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memResult = memoryCache.get(key);
    if (memResult) {
      return memResult as T;
    }
    
    // Check Redis
    const redisResult = await redis.get(key);
    if (redisResult) {
      const parsed = JSON.parse(redisResult);
      // Populate memory cache
      memoryCache.set(key, parsed);
      return parsed as T;
    }
    
    return null;
  }
  
  async set<T>(
    key: string, 
    value: T, 
    ttl: number = 300
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    
    // Set in both caches
    memoryCache.set(key, value);
    await redis.setex(key, ttl, serialized);
  }
  
  async invalidate(pattern: string): Promise<void> {
    // Clear memory cache
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern)) {
        memoryCache.delete(key);
      }
    }
    
    // Clear Redis cache
    const keys = await redis.keys(`ventry:cache:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
  
  // Cache decorator
  cached(ttl: number = 300) {
    return (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function(...args: any[]) {
        const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;
        
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
        
        const result = await originalMethod.apply(this, args);
        await this.cache.set(cacheKey, result, ttl);
        
        return result;
      };
    };
  }
}
```

### 4.2 Query Result Caching

**tRPC Query Caching:**
```typescript
// apps/backend/src/routers/inventory.ts
export const inventoryRouter = createTRPCRouter({
  getStockLevels: organizationProcedure
    .input(z.object({
      warehouseId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const cacheKey = `stock:${ctx.organizationId}:${input.warehouseId || 'all'}`;
      
      // Check cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Complex aggregation query
      const stockLevels = await ctx.prisma.$queryRaw`
        SELECT 
          i.id,
          i.name,
          i.sku,
          COALESCE(SUM(inv.qty_on_hand), 0) as total_qty,
          COALESCE(SUM(inv.qty_reserved), 0) as reserved_qty,
          COALESCE(SUM(inv.qty_available), 0) as available_qty,
          COUNT(DISTINCT inv.warehouse_id) as warehouse_count
        FROM items i
        LEFT JOIN inventory inv ON i.id = inv.item_id
        WHERE i.organization_id = ${ctx.organizationId}
        ${input.warehouseId ? `AND inv.warehouse_id = ${input.warehouseId}` : ''}
        GROUP BY i.id, i.name, i.sku
        ORDER BY i.name
      `;
      
      // Cache for 5 minutes
      await cache.set(cacheKey, stockLevels, 300);
      
      return stockLevels;
    }),
});
```

### 4.3 Frontend Caching

**React Query Cache Configuration:**
```typescript
// apps/web/src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: (failureCount, error) => {
        if (error instanceof TRPCError) {
          if (error.code === 'UNAUTHORIZED') return false;
          if (error.code === 'NOT_FOUND') return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      onError: (error) => {
        toast.error(error.message);
      },
    },
  },
});

// Implement optimistic updates
export function useOptimisticUpdate() {
  const utils = trpc.useContext();
  
  return {
    updateItem: (itemId: string, updates: Partial<Item>) => {
      // Optimistically update cache
      utils.items.getById.setData({ id: itemId }, (old) => {
        if (!old) return old;
        return { ...old, ...updates };
      });
      
      // Also update in list
      utils.items.list.setData({}, (old) => {
        if (!old) return old;
        return old.map(item => 
          item.id === itemId ? { ...item, ...updates } : item
        );
      });
    },
  };
}
```

---

## Bundle Optimization

### 5.1 Webpack Configuration

**Next.js Config Optimization:**
```javascript
// apps/web/next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  reactStrictMode: true,
  swcMinify: true,
  
  // Optimize builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Module federation for micro-frontends
  webpack: (config, { isServer }) => {
    // Tree shake unused lodash methods
    config.resolve.alias = {
      ...config.resolve.alias,
      'lodash': 'lodash-es',
    };
    
    // Optimize moment.js
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      })
    );
    
    // Split chunks optimization
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          lib: {
            test(module) {
              return module.size() > 160000 &&
                /node_modules[/\\]/.test(module.identifier());
            },
            name(module) {
              const hash = crypto.createHash('sha1');
              hash.update(module.identifier());
              return hash.digest('hex').substring(0, 8);
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
            priority: 20,
          },
          shared: {
            name(module, chunks) {
              return crypto
                .createHash('sha1')
                .update(chunks.reduce((acc, chunk) => acc + chunk.name, ''))
                .digest('hex');
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      };
    }
    
    return config;
  },
  
  // Experimental features
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
});
```

### 5.2 Tree Shaking

**Optimize Imports:**
```typescript
// BAD: Imports entire library
import _ from 'lodash';
import * as Icons from 'lucide-react';

// GOOD: Import only what's needed
import debounce from 'lodash/debounce';
import { Search, Filter, Download } from 'lucide-react';

// Use barrel exports carefully
// packages/shared/src/index.ts
export { formatCurrency } from './utils/currency';
export { formatDate } from './utils/date';
// Don't export large objects or classes unless needed

// Enable side effects configuration
// package.json
{
  "sideEffects": false,
  "sideEffects": ["*.css", "*.scss"]
}
```

### 5.3 Asset Optimization

**Image and Font Optimization:**
```typescript
// apps/web/src/app/layout.tsx
import { Inter } from 'next/font/google';

// Optimize font loading
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  adjustFontFallback: true,
});

// Preload critical assets
export const metadata = {
  // ...
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
};

// Optimize images
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://cdn.ventry.com" />
        <link rel="dns-prefetch" href="https://api.ventry.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## Runtime Performance

### 6.1 Worker Threads

**CPU-Intensive Operations:**
```typescript
// apps/backend/src/workers/report-generator.ts
import { Worker } from 'worker_threads';
import { cpus } from 'os';

export class ReportGeneratorPool {
  private workers: Worker[] = [];
  private queue: Array<{
    data: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  
  constructor(private poolSize: number = cpus().length) {
    this.initializeWorkers();
  }
  
  private initializeWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker('./report-worker.js');
      
      worker.on('message', ({ id, result, error }) => {
        const task = this.queue.find(t => t.data.id === id);
        if (task) {
          if (error) {
            task.reject(error);
          } else {
            task.resolve(result);
          }
          this.queue = this.queue.filter(t => t.data.id !== id);
        }
        
        // Process next task
        this.processNext(worker);
      });
      
      this.workers.push(worker);
    }
  }
  
  async generateReport(reportData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const task = {
        data: { ...reportData, id: Math.random() },
        resolve,
        reject,
      };
      
      this.queue.push(task);
      
      // Find available worker
      const availableWorker = this.workers.find(w => !w.threadId);
      if (availableWorker) {
        this.processNext(availableWorker);
      }
    });
  }
  
  private processNext(worker: Worker) {
    const task = this.queue.shift();
    if (task) {
      worker.postMessage(task.data);
    }
  }
}

// report-worker.js
const { parentPort } = require('worker_threads');

parentPort.on('message', async (data) => {
  try {
    // Heavy computation here
    const result = await generateReport(data);
    parentPort.postMessage({ id: data.id, result });
  } catch (error) {
    parentPort.postMessage({ id: data.id, error: error.message });
  }
});
```

### 6.2 Memory Management

**Prevent Memory Leaks:**
```typescript
// apps/backend/src/lib/memory-monitor.ts
import v8 from 'v8';
import { performance } from 'perf_hooks';

export class MemoryMonitor {
  private interval: NodeJS.Timeout;
  private baseline: number;
  
  start() {
    this.baseline = process.memoryUsage().heapUsed;
    
    this.interval = setInterval(() => {
      const heap = v8.getHeapStatistics();
      const usage = process.memoryUsage();
      
      // Log metrics
      logger.info({
        memory: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          external: usage.external,
          heapLimit: heap.heap_size_limit,
          mallocedMemory: heap.malloced_memory,
          peakMallocedMemory: heap.peak_malloced_memory,
        },
      }, 'Memory statistics');
      
      // Check for memory leaks
      if (usage.heapUsed > this.baseline * 2) {
        logger.warn('Potential memory leak detected');
        
        // Take heap snapshot
        if (process.env.NODE_ENV === 'development') {
          const snapshot = v8.writeHeapSnapshot();
          logger.info(`Heap snapshot written to ${snapshot}`);
        }
      }
    }, 60000); // Every minute
  }
  
  stop() {
    clearInterval(this.interval);
  }
}

// Implement cleanup in services
export class InventoryService {
  private subscriptions: Set<Subscription> = new Set();
  
  async subscribeToUpdates(callback: Function) {
    const subscription = redis.subscribe('inventory:updates', callback);
    this.subscriptions.add(subscription);
    
    return () => {
      subscription.unsubscribe();
      this.subscriptions.delete(subscription);
    };
  }
  
  // Clean up on service destruction
  destroy() {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
  }
}
```

### 6.3 Event Loop Optimization

**Prevent Blocking:**
```typescript
// apps/backend/src/lib/async-iterator.ts
export async function* batchProcess<T>(
  items: T[],
  batchSize: number,
  processFn: (item: T) => Promise<void>
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch in parallel
    await Promise.all(batch.map(item => processFn(item)));
    
    // Yield control back to event loop
    await new Promise(resolve => setImmediate(resolve));
    
    yield {
      processed: Math.min(i + batchSize, items.length),
      total: items.length,
      percentage: Math.round((Math.min(i + batchSize, items.length) / items.length) * 100),
    };
  }
}

// Use in large operations
export async function processLargeDataset(items: any[]) {
  const processor = batchProcess(items, 100, async (item) => {
    // Process item
    await updateInventory(item);
  });
  
  for await (const progress of processor) {
    logger.info(`Processing: ${progress.percentage}%`);
    
    // Update progress in Redis for UI
    await redis.set(
      'import:progress',
      JSON.stringify(progress),
      'EX',
      300
    );
  }
}
```

---

## Monitoring & Profiling

### 7.1 Performance Monitoring

**Application Performance Monitoring:**
```typescript
// apps/backend/src/lib/apm.ts
import { performance, PerformanceObserver } from 'perf_hooks';

export class PerformanceMonitor {
  private observer: PerformanceObserver;
  
  constructor() {
    this.observer = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        if (entry.duration > 100) {
          logger.warn({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
          }, 'Slow operation detected');
        }
        
        // Send to monitoring service
        metrics.recordHistogram('operation.duration', entry.duration, {
          operation: entry.name,
        });
      });
    });
    
    this.observer.observe({ entryTypes: ['measure'] });
  }
  
  measure<T>(name: string, fn: () => T): T {
    const start = `${name}-start-${Date.now()}`;
    const end = `${name}-end-${Date.now()}`;
    
    performance.mark(start);
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          performance.mark(end);
          performance.measure(name, start, end);
        }) as any;
      }
      
      performance.mark(end);
      performance.measure(name, start, end);
      return result;
    } catch (error) {
      performance.mark(end);
      performance.measure(name, start, end);
      throw error;
    }
  }
}

// Use in routes
const perfMonitor = new PerformanceMonitor();

export const inventoryRouter = createTRPCRouter({
  heavyOperation: organizationProcedure
    .mutation(async ({ ctx }) => {
      return perfMonitor.measure('inventory.heavyOperation', async () => {
        // Heavy operation
        const result = await processInventory();
        return result;
      });
    }),
});
```

### 7.2 Database Query Analysis

**Query Performance Tracking:**
```typescript
// apps/backend/src/lib/database/performance.ts
export const performanceExtension = Prisma.defineExtension({
  name: 'performance-tracking',
  query: {
    async $allOperations({ operation, model, args, query }) {
      const start = performance.now();
      
      try {
        const result = await query(args);
        const duration = performance.now() - start;
        
        // Track slow queries
        if (duration > 100) {
          const queryInfo = {
            operation,
            model,
            duration,
            args: JSON.stringify(args).substring(0, 200),
          };
          
          logger.warn(queryInfo, 'Slow query detected');
          
          // Store for analysis
          await redis.zadd(
            'slow-queries',
            Date.now(),
            JSON.stringify(queryInfo)
          );
        }
        
        // Record metrics
        metrics.recordHistogram('db.query.duration', duration, {
          operation,
          model,
        });
        
        return result;
      } catch (error) {
        metrics.increment('db.query.error', {
          operation,
          model,
          error: error.message,
        });
        throw error;
      }
    },
  },
});

// Apply to Prisma client
export const prisma = new PrismaClient().$extends(performanceExtension);
```

### 7.3 Frontend Performance Tracking

**Web Vitals Monitoring:**
```typescript
// apps/web/src/lib/performance.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function initializePerformanceMonitoring() {
  // Track Core Web Vitals
  getCLS((metric) => sendToAnalytics('CLS', metric));
  getFID((metric) => sendToAnalytics('FID', metric));
  getFCP((metric) => sendToAnalytics('FCP', metric));
  getLCP((metric) => sendToAnalytics('LCP', metric));
  getTTFB((metric) => sendToAnalytics('TTFB', metric));
  
  // Track custom metrics
  if ('PerformanceObserver' in window) {
    // Track long tasks
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Long task detected
        sendToAnalytics('long-task', {
          duration: entry.duration,
          startTime: entry.startTime,
          name: entry.name,
        });
      }
    });
    
    observer.observe({ entryTypes: ['longtask'] });
    
    // Track resource loading
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 1000) {
          sendToAnalytics('slow-resource', {
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize,
          });
        }
      }
    });
    
    resourceObserver.observe({ entryTypes: ['resource'] });
  }
}

function sendToAnalytics(metricName: string, data: any) {
  // Send to analytics service
  if (window.gtag) {
    window.gtag('event', metricName, {
      value: Math.round(data.value || data.duration),
      metric_id: data.id,
      metric_value: data.value || data.duration,
      metric_delta: data.delta,
    });
  }
  
  // Send to custom monitoring
  fetch('/api/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metric: metricName,
      value: data.value || data.duration,
      metadata: data,
      timestamp: Date.now(),
    }),
  });
}
```

---

## Performance Checklist

### Pre-Deployment Checklist

#### Database Performance
- [ ] All foreign keys have indexes
- [ ] Common query patterns have composite indexes
- [ ] Slow queries identified and optimized
- [ ] Connection pooling configured
- [ ] Query timeout settings configured
- [ ] Database statistics updated (`ANALYZE` run)

#### API Performance
- [ ] Response compression enabled
- [ ] Rate limiting configured
- [ ] API response caching implemented
- [ ] Field selection/filtering available
- [ ] Pagination implemented for all list endpoints
- [ ] Request batching enabled

#### Frontend Performance
- [ ] Code splitting implemented
- [ ] Dynamic imports for heavy components
- [ ] Images optimized and lazy loaded
- [ ] Fonts preloaded and optimized
- [ ] Critical CSS inlined
- [ ] JavaScript minified and compressed

#### Caching Strategy
- [ ] Redis configured and tested
- [ ] Cache invalidation strategy defined
- [ ] HTTP caching headers configured
- [ ] Static assets cached with long TTL
- [ ] API responses cached appropriately

#### Monitoring
- [ ] APM tool configured (Sentry/DataDog)
- [ ] Custom metrics tracking implemented
- [ ] Performance budgets defined
- [ ] Alerting thresholds configured
- [ ] Real user monitoring (RUM) enabled

### Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Time to First Byte (TTFB) | <200ms | <500ms |
| First Contentful Paint (FCP) | <1s | <2s |
| Largest Contentful Paint (LCP) | <2.5s | <4s |
| First Input Delay (FID) | <100ms | <300ms |
| Cumulative Layout Shift (CLS) | <0.1 | <0.25 |
| API Response Time (p95) | <200ms | <500ms |
| Database Query Time (p95) | <50ms | <100ms |
| JavaScript Bundle Size | <200KB | <500KB |
| Page Load Time | <3s | <5s |
| Memory Usage | <512MB | <1GB |

---

This performance optimization guide should be reviewed and updated regularly as the application grows and new performance challenges arise.