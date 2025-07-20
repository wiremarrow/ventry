# Monitoring Setup Guide

This guide covers setting up comprehensive monitoring for Ventry in production, including application monitoring, infrastructure monitoring, and alerting.

## Monitoring Stack Overview

```
┌─────────────────────────────────────────────────┐
│                   Dashboards                     │
│         (Grafana / Datadog / New Relic)         │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              Metrics Storage                     │
│     (Prometheus / CloudWatch / Datadog)         │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              Data Collection                     │
├─────────────────┴───────────────────────────────┤
│ Application │ Infrastructure │ Logs │ Traces    │
│   Metrics   │    Metrics     │      │          │
└─────────────┴────────────────┴──────┴───────────┘
```

## Application Monitoring

### 1. Error Tracking with Sentry

#### Backend Setup

```typescript
// apps/backend/src/index.ts
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    // Enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // Enable Express middleware tracing
    new Sentry.Integrations.Express({ app }),
    // Enable profiling
    new ProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Profiling
  profilesSampleRate: 0.1,
  
  beforeSend(event, hint) {
    // Filter out sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});

// Error handler middleware
app.use(Sentry.Handlers.errorHandler());
```

#### Frontend Setup

```typescript
// apps/web/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  beforeSend(event, hint) {
    // Filter out non-app errors
    if (event.exception?.values?.[0]?.type === 'NetworkError') {
      return null;
    }
    return event;
  },
});
```

### 2. Application Performance Monitoring (APM)

#### Custom Metrics

```typescript
// src/lib/metrics.ts
import { StatsD } from 'node-statsd';

const statsd = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: 8125,
  prefix: 'ventry.',
});

export const metrics = {
  // Count metrics
  increment(metric: string, tags?: Record<string, string>) {
    statsd.increment(metric, 1, tags);
  },
  
  // Timing metrics
  timing(metric: string, time: number, tags?: Record<string, string>) {
    statsd.timing(metric, time, tags);
  },
  
  // Gauge metrics
  gauge(metric: string, value: number, tags?: Record<string, string>) {
    statsd.gauge(metric, value, tags);
  },
  
  // Histogram
  histogram(metric: string, value: number, tags?: Record<string, string>) {
    statsd.histogram(metric, value, tags);
  },
};

// Usage examples
metrics.increment('api.request', { endpoint: 'items.list' });
metrics.timing('db.query.time', 45, { query: 'findMany' });
metrics.gauge('inventory.total_value', 1250000);
```

#### tRPC Middleware for Metrics

```typescript
// src/trpc/metrics-middleware.ts
export const metricsMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  
  const result = await next();
  
  const duration = Date.now() - start;
  
  // Track request metrics
  metrics.increment('trpc.request', {
    procedure: path,
    type: type,
    status: result.ok ? 'success' : 'error',
  });
  
  metrics.timing('trpc.duration', duration, {
    procedure: path,
    type: type,
  });
  
  // Log slow requests
  if (duration > 1000) {
    logger.warn('Slow tRPC procedure', {
      procedure: path,
      duration,
      type,
    });
  }
  
  return result;
});
```

### 3. Business Metrics

```typescript
// src/services/business-metrics.ts
export class BusinessMetrics {
  async collectMetrics() {
    // Order metrics
    const orderStats = await prisma.order.aggregate({
      _count: true,
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    
    metrics.gauge('business.daily_orders', orderStats._count);
    metrics.gauge('business.daily_revenue', orderStats._sum.totalAmount || 0);
    
    // Inventory metrics
    const inventoryValue = await prisma.$queryRaw`
      SELECT SUM(i.qty_on_hand * it.unit_cost) as total_value
      FROM inventory i
      JOIN items it ON i.item_id = it.id
    `;
    
    metrics.gauge('business.inventory_value', inventoryValue[0].total_value);
    
    // User activity
    const activeUsers = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      _count: true,
    });
    
    metrics.gauge('business.active_users_hourly', activeUsers.length);
  }
}

// Run every 5 minutes
setInterval(() => {
  new BusinessMetrics().collectMetrics();
}, 5 * 60 * 1000);
```

## Infrastructure Monitoring

### 1. Prometheus Setup

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'ventry-backend'
    static_configs:
      - targets: ['backend:4000']
    metrics_path: '/metrics'
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
      
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

```typescript
// Backend metrics endpoint
import { register } from 'prom-client';

app.get('/metrics', async (req, reply) => {
  reply.header('Content-Type', register.contentType);
  return register.metrics();
});
```

### 2. CloudWatch Integration

```typescript
// src/lib/cloudwatch.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

export async function putMetric(
  namespace: string,
  metricName: string,
  value: number,
  unit: string = 'Count',
  dimensions?: Record<string, string>
) {
  const command = new PutMetricDataCommand({
    Namespace: namespace,
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        Dimensions: Object.entries(dimensions || {}).map(([Name, Value]) => ({
          Name,
          Value,
        })),
      },
    ],
  });
  
  await cloudwatch.send(command);
}

// Usage
await putMetric('Ventry/API', 'RequestCount', 1, 'Count', {
  Environment: process.env.NODE_ENV,
  Endpoint: 'items.list',
});
```

### 3. Container Metrics

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - 8080:8080
      
  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - 9100:9100
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
```

## Logging

### 1. Structured Logging

```typescript
// src/lib/logger.ts
import pino from 'pino';
import { createStream } from '@datadog/pino';

const streams = [
  // Console output for development
  process.env.NODE_ENV === 'development' && {
    level: 'debug',
    stream: pino.pretty(),
  },
  // Datadog for production
  process.env.NODE_ENV === 'production' && {
    level: 'info',
    stream: createStream({
      apiKey: process.env.DATADOG_API_KEY,
      service: 'ventry-backend',
    }),
  },
].filter(Boolean);

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      err: pino.stdSerializers.err,
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        userId: req.user?.id,
        organizationId: req.organizationId,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  },
  pino.multistream(streams)
);
```

### 2. Log Aggregation

```yaml
# filebeat.yml
filebeat.inputs:
  - type: container
    paths:
      - '/var/lib/docker/containers/*/*.log'
    processors:
      - add_docker_metadata:
          host: "unix:///var/run/docker.sock"
      - decode_json_fields:
          fields: ["message"]
          target: "json"
          overwrite_keys: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  indices:
    - index: "ventry-logs-%{+yyyy.MM.dd}"
      when.contains:
        container.labels.app: "ventry"
```

### 3. Log Queries

```json
// Elasticsearch queries for common scenarios

// Find all errors in the last hour
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "error" } },
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}

// Find slow database queries
{
  "query": {
    "bool": {
      "must": [
        { "match": { "message": "Slow query" } },
        { "range": { "duration": { "gte": 1000 } } }
      ]
    }
  }
}

// Track specific user activity
{
  "query": {
    "bool": {
      "must": [
        { "match": { "userId": "user-123" } },
        { "range": { "@timestamp": { "gte": "now-24h" } } }
      ]
    }
  }
}
```

## Distributed Tracing

### 1. OpenTelemetry Setup

```typescript
// src/lib/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'ventry-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version,
  }),
  traceExporter: jaegerExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

sdk.start();
```

### 2. Custom Spans

```typescript
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('ventry-backend');

export async function tracedOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const span = tracer.startSpan(name);
  
  try {
    const result = await context.with(
      trace.setSpan(context.active(), span),
      operation
    );
    
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

// Usage
const result = await tracedOperation('inventory.calculate-value', async () => {
  return await calculateInventoryValue();
});
```

## Alerting

### 1. Alert Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: ventry-alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for 5 minutes"
          
      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "API response time degraded"
          description: "95th percentile response time is above 1 second"
          
      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "Using more than 80% of available connections"
          
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 90%"
```

### 2. PagerDuty Integration

```typescript
// src/lib/pagerduty.ts
import { event } from '@pagerduty/pdjs';

export async function createIncident(
  summary: string,
  severity: 'info' | 'warning' | 'error' | 'critical',
  details: any
) {
  await event({
    data: {
      routing_key: process.env.PAGERDUTY_ROUTING_KEY,
      event_action: 'trigger',
      dedup_key: `ventry-${Date.now()}`,
      payload: {
        summary,
        severity,
        source: 'ventry-monitoring',
        custom_details: details,
      },
    },
  });
}

// Alert on critical errors
logger.on('error', async (error) => {
  if (error.level >= 50) { // Error or Fatal
    await createIncident(
      `Critical error: ${error.msg}`,
      'critical',
      { error: error.err, context: error }
    );
  }
});
```

### 3. Slack Notifications

```typescript
// src/lib/slack.ts
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_TOKEN);

export async function sendAlert(
  channel: string,
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'error'
) {
  const color = {
    info: '#36a64f',
    warning: '#ff9800',
    error: '#ff0000',
  }[severity];
  
  await slack.chat.postMessage({
    channel,
    attachments: [{
      color,
      title,
      text: message,
      footer: 'Ventry Monitoring',
      ts: `${Date.now() / 1000}`,
    }],
  });
}
```

## Dashboards

### 1. Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "Ventry Production Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "sum(rate(http_requests_total[5m])) by (endpoint)"
        }],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))"
        }],
        "type": "singlestat",
        "thresholds": "0.01,0.05",
        "colors": ["green", "yellow", "red"]
      },
      {
        "title": "Response Time (p95)",
        "targets": [{
          "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
        }],
        "type": "graph"
      },
      {
        "title": "Active Users",
        "targets": [{
          "expr": "business_active_users_hourly"
        }],
        "type": "singlestat"
      },
      {
        "title": "Database Connections",
        "targets": [{
          "expr": "pg_stat_database_numbackends{datname=\"ventry\"}"
        }],
        "type": "graph"
      },
      {
        "title": "Memory Usage",
        "targets": [{
          "expr": "(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100"
        }],
        "type": "gauge",
        "thresholds": "70,90"
      }
    ]
  }
}
```

### 2. Custom Metrics Dashboard

```typescript
// API endpoint for custom dashboard
app.get('/api/metrics/dashboard', async (req, reply) => {
  const [orders, inventory, users, performance] = await Promise.all([
    // Business metrics
    prisma.order.aggregate({
      _count: true,
      _sum: { totalAmount: true },
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    
    // Inventory metrics
    prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT item_id) as unique_items,
        SUM(qty_on_hand) as total_quantity,
        SUM(qty_on_hand * unit_cost) as total_value
      FROM inventory i
      JOIN items it ON i.item_id = it.id
    `,
    
    // User activity
    prisma.auditLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      _count: true,
    }),
    
    // Performance metrics from Redis
    redis.mget([
      'metrics:api:response_time:p95',
      'metrics:api:request_rate',
      'metrics:api:error_rate',
    ]),
  ]);
  
  return {
    business: {
      dailyOrders: orders._count,
      dailyRevenue: orders._sum.totalAmount,
      inventoryItems: inventory[0].unique_items,
      inventoryValue: inventory[0].total_value,
      activeUsers: users.length,
    },
    performance: {
      responseTime: performance[0],
      requestRate: performance[1],
      errorRate: performance[2],
    },
    timestamp: new Date().toISOString(),
  };
});
```

## Monitoring Checklist

### Initial Setup
- [ ] Sentry configured for error tracking
- [ ] Prometheus/CloudWatch for metrics
- [ ] ELK/CloudWatch Logs for log aggregation
- [ ] Jaeger/X-Ray for distributed tracing
- [ ] Grafana/DataDog for dashboards
- [ ] PagerDuty/Opsgenie for alerting

### Key Metrics Tracked
- [ ] API response times (p50, p95, p99)
- [ ] Error rates by endpoint
- [ ] Database query performance
- [ ] Business metrics (orders, revenue, inventory)
- [ ] Infrastructure metrics (CPU, memory, disk)
- [ ] User activity metrics

### Alerts Configured
- [ ] High error rate (>5%)
- [ ] Slow response times (>1s)
- [ ] Database connection exhaustion
- [ ] High memory usage (>90%)
- [ ] Disk space low (<10%)
- [ ] SSL certificate expiration

### Regular Reviews
- [ ] Daily: Check error rates and alerts
- [ ] Weekly: Review performance trends
- [ ] Monthly: Analyze business metrics
- [ ] Quarterly: Optimize alert thresholds

Remember: You can't improve what you don't measure. Monitor everything!