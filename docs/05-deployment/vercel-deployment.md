# Vercel Deployment Guide

This guide covers deploying the Ventry Next.js frontend to Vercel, including configuration, optimization, and best practices.

## Prerequisites

- Vercel account (free tier works for testing)
- GitHub/GitLab/Bitbucket repository
- Environment variables ready
- Backend API deployed and accessible

## Deployment Methods

### 1. Vercel Dashboard (Recommended)

1. **Import Project**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Select your Git provider
   - Choose the ventry repository
   - Select the `apps/web` directory as root

2. **Configure Project**
   ```yaml
   Framework Preset: Next.js
   Root Directory: apps/web
   Build Command: cd ../.. && pnpm build --filter=@ventry/web
   Output Directory: apps/web/.next
   Install Command: pnpm install
   ```

3. **Environment Variables**
   Add these in the Vercel dashboard:
   ```env
   NEXT_PUBLIC_API_URL=https://api.ventry.app
   NEXT_PUBLIC_APP_URL=https://ventry.app
   NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
   ```

### 2. Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from apps/web directory
cd apps/web
vercel

# Deploy to production
vercel --prod
```

### 3. GitHub Integration

1. **Connect Repository**
   - Go to Vercel dashboard
   - Import from GitHub
   - Authorize Vercel app
   - Select repository

2. **Automatic Deployments**
   - Push to `main` → Production deployment
   - Open PR → Preview deployment
   - Merge PR → Production update

## Configuration

### vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "cd ../.. && pnpm build --filter=@ventry/web",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "devCommand": "pnpm dev",
  "functions": {
    "app/api/health/route.ts": {
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.ventry.app/:path*"
    }
  ],
  "redirects": [
    {
      "source": "/old-page",
      "destination": "/new-page",
      "permanent": true
    }
  ],
  "regions": ["iad1", "sfo1", "sin1"],
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Environment Variables

```bash
# Production Environment Variables

# Public (exposed to browser)
NEXT_PUBLIC_API_URL=https://api.ventry.app
NEXT_PUBLIC_APP_URL=https://ventry.app
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Server-side only
SENTRY_AUTH_TOKEN=xxx
SENTRY_ORG=ventry
SENTRY_PROJECT=web
ANALYZE=false

# Feature flags
NEXT_PUBLIC_FEATURE_AI_ASSISTANT=true
NEXT_PUBLIC_FEATURE_ADVANCED_ANALYTICS=false
```

## Optimization

### 1. Build Optimization

```javascript
// next.config.js
module.exports = {
  // Enable SWC minification
  swcMinify: true,
  
  // Optimize images
  images: {
    domains: ['ventry.app', 'images.ventry.app'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Bundle analyzer
  webpack: (config, { isServer }) => {
    if (process.env.ANALYZE) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
        })
      );
    }
    return config;
  },
};
```

### 2. Edge Functions

```typescript
// app/api/geo/route.ts
export const runtime = 'edge'; // Use Edge Runtime

export async function GET(request: Request) {
  const geo = request.headers.get('x-vercel-ip-country');
  return Response.json({ country: geo });
}
```

### 3. ISR (Incremental Static Regeneration)

```typescript
// app/products/[id]/page.tsx
export const revalidate = 3600; // Revalidate every hour

export async function generateStaticParams() {
  const products = await getPopularProducts();
  return products.map((product) => ({
    id: product.id,
  }));
}
```

### 4. Image Optimization

```typescript
import Image from 'next/image';

export function ProductImage({ src, alt }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      quality={85}
      placeholder="blur"
      blurDataURL={blurDataUrl}
      priority={false}
      loading="lazy"
    />
  );
}
```

## Performance Monitoring

### 1. Web Vitals

```typescript
// app/layout.tsx
export function reportWebVitals(metric) {
  // Send to analytics
  window.gtag('event', metric.name, {
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    event_category: 'Web Vitals',
    event_label: metric.id,
    non_interaction: true,
  });
}
```

### 2. Vercel Analytics

```bash
# Install analytics
pnpm add @vercel/analytics

# Add to layout
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 3. Speed Insights

```bash
# Install speed insights
pnpm add @vercel/speed-insights

# Add to layout
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

## Domain Configuration

### 1. Add Custom Domain

```bash
# Via CLI
vercel domains add ventry.app

# Or in dashboard
Settings → Domains → Add
```

### 2. DNS Configuration

```dns
# A Records (if using root domain)
A     @     76.76.21.21
A     @     76.223.126.88

# CNAME (if using subdomain)
CNAME www   cname.vercel-dns.com

# Wildcard (for preview deployments)
CNAME *     cname.vercel-dns.com
```

### 3. SSL Configuration

- Automatic SSL provisioning
- Let's Encrypt certificates
- Auto-renewal
- Force HTTPS in vercel.json

## Preview Deployments

### Branch Previews

```yaml
# Every push creates a preview
https://ventry-git-feature-branch-team.vercel.app

# Comment on PR with preview URL
# Automatic lighthouse scores
# Shareable links
```

### Preview Protection

```javascript
// middleware.ts
export function middleware(request: NextRequest) {
  // Password protect preview deployments
  if (process.env.VERCEL_ENV === 'preview') {
    const basicAuth = request.headers.get('authorization');
    
    if (!basicAuth || !verifyAuth(basicAuth)) {
      return new Response('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
      });
    }
  }
}
```

## Monitoring and Alerts

### 1. Function Logs

```bash
# View function logs
vercel logs

# Filter by function
vercel logs --filter function-name

# Follow logs
vercel logs --follow
```

### 2. Error Tracking

```typescript
// Sentry integration
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 0.1,
});
```

### 3. Alerts Configuration

```json
{
  "alerts": {
    "email": ["alerts@ventry.com"],
    "slack": "https://hooks.slack.com/xxx",
    "rules": [
      {
        "metric": "error_rate",
        "threshold": 0.01,
        "window": "5m"
      },
      {
        "metric": "response_time",
        "threshold": 1000,
        "window": "5m"
      }
    ]
  }
}
```

## Cost Optimization

### 1. Function Configuration

```javascript
// Reduce function size
export const config = {
  // Opt out of bundling certain packages
  unstable_excludeFiles: [
    'node_modules/@swc/core-linux-x64-gnu',
    'node_modules/@swc/core-linux-x64-musl',
  ],
};
```

### 2. Bandwidth Optimization

```javascript
// Use efficient caching headers
export async function GET() {
  return new Response(data, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'CDN-Cache-Control': 'max-age=604800',
    },
  });
}
```

### 3. Build Cache

```json
{
  "buildCommand": "pnpm build:cached",
  "framework": {
    "buildCache": {
      "maximize": true
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   vercel logs --build
   
   # Common fixes:
   - Clear cache: vercel --force
   - Check Node version
   - Verify env variables
   ```

2. **Function Timeouts**
   ```javascript
   // Increase timeout
   export const maxDuration = 60; // seconds
   ```

3. **Memory Issues**
   ```javascript
   // Monitor memory usage
   console.log('Memory:', process.memoryUsage());
   ```

### Debug Mode

```bash
# Enable debug logging
VERCEL_DEBUG=1 vercel

# Check deployment details
vercel inspect deployment-url
```

## Best Practices

1. **Use Environment Variables**
   - Never hardcode secrets
   - Use NEXT_PUBLIC_ prefix for client vars
   - Different values per environment

2. **Optimize Bundle Size**
   - Dynamic imports for large components
   - Tree shake unused code
   - Analyze bundle regularly

3. **Cache Effectively**
   - Use ISR for semi-static content
   - Set appropriate cache headers
   - Leverage Vercel's Edge Cache

4. **Monitor Performance**
   - Set up Web Vitals tracking
   - Use Vercel Analytics
   - Regular Lighthouse audits

5. **Security Headers**
   - Configure in vercel.json
   - Test with securityheaders.com
   - Regular security audits

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Custom domain set up
- [ ] SSL certificate active
- [ ] Security headers configured
- [ ] Error tracking enabled
- [ ] Analytics configured
- [ ] Preview protection (if needed)
- [ ] Build optimizations applied
- [ ] Monitoring alerts set up
- [ ] Cost alerts configured

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Edge Functions Guide](https://vercel.com/docs/functions/edge-functions)
- [Limits and Pricing](https://vercel.com/docs/limits)