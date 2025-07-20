# Ventry Troubleshooting Guide

## Authentication Issues

### Dashboard Shows "UNAUTHORIZED" Error

**Symptoms:**
- Dashboard displays "Failed to load statistics" with "UNAUTHORIZED" error
- Login appears successful but API calls fail
- Organization list doesn't load

**Root Cause:**
The authentication system uses signed cookies. If cookies are read directly without unsigning, the JWT token will include the signature and fail verification.

**Solution:**
Ensure all cookie reads use `request.unsignCookie()`:

```typescript
// Correct way to read auth cookie
const authCookie = request.cookies['auth-token'];
const token = authCookie ? request.unsignCookie(authCookie)?.value : undefined;
```

**Verification Steps:**
1. Check browser DevTools > Application > Cookies
2. Verify `auth-token` cookie exists
3. Check Network tab for API responses
4. Look for "Signed cookie string must be provided" errors

### "Signed cookie string must be provided" Error

**Cause:** Attempting to unsign a cookie that doesn't exist

**Solution:** Always check if cookie exists before unsigning:
```typescript
const cookie = request.cookies['cookie-name'];
const value = cookie ? request.unsignCookie(cookie)?.value : undefined;
```

### Organization Context Not Set

**Symptoms:**
- API calls return "No organization selected"
- Dashboard loads but shows no data

**Root Cause:**
Organization ID not being sent with requests

**Solution:**
1. Verify organization context is properly set in the application state
2. Check `x-organization-id` header in API requests
3. Ensure organization selection updates the context

## Row-Level Security (RLS) Issues

### Circular Dependency on Organization Loading

**Symptoms:**
- "Loading organization..." spinner never disappears
- Can't query organizations list

**Root Cause:**
RLS policies require organization context to query organization_members, but you need to query it to get organizations.

**Solution:**
Add read-only policy on organization_members that only requires user_id:

```sql
CREATE POLICY org_members_read_own
ON organization_members
FOR SELECT
USING (user_id = current_setting('app.current_user_id', true));
```

### Data Not Filtering by Organization

**Symptoms:**
- Users see data from other organizations
- Queries return all data regardless of context

**Causes:**
1. RLS not enabled on table
2. Missing RLS policy
3. Organization context not set in query

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

## Database Connection Issues

### "Connection terminated unexpectedly"

**Causes:**
1. Database server not running
2. Connection pool exhausted
3. Network issues

**Solutions:**
1. Check PostgreSQL is running: `docker ps | grep postgres`
2. Restart database: `docker-compose restart postgres`
3. Check connection pool settings in Prisma

### Migration Failures

**"CREATE INDEX CONCURRENTLY cannot run inside a transaction"**

**Cause:** Prisma runs migrations in transactions, but CONCURRENTLY requires non-transactional execution

**Solution:** Remove CONCURRENTLY from migration files or run manually:
```sql
-- Run outside of migration
CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

## Development Environment Issues

### Port Already in Use

**Error:** "address already in use :::6060"

**Solution:**
```bash
# Find process using port
lsof -i :6060

# Kill process
kill -9 <PID>

# Or use different port
PORT=6061 pnpm dev
```

### Module Not Found Errors

**Common Causes:**
1. Dependencies not installed
2. Workspace dependencies not built
3. TypeScript paths not configured

**Solutions:**
```bash
# Install all dependencies
pnpm install

# Build workspace packages
pnpm build

# Clear cache and reinstall
rm -rf node_modules
pnpm install
```

## Performance Issues

### Slow Queries

**Debugging Steps:**
1. Enable query logging in Prisma
2. Check for missing indexes
3. Analyze query plans

```typescript
// Enable query logging
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### High Memory Usage

**Common Causes:**
1. Memory leaks in subscriptions
2. Large result sets
3. Unclosed database connections

**Solutions:**
1. Use pagination for large queries
2. Properly close subscriptions
3. Monitor connection pool

## Testing Issues

### E2E Tests Failing

**Common Causes:**
1. Backend not running
2. Wrong environment variables
3. Database not seeded

**Pre-test Checklist:**
```bash
# Start services
pnpm dev

# Check services are running
curl http://localhost:6060/health
curl http://localhost:6061

# Run tests
pnpm test:e2e
```

### Integration Tests Timeout

**Cause:** Database not accessible or slow

**Solutions:**
1. Ensure test database exists
2. Check database performance
3. Increase test timeout

```typescript
// Increase timeout for slow operations
it('should handle large dataset', async () => {
  // test code
}, 30000); // 30 second timeout
```