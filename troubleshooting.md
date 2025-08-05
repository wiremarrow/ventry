# Ventry Troubleshooting Guide

This comprehensive guide consolidates all troubleshooting information for the Ventry project. It covers common issues, solutions, and debugging techniques for authentication, database, build, runtime, and performance problems.

## Table of Contents

- [Common Issues and Solutions](#common-issues-and-solutions)
- [Authentication Problems](#authentication-problems)
- [Database Issues](#database-issues)
- [Build and Compilation Errors](#build-and-compilation-errors)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [Debugging Techniques](#debugging-techniques)

## Common Issues and Solutions

### Quick Start Problems

#### Services Not Starting

```bash
# Ensure all dependencies are installed
pnpm install

# Check if ports are already in use
lsof -i :6060  # Backend port
lsof -i :6061  # Frontend port
lsof -i :5487  # PostgreSQL port

# Kill process using port
kill -9 <PID>

# Start services with verbose logging
pnpm dev
```

#### Module Not Found Errors

```bash
# Clear cache and reinstall
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install

# Build workspace packages
pnpm build

# Rebuild TypeScript references
pnpm typecheck --build --force
```

## Authentication Problems

### "Invalid credentials" Error

If you receive an "Invalid credentials" error when trying to login:

1. **Verify Database Seeding**: Ensure you've run the seed script:

   ```bash
   pnpm --filter @ventry/database db:seed
   # OR for comprehensive seed data:
   pnpm --filter @ventry/database db:seed-comprehensive
   ```

2. **Check Demo Credentials**: All demo accounts use the password `password123`:
   - admin@ventry.com / password123
   - manager@ventry.com / password123
   - employee@ventry.com / password123
   - user@ventry.com / password123

3. **Clear Browser Cache**: Old authentication cookies can interfere:
   - Clear cookies for localhost:6061
   - Clear localStorage for auth-storage
   - Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+F5)

4. **Verify Backend is Running**:

   ```bash
   # Check if backend is responding
   curl http://localhost:6060/health

   # Ensure both services are running
   pnpm dev
   ```

### Dashboard Shows "UNAUTHORIZED" Error

**Symptoms:**

- Dashboard displays "Failed to load statistics" with "UNAUTHORIZED" error
- Login appears successful but API calls fail
- Organization list doesn't load

**Root Cause:**
The authentication system uses signed cookies. If cookies are read directly without unsigning, the JWT token will include the signature and fail verification.

**Solution:**
This is typically a backend implementation issue. Ensure all cookie reads use `request.unsignCookie()`:

```typescript
// Correct way to read auth cookie
const authCookie = request.cookies['auth-token'];
const token = authCookie ? request.unsignCookie(authCookie)?.value : undefined;
```

**Verification Steps:**

1. Check browser DevTools > Application > Cookies
2. Verify `auth-token` cookie exists
3. Check Network tab for API responses
4. Look for "Signed cookie string must be provided" errors in console

### "Signed cookie string must be provided" Error

**Cause:** Attempting to unsign a cookie that doesn't exist

**Solution:** Always check if cookie exists before unsigning:

```typescript
const cookie = request.cookies['cookie-name'];
const value = cookie ? request.unsignCookie(cookie)?.value : undefined;
```

### Organization Context Errors

If you see "No organization selected" errors:

- This is expected behavior for multi-tenant support
- The login process automatically assigns your first organization
- Use the organization switcher in the header to change organizations
- Check that `active-organization` cookie is set

### JWT Token Issues

**401 Unauthorized errors:**

1. Check if JWT token is expired (default: 7 days)
2. Verify token is sent in Authorization header or cookie
3. Check backend JWT_SECRET matches
4. Verify CORS configuration allows credentials

## Database Issues

### PostgreSQL Connection Problems

#### "Connection terminated unexpectedly"

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Start/restart PostgreSQL
./tools/scripts/switch-db.sh start

# Check database logs
docker logs ventry-postgres

# Verify connection string
echo $DATABASE_URL
```

#### Database Not Found

```bash
# Create database if missing
createdb -h localhost -p 5487 -U ventry ventry_dev

# Push schema
pnpm --filter @ventry/database db:push

# Run migrations
pnpm --filter @ventry/database db:migrate
```

### Migration Failures

#### "CREATE INDEX CONCURRENTLY cannot run inside a transaction"

**Cause:** Prisma runs migrations in transactions, but CONCURRENTLY requires non-transactional execution

**Solution:** Remove CONCURRENTLY from migration files or run manually:

```sql
-- Run outside of migration
CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

### Row-Level Security (RLS) Issues

#### Circular Dependency on Organization Loading

**Symptoms:**

- "Loading organization..." spinner never disappears
- Can't query organizations list

**Solution:**
Add read-only policy on organization_members that only requires user_id:

```sql
CREATE POLICY org_members_read_own
ON organization_members
FOR SELECT
USING (user_id = current_setting('app.current_user_id', true));
```

#### Data Not Filtering by Organization

**Verification:**

```sql
-- Check if RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'your_table';

-- Check existing policies
SELECT * FROM pg_policies
WHERE tablename = 'your_table';
```

## Build and Compilation Errors

### TypeScript Errors

#### React Query v5 Migration Issues

```typescript
// Old (v4)
const { isLoading } = useQuery();

// New (v5)
const { isPending } = useQuery();
```

#### Prisma Decimal Type Conversions

```typescript
// Convert Decimal to number
const numericValue = parseFloat(decimalValue.toString());
```

#### Missing Required Fields

Check that all required fields match the backend schema:

- Customer: customerCode, firstName, lastName, email
- Order: customerId, items array
- Purchase Order: supplierId, items array

### Next.js Build Issues

#### Turbopack Compatibility Issue

**Error:**

```
[Error [TurbopackInternalError]: Next.js package not found
Debug info:
- Execution of get_next_package failed
```

**Solution:** Turbopack is disabled due to monorepo compatibility issues. Use standard Webpack:

```bash
# Don't use --turbopack flag
pnpm --filter @ventry/web dev
```

#### ESLint 9 Compatibility

**Issue:** Next.js 15 with ESLint 9 causes `context.getScope is not a function` errors

**Solution:** Custom ESLint configuration is implemented that bypasses the Next.js config. This is a known issue tracked in Next.js GitHub.

### Module Resolution Issues

```bash
# Ensure backend is built before frontend
pnpm --filter @ventry/backend build
pnpm --filter @ventry/web build

# Clear Next.js cache
rm -rf apps/web/.next

# Rebuild everything
pnpm build
```

## Runtime Errors

### CORS Errors

**Verification:**

1. Check FRONTEND_URL in backend .env: `FRONTEND_URL=http://localhost:6061`
2. Check NEXT_PUBLIC_API_URL in frontend: `NEXT_PUBLIC_API_URL=http://localhost:6060`
3. Ensure credentials are included in requests

### API Proxy Issues

The frontend uses Next.js rewrites to proxy API requests. Check `next.config.js`:

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:6060/api/:path*',
    },
  ];
}
```

### Node.js Type Stripping Warning

**Warning during backend startup:**

```
ExperimentalWarning: Type stripping is an experimental feature
```

**Status:** This is harmless and related to Node.js experimental TypeScript support. It doesn't affect functionality.

## Performance Issues

### Slow Queries

**Debugging Steps:**

1. Enable query logging in Prisma:

   ```typescript
   const prisma = new PrismaClient({
     log: ['query', 'info', 'warn', 'error'],
   });
   ```

2. Check for missing indexes:

   ```sql
   -- Find slow queries
   SELECT query, calls, mean_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

3. Add appropriate indexes:
   ```sql
   CREATE INDEX idx_items_organization_id ON items(organization_id);
   CREATE INDEX idx_orders_customer_id ON orders(customer_id);
   ```

### High Memory Usage

**Common Causes:**

1. Memory leaks in subscriptions
2. Large result sets without pagination
3. Unclosed database connections

**Solutions:**

1. Use pagination for large queries:

   ```typescript
   const items = await prisma.item.findMany({
     take: 20,
     skip: page * 20,
   });
   ```

2. Properly close subscriptions:
   ```typescript
   useEffect(() => {
     const subscription = observable.subscribe();
     return () => subscription.unsubscribe();
   }, []);
   ```

### Dashboard Performance

**Auto-refresh Issues:**

- Default refresh interval: 30 seconds
- Can be toggled off with the refresh button
- Monitor Network tab for excessive API calls

## Debugging Techniques

### Browser DevTools

#### Console Commands

```javascript
// Enable debug logging
window.__DEBUG_API__ = true; // Log all API calls
window.__DEBUG_RENDERS__ = true; // Track component renders
window.__DEBUG_AUTH__ = true; // Log auth state changes

// Check current auth state
console.log(document.cookie);
console.log(localStorage.getItem('auth-storage'));
```

#### Network Tab

- Filter by XHR/Fetch to see API calls
- Check request/response headers
- Verify cookies are sent with requests
- Look for failed requests (red entries)

#### Application Tab

- Cookies: Check auth-token and active-organization
- Local Storage: Check auth-storage for user state
- Session Storage: Check for temporary data

### React Developer Tools

1. **Components Tab**:
   - Inspect props and state
   - Search for specific components
   - View component tree

2. **Profiler Tab**:
   - Record performance
   - Identify slow renders
   - Find unnecessary re-renders

### Sentry Integration

**View Errors:**

1. Go to https://sentry.io
2. Select your Ventry project
3. Check Issues tab for errors
4. View Performance tab for slow operations

**Test Sentry:**

```bash
# Visit the test page
open http://localhost:6061/sentry-test
```

### Custom Debug Utilities

```typescript
import { componentLog, logApiError, measurePerformance, useWhyDidYouUpdate } from '@/lib/debug';

// Component-specific logging
componentLog('LoginForm', 'User data:', userData);

// API error logging
logApiError('/api/auth/login', error);

// Performance measurement
await measurePerformance('fetchUserData', async () => {
  return await api.get('/users');
});

// Track why component re-rendered
useWhyDidYouUpdate('MyComponent', props);
```

### Backend Debugging

#### Enable Verbose Logging

```typescript
// In server.ts
fastify.addHook('onRequest', async (request, reply) => {
  console.log(`${request.method} ${request.url}`);
});

fastify.addHook('onResponse', async (request, reply) => {
  console.log(`${request.method} ${request.url} - ${reply.statusCode}`);
});
```

#### tRPC Error Details

```typescript
// Add detailed error logging
.mutation(async ({ ctx, input }) => {
  try {
    // ... procedure logic
  } catch (error) {
    console.error('Procedure error:', {
      procedure: 'procedureName',
      input,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
})
```

### Testing Issues

#### E2E Tests Failing

**Pre-test Checklist:**

```bash
# Ensure database is seeded
pnpm --filter @ventry/database db:seed

# Start services
pnpm dev

# Check services are running
curl http://localhost:6060/health
curl http://localhost:6061

# Run specific test
pnpm test:e2e -- --grep "login"
```

#### Integration Tests Timeout

**Solutions:**

1. Ensure test database exists:

   ```bash
   createdb -h localhost -p 5487 -U ventry ventry_integration_test
   ```

2. Increase test timeout:
   ```typescript
   it('should handle large dataset', async () => {
     // test code
   }, 30000); // 30 second timeout
   ```

### Environment Variable Issues

**Verification:**

```bash
# Check all required variables
cat .env | grep -E "DATABASE_URL|JWT_SECRET|FRONTEND_URL"

# Ensure no spaces around equals signs
DATABASE_URL=postgresql://...  # Correct
DATABASE_URL = postgresql://... # Wrong
```

## Quick Debug Checklist

When encountering issues, follow this checklist:

- [ ] Check browser console for JavaScript errors
- [ ] Verify network requests in DevTools (failed requests, CORS errors)
- [ ] Check React DevTools for component state
- [ ] Verify localStorage/cookies for auth data
- [ ] Check Sentry for production errors
- [ ] Review server logs for backend errors
- [ ] Test with different browsers
- [ ] Clear cache and hard reload (Cmd+Shift+R)
- [ ] Verify environment variables are set correctly
- [ ] Ensure database is running and accessible
- [ ] Check if all services are running (frontend, backend, database)
- [ ] Verify you've run database migrations and seeding

## Getting Help

If you're still experiencing issues after following this guide:

1. Check the browser console for specific error messages
2. Review server logs for detailed error information
3. Use the debug utilities in `/lib/debug.ts`
4. Check Sentry for error tracking
5. Search for the error message in the codebase
6. Review recent commits for related changes

Remember: Most issues are related to authentication cookies, database connections, or missing environment variables. Always start by checking these three areas first.
