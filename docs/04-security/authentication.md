# Authentication Guide

This guide covers Ventry's authentication implementation, including JWT tokens, signed cookies, and multi-tenant organization context.

## Authentication Architecture

### Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Next.js   │────▶│   tRPC API  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │                    │                    │
  Signed Cookies      tRPC Client         JWT Validation
  - auth-token       - Type safety        - User context
  - organization     - Auto retry         - Org context
```

### Key Components

1. **JWT Tokens**: Secure user authentication
2. **Signed Cookies**: Prevent tampering
3. **Organization Context**: Multi-tenant isolation
4. **tRPC Middleware**: Request authentication

## Implementation Details

### JWT Token Structure

```typescript
interface JWTPayload {
  userId: string;
  email: string;
  organizationId: string;
  membershipId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  iat: number;
  exp: number;
}
```

### Cookie Configuration

```typescript
// Secure cookie settings
const cookieOptions = {
  httpOnly: true, // Prevent XSS
  signed: true, // Prevent tampering
  sameSite: 'lax', // CSRF protection
  secure: isProduction, // HTTPS only in production
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

## Authentication Flow

### 1. Login Process

```typescript
// Backend: auth-service.ts
async login(email: string, password: string) {
  // 1. Validate credentials
  const user = await validateUser(email, password);

  // 2. Get user's organizations
  const memberships = await getUserMemberships(user.id);

  // 3. Select active organization
  const activeMembership = selectActiveMembership(memberships);

  // 4. Generate JWT
  const token = jwt.sign({
    userId: user.id,
    email: user.email,
    organizationId: activeMembership.organizationId,
    membershipId: activeMembership.id,
    role: activeMembership.role,
  }, JWT_SECRET, { expiresIn: '7d' });

  // 5. Set cookies
  setCookie(res, COOKIE_NAMES.AUTH_TOKEN, token);
  setCookie(res, COOKIE_NAMES.ACTIVE_ORGANIZATION, activeMembership.organizationId);

  return { user, membership: activeMembership };
}
```

### 2. Request Authentication

```typescript
// Backend: auth-middleware.ts
export async function authenticateRequest(req: FastifyRequest) {
  // 1. Extract auth cookie
  const authCookie = req.cookies[COOKIE_NAMES.AUTH_TOKEN];
  if (!authCookie) throw new TRPCError({ code: 'UNAUTHORIZED' });

  // 2. Unsign cookie (CRITICAL!)
  const unsigned = req.unsignCookie(authCookie);
  if (!unsigned.valid || !unsigned.value) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // 3. Verify JWT
  const payload = jwt.verify(unsigned.value, JWT_SECRET) as JWTPayload;

  // 4. Return user context
  return {
    user: {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    },
    organizationId: payload.organizationId,
    membershipId: payload.membershipId,
  };
}
```

### 3. Organization Switching

```typescript
// Frontend: use-organization.tsx
const switchOrganization = async (membershipId: string) => {
  const result = await switchOrgMutation.mutateAsync({ membershipId });

  // Server updates JWT and cookies
  // Client receives new context
  // UI updates automatically via React Query
};
```

## Security Best Practices

### 1. Signed Cookies

**CRITICAL**: Always unsign cookies before use!

```typescript
// ✅ CORRECT
const authCookie = request.cookies['auth-token'];
const token = authCookie ? request.unsignCookie(authCookie)?.value : undefined;

// ❌ WRONG - Will include signature!
const token = request.cookies['auth-token'];
```

### 2. Token Validation

```typescript
// Always validate tokens
try {
  const payload = jwt.verify(token, JWT_SECRET);
  // Additional checks
  if (Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }
} catch (error) {
  throw new TRPCError({ code: 'UNAUTHORIZED' });
}
```

### 3. Organization Context

```typescript
// Every authenticated procedure includes org context
export const organizationProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.organizationId) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }

  // Verify user has access to organization
  const membership = await ctx.prisma.organizationMember.findFirst({
    where: {
      userId: ctx.user.id,
      organizationId: ctx.organizationId,
      status: 'ACTIVE',
    },
  });

  if (!membership) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }

  return next({ ctx: { ...ctx, membership } });
});
```

## Common Authentication Errors

### 1. "Signed cookie string must be provided"

**Cause**: Cookie doesn't exist or is being read incorrectly

**Solution**:

```typescript
// Handle missing cookie
const authCookie = request.cookies['auth-token'];
if (!authCookie) {
  // Cookie doesn't exist
  throw new TRPCError({ code: 'UNAUTHORIZED' });
}
```

### 2. "JWT malformed"

**Cause**: Reading signed cookie directly without unsigning

**Solution**:

```typescript
// Always unsign first
const unsigned = request.unsignCookie(authCookie);
const token = unsigned.value; // Now it's the actual JWT
```

### 3. "Organization context missing"

**Cause**: JWT missing organizationId or cookie not set

**Solution**:

```typescript
// Ensure organization is set during login
if (!activeMembership) {
  throw new Error('User has no organization memberships');
}
```

## Testing Authentication

### Unit Tests

```typescript
describe('AuthService', () => {
  it('should generate valid JWT on login', async () => {
    const result = await authService.login('test@example.com', 'password');

    expect(result.token).toBeDefined();
    expect(jwt.verify(result.token, JWT_SECRET)).toMatchObject({
      userId: expect.any(String),
      organizationId: expect.any(String),
    });
  });
});
```

### Integration Tests

```typescript
describe('Auth Flow', () => {
  it('should maintain organization context', async () => {
    // Login
    const loginRes = await request(app)
      .post('/trpc/auth.login')
      .send({ email: 'test@example.com', password: 'password' });

    const cookies = loginRes.headers['set-cookie'];

    // Make authenticated request
    const itemsRes = await request(app).get('/trpc/items.list').set('Cookie', cookies);

    expect(itemsRes.status).toBe(200);
    // Items should be filtered by organization
  });
});
```

### E2E Tests

```typescript
test('complete auth flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Verify redirect to dashboard
  await expect(page).toHaveURL('/dashboard');

  // Switch organization
  await page.click('[data-testid="org-switcher"]');
  await page.click('[data-testid="org-option-2"]');

  // Verify data updates
  await expect(page.locator('[data-testid="org-name"]')).toContainText('New Org');
});
```

## Debugging Authentication

### 1. Check JWT Contents

```typescript
// In browser console
const token = document.cookie.match(/auth-token=([^;]+)/)?.[1];
if (token) {
  // Decode (note: this is still signed)
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('JWT payload:', payload);
}
```

### 2. Verify Cookies

```typescript
// Backend logging
server.addHook('onRequest', async (request) => {
  console.log('Cookies:', request.cookies);
  console.log('Headers:', request.headers);
});
```

### 3. Test Organization Context

```sql
-- Check RLS context in database
SELECT current_setting('app.current_user_id', true);
SELECT current_setting('app.current_organization_id', true);
```

## Security Checklist

- [ ] JWT secret is strong and rotated regularly
- [ ] Cookies are signed and httpOnly
- [ ] HTTPS enforced in production
- [ ] Token expiration is reasonable (7 days)
- [ ] Organization access is verified on each request
- [ ] Failed login attempts are rate limited
- [ ] Passwords are hashed with bcrypt (12+ rounds)
- [ ] Sessions can be revoked
- [ ] Audit logs track authentication events

## Next Steps

- Review [Row-Level Security](./row-level-security.md) for data isolation
- Check [Security Overview](./security-overview.md) for overall security posture
- See [Hardening Checklist](./hardening-checklist.md) for production readiness
