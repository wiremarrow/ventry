# External Services Configuration Guide

This comprehensive guide consolidates all external service configurations required for Ventry. It covers GitHub repository setup, CI/CD configuration, deployment services, monitoring, and database providers.

## Table of Contents

1. [Quick Start with Automated Scripts](#quick-start-with-automated-scripts)
2. [GitHub Repository Configuration](#github-repository-configuration)
3. [CI/CD Pipeline Setup](#cicd-pipeline-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Database Services](#database-services)
6. [Sentry Error Tracking](#sentry-error-tracking)
7. [Optional Services](#optional-services)
8. [Environment Configuration](#environment-configuration)
9. [Security Configuration](#security-configuration)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start with Automated Scripts

We provide automated scripts that configure ~90% of the external services setup:

```bash
# Step 1: Configure GitHub repository settings
# Automates branch protection, security features, and environments
./tools/scripts/setup-github-repo.sh

# Step 2: Configure all required secrets interactively
./tools/scripts/setup-ci-secrets.sh

# Step 3: Validate your setup
./tools/scripts/validate-ci-setup.sh
```

### What's Automated vs Manual

#### ✅ Fully Automated (via scripts)
- Branch protection with all required CI jobs
- Security features (vulnerability alerts, Dependabot)
- Environment creation (staging, production)
- Secret configuration via CLI prompts
- Setup validation and verification

#### ⚠️ Still Manual (external services)
- Creating accounts on external services
- Getting API tokens from these services
- Linking Vercel project
- Database provisioning

---

## GitHub Repository Configuration

### Initial Repository Setup

```bash
# If not already done
git init
git add .
git commit -m "feat: initial project setup with CI/CD pipelines"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ventry.git
git push -u origin main
```

### Branch Protection Rules

Configure branch protection for the `main` branch with these settings:

#### Required Status Checks
All these checks must pass before merging:
- **Documentation Check** - Enforces README.md/TODO.md updates
- **Lint and Type Check** - ESLint + TypeScript validation
- **Unit Tests** - Vitest on Node.js 20 LTS
- **PostgreSQL Integration Tests** - Real database operations
- **E2E Tests - chromium (1)** - Browser testing, shard 1/2
- **E2E Tests - chromium (2)** - Browser testing, shard 2/2
- **E2E Tests - firefox (1)** - Browser testing, shard 1/2
- **E2E Tests - firefox (2)** - Browser testing, shard 2/2
- **E2E Tests - webkit (1)** - Browser testing, shard 1/2
- **E2E Tests - webkit (2)** - Browser testing, shard 2/2
- **Build** - Production build with Sentry integration
- **Coverage Gate** - Test coverage threshold validation

#### Pull Request Settings
- ✅ Require a pull request before merging
  - ✅ Require approvals: 1
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from CODEOWNERS
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution before merging
- ✅ Require linear history
- ✅ Include administrators

### GitHub Environments

Create two environments in **Settings** → **Environments**:

#### Staging Environment
- No protection rules
- Secrets:
  - `DATABASE_URL` - Staging database connection string
  - `VERCEL_ENV` = "preview"
  - `OPENAI_API_KEY` - Staging API key
  - `ANTHROPIC_API_KEY` - Staging API key

#### Production Environment
- Required reviewers: 1-2 team members
- Deployment branches: `main` only
- Secrets:
  - `DATABASE_URL` - Production database connection string
  - `VERCEL_ENV` = "production"
  - `OPENAI_API_KEY` - Production API key
  - `ANTHROPIC_API_KEY` - Production API key

---

## CI/CD Pipeline Setup

### Required Repository Secrets

Navigate to **Settings** → **Secrets and variables** → **Actions** and add:

| Secret Name | Description | Required | How to Get |
|------------|-------------|----------|------------|
| `TURBO_TOKEN` | Turborepo remote caching | Yes | [Sign up at turbo.build](https://turbo.build/repo/docs/core-concepts/remote-caching) |
| `TURBO_TEAM` | Your Turborepo team name | Yes | From your Turbo dashboard |
| `DATABASE_URL` | PostgreSQL connection string | Yes | From your database provider |
| `VERCEL_TOKEN` | Vercel deployment token | Yes | [Get from Vercel dashboard](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel organization ID | Yes | Run `vercel link` locally |
| `VERCEL_PROJECT_ID` | Vercel project ID | Yes | Run `vercel link` locally |
| `SENTRY_DSN` | Error tracking DSN | Yes | From Sentry project settings |
| `SENTRY_ORG` | Sentry organization slug | Yes | From Sentry settings |
| `SENTRY_PROJECT` | Sentry project slug | Yes | From Sentry settings |
| `SENTRY_AUTH_TOKEN` | Sentry API token | Yes | [Create auth token](https://sentry.io/settings/auth-tokens/) |
| `CODECOV_TOKEN` | Code coverage reporting | No | [Sign up at codecov.io](https://codecov.io/) |
| `SLACK_WEBHOOK_URL` | Deployment notifications | No | [Create Slack webhook](https://api.slack.com/messaging/webhooks) |

### Turborepo Setup

```bash
# Install Turbo CLI
pnpm add -g turbo

# Login to Turborepo
turbo login

# Link your repository
turbo link

# The token will be displayed - add it to GitHub Secrets
```

---

## Vercel Deployment

### Initial Setup

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Link your project**
   ```bash
   vercel link
   ```
   This creates `.vercel` directory with project configuration and generates the VERCEL_ORG_ID and VERCEL_PROJECT_ID.

3. **Get Vercel Token**
   - Go to [Vercel Dashboard](https://vercel.com/account/tokens)
   - Create a new token
   - Add as `VERCEL_TOKEN` in GitHub secrets

### Environment Variables in Vercel

In Vercel Dashboard → Project Settings → Environment Variables, add:

```bash
# Database
DATABASE_URL=your-postgres-connection-string

# API URLs
NEXT_PUBLIC_API_URL=https://api.ventry.com
API_URL=https://api.ventry.com

# Sentry
NEXT_PUBLIC_SENTRY_DSN=your-public-sentry-dsn
SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=your-sentry-project
SENTRY_AUTH_TOKEN=your-sentry-auth-token

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Auth
JWT_SECRET=your-secure-secret
NEXTAUTH_SECRET=your-secure-secret
FRONTEND_URL=https://ventry.com

# Feature Flags
NEXT_PUBLIC_ENABLE_AI=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

### Vercel Project Settings

In Vercel Dashboard → Project Settings:

1. **General**
   - Framework Preset: Next.js
   - Node.js Version: 20.x
   - Root Directory: `./`

2. **Git**
   - Production Branch: `main`
   - Preview Branches: All branches
   - Comments: Enabled on PRs

3. **Functions**
   - Region: US East (iad1) or your preferred region
   - Include source files outside of Root Directory: Yes

### Deployment Commands

```bash
# Deploy to preview (staging)
vercel

# Deploy to production
vercel --prod

# Pull environment variables locally
vercel env pull
```

---

## Database Services

### PostgreSQL Options

Choose one of these managed PostgreSQL providers:

#### Option 1: Neon (Recommended for Serverless)
1. Go to [neon.tech](https://neon.tech)
2. Create account and new project
3. Copy connection string from dashboard
4. Features:
   - Serverless PostgreSQL
   - Automatic scaling
   - Branching for development
   - Free tier available

#### Option 2: Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database
4. Copy connection string
5. Features:
   - PostgreSQL with extras
   - Built-in auth (optional)
   - Realtime subscriptions
   - Free tier available

#### Option 3: Railway
1. Go to [railway.app](https://railway.app)
2. New Project → Provision PostgreSQL
3. Copy connection string from dashboard
4. Features:
   - Simple setup
   - Automatic backups
   - Easy scaling
   - Usage-based pricing

#### Option 4: AWS RDS (Enterprise)
1. Create RDS PostgreSQL instance
2. Configure security groups
3. Enable SSL/TLS
4. Features:
   - Enterprise-grade
   - Multi-AZ deployment
   - Read replicas
   - Full control

### Database Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require
```

### Database Migration Commands

```bash
# Generate migrations
pnpm db:migrate:dev

# Apply migrations
pnpm db:migrate:deploy

# Push schema (development)
pnpm db:push

# Reset database
pnpm db:reset
```

---

## Sentry Error Tracking

### Account Setup

1. **Create Sentry Account**
   - Sign up at [sentry.io](https://sentry.io)
   - Create organization

2. **Create Projects**
   - Create project: `ventry-frontend` (Platform: Next.js)
   - Create project: `ventry-backend` (Platform: Node.js)

3. **Get DSN Values**
   - Go to Settings → Projects → [Your Project] → Client Keys (DSN)
   - Copy the DSN for each project

4. **Create Auth Token**
   - Go to Settings → Account → API → Auth Tokens
   - Create token with scopes:
     - `project:releases`
     - `org:read`
     - `project:write`

### Configuration

Add these values to GitHub secrets and Vercel environment variables:
- `SENTRY_DSN` - Your project DSN
- `SENTRY_ORG` - Organization slug
- `SENTRY_PROJECT` - Project slug
- `SENTRY_AUTH_TOKEN` - API token

### Alert Configuration

In Sentry Dashboard → Alerts → Create Alert Rule:
- **Error Alert**: 10 errors in 5 minutes
- **Performance Alert**: P95 > 3 seconds
- **Crash Rate Alert**: > 1% crash rate

---

## Optional Services

### Codecov (Code Coverage)

1. Go to [codecov.io](https://codecov.io)
2. Sign in with GitHub
3. Add your repository
4. Copy the upload token
5. Add as `CODECOV_TOKEN` in GitHub Secrets

### Slack (Notifications)

1. Create Slack App at [api.slack.com](https://api.slack.com)
2. Add Incoming Webhook
3. Select channel for notifications
4. Copy webhook URL
5. Add as `SLACK_WEBHOOK_URL` in GitHub Secrets

### Docker Hub (If not using GitHub Container Registry)

Add these secrets:
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

Then update deployment workflows to use Docker Hub.

---

## Environment Configuration

### Local Development (.env.local)

```bash
# Database (PostgreSQL with Docker)
DATABASE_URL="postgresql://ventry:ventry_dev_password@localhost:5432/ventry_dev"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:6060"
API_URL="http://localhost:6060"

# Sentry (optional for local)
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_DSN=""

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Auth
JWT_SECRET="local-dev-secret-change-in-production"
NEXTAUTH_SECRET="local-dev-secret-change-in-production"
FRONTEND_URL="http://localhost:6061"

# Feature Flags
NEXT_PUBLIC_ENABLE_AI="true"
NEXT_PUBLIC_ENABLE_ANALYTICS="false"
```

### Docker Compose Services

```bash
# Start PostgreSQL only
docker-compose --profile postgres up -d

# Start PostgreSQL and Redis
docker-compose --profile postgres --profile redis up -d

# Stop all services
docker-compose down
```

---

## Security Configuration

### GitHub Security Features

Enable in **Settings** → **Security & analysis**:

1. **Dependency graph**: ✅ Enable
2. **Dependabot**:
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Dependabot version updates
3. **Code scanning**:
   - ✅ Set up code scanning
4. **Secret scanning**:
   - ✅ Enable secret scanning
   - ✅ Push protection

### Security Headers (vercel.json)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

#### Vercel Build Failures
```bash
# Check build logs
vercel logs [deployment-url]

# Test local build
pnpm build

# Pull environment variables
vercel env pull
```

#### Database Connection Issues
- Verify DATABASE_URL format
- Check SSL requirements (`?sslmode=require`)
- Test connection: `pnpm db:push`
- Verify IP allowlist in database provider

#### Sentry Not Receiving Events
- Verify DSN is correct
- Check auth token permissions
- Look for errors in browser console
- Ensure SENTRY_DSN is in environment variables

#### CI/CD Pipeline Failures
- Check GitHub Actions logs
- Verify all secrets are set
- Run tests locally: `pnpm test`
- Check branch protection settings

#### "Resource not accessible by integration"
- Check repository permissions
- Ensure secrets are set at correct level
- Verify GitHub App permissions

### Validation Commands

```bash
# Validate CI setup
./tools/scripts/validate-ci-setup.sh

# Test database connection
DATABASE_URL="your-connection-string" pnpm db:push

# Test Vercel deployment
vercel

# Check GitHub secrets
gh secret list

# Run all tests locally
pnpm test
pnpm test:integration
pnpm test:e2e
```

### Support Resources

- **Vercel**: [vercel.com/support](https://vercel.com/support)
- **GitHub Actions**: [docs.github.com/actions](https://docs.github.com/actions)
- **Sentry**: [docs.sentry.io](https://docs.sentry.io)
- **PostgreSQL**: [postgresql.org/docs](https://postgresql.org/docs)
- **Neon**: [neon.tech/docs](https://neon.tech/docs)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Railway**: [docs.railway.app](https://docs.railway.app)

---

## Maintenance Checklist

### Weekly
- [ ] Review Dependabot PRs
- [ ] Check Sentry for new errors
- [ ] Monitor database performance
- [ ] Review CI/CD pipeline status

### Monthly
- [ ] Update workflow versions
- [ ] Review security alerts
- [ ] Check service usage/costs
- [ ] Update dependencies

### Quarterly
- [ ] Rotate secrets and API keys
- [ ] Review and update documentation
- [ ] Audit third-party service access
- [ ] Performance optimization review

---

## Cost Optimization

### Service Tiers

#### Vercel
- **Free**: 100GB bandwidth, suitable for development
- **Pro**: $20/month per member, production features
- **Enterprise**: Custom pricing

#### Database
- **Neon Free**: 3GB storage, 1 compute hour/day
- **Supabase Free**: 500MB storage, 2GB bandwidth
- **Railway**: Usage-based pricing
- **AWS RDS**: Pay per instance hour

#### Sentry
- **Free**: 5k errors/month
- **Team**: $26/month, 50k errors
- **Business**: Custom pricing

### Cost Monitoring
- Set up billing alerts in each service
- Use free tiers for development/staging
- Monitor usage dashboards regularly
- Implement caching to reduce API calls

---

This guide consolidates all external service configurations for Ventry. Follow the automated scripts for quick setup, or use the manual instructions for custom configurations. Regular maintenance and monitoring ensure optimal performance and security.