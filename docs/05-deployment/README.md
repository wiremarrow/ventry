# Deployment Documentation

This section covers everything related to deploying Ventry to production.

## 📚 Documentation Structure

### [Deployment Overview](./deployment-overview.md)

Complete guide to deploying Ventry, including architecture, environments, and deployment strategies.

### [Vercel Deployment](./vercel-deployment.md)

Step-by-step guide for deploying the Next.js frontend to Vercel, including configuration and optimization.

### [Backend Deployment](./backend-deployment.md)

Guide for deploying the tRPC + Fastify backend, including containerization and hosting options.

### [Environment Configuration](./environment-configuration.md)

Comprehensive guide to environment variables, secrets management, and configuration best practices.

### [Performance Optimization](./performance-optimization.md)

Techniques and strategies for optimizing Ventry's performance in production.

### [Monitoring Setup](./monitoring-setup.md)

Setting up monitoring, logging, and alerting for production deployments.

## 🚀 Quick Deployment Guide

### Prerequisites

- Node.js 20 LTS
- PostgreSQL 16+ database
- Vercel account (for frontend)
- Docker (for backend containerization)

### Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

### Backend Deployment (Docker)

```bash
# Build container
docker build -t ventry-backend apps/backend

# Run container
docker run -p 4000:4000 --env-file .env.production ventry-backend
```

### Database Setup

```bash
# Run migrations
DATABASE_URL=your-production-url pnpm db:migrate:deploy

# Verify RLS
pnpm db:verify-rls
```

## 🌍 Deployment Environments

### Development

- **Frontend**: http://localhost:6061
- **Backend**: http://localhost:6060
- **Database**: Local PostgreSQL with Docker

### Staging

- **Frontend**: https://staging.ventry.app
- **Backend**: https://api-staging.ventry.app
- **Database**: Staging PostgreSQL instance

### Production

- **Frontend**: https://ventry.app
- **Backend**: https://api.ventry.app
- **Database**: Production PostgreSQL with backups

## 🔧 Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Security audit completed
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Monitoring configured

### Deployment

- [ ] Deploy database migrations
- [ ] Deploy backend services
- [ ] Deploy frontend application
- [ ] Verify health checks
- [ ] Test critical paths

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify data integrity
- [ ] Update documentation
- [ ] Notify stakeholders

## 📊 Key Metrics to Monitor

- **Response Time**: < 200ms p95
- **Error Rate**: < 0.1%
- **Uptime**: > 99.9%
- **Database Connections**: < 80% of pool
- **Memory Usage**: < 80% of allocated

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check connection string
   - Verify network access
   - Check connection pool settings

2. **Authentication Failures**
   - Verify JWT secret is set
   - Check cookie configuration
   - Verify RLS context

3. **Performance Issues**
   - Check database indexes
   - Review query performance
   - Monitor memory usage

## 🔄 Rollback Procedures

### Quick Rollback

```bash
# Revert to previous version
vercel rollback

# Or for backend
kubectl rollout undo deployment/ventry-backend
```

### Database Rollback

```bash
# Always backup first!
pg_dump $DATABASE_URL > backup.sql

# Rollback migration
pnpm db:migrate:rollback
```

## 📞 Support Contacts

- **DevOps Team**: devops@ventry.com
- **On-Call**: +1-XXX-XXX-XXXX
- **Escalation**: escalation@ventry.com

## Next Steps

1. Review [Deployment Overview](./deployment-overview.md) for detailed architecture
2. Follow platform-specific guides for your deployment target
3. Configure monitoring with [Monitoring Setup](./monitoring-setup.md)
4. Optimize performance using [Performance Optimization](./performance-optimization.md)
