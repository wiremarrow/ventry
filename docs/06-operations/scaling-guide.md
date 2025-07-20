# Scaling Guide

This guide covers strategies for scaling Ventry both horizontally and vertically to handle increased load and growth.

## Scaling Overview

```
┌─────────────────────────────────────────────────┐
│              Load Balancer                       │
│            (HAProxy/ALB/Nginx)                  │
└────────────────┬────────────────────────────────┘
                 │
         ┌───────┴────────┬──────────────┐
         │                │              │
┌────────▼──────┐ ┌───────▼──────┐ ┌────▼────────┐
│   Frontend    │ │   Frontend   │ │  Frontend   │
│   (Vercel)    │ │   (Vercel)  │ │  (Vercel)   │
└───────────────┘ └──────────────┘ └─────────────┘
                 │
         ┌───────┴────────┬──────────────┐
         │                │              │
┌────────▼──────┐ ┌───────▼──────┐ ┌────▼────────┐
│   API Node 1  │ │  API Node 2  │ │ API Node 3  │
│  (Container)  │ │ (Container)  │ │(Container)  │
└───────┬───────┘ └──────┬───────┘ └────┬────────┘
        │                 │              │
        └─────────────────┴──────────────┘
                         │
                ┌────────▼────────┐
                │   PostgreSQL    │
                │  (Primary +     │
                │  Read Replicas) │
                └─────────────────┘
```

## Horizontal Scaling

### 1. Application Layer Scaling

#### Kubernetes Auto-Scaling

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ventry-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ventry-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
```

#### Container Orchestration

```typescript
// src/scaling/orchestrator.ts
export class ScalingOrchestrator {
  private readonly thresholds = {
    cpu: 80,
    memory: 85,
    responseTime: 1000, // ms
    errorRate: 5, // percent
  };
  
  async evaluateScaling() {
    const metrics = await this.collectMetrics();
    const decision = this.makeScalingDecision(metrics);
    
    if (decision.action !== 'none') {
      await this.executeScaling(decision);
    }
    
    return decision;
  }
  
  private makeScalingDecision(metrics: Metrics): ScalingDecision {
    // Check if we need to scale up
    if (
      metrics.cpu > this.thresholds.cpu ||
      metrics.memory > this.thresholds.memory ||
      metrics.responseTime > this.thresholds.responseTime ||
      metrics.errorRate > this.thresholds.errorRate
    ) {
      return {
        action: 'scale_up',
        reason: this.getScaleUpReason(metrics),
        targetReplicas: Math.min(
          metrics.currentReplicas * 2,
          this.maxReplicas
        ),
      };
    }
    
    // Check if we can scale down
    if (
      metrics.cpu < this.thresholds.cpu * 0.3 &&
      metrics.memory < this.thresholds.memory * 0.3 &&
      metrics.responseTime < this.thresholds.responseTime * 0.3 &&
      metrics.errorRate < 1
    ) {
      return {
        action: 'scale_down',
        reason: 'Low resource utilization',
        targetReplicas: Math.max(
          Math.floor(metrics.currentReplicas * 0.7),
          this.minReplicas
        ),
      };
    }
    
    return { action: 'none' };
  }
}
```

### 2. Database Scaling

#### Read Replica Configuration

```sql
-- Create read replica for reporting
CREATE DATABASE ventry_replica WITH TEMPLATE ventry;

-- Configure streaming replication
-- On primary:
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_senders = 10;
ALTER SYSTEM SET wal_keep_segments = 64;
ALTER SYSTEM SET hot_standby = on;

-- On replica:
-- recovery.conf
standby_mode = 'on'
primary_conninfo = 'host=primary.db.ventry.internal port=5432 user=replicator'
trigger_file = '/tmp/postgresql.trigger.5432'
```

#### Connection Routing

```typescript
// src/db/read-write-splitting.ts
export class DatabaseRouter {
  private writePool: PrismaClient;
  private readPools: PrismaClient[];
  private currentReadIndex = 0;
  
  constructor() {
    // Write pool (primary)
    this.writePool = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_URL },
      },
    });
    
    // Read pools (replicas)
    this.readPools = process.env.READ_DATABASE_URLS
      ?.split(',')
      .map(url => new PrismaClient({
        datasources: { db: { url } },
      })) || [];
  }
  
  // Route read queries to replicas
  get read(): PrismaClient {
    if (this.readPools.length === 0) {
      return this.writePool;
    }
    
    // Round-robin load balancing
    const pool = this.readPools[this.currentReadIndex];
    this.currentReadIndex = (this.currentReadIndex + 1) % this.readPools.length;
    
    return pool;
  }
  
  // Route write queries to primary
  get write(): PrismaClient {
    return this.writePool;
  }
  
  // Use in procedures
  async getOrders(organizationId: string) {
    return this.read.order.findMany({
      where: { organizationId },
    });
  }
  
  async createOrder(data: OrderCreateInput) {
    return this.write.order.create({ data });
  }
}
```

#### Database Sharding

```typescript
// src/db/sharding.ts
export class ShardManager {
  private shards: Map<string, PrismaClient> = new Map();
  
  constructor(private shardConfig: ShardConfig) {
    // Initialize shard connections
    for (const [shardId, config] of Object.entries(shardConfig)) {
      this.shards.set(shardId, new PrismaClient({
        datasources: { db: { url: config.url } },
      }));
    }
  }
  
  // Determine shard based on organization
  private getShardKey(organizationId: string): string {
    const hash = crypto.createHash('md5').update(organizationId).digest('hex');
    const shardIndex = parseInt(hash.substring(0, 8), 16) % this.shards.size;
    return Array.from(this.shards.keys())[shardIndex];
  }
  
  // Get client for organization
  getClient(organizationId: string): PrismaClient {
    const shardKey = this.getShardKey(organizationId);
    const client = this.shards.get(shardKey);
    
    if (!client) {
      throw new Error(`Shard not found for organization ${organizationId}`);
    }
    
    return client;
  }
  
  // Cross-shard query
  async queryAllShards<T>(
    queryFn: (client: PrismaClient) => Promise<T>
  ): Promise<T[]> {
    const results = await Promise.all(
      Array.from(this.shards.values()).map(client => queryFn(client))
    );
    
    return results;
  }
}
```

### 3. Caching Layer

#### Redis Cluster

```yaml
# redis-cluster.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-cluster-config
data:
  redis.conf: |
    port 6379
    cluster-enabled yes
    cluster-config-file nodes.conf
    cluster-node-timeout 5000
    appendonly yes
    maxmemory 2gb
    maxmemory-policy allkeys-lru
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
spec:
  serviceName: redis-cluster
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command: ["redis-server"]
        args: ["/conf/redis.conf"]
        ports:
        - containerPort: 6379
        - containerPort: 16379
        volumeMounts:
        - name: conf
          mountPath: /conf
        - name: data
          mountPath: /data
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 2Gi
      volumes:
      - name: conf
        configMap:
          name: redis-cluster-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

#### Multi-Level Caching

```typescript
// src/caching/multi-level-cache.ts
export class MultiLevelCache {
  private l1Cache = new Map<string, CacheEntry>(); // In-memory
  private l2Cache: Redis; // Redis
  private l3Cache: S3Client; // S3 for large objects
  
  async get<T>(key: string): Promise<T | null> {
    // Check L1 (memory)
    const l1Result = this.l1Cache.get(key);
    if (l1Result && l1Result.expiry > Date.now()) {
      metrics.increment('cache.l1.hit');
      return l1Result.value as T;
    }
    
    // Check L2 (Redis)
    const l2Result = await this.l2Cache.get(key);
    if (l2Result) {
      metrics.increment('cache.l2.hit');
      const value = JSON.parse(l2Result);
      
      // Promote to L1
      this.l1Cache.set(key, {
        value,
        expiry: Date.now() + 60000, // 1 minute
      });
      
      return value;
    }
    
    // Check L3 (S3) for large objects
    if (await this.isLargeObject(key)) {
      const l3Result = await this.getFromS3(key);
      if (l3Result) {
        metrics.increment('cache.l3.hit');
        
        // Don't promote large objects to memory
        await this.l2Cache.setex(key, 300, JSON.stringify(l3Result));
        
        return l3Result;
      }
    }
    
    metrics.increment('cache.miss');
    return null;
  }
  
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    const serialized = JSON.stringify(value);
    const sizeInBytes = Buffer.byteLength(serialized);
    
    // Store based on size
    if (sizeInBytes < 1024) { // < 1KB
      // Store in all levels
      this.l1Cache.set(key, {
        value,
        expiry: Date.now() + ttl * 1000,
      });
      
      await this.l2Cache.setex(key, ttl, serialized);
    } else if (sizeInBytes < 1048576) { // < 1MB
      // Skip L1 for medium objects
      await this.l2Cache.setex(key, ttl, serialized);
    } else {
      // Large objects go to S3
      await this.putToS3(key, serialized, ttl);
      
      // Store reference in Redis
      await this.l2Cache.setex(key, ttl, JSON.stringify({
        _type: 'S3Reference',
        key: key,
      }));
    }
  }
  
  // Implement cache warming
  async warmCache(patterns: string[]) {
    for (const pattern of patterns) {
      const keys = await this.l2Cache.keys(pattern);
      
      for (const key of keys) {
        const value = await this.l2Cache.get(key);
        if (value) {
          this.l1Cache.set(key, {
            value: JSON.parse(value),
            expiry: Date.now() + 300000, // 5 minutes
          });
        }
      }
    }
  }
}
```

## Vertical Scaling

### 1. Resource Optimization

```yaml
# k8s/resources.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ventry-quota
spec:
  hard:
    requests.cpu: "100"
    requests.memory: 200Gi
    limits.cpu: "200"
    limits.memory: 400Gi
    persistentvolumeclaims: "10"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: ventry-limits
spec:
  limits:
  - max:
      cpu: "4"
      memory: 8Gi
    min:
      cpu: 100m
      memory: 128Mi
    default:
      cpu: 500m
      memory: 512Mi
    defaultRequest:
      cpu: 250m
      memory: 256Mi
    type: Container
```

### 2. Database Optimization

```sql
-- PostgreSQL configuration for high-performance
-- postgresql.conf

# Memory Configuration
shared_buffers = 8GB              # 25% of RAM
effective_cache_size = 24GB       # 75% of RAM
work_mem = 64MB                   # RAM / (max_connections * 2)
maintenance_work_mem = 2GB        # RAM / 16
wal_buffers = 16MB

# Checkpoint Configuration
checkpoint_timeout = 15min
checkpoint_completion_target = 0.9
max_wal_size = 8GB
min_wal_size = 2GB

# Connection Configuration
max_connections = 200
max_prepared_transactions = 100

# Parallel Query Execution
max_parallel_workers_per_gather = 4
max_parallel_maintenance_workers = 4
max_parallel_workers = 8
parallel_leader_participation = on

# Query Planner
random_page_cost = 1.1           # SSD optimization
effective_io_concurrency = 200   # SSD optimization
default_statistics_target = 1000

# Background Writer
bgwriter_delay = 200ms
bgwriter_lru_maxpages = 100
bgwriter_lru_multiplier = 2.0

# Logging
log_min_duration_statement = 100
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0
log_autovacuum_min_duration = 0
```

### 3. Application Performance

```typescript
// src/performance/optimization.ts
export class PerformanceOptimizer {
  // Connection pooling optimization
  private connectionPool = {
    min: 10,
    max: 100,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    
    // Dynamic pool sizing
    async adjustPoolSize(metrics: PoolMetrics) {
      const utilization = metrics.active / metrics.total;
      
      if (utilization > 0.8 && metrics.total < this.max) {
        // Increase pool size
        await this.increasePoolSize(Math.min(
          metrics.total * 1.5,
          this.max
        ));
      } else if (utilization < 0.2 && metrics.total > this.min) {
        // Decrease pool size
        await this.decreasePoolSize(Math.max(
          metrics.total * 0.7,
          this.min
        ));
      }
    },
  };
  
  // Query optimization
  async optimizeQuery(query: string): Promise<string> {
    // Add query hints
    if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
      logger.warn('Query has ORDER BY without LIMIT', { query });
    }
    
    // Use prepared statements
    const preparedQuery = this.prepareStatement(query);
    
    // Add timeout
    return `SET statement_timeout = 5000; ${preparedQuery}`;
  }
  
  // Memory optimization
  setupMemoryMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      
      metrics.gauge('memory.rss', usage.rss);
      metrics.gauge('memory.heap_total', usage.heapTotal);
      metrics.gauge('memory.heap_used', usage.heapUsed);
      metrics.gauge('memory.external', usage.external);
      
      // Force garbage collection if needed
      if (usage.heapUsed / usage.heapTotal > 0.9) {
        if (global.gc) {
          global.gc();
          logger.info('Forced garbage collection');
        }
      }
      
      // Alert on memory leak
      if (usage.rss > 1024 * 1024 * 1024) { // 1GB
        logger.error('High memory usage detected', { usage });
      }
    }, 30000); // Every 30 seconds
  }
}
```

## Load Testing & Capacity Planning

### 1. Load Testing Script

```javascript
// k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '5m', target: 200 },   // Stay at 200
    { duration: '2m', target: 400 },   // Ramp to 400
    { duration: '5m', target: 400 },   // Stay at 400
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
    errors: ['rate<0.1'],              // Custom error rate
  },
};

export default function () {
  const baseUrl = 'https://api.ventry.app';
  
  // Simulate user workflow
  const authRes = http.post(`${baseUrl}/auth/login`, {
    email: `user${Math.random()}@test.com`,
    password: 'password',
  });
  
  check(authRes, {
    'login successful': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  const token = authRes.json('token');
  const headers = { Authorization: `Bearer ${token}` };
  
  // Browse inventory
  const itemsRes = http.get(`${baseUrl}/items?limit=20`, { headers });
  check(itemsRes, {
    'items loaded': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  // Create order
  const orderRes = http.post(`${baseUrl}/orders`, 
    JSON.stringify({
      customerId: 'cust-123',
      items: [
        { itemId: 'item-1', quantity: 5 },
        { itemId: 'item-2', quantity: 3 },
      ],
    }),
    { headers: { ...headers, 'Content-Type': 'application/json' } }
  );
  
  check(orderRes, {
    'order created': (r) => r.status === 201,
  }) || errorRate.add(1);
  
  sleep(1);
}
```

### 2. Capacity Planning

```typescript
// src/capacity/planner.ts
export class CapacityPlanner {
  async calculateRequiredCapacity(
    currentMetrics: Metrics,
    growthRate: number,
    months: number
  ): Promise<CapacityPlan> {
    const projectedLoad = this.projectLoad(currentMetrics, growthRate, months);
    
    return {
      compute: {
        current: currentMetrics.compute,
        required: Math.ceil(projectedLoad.requests / 1000), // 1000 req/s per instance
        recommendation: 'Add horizontal scaling',
      },
      
      database: {
        current: currentMetrics.database,
        required: {
          cpu: projectedLoad.dbCpu,
          memory: projectedLoad.dbMemory,
          storage: projectedLoad.dbStorage,
          iops: projectedLoad.dbIops,
        },
        recommendation: this.getDatabaseRecommendation(projectedLoad),
      },
      
      cache: {
        current: currentMetrics.cache,
        required: Math.ceil(projectedLoad.cacheSize),
        recommendation: 'Implement Redis Cluster',
      },
      
      bandwidth: {
        current: currentMetrics.bandwidth,
        required: projectedLoad.bandwidth,
        recommendation: 'Add CDN for static assets',
      },
      
      cost: {
        current: this.calculateCurrentCost(currentMetrics),
        projected: this.calculateProjectedCost(projectedLoad),
      },
    };
  }
  
  private getDatabaseRecommendation(load: ProjectedLoad): string {
    if (load.dbSize > 1000) { // 1TB
      return 'Implement sharding strategy';
    } else if (load.dbConnections > 500) {
      return 'Add read replicas and connection pooling';
    } else if (load.dbIops > 10000) {
      return 'Upgrade to high-performance SSD';
    }
    
    return 'Current setup sufficient';
  }
}
```

## Monitoring Scaling Events

```typescript
// src/monitoring/scaling-monitor.ts
export class ScalingMonitor {
  async monitorScalingEvents() {
    // Track scaling events
    kubernetes.on('scale', async (event) => {
      await prisma.scalingEvent.create({
        data: {
          timestamp: new Date(),
          service: event.deployment,
          fromReplicas: event.oldReplicas,
          toReplicas: event.newReplicas,
          reason: event.reason,
          metrics: event.metrics,
        },
      });
      
      // Alert on unusual scaling
      if (event.newReplicas > event.oldReplicas * 2) {
        await this.alertOncall({
          level: 'warning',
          message: `Rapid scaling detected: ${event.deployment}`,
          details: event,
        });
      }
    });
    
    // Monitor resource utilization
    setInterval(async () => {
      const utilization = await this.getResourceUtilization();
      
      // Store metrics
      metrics.gauge('scaling.cpu_utilization', utilization.cpu);
      metrics.gauge('scaling.memory_utilization', utilization.memory);
      metrics.gauge('scaling.pod_count', utilization.podCount);
      
      // Check for scaling issues
      if (utilization.cpu > 90 && utilization.podCount === this.maxPods) {
        await this.alertOncall({
          level: 'critical',
          message: 'Cannot scale further - at maximum capacity',
          utilization,
        });
      }
    }, 60000); // Every minute
  }
}
```

## Scaling Best Practices

1. **Start Horizontal**: Scale out before scaling up
2. **Monitor Everything**: You can't scale what you don't measure
3. **Automate Scaling**: Use HPA, VPA, and cluster autoscaler
4. **Cache Aggressively**: Reduce database load
5. **Async Processing**: Use queues for heavy operations
6. **Database Optimization**: Indexes, partitioning, read replicas
7. **Load Testing**: Regular testing under expected load
8. **Gradual Rollout**: Use canary deployments
9. **Cost Awareness**: Monitor scaling costs
10. **Documentation**: Document scaling procedures

## Scaling Checklist

### Before Scaling
- [ ] Current metrics baseline established
- [ ] Bottlenecks identified
- [ ] Load testing completed
- [ ] Cost analysis done
- [ ] Rollback plan ready

### During Scaling
- [ ] Monitor all metrics
- [ ] Check error rates
- [ ] Verify data consistency
- [ ] Test critical paths
- [ ] Document changes

### After Scaling
- [ ] Validate performance improvements
- [ ] Update monitoring thresholds
- [ ] Review costs
- [ ] Update documentation
- [ ] Plan next scaling phase

Remember: Scaling is not just about adding resources, it's about architecting for growth!