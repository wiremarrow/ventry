# Deployment Guide

Ventry supports multiple deployment strategies with Vercel as the primary platform for the Next.js frontend.

## Deployment Overview

- **Frontend (Next.js)**: Vercel (automatic deployments)
- **Backend (tRPC + Fastify)**: Docker containers (various platforms)
- **Database**: PostgreSQL (managed service recommended)
- **Monitoring**: Sentry (automatic integration)

## Vercel Deployment (Frontend)

### Initial Setup

1. **Install Vercel CLI**

   ```bash
   pnpm add -g vercel
   ```

2. **Link your project**

   ```bash
   vercel link
   ```

   This will create `.vercel` directory with project configuration.

3. **Configure environment variables**

   ```bash
   # Production variables
   vercel env add DATABASE_URL production
   vercel env add OPENAI_API_KEY production
   vercel env add ANTHROPIC_API_KEY production
   vercel env add SENTRY_DSN production

   # Preview variables (for PRs)
   vercel env add DATABASE_URL preview
   # ... repeat for other variables
   ```

### Deployment Commands

```bash
# Deploy to preview (staging)
vercel

# Deploy to production
vercel --prod

# Deploy specific branch
vercel --prod --scope your-team
```

### Automatic Deployments

With GitHub integration:

- **Production**: Deploys on push to `main`
- **Preview**: Deploys on every PR
- **Comments**: Bot adds deployment URLs to PRs

### Configuration

The `vercel.json` file controls:

- Build settings
- Environment variables
- Headers and redirects
- Function configuration

## Backend Deployment

### Docker Deployment

1. **Build the image**

   ```bash
   docker build -t ventry-backend -f apps/backend/Dockerfile .
   ```

2. **Push to registry**

   ```bash
   # GitHub Container Registry
   docker tag ventry-backend ghcr.io/your-org/ventry-backend:latest
   docker push ghcr.io/your-org/ventry-backend:latest
   ```

3. **Deploy to platform**
   - **AWS ECS**: Use task definitions
   - **Google Cloud Run**: Direct container deployment
   - **Digital Ocean**: App Platform
   - **Railway**: Direct GitHub integration

### Environment Variables

Required for backend:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
SENTRY_DSN=...
```

## Database Deployment

### PostgreSQL Options

1. **Managed Services** (Recommended)
   - [Neon](https://neon.tech/) - Serverless PostgreSQL
   - [Supabase](https://supabase.com/) - PostgreSQL with extras
   - [Railway](https://railway.app/) - Simple PostgreSQL hosting
   - [AWS RDS](https://aws.amazon.com/rds/) - Enterprise option

2. **Connection Pooling**
   - Use PgBouncer for connection pooling
   - Most managed services include this

### Database Migrations

```bash
# Run migrations before deployment
pnpm db:migrate

# Or in CI/CD
DATABASE_URL=$PROD_DB_URL pnpm db:migrate
```

## CI/CD Pipeline

### GitHub Actions Workflow

The deployment workflow (`deploy.yml`) handles:

1. **Environment Detection**
   - `main` branch → Staging
   - Tags (`v*`) → Production

2. **Database Migrations**
   - Runs before deployment
   - Validates schema changes

3. **Deployment Steps**
   - Frontend → Vercel
   - Backend → Container registry
   - Notifications → Slack

### Manual Deployment

```bash
# Frontend only
vercel --prod

# Backend only
docker build -t ventry-backend -f apps/backend/Dockerfile .
docker push ghcr.io/your-org/ventry-backend:latest
# Then trigger deployment on your platform

# Full deployment
pnpm deploy:all
```

## Monitoring & Alerts

### Sentry Integration

Automatic error tracking:

- Frontend errors with session replay
- Backend errors with context
- Performance monitoring
- Custom alerts

### Health Checks

1. **Frontend**
   - Vercel provides automatic monitoring
   - Custom health endpoint: `/api/health`

2. **Backend**
   - Health endpoint: `/health`
   - Readiness endpoint: `/ready`
   - Metrics endpoint: `/metrics`

### Logging

- **Development**: Console output
- **Production**: Structured JSON logs
- **Aggregation**: Use service like Datadog or Logtail

## Rollback Procedures

### Vercel (Frontend)

```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback [deployment-url]

# Or use Vercel dashboard
```

### Backend

```bash
# Tag-based rollback
docker pull ghcr.io/your-org/ventry-backend:previous-tag
# Redeploy with previous tag

# Database rollback
pnpm db:migrate:rollback
```

## Production Checklist

### Before Deployment

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] API endpoints documented
- [ ] Rate limiting configured
- [ ] CORS settings verified
- [ ] Security headers in place

### After Deployment

- [ ] Health checks passing
- [ ] Sentry receiving events
- [ ] Performance metrics normal
- [ ] No console errors
- [ ] Features working as expected
- [ ] Database queries optimized
- [ ] Cache headers correct

## Scaling Considerations

### Frontend (Vercel)

- Automatic scaling
- Global CDN included
- Edge functions for API routes
- Image optimization built-in

### Backend

1. **Horizontal Scaling**
   - Run multiple containers
   - Load balancer in front
   - Session management with Redis

2. **Database Scaling**
   - Read replicas for queries
   - Connection pooling
   - Query optimization
   - Caching layer (Redis)

3. **AI/LLM Scaling**
   - Rate limiting per user
   - Response caching
   - Queue for long operations
   - Cost monitoring

## Security Checklist

- [ ] HTTPS everywhere
- [ ] Environment variables encrypted
- [ ] Database connections use SSL
- [ ] API rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers implemented
- [ ] Dependencies up to date
- [ ] Secrets rotated regularly

## Cost Optimization

### Vercel

- Free tier: 100GB bandwidth
- Pro: $20/month per member
- Monitor usage in dashboard

### Database

- Start with free tiers
- Scale based on usage
- Use connection pooling
- Optimize queries

### Monitoring

- Sentry free tier: 5k errors/month
- Upgrade as needed

## Troubleshooting

### Common Issues

1. **Build Failures**

   ```bash
   # Check build logs
   vercel logs [deployment-url]

   # Local build test
   pnpm build
   ```

2. **Database Connection**
   - Verify DATABASE_URL
   - Check SSL requirements
   - Test connection limits

3. **Environment Variables**

   ```bash
   # List all env vars
   vercel env ls

   # Pull to .env.local
   vercel env pull
   ```

### Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- [GitHub Actions Status](https://www.githubstatus.com/)
- [Sentry Status](https://status.sentry.io/)
