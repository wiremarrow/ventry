# Ventry Frontend Debugging Guide

## State-of-the-Art Debugging Techniques

### 1. React Developer Tools

Install the React Developer Tools browser extension for advanced debugging:

- **Profiler Tab**: Record performance and identify slow renders
- **Components Tab**: Inspect props, state, and hooks
- **Highlight Updates**: See which components re-render

### 2. Sentry Integration (Already Configured!)

Sentry automatically captures:

- JavaScript errors with stack traces
- Breadcrumbs (user actions leading to errors)
- Performance metrics
- Session replays (with upgrade)

To view errors:

1. Go to https://sentry.io
2. Select your Ventry project
3. Check Issues tab for errors
4. View Performance tab for slow operations

### 3. Browser DevTools Advanced Features

#### Console Commands

```javascript
// Monitor all API calls
window.__DEBUG_API__ = true;

// Track component renders
window.__DEBUG_RENDERS__ = true;

// Log auth state changes
window.__DEBUG_AUTH__ = true;
```

#### Network Tab

- Filter by XHR/Fetch to see API calls
- Check request/response headers
- Verify JWT tokens in Authorization headers
- Look for CORS errors

#### Application Tab

- Check localStorage for `auth-storage`
- Verify cookies for `auth-token`
- Inspect IndexedDB for Zustand persist

### 4. Custom Debug Utilities

We've added debug utilities in `/lib/debug.ts`:

```typescript
// Component-specific logging
componentLog('LoginForm', 'User data:', userData);

// API error logging with context
logApiError('/api/auth/login', error);

// Performance measurement
await measurePerformance('fetchUserData', async () => {
  return await api.get('/users');
});

// Track why component re-rendered
useWhyDidYouUpdate('MyComponent', props);
```

### 5. Vercel Runtime Logs

For production debugging:

1. Go to Vercel dashboard
2. Select your project
3. Click "Functions" tab
4. View real-time logs

### 6. Next.js Error Overlay

In development, Next.js shows:

- Compilation errors
- Runtime errors with stack traces
- Build errors
- Fast refresh for instant feedback

### 7. Common Login Issues & Solutions

#### Issue: Login redirects back to login page

**Debug Steps:**

1. Open DevTools → Network tab
2. Try to login
3. Check `/api/auth/login` response
4. Verify response contains `accessToken`
5. Check Application → localStorage for `auth-storage`
6. Check Application → Cookies for `auth-token`

#### Issue: 401 Unauthorized errors

**Debug Steps:**

1. Check if JWT token is expired
2. Verify token is sent in Authorization header
3. Check backend JWT_SECRET matches
4. Verify CORS configuration

#### Issue: Login returns 401 "Invalid credentials"

**Solution**: Database needs demo users

```bash
pnpm db:seed
```

Creates: admin@ventry.com/admin123, manager@ventry.com/manager123, user@ventry.com/user123

#### Issue: CORS errors

**Debug Steps:**

1. Verify FRONTEND_URL in backend .env
2. Check NEXT_PUBLIC_API_URL in frontend
3. Ensure ports match (6060 for backend, 6061 for frontend)

### 8. Enhanced Error Boundaries

Add error boundaries to catch and log errors:

```typescript
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/nextjs';

function ErrorFallback({ error, resetErrorBoundary }) {
  // Log to Sentry
  Sentry.captureException(error);

  return (
    <div>
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// Wrap your components
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <YourComponent />
</ErrorBoundary>
```

### 9. Performance Monitoring

```typescript
// Use React Profiler API
import { Profiler } from 'react';

function onRenderCallback(id, phase, actualDuration) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}

<Profiler id="LoginForm" onRender={onRenderCallback}>
  <LoginForm />
</Profiler>
```

### 10. Debug Commands

Add these to your package.json for quick debugging:

```json
{
  "scripts": {
    "dev:debug": "NODE_OPTIONS='--inspect' next dev",
    "analyze": "ANALYZE=true next build",
    "trace": "next build --debug --profile"
  }
}
```

## Quick Debug Checklist

- [ ] Check browser console for errors
- [ ] Verify network requests in DevTools
- [ ] Check React DevTools for state
- [ ] Verify localStorage/cookies
- [ ] Check Sentry for production errors
- [ ] Review Vercel function logs
- [ ] Test with different browsers
- [ ] Clear cache and hard reload

## Environment Variables Check

Frontend (.env.local):

```
NEXT_PUBLIC_API_URL=http://localhost:6060/api
```

Backend (.env):

```
PORT=6060
FRONTEND_URL=http://localhost:6061
JWT_SECRET=dev-super-secret-jwt-key-for-development-only
```

## Need More Help?

1. Check the browser console first
2. Use the debug utilities we've added
3. Check Sentry for error details
4. Review network requests
5. Verify environment configuration
