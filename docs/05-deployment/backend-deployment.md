# Backend Deployment Guide

This guide covers deploying the Ventry tRPC + Fastify backend to various platforms, including containerization, configuration, and best practices.

## Prerequisites

- Docker installed locally
- Access to a container registry
- PostgreSQL database deployed
- Environment variables prepared
- SSL certificates (for HTTPS)

## Containerization

### Dockerfile

```dockerfile
# apps/backend/Dockerfile
FROM node:20-alpine AS builder

# Install dependencies for building
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build --filter=@ventry/backend

# Production image
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm

WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "dist/index.js"]
```

### Building and Testing

```bash
# Build the image
docker build -t ventry-backend:latest -f apps/backend/Dockerfile .

# Test locally
docker run -p 4000:4000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e COOKIE_SECRET="..." \
  ventry-backend:latest

# Push to registry
docker tag ventry-backend:latest registry.example.com/ventry-backend:latest
docker push registry.example.com/ventry-backend:latest
```

## Deployment Platforms

### 1. AWS ECS (Elastic Container Service)

#### Task Definition

```json
{
  "family": "ventry-backend",
  "taskRoleArn": "arn:aws:iam::xxx:role/ecsTaskRole",
  "executionRoleArn": "arn:aws:iam::xxx:role/ecsExecutionRole",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "ventry-backend",
      "image": "xxx.dkr.ecr.us-east-1.amazonaws.com/ventry-backend:latest",
      "portMappings": [
        {
          "containerPort": 4000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "4000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:xxx:secret:ventry/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:xxx:secret:ventry/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ventry-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:4000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### Service Configuration

```yaml
# ecs-service.yaml
service:
  name: ventry-backend
  cluster: production
  taskDefinition: ventry-backend:latest
  desiredCount: 2
  launchType: FARGATE
  
  networkConfiguration:
    awsvpcConfiguration:
      subnets:
        - subnet-xxx
        - subnet-yyy
      securityGroups:
        - sg-backend
      assignPublicIp: DISABLED
  
  loadBalancers:
    - targetGroupArn: arn:aws:elasticloadbalancing:xxx
      containerName: ventry-backend
      containerPort: 4000
  
  deploymentConfiguration:
    maximumPercent: 200
    minimumHealthyPercent: 100
    deploymentCircuitBreaker:
      enable: true
      rollback: true
```

### 2. Google Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/ventry-prod/backend

# Deploy to Cloud Run
gcloud run deploy ventry-backend \
  --image gcr.io/ventry-prod/backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --set-secrets="JWT_SECRET=jwt-secret:latest" \
  --min-instances=1 \
  --max-instances=10 \
  --memory=1Gi \
  --cpu=1
```

### 3. Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ventry-backend
  labels:
    app: ventry-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ventry-backend
  template:
    metadata:
      labels:
        app: ventry-backend
    spec:
      containers:
      - name: backend
        image: registry.example.com/ventry-backend:latest
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "4000"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ventry-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: ventry-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ventry-backend
spec:
  selector:
    app: ventry-backend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 4000
  type: LoadBalancer
```

### 4. Digital Ocean App Platform

```yaml
# .do/app.yaml
name: ventry-backend
region: nyc
services:
  - name: backend
    dockerfile_path: apps/backend/Dockerfile
    source_dir: /
    github:
      repo: your-org/ventry
      branch: main
      deploy_on_push: true
    http_port: 4000
    instance_count: 2
    instance_size_slug: professional-xs
    health_check:
      http_path: /health
      initial_delay_seconds: 30
      period_seconds: 10
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        type: SECRET
        value: ${db.DATABASE_URL}
      - key: JWT_SECRET
        type: SECRET
        value: ${JWT_SECRET}
databases:
  - name: db
    engine: PG
    version: "16"
    size: db-s-1vcpu-1gb
    num_nodes: 1
```

## Environment Configuration

### Required Environment Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=4000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/ventry

# Authentication
JWT_SECRET=your-secure-jwt-secret-min-32-chars
COOKIE_SECRET=your-secure-cookie-secret-min-32-chars

# CORS
CORS_ORIGIN=https://ventry.app

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
LOG_LEVEL=info

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_ANALYTICS=true

# External Services
OPENAI_API_KEY=sk-xxx
REDIS_URL=redis://xxx:6379
```

### Secrets Management

#### AWS Secrets Manager

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getSecret(secretName: string) {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const data = await client.send(command);
  return JSON.parse(data.SecretString);
}

// Load secrets on startup
const secrets = await getSecret("ventry/production");
process.env = { ...process.env, ...secrets };
```

#### Kubernetes Secrets

```bash
# Create secrets
kubectl create secret generic ventry-secrets \
  --from-literal=database-url=$DATABASE_URL \
  --from-literal=jwt-secret=$JWT_SECRET \
  --from-literal=cookie-secret=$COOKIE_SECRET

# Update secrets
kubectl create secret generic ventry-secrets \
  --from-env-file=.env.production \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Load Balancing

### Application Load Balancer (AWS)

```yaml
# Health check configuration
HealthCheckProtocol: HTTP
HealthCheckPath: /health
HealthCheckIntervalSeconds: 30
HealthCheckTimeoutSeconds: 5
HealthyThresholdCount: 2
UnhealthyThresholdCount: 3

# Target group settings
TargetType: ip
Protocol: HTTP
Port: 4000
DeregistrationDelay: 30
StickinessDuration: 86400
```

### NGINX Configuration

```nginx
upstream ventry_backend {
    least_conn;
    server backend1:4000 max_fails=3 fail_timeout=30s;
    server backend2:4000 max_fails=3 fail_timeout=30s;
    server backend3:4000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.ventry.app;
    
    location / {
        proxy_pass http://ventry_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://ventry_backend/health;
        access_log off;
    }
}
```

## Database Migrations

### Production Migration Strategy

```bash
# 1. Run migrations in a separate job
docker run --rm \
  -e DATABASE_URL=$DATABASE_URL \
  ventry-backend:latest \
  node dist/migrate.js

# 2. Deploy new version
kubectl set image deployment/ventry-backend \
  backend=ventry-backend:v2.0.0

# 3. Verify migration
psql $DATABASE_URL -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;"
```

### Migration Script

```typescript
// migrate.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    await execAsync('pnpm db:migrate:deploy');
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
```

## Monitoring and Logging

### Health Check Endpoint

```typescript
// src/routes/health.ts
export async function healthCheckRoute(server: FastifyInstance) {
  server.get('/health', async (request, reply) => {
    try {
      // Check database connection
      await server.prisma.$queryRaw`SELECT 1`;
      
      // Check Redis if used
      if (server.redis) {
        await server.redis.ping();
      }
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version,
      };
    } catch (error) {
      reply.code(503);
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  });
}
```

### Structured Logging

```typescript
// Configure Pino logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' }
    : undefined,
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      userId: req.user?.id,
      organizationId: req.organizationId,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      time: res.responseTime,
    }),
  },
});
```

### Metrics Collection

```typescript
// Prometheus metrics
import { register, Counter, Histogram } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Metrics endpoint
server.get('/metrics', async (request, reply) => {
  reply.header('Content-Type', register.contentType);
  return register.metrics();
});
```

## Performance Optimization

### Connection Pooling

```typescript
// Database connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  // Adjust based on your needs
  // Default pool size = num_physical_cpus * 2 + 1
});
```

### Caching Strategy

```typescript
// Redis caching
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache middleware
async function cacheMiddleware(request, reply) {
  const key = `cache:${request.method}:${request.url}`;
  const cached = await redis.get(key);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Store original send
  const originalSend = reply.send;
  
  reply.send = function(data) {
    // Cache for 5 minutes
    redis.setex(key, 300, JSON.stringify(data));
    return originalSend.call(this, data);
  };
}
```

## Security Hardening

### Rate Limiting

```typescript
import rateLimit from '@fastify/rate-limit';

await server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  redis: redis,
  skipOnError: true,
  keyGenerator: (request) => {
    return request.user?.id || request.ip;
  },
});
```

### Security Headers

```typescript
import helmet from '@fastify/helmet';

await server.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});
```

## Deployment Checklist

### Pre-Deployment

- [ ] Docker image built and tested
- [ ] Environment variables configured
- [ ] Secrets stored securely
- [ ] Database migrations tested
- [ ] Health check endpoint working
- [ ] Load testing completed
- [ ] Security scan passed

### Deployment

- [ ] Run database migrations
- [ ] Deploy to staging first
- [ ] Verify health checks
- [ ] Check logs for errors
- [ ] Test critical endpoints
- [ ] Monitor metrics

### Post-Deployment

- [ ] Verify all services healthy
- [ ] Check error rates
- [ ] Monitor performance metrics
- [ ] Test user workflows
- [ ] Update documentation
- [ ] Notify team

## Troubleshooting

### Common Issues

1. **Container fails to start**
   - Check environment variables
   - Verify database connectivity
   - Review container logs

2. **Health checks failing**
   - Increase startup time
   - Check database connection
   - Verify port configuration

3. **High memory usage**
   - Review connection pool size
   - Check for memory leaks
   - Optimize queries

4. **Slow response times**
   - Add database indexes
   - Implement caching
   - Scale horizontally

## Rollback Procedures

```bash
# Kubernetes rollback
kubectl rollout undo deployment/ventry-backend

# ECS rollback
aws ecs update-service \
  --cluster production \
  --service ventry-backend \
  --task-definition ventry-backend:previous-version

# Docker Swarm rollback
docker service rollback ventry-backend
```

Remember: Always test in staging before production deployment!