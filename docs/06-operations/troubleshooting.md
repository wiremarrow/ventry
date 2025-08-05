# Troubleshooting Guide

This guide provides solutions to common issues, debugging procedures, and emergency response protocols for Ventry.

## Quick Troubleshooting Index

| Symptom                    | Possible Cause                             | Section                                         |
| -------------------------- | ------------------------------------------ | ----------------------------------------------- |
| 🔴 Application won't start | Environment variables, Database connection | [Startup Issues](#startup-issues)               |
| 🔴 Users can't login       | JWT configuration, Cookie issues           | [Authentication Issues](#authentication-issues) |
| 🔴 Database errors         | Connection pool, RLS policies              | [Database Issues](#database-issues)             |
| 🟡 Slow performance        | Missing indexes, Memory leaks              | [Performance Issues](#performance-issues)       |
| 🟡 Data not showing        | RLS context, Permissions                   | [Data Access Issues](#data-access-issues)       |
| 🔴 Production down         | Infrastructure, Dependencies               | [Emergency Response](#emergency-response)       |

## Startup Issues

### Application Won't Start

#### Environment Variables Missing

**Symptoms:**

```
Error: Missing required environment variable: JWT_SECRET
```

**Solution:**

```bash
# Check current environment
env | grep -E "(DATABASE_URL|JWT_SECRET|COOKIE_SECRET)"

# Set missing variables
export JWT_SECRET="your-secret-here"
export COOKIE_SECRET="your-cookie-secret"
export DATABASE_URL="postgresql://user:pass@localhost:5432/ventry"

# Or use .env file
cp .env.example .env
# Edit .env with proper values
```

#### Database Connection Failed

**Symptoms:**

```
Error: P1001: Can't reach database server at `localhost:5432`
```

**Solution:**

```bash
# Check if PostgreSQL is running
docker ps | grep postgres
# OR
systemctl status postgresql

# Start PostgreSQL
docker-compose up -d postgres
# OR
systemctl start postgresql

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection string format
# Should be: postgresql://user:password@host:port/database
echo $DATABASE_URL
```

#### Port Already in Use

**Symptoms:**

```
Error: listen EADDRINUSE: address already in use :::6060
```

**Solution:**

```bash
# Find process using port
lsof -i :6060
# OR
netstat -tulpn | grep 6060

# Kill process
kill -9 <PID>

# Or change port
export PORT=6061
```

### Build Failures

#### TypeScript Errors

**Symptoms:**

```
Type error: Property 'organizationId' does not exist on type 'Context'
```

**Solution:**

```bash
# Regenerate Prisma types
pnpm db:generate

# Clear TypeScript cache
rm -rf apps/backend/dist
rm -rf apps/web/.next

# Rebuild
pnpm build
```

#### Module Resolution Issues

**Symptoms:**

```
Error: Cannot find module '@ventry/database'
```

**Solution:**

```bash
# Clean install dependencies
rm -rf node_modules
rm -rf **/node_modules
rm pnpm-lock.yaml

# Reinstall
pnpm install

# Build workspace packages
pnpm build:packages
```

## Authentication Issues

### Users Can't Login

#### JWT Verification Failed

**Symptoms:**

```
Error: JsonWebTokenError: invalid signature
```

**Debugging:**

```typescript
// Debug JWT issues
const debugAuth = async (req: Request) => {
  console.log('Cookies:', req.cookies);
  console.log('Auth header:', req.headers.authorization);

  const token = req.cookies['auth-token'];
  if (token) {
    // Check if token is signed
    const unsigned = req.unsignCookie(token);
    console.log('Unsigned:', unsigned);

    // Decode without verification
    const decoded = jwt.decode(unsigned.value);
    console.log('Decoded:', decoded);

    // Try to verify
    try {
      const verified = jwt.verify(unsigned.value, process.env.JWT_SECRET);
      console.log('Verified:', verified);
    } catch (error) {
      console.error('Verification error:', error);
    }
  }
};
```

**Solution:**

```bash
# Ensure JWT_SECRET matches between services
echo $JWT_SECRET

# Regenerate JWT secret if needed
openssl rand -base64 32

# Clear browser cookies
# In browser console:
document.cookie.split(";").forEach(function(c) {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});
```

#### Cookie Not Being Set

**Symptoms:**

- Login succeeds but subsequent requests fail
- No cookies in browser DevTools

**Solution:**

```typescript
// Check cookie configuration
const cookieConfig = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // Must be false for localhost
  sameSite: 'lax' as const,
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  domain: process.env.NODE_ENV === 'production' ? '.ventry.app' : undefined,
};

// Debug cookie setting
reply.setCookie('debug-cookie', 'test-value', {
  httpOnly: false,
  secure: false,
  sameSite: 'lax',
});
```

### Organization Context Issues

#### Wrong Organization Data

**Symptoms:**

- User sees data from wrong organization
- Organization switching not working

**Debugging:**

```sql
-- Check current RLS context
SELECT
  current_setting('app.current_user_id', true) as user_id,
  current_setting('app.current_organization_id', true) as org_id;

-- Check user's organizations
SELECT om.*, o.name
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
WHERE om.user_id = 'user-id-here';
```

**Solution:**

```typescript
// Force refresh organization context
const refreshOrgContext = async (userId: string) => {
  // Clear cache
  await redis.del(`user:${userId}:memberships`);

  // Reload memberships
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
  });

  // Update active organization
  if (memberships.length > 0) {
    await setActiveOrganization(userId, memberships[0].organizationId);
  }
};
```

## Database Issues

### Connection Pool Exhausted

**Symptoms:**

```
Error: P2024: Timed out fetching a new connection from the connection pool
```

**Debugging:**

```sql
-- Check current connections
SELECT
  datname,
  count(*) as connections,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
GROUP BY datname;

-- Find long-running queries
SELECT
  pid,
  now() - query_start AS duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '1 minute'
ORDER BY duration DESC;
```

**Solution:**

```bash
# Kill stuck connections
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'ventry'
    AND state = 'idle'
    AND state_change < current_timestamp - interval '5 minutes';
"

# Increase connection limit
export DATABASE_URL="${DATABASE_URL}?connection_limit=50&pool_timeout=30"

# Or in postgresql.conf
max_connections = 200
```

### RLS Policy Violations

**Symptoms:**

```
Error: new row violates row-level security policy for table "items"
```

**Debugging:**

```sql
-- Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'items';

-- Test RLS as specific user
BEGIN;
SELECT set_rls_context('user-id', 'org-id');
SELECT * FROM items LIMIT 5;
ROLLBACK;
```

**Solution:**

```sql
-- Fix missing policy
CREATE POLICY items_insert_policy ON items
  FOR INSERT
  WITH CHECK (organization_id = current_organization_id());

-- Debug policy with USING vs WITH CHECK
CREATE POLICY items_all_policy ON items
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());
```

### Migration Failures

**Symptoms:**

```
Error: P3006: Migration `20240120_add_index` failed to apply
```

**Solution:**

```bash
# Check migration status
pnpm db:migrate:status

# Reset to specific migration
pnpm db:migrate:resolve --rolled-back 20240120_add_index

# Apply migrations manually
psql $DATABASE_URL < prisma/migrations/20240120_add_index/migration.sql

# Mark as applied
pnpm db:migrate:resolve --applied 20240120_add_index
```

## Performance Issues

### Slow API Responses

**Debugging:**

```typescript
// Add request timing
app.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now();
});

app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - request.startTime;
  console.log(`${request.method} ${request.url} - ${duration}ms`);

  if (duration > 1000) {
    logger.warn('Slow request', {
      method: request.method,
      url: request.url,
      duration,
      userId: request.user?.id,
    });
  }
});
```

**Query Analysis:**

```sql
-- Enable query timing
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

-- Find slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Analyze specific query
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders
WHERE organization_id = 'xxx'
  AND created_at > NOW() - INTERVAL '30 days';
```

### Memory Leaks

**Symptoms:**

- Increasing memory usage over time
- Application crashes with OOM

**Debugging:**

```typescript
// Monitor memory usage
const memoryMonitor = setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
  });

  // Force GC if available
  if (global.gc && usage.heapUsed > 500 * 1024 * 1024) {
    console.log('Forcing garbage collection');
    global.gc();
  }
}, 30000);

// Track event listeners
console.log('Event listeners:', process.eventNames());
process.eventNames().forEach((event) => {
  console.log(`${event}: ${process.listenerCount(event)} listeners`);
});
```

**Solution:**

```bash
# Run with heap profiling
node --expose-gc --max-old-space-size=4096 dist/index.js

# Generate heap snapshot
kill -USR2 <PID>

# Analyze with Chrome DevTools
# 1. Open chrome://inspect
# 2. Load heap snapshot
# 3. Look for retained objects
```

### High CPU Usage

**Debugging:**

```bash
# Profile CPU usage
npm install -g clinic
clinic doctor -- node dist/index.js

# Or use built-in profiler
node --prof dist/index.js
# Process profile
node --prof-process isolate-*.log > profile.txt
```

**Common Causes:**

1. Infinite loops in code
2. Synchronous operations blocking event loop
3. Inefficient algorithms
4. Missing database indexes

## Data Access Issues

### No Data Showing

**RLS Context Not Set:**

```typescript
// Debug RLS context
app.addHook('preHandler', async (request, reply) => {
  const result = await prisma.$queryRaw`
    SELECT 
      current_setting('app.current_user_id', true) as user_id,
      current_setting('app.current_organization_id', true) as org_id
  `;

  console.log('RLS Context:', result);

  if (!result[0].user_id || !result[0].org_id) {
    logger.error('RLS context not set', {
      user: request.user,
      organization: request.organizationId,
    });
  }
});
```

### Wrong Data Returned

**Missing WHERE Clauses:**

```typescript
// Audit all queries
const auditQueries = () => {
  const originalFindMany = prisma.item.findMany;

  prisma.item.findMany = async function (args) {
    console.log('Query args:', JSON.stringify(args, null, 2));

    // Check if organizationId is included
    if (!args?.where?.organizationId) {
      console.warn('Query missing organizationId filter!');
    }

    return originalFindMany.call(this, args);
  };
};
```

## Emergency Response

### Production Down

**Immediate Actions:**

```bash
# 1. Check infrastructure status
kubectl get pods -n production
kubectl get nodes
kubectl describe pod <failing-pod>

# 2. Check recent deployments
kubectl rollout history deployment/ventry-backend
helm history ventry

# 3. Quick rollback
kubectl rollout undo deployment/ventry-backend
# OR
helm rollback ventry

# 4. Check database
psql $DATABASE_URL -c "SELECT 1"

# 5. Check external services
curl -I https://api.ventry.app/health
```

### Database Locked Up

**Emergency Recovery:**

```sql
-- Kill all connections (except current)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND datname = 'ventry';

-- Cancel running queries
SELECT pg_cancel_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '5 minutes';

-- Emergency vacuum
SET statement_timeout = 0;
VACUUM (ANALYZE, VERBOSE) orders;
```

### Data Corruption

**Recovery Steps:**

```bash
# 1. Stop writes immediately
kubectl scale deployment/ventry-backend --replicas=0

# 2. Backup current state
pg_dump $DATABASE_URL > emergency-backup-$(date +%Y%m%d-%H%M%S).sql

# 3. Analyze corruption
psql $DATABASE_URL -c "
  SELECT schemaname, tablename
  FROM pg_tables
  WHERE schemaname = 'public'
" | while read schema table; do
  echo "Checking $table..."
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM $table" || echo "ERROR: $table corrupted"
done

# 4. Restore from backup
psql $DATABASE_URL < last-known-good-backup.sql

# 5. Verify and restart
kubectl scale deployment/ventry-backend --replicas=3
```

## Debugging Tools

### Request Tracing

```typescript
// Enable request tracing
import { AsyncLocalStorage } from 'async_hooks';

const traceStorage = new AsyncLocalStorage<TraceContext>();

app.addHook('onRequest', async (request, reply) => {
  const traceId = request.headers['x-trace-id'] || crypto.randomUUID();

  traceStorage.run({ traceId, startTime: Date.now() }, () => {
    request.traceId = traceId;
    reply.header('X-Trace-ID', traceId);
  });
});

// Use in logging
const logger = {
  info: (message: string, data?: any) => {
    const trace = traceStorage.getStore();
    console.log({
      level: 'info',
      message,
      traceId: trace?.traceId,
      duration: trace ? Date.now() - trace.startTime : 0,
      ...data,
    });
  },
};
```

### Database Query Logging

```typescript
// Log all Prisma queries
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
});

prisma.$on('query', (e) => {
  console.log({
    query: e.query,
    params: e.params,
    duration: e.duration,
    timestamp: new Date().toISOString(),
  });
});
```

### Performance Profiling

```typescript
// CPU profiling
import { performance } from 'perf_hooks';

const profile = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    if (duration > 100) {
      console.warn(`Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`Operation failed: ${name} after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
};

// Usage
const items = await profile('fetchItems', async () => {
  return prisma.item.findMany({ where: { organizationId } });
});
```

## Common Error Reference

### Error Codes

| Code                     | Description                 | Solution                            |
| ------------------------ | --------------------------- | ----------------------------------- |
| P1001                    | Can't reach database        | Check connection string and network |
| P2002                    | Unique constraint violation | Check for duplicates                |
| P2024                    | Connection pool timeout     | Increase pool size or timeout       |
| P2025                    | Record not found            | Verify ID exists                    |
| UNAUTHORIZED             | No valid auth token         | Check JWT configuration             |
| FORBIDDEN                | No permission               | Check organization membership       |
| ERR_PNPM_PEER_DEP_ISSUES | Peer dependency conflicts   | Update dependencies                 |

### Quick Fixes

```bash
# Clear all caches
rm -rf .next node_modules/.cache dist
redis-cli FLUSHALL
pnpm install --force

# Reset database
pnpm db:push --force-reset
pnpm db:seed

# Full restart
docker-compose down
docker-compose up -d
pnpm dev

# Check logs
docker-compose logs -f backend
kubectl logs -f deployment/ventry-backend
tail -f /var/log/ventry/*.log
```

## Getting Help

### Collect Diagnostics

```bash
# Generate diagnostic report
cat > diagnostic-report.md << EOF
## Environment
- Node Version: $(node -v)
- pnpm Version: $(pnpm -v)
- OS: $(uname -a)
- Environment: $NODE_ENV

## Recent Logs
\`\`\`
$(tail -n 100 logs/error.log)
\`\`\`

## Database Status
\`\`\`
$(psql $DATABASE_URL -c "SELECT version();")
\`\`\`

## Container Status
\`\`\`
$(docker ps)
\`\`\`
EOF
```

### Support Channels

1. **GitHub Issues**: For bugs and feature requests
2. **Discord**: For community support
3. **Emergency**: security@ventry.com for security issues
4. **On-Call**: Check PagerDuty for current on-call engineer

Remember: When in doubt, check the logs!
