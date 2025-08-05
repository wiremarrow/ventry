# Debugging Guide

This guide covers debugging techniques and tools for the Ventry application.

## Table of Contents

1. [Frontend Debugging](#frontend-debugging)
2. [Backend Debugging](#backend-debugging)
3. [Database Debugging](#database-debugging)
4. [Debugging Tools](#debugging-tools)
5. [Common Debugging Scenarios](#common-debugging-scenarios)
6. [Performance Debugging](#performance-debugging)

## Frontend Debugging

### Browser DevTools

#### React Developer Tools

1. Install React Developer Tools extension
2. Use Components tab to inspect:
   - Component props and state
   - Context values
   - Hooks state
   - Component performance

#### Console Commands

```javascript
// Check authentication state
console.log(window.__clerk_db_jwt);

// Inspect tRPC client
console.log(window.trpc);

// Check organization context
console.log(document.cookie);

// Force component re-render
$r.forceUpdate();
```

### Debug Utilities

The project includes custom debug utilities:

```typescript
// lib/debug.ts utilities
import { useWhyDidYouUpdate } from '@/lib/debug';

// Track why component re-renders
useWhyDidYouUpdate('MyComponent', props);

// Measure performance
import { measurePerformance } from '@/lib/debug';
const cleanup = measurePerformance('API call');
// ... code to measure
cleanup();
```

### Next.js Debugging

#### Debug Mode

```bash
# Enable debug mode
NODE_OPTIONS='--inspect' pnpm dev

# Then open chrome://inspect
```

#### Source Maps

- Automatically enabled in development
- Use browser DevTools to set breakpoints in original source

### React Query DevTools

```typescript
// Already configured in the app
// Look for floating DevTools button in development
```

## Backend Debugging

### tRPC Debugging

#### Enable Debug Logging

```typescript
// In development, tRPC logs all procedures
export const createTRPCContext = async ({ req, res }: CreateContextOptions) => {
  console.log('tRPC Context:', {
    url: req.url,
    method: req.method,
    headers: req.headers,
  });
  // ...
};
```

#### Procedure Debugging

```typescript
.query(async ({ ctx, input }) => {
  console.log('Procedure input:', input);
  console.log('User context:', ctx.user);
  console.log('Organization:', ctx.organizationId);

  // Add breakpoint here
  debugger;

  const result = await ctx.prisma.item.findMany();
  console.log('Query result:', result);

  return result;
})
```

### Fastify Debugging

#### Request Logging

```typescript
// Fastify automatically logs all requests
// Check console for:
// - Request ID
// - Method and URL
// - Response time
// - Status code
```

#### Custom Logging

```typescript
server.log.info('Custom message', { data });
server.log.error('Error occurred', error);
```

### Node.js Debugging

#### VS Code Launch Configuration

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["--filter", "@ventry/backend", "dev"],
  "skipFiles": ["<node_internals>/**"],
  "outFiles": ["${workspaceFolder}/apps/backend/dist/**/*.js"]
}
```

## Database Debugging

### Query Logging

#### Enable Prisma Query Logging

```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

#### Log Specific Queries

```typescript
// In development
const items = await ctx.prisma.item.findMany();
console.log('SQL:', ctx.prisma.$queryRaw`SELECT * FROM items`);
```

### Database Inspection

#### Using psql

```bash
# Connect to database
psql $DATABASE_URL

# Useful commands
\dt                    # List tables
\d+ items             # Describe table
\di                   # List indexes
EXPLAIN ANALYZE ...   # Query performance
```

#### Using pgAdmin

1. Open pgAdmin at http://localhost:5050
2. Connect using credentials from docker-compose.yml
3. Use Query Tool for debugging

### RLS Debugging

#### Check Current Context

```sql
SELECT current_setting('app.current_user_id', true);
SELECT current_setting('app.current_organization_id', true);
```

#### Test RLS Policies

```sql
-- Set context
SELECT set_rls_context('user-id', 'org-id');

-- Test query
SELECT * FROM items;

-- Clear context
SELECT clear_rls_context();
```

## Debugging Tools

### Sentry Integration

#### Local Sentry Debugging

```typescript
// Force error to Sentry
Sentry.captureException(new Error('Test error'));

// Add breadcrumbs
Sentry.addBreadcrumb({
  message: 'User action',
  level: 'info',
  data: { action: 'clicked-button' },
});

// Check Sentry test page
// http://localhost:6061/sentry-test
```

### Logger Service

```typescript
import { createLogger } from '@/services/logger';
const logger = createLogger('my-module');

logger.info('Operation started', { userId });
logger.error('Operation failed', error);
logger.debug('Debug info', { data });
```

### Chrome Extensions

Recommended extensions:

- React Developer Tools
- Redux DevTools (for Zustand)
- Network Inspector
- Cookie Editor

## Common Debugging Scenarios

### Authentication Issues

```typescript
// Check JWT token
const token = request.unsignCookie(request.cookies['auth-token'])?.value;
console.log('JWT payload:', jwt.decode(token));

// Verify organization context
console.log('Org from header:', request.headers['x-organization-id']);
console.log('Org from cookie:', request.cookies['active-organization']);
```

### State Management

```typescript
// Debug Zustand store
import { useAuthStore } from '@/stores/auth';
const state = useAuthStore.getState();
console.log('Auth state:', state);

// Subscribe to changes
useAuthStore.subscribe((state) => {
  console.log('State changed:', state);
});
```

### API Issues

```typescript
// Add to tRPC client
const client = trpc.createClient({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' ||
        (opts.direction === 'down' && opts.result instanceof Error),
    }),
  ],
});
```

## Performance Debugging

### React Profiler

```typescript
import { Profiler } from 'react';

<Profiler id="ItemList" onRender={onRenderCallback}>
  <ItemList />
</Profiler>

function onRenderCallback(id, phase, actualDuration) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}
```

### Database Performance

```sql
-- Find slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze specific query
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM items WHERE organization_id = 'xxx';
```

### Bundle Analysis

```bash
# Analyze bundle size
pnpm --filter @ventry/web analyze

# Check build output
pnpm build
# Look for large chunks in output
```

## Debug Checklist

When debugging an issue:

1. **Reproduce the issue**
   - [ ] Can you reproduce it consistently?
   - [ ] What are the exact steps?
   - [ ] Does it happen in all environments?

2. **Gather information**
   - [ ] Check browser console
   - [ ] Check server logs
   - [ ] Check network requests
   - [ ] Check database queries

3. **Isolate the problem**
   - [ ] Frontend or backend?
   - [ ] Which component/procedure?
   - [ ] What changed recently?

4. **Fix and verify**
   - [ ] Implement fix
   - [ ] Test the fix
   - [ ] Check for side effects
   - [ ] Add test to prevent regression

## Related Documentation

- [Troubleshooting Guide](../01-getting-started/troubleshooting.md)
- [Testing Guide](./testing-guide.md)
- [Performance Optimization](../05-deployment/performance-optimization.md)
- [Monitoring Setup](../05-deployment/monitoring-setup.md)
