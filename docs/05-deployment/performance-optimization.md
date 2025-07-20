# Performance Optimization Guide

This guide covers comprehensive performance optimization strategies for Ventry, from database queries to frontend rendering.

## Performance Goals

### Target Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| First Contentful Paint (FCP) | < 1.8s | < 3s |
| Largest Contentful Paint (LCP) | < 2.5s | < 4s |
| Time to Interactive (TTI) | < 3.8s | < 7.3s |
| API Response Time (p95) | < 200ms | < 500ms |
| Database Query Time (p95) | < 50ms | < 100ms |
| Memory Usage | < 512MB | < 1GB |

## Database Optimization

### 1. Query Optimization

#### Use Proper Indexes

```sql
-- Analyze slow queries
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM items 
WHERE organization_id = 'xxx' 
  AND status = 'ACTIVE'
ORDER BY created_at DESC;

-- Create composite indexes for common queries
CREATE INDEX idx_items_org_status_created 
ON items(organization_id, status, created_at DESC);

-- Partial indexes for filtered queries
CREATE INDEX idx_active_items 
ON items(organization_id, created_at DESC) 
WHERE status = 'ACTIVE';

-- Covering indexes to avoid table lookups
CREATE INDEX idx_items_covering 
ON items(organization_id, id, name, sku, status)
INCLUDE (qty_on_hand, price);
```

#### Optimize Prisma Queries

```typescript
// ❌ Bad: N+1 query problem
const orders = await prisma.order.findMany();
for (const order of orders) {
  const items = await prisma.orderItem.findMany({
    where: { orderId: order.id }
  });
}

// ✅ Good: Eager loading with include
const orders = await prisma.order.findMany({
  include: {
    orderItems: {
      include: {
        item: true
      }
    }
  }
});

// ✅ Better: Select only needed fields
const orders = await prisma.order.findMany({
  select: {
    id: true,
    orderNumber: true,
    totalAmount: true,
    orderItems: {
      select: {
        quantity: true,
        price: true,
        item: {
          select: {
            name: true,
            sku: true
          }
        }
      }
    }
  }
});
```

#### Batch Operations

```typescript
// ❌ Bad: Individual inserts
for (const item of items) {
  await prisma.item.create({ data: item });
}

// ✅ Good: Batch insert
await prisma.item.createMany({
  data: items,
  skipDuplicates: true
});

// ✅ Good: Batch update with transaction
await prisma.$transaction(
  items.map(item => 
    prisma.item.update({
      where: { id: item.id },
      data: { quantity: item.quantity }
    })
  )
);
```

### 2. Connection Pooling

```typescript
// prisma/client.ts
import { PrismaClient } from '@prisma/client';

// Configure connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

// Connection pool configuration in DATABASE_URL
// postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30
```

### 3. Database Maintenance

```sql
-- Regular maintenance tasks
-- Run weekly during low traffic

-- Update statistics
ANALYZE;

-- Rebuild indexes
REINDEX DATABASE ventry;

-- Vacuum to reclaim space
VACUUM ANALYZE;

-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pg_toast%'
ORDER BY schemaname, tablename;

-- Monitor table bloat
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS external_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

## API Optimization

### 1. Response Caching

```typescript
// Redis caching for expensive operations
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export const cachedProcedure = t.procedure.use(async ({ ctx, next, path }) => {
  const cacheKey = `api:${path}:${JSON.stringify(ctx.input)}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Execute procedure
  const result = await next();
  
  // Cache result (5 minutes for lists, 1 hour for details)
  const ttl = path.includes('list') ? 300 : 3600;
  await redis.setex(cacheKey, ttl, JSON.stringify(result));
  
  return result;
});

// Invalidate cache on mutations
export const invalidateCache = async (patterns: string[]) => {
  for (const pattern of patterns) {
    const keys = await redis.keys(`api:${pattern}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
};
```

### 2. Pagination

```typescript
// Cursor-based pagination for large datasets
export const paginatedList = organizationProcedure
  .input(z.object({
    cursor: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
  }))
  .query(async ({ ctx, input }) => {
    const items = await ctx.prisma.item.findMany({
      where: { organizationId: ctx.organizationId },
      take: input.limit + 1, // Fetch one extra
      cursor: input.cursor ? { id: input.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    
    let nextCursor: string | undefined = undefined;
    if (items.length > input.limit) {
      const nextItem = items.pop();
      nextCursor = nextItem!.id;
    }
    
    return {
      items,
      nextCursor,
    };
  });
```

### 3. Field Selection

```typescript
// Allow clients to specify fields
export const selectableFields = organizationProcedure
  .input(z.object({
    id: z.string(),
    fields: z.array(z.enum(['id', 'name', 'sku', 'price', 'inventory'])),
  }))
  .query(async ({ ctx, input }) => {
    // Build select object dynamically
    const select = input.fields.reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {} as any);
    
    return ctx.prisma.item.findUnique({
      where: { id: input.id },
      select,
    });
  });
```

## Frontend Optimization

### 1. Code Splitting

```typescript
// Dynamic imports for route-based splitting
const InventoryPage = dynamic(() => import('./inventory/page'), {
  loading: () => <LoadingSpinner />,
  ssr: false, // Disable SSR for heavy client components
});

// Component-level splitting
const HeavyChart = dynamic(() => import('@/components/charts/heavy-chart'), {
  loading: () => <Skeleton className="h-64" />,
  ssr: false,
});
```

### 2. Image Optimization

```typescript
// Use Next.js Image component
import Image from 'next/image';

export function ProductImage({ src, alt, priority = false }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={400}
      height={300}
      quality={85}
      placeholder="blur"
      blurDataURL={generateBlurDataURL()}
      priority={priority} // Only for above-fold images
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      loading={priority ? undefined : "lazy"}
    />
  );
}

// Optimize with sharp
export async function generateBlurDataURL(src: string): Promise<string> {
  const buffer = await sharp(src)
    .resize(10, 10)
    .blur()
    .toBuffer();
  
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}
```

### 3. Bundle Optimization

```javascript
// next.config.js
module.exports = {
  // Enable SWC minifier
  swcMinify: true,
  
  // Optimize webpack
  webpack: (config, { dev, isServer }) => {
    // Tree shake lodash
    config.resolve.alias = {
      ...config.resolve.alias,
      'lodash': 'lodash-es',
    };
    
    // Minimize bundle
    if (!dev && !isServer) {
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
};
```

### 4. React Optimization

```typescript
// Memoize expensive computations
const ExpensiveComponent = memo(({ data, filters }) => {
  const processedData = useMemo(() => {
    return data
      .filter(item => applyFilters(item, filters))
      .sort((a, b) => b.value - a.value)
      .slice(0, 100);
  }, [data, filters]);
  
  return <DataGrid data={processedData} />;
});

// Optimize re-renders with useCallback
const ParentComponent = () => {
  const [search, setSearch] = useState('');
  
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);
  
  return <SearchInput onSearch={handleSearch} />;
};

// Virtual scrolling for large lists
import { VirtualList } from '@tanstack/react-virtual';

const LargeList = ({ items }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} className="h-96 overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
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
            <ItemRow item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Caching Strategy

### 1. Browser Caching

```typescript
// Cache static assets
export async function GET() {
  return new Response(data, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': generateETag(data),
    },
  });
}

// Cache API responses
export async function GET(request: Request) {
  const etag = request.headers.get('If-None-Match');
  const data = await fetchData();
  const newEtag = generateETag(data);
  
  if (etag === newEtag) {
    return new Response(null, { status: 304 });
  }
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      'ETag': newEtag,
    },
  });
}
```

### 2. Service Worker Caching

```javascript
// public/sw.js
const CACHE_NAME = 'ventry-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/script.js',
  '/offline.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});
```

### 3. CDN Configuration

```nginx
# Cloudflare Page Rules
# Cache Everything for static assets
/*.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ 
  Cache Level: Cache Everything
  Edge Cache TTL: 1 month

# Cache API responses with short TTL
/api/* 
  Cache Level: Standard
  Edge Cache TTL: 5 minutes
  
# Bypass cache for auth endpoints
/api/auth/* 
  Cache Level: Bypass
```

## Monitoring Performance

### 1. Real User Monitoring (RUM)

```typescript
// Track Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    label: metric.label,
  });
  
  // Use sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', body);
  } else {
    fetch('/api/analytics', { body, method: 'POST', keepalive: true });
  }
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### 2. Application Performance Monitoring (APM)

```typescript
// Instrument API calls
import { performance } from 'perf_hooks';

export function measurePerformance(name: string) {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      
      // Send to monitoring service
      metrics.histogram('api.request.duration', duration, {
        tags: { endpoint: name },
      });
      
      // Log slow requests
      if (duration > 1000) {
        logger.warn(`Slow API call: ${name} took ${duration}ms`);
      }
    },
  };
}

// Usage in tRPC procedures
.query(async ({ ctx, input }) => {
  const perf = measurePerformance('items.list');
  
  try {
    const result = await ctx.prisma.item.findMany({...});
    return result;
  } finally {
    perf.end();
  }
});
```

### 3. Database Query Monitoring

```sql
-- Enable query logging for slow queries
ALTER SYSTEM SET log_min_duration_statement = 100; -- Log queries over 100ms

-- Monitor query performance
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_time DESC
LIMIT 20;

-- Find missing indexes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  most_common_vals
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND n_distinct > 100
  AND attname NOT IN (
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  );
```

## Load Testing

### k6 Load Test Script

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 20 },    // Stay at 20 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  // Login
  const loginRes = http.post('https://api.ventry.app/auth/login', {
    email: 'test@example.com',
    password: 'password',
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });
  
  const authToken = loginRes.json('token');
  const params = {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  };
  
  // Test endpoints
  const endpoints = [
    '/api/items',
    '/api/orders',
    '/api/inventory/stats',
    '/api/warehouses',
  ];
  
  endpoints.forEach(endpoint => {
    const res = http.get(`https://api.ventry.app${endpoint}`, params);
    
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    sleep(1);
  });
}
```

## Performance Checklist

### Before Deployment

- [ ] Database indexes created and analyzed
- [ ] Queries optimized (no N+1 problems)
- [ ] API responses cached appropriately
- [ ] Images optimized and lazy loaded
- [ ] JavaScript bundle size < 200KB (gzipped)
- [ ] CSS bundle size < 50KB (gzipped)
- [ ] Service worker implemented
- [ ] CDN configured for static assets

### Monitoring Setup

- [ ] Web Vitals tracking enabled
- [ ] APM configured for API monitoring
- [ ] Database query monitoring active
- [ ] Error tracking integrated
- [ ] Performance budgets defined
- [ ] Alerts configured for degradation

### Regular Maintenance

- [ ] Weekly: Analyze slow queries
- [ ] Monthly: Review bundle size
- [ ] Monthly: Update dependencies
- [ ] Quarterly: Load testing
- [ ] Quarterly: Performance audit

Remember: Performance is a feature. Measure, optimize, and monitor continuously!