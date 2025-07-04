# Ventry Complete Setup Guide

## Table of Contents
1. [Quick Start Checklist](#quick-start-checklist)
2. [Detailed Configuration Reference](#detailed-configuration-reference)
3. [Troubleshooting & Support](#troubleshooting--support)

---

## Quick Start Checklist

### ✅ Already Completed
- [x] GitHub repository created and code pushed
- [x] GitHub environments created (staging/production)
- [x] Vulnerability alerts enabled
- [x] Automated security fixes enabled
- [x] Unified CI/CD pipeline deployed

### 🔄 Next Steps (In Order)

#### 1. Run Automated CI/CD Setup Scripts (NEW! 🚀)

We now provide automated scripts that configure ~90% of the CI/CD setup:

```bash
# Step 1: Configure GitHub repository settings
# This automates branch protection, security features, and environments
./tools/scripts/setup-github-repo.sh

# Step 2: Configure all required secrets interactively
./tools/scripts/setup-ci-secrets.sh

# Step 3: Validate your setup
./tools/scripts/validate-ci-setup.sh
```

#### 1a. Manual Branch Protection Setup (If Automation Fails)

**Go to:** https://github.com/wiremarrow/ventry/settings/branches

**Click:** "Add rule"

**Branch name pattern:** `main`

**Enable these settings:**
```
✅ Require a pull request before merging
  ✅ Require approvals: 1
  ✅ Dismiss stale pull request approvals when new commits are pushed
  ✅ Require review from CODEOWNERS

✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  
  Required status checks (add after first CI run):
  - Documentation Check
  - Lint and Type Check
  - Unit Tests (18)
  - Unit Tests (20)
  - PostgreSQL Integration Tests
  - E2E Tests - chromium (1)
  - E2E Tests - chromium (2)
  - E2E Tests - firefox (1)
  - E2E Tests - firefox (2)
  - E2E Tests - webkit (1)
  - E2E Tests - webkit (2)
  - Build
  - Coverage Gate

✅ Require conversation resolution before merging
✅ Require linear history
✅ Include administrators
```

#### 2. Add Repository Secrets

**Go to:** https://github.com/wiremarrow/ventry/settings/secrets/actions

**Click:** "New repository secret" for each:

```bash
# Required for CI/CD
TURBO_TOKEN=          # Get from https://turbo.build (optional for now)
TURBO_TEAM=           # Your Turborepo team name (optional for now)

# Required for deployment (set up next)
VERCEL_TOKEN=         # From Vercel account settings
VERCEL_ORG_ID=        # From vercel.json after linking
VERCEL_PROJECT_ID=    # From vercel.json after linking

# Required for database (set up next)
DATABASE_URL=         # PostgreSQL connection string

# Required for error tracking (set up next)
SENTRY_DSN=          # From Sentry project settings
SENTRY_ORG=          # Sentry organization slug
SENTRY_PROJECT=      # Sentry project slug
SENTRY_AUTH_TOKEN=   # From Sentry API tokens

# Optional
CODECOV_TOKEN=       # From Codecov.io (optional)
SLACK_WEBHOOK_URL=   # From Slack app settings (optional)
```

#### 3. Set Up External Services

##### A. Database (Choose One)

**Option 1: Neon (Recommended)**
1. Go to https://neon.tech
2. Create account and new project
3. Copy connection string
4. Add to GitHub secrets as `DATABASE_URL`

**Option 2: Supabase**
1. Go to https://supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy connection string
5. Add to GitHub secrets as `DATABASE_URL`

**Option 3: Railway**
1. Go to https://railway.app
2. New Project → Provision PostgreSQL
3. Copy connection string
4. Add to GitHub secrets as `DATABASE_URL`

##### B. Error Tracking (Sentry)

1. Go to https://sentry.io
2. Create account and organization
3. Create new project: "Next.js"
4. Copy DSN from project settings
5. Go to Settings → Account → API → Auth Tokens
6. Create token with scopes: `project:releases`, `org:read`
7. Add all Sentry values to GitHub secrets

##### C. Deployment (Vercel)

1. Go to https://vercel.com
2. Create account
3. Install Vercel CLI: `npm install -g vercel`
4. In your project: `vercel link`
5. Follow prompts to create/link project
6. Get tokens from Vercel dashboard → Settings → Tokens
7. Add VERCEL_* values to GitHub secrets

#### 4. Test the Setup

**Create a test PR:**
```bash
git checkout -b test/initial-setup
echo "# Test" >> README.md
git add README.md
git commit -m "test: verify CI/CD pipeline"
git push origin test/initial-setup
```

**Go to:** https://github.com/wiremarrow/ventry/pulls
**Create:** Pull request from test/initial-setup to main

This will trigger your CI/CD pipeline and test all configurations.

#### 5. Complete Setup Verification

After the test PR passes:

1. **Check CI/CD:** All GitHub Actions should be green
2. **Check Vercel:** Preview deployment should be created
3. **Check Sentry:** Should be receiving events
4. **Check Database:** Connection should work

### 🚨 Important Notes

1. **Don't merge the test PR until all CI/CD checks pass**
2. **Branch protection will prevent merging until checks pass**
3. **Add required status checks to branch protection after first successful CI run**
4. **Keep your secrets secure and never commit them to the repository**

### 🎯 Ready for Development

Once all steps are complete, you can start development:

```bash
# Clone and setup (for new contributors)
git clone https://github.com/wiremarrow/ventry.git
cd ventry
./tools/scripts/dev-setup-sqlite.sh
pnpm dev
```

Your repository is now ready for production-level development with:
- ✅ Automated testing and quality checks
- ✅ Deployment pipelines
- ✅ Error tracking and monitoring
- ✅ Security scanning and dependency updates
- ✅ Branch protection and code review requirements

---

## Detailed Configuration Reference

### Overview of External Integrations

#### Required Services
1. **GitHub** - Source control, CI/CD, branch protection, automated updates
2. **Vercel** - Frontend deployment, preview environments, edge functions
3. **PostgreSQL** - Production database (Neon/Supabase recommended)
4. **Sentry** - Error tracking, performance monitoring, release management
5. **Docker** - Local development environment (optional)
6. **Turborepo** - Build caching and monorepo optimization

#### Optional Services
- **Codecov** - Code coverage reporting
- **Slack** - Deployment notifications

### GitHub Configuration

#### Repository Settings

The current CI workflow in `.github/workflows/ci.yml` includes:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ventry_test

jobs:
  docs-check:
    name: Documentation Check
    # Enforces README.md and TODO.md updates for feature PRs
    
  lint-and-typecheck:
    name: Lint and Type Check
    # ESLint + TypeScript validation
    
  test:
    name: Unit Tests
    # Jest testing on Node.js 18 & 20 with coverage
    
  postgres-integration:
    name: PostgreSQL Integration Tests
    # Database operations with real PostgreSQL service
    
  playwright-tests:
    name: E2E Tests
    # Browser matrix (Chromium, Firefox, WebKit) with sharding
    
  build:
    name: Build
    # Production build with Sentry integration
    
  coverage-gate:
    name: Coverage Gate
    # Test coverage threshold validation
```

#### GitHub Environments

**Staging environment:**
- No protection rules
- Secrets:
  - `DATABASE_URL` (staging database)
  - `VERCEL_ENV` = "preview"

**Production environment:**
- Required reviewers: 1-2 team members
- Deployment branches: `main` only
- Secrets:
  - `DATABASE_URL` (production database)
  - `VERCEL_ENV` = "production"

### Vercel Configuration

#### Project Setup Commands
```bash
# Install Vercel CLI
npm install -g vercel

# Link your project
vercel link

# Deploy preview
vercel
```

#### Environment Variables Setup

**In Vercel Dashboard → Project Settings → Environment Variables:**

Add for each environment (Production, Preview, Development):

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

# Feature Flags
NEXT_PUBLIC_ENABLE_AI=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

#### Vercel Project Settings

**In Vercel Dashboard → Project Settings:**

1. **General**
   - Framework Preset: Next.js
   - Node.js Version: 20.x
   - Root Directory: `./`

2. **Git**
   - Production Branch: `main`
   - Preview Branches: All branches
   - Comments: Enabled on PRs

3. **Functions**
   - Region: US East (iad1)
   - Include source files outside of Root Directory: Yes

### PostgreSQL Database Setup

#### Connection String Format
```
postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require
```

#### Migration Commands
```bash
# Generate migrations
pnpm db:migrate:dev

# Apply migrations
pnpm db:migrate:deploy

# Reset database
pnpm db:reset
```

### Sentry Configuration

#### Project Setup Steps

1. **Create Sentry Account**
   - Sign up at [sentry.io](https://sentry.io)
   - Create organization

2. **Create Projects**
   - Create project: `ventry-frontend` (Next.js)
   - Create project: `ventry-backend` (Node.js)

3. **Get DSN and Tokens**
   - Settings → Projects → Client Keys (DSN)
   - Settings → Account → API → Auth Tokens
   - Create token with scopes: `project:releases`, `org:read`

4. **Configure Alerts**
   - Alerts → Create Alert Rule
   - Error threshold: 10 errors in 5 minutes
   - Performance: P95 > 3 seconds

### Docker Configuration (Optional)

#### Development Setup

**Default (SQLite only, no Docker needed):**
```bash
pnpm dev
```

**With PostgreSQL:**
```bash
docker-compose --profile postgres up -d
pnpm dev
```

**With PostgreSQL and Redis:**
```bash
docker-compose --profile postgres --profile redis up -d
pnpm dev
```

### Local Environment Setup

#### Environment Files

**File:** `.env.local` (for development)
```bash
# Database (SQLite for local dev)
DATABASE_URL="file:./dev.db"

# Or PostgreSQL if using Docker
# DATABASE_URL="postgresql://ventry:ventry_dev@localhost:5432/ventry_dev"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:3000"
API_URL="http://localhost:3000"

# Sentry (optional for local)
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_DSN=""

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Feature Flags
NEXT_PUBLIC_ENABLE_AI="true"
NEXT_PUBLIC_ENABLE_ANALYTICS="false"

# Auth
JWT_SECRET="local-dev-secret-change-in-production"
NEXTAUTH_SECRET="local-dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3001"
```

### Verification Commands

```bash
# Test local development
pnpm dev

# Test builds
pnpm build

# Test unit tests
pnpm test

# Test E2E tests
pnpm test:e2e

# Test PostgreSQL migrations
DATABASE_URL="your-postgres-url" pnpm db:push

# Test Vercel deployment
vercel

# Check GitHub secrets
gh secret list
```

---

## Troubleshooting & Support

### Common Issues

#### 1. Vercel Build Failures
- Check build logs in Vercel dashboard
- Ensure all env vars are set
- Try local build: `vercel build`

#### 2. Database Connection Issues
- Check DATABASE_URL format
- Ensure SSL is enabled for production
- Test with: `pnpm db:push`

#### 3. Sentry Not Receiving Events
- Verify DSN is correct
- Check auth token permissions
- Look for errors in browser console

#### 4. CI Failures
- Check GitHub Actions logs
- Verify all secrets are set
- Run locally: `act` (requires Docker)

#### 5. Dependabot PR Failures
- Check for breaking changes
- Update tests if needed
- Consider pinning versions

#### 6. Branch Protection Issues
- Ensure all required status checks are added
- Check that check names match exactly
- Verify administrators are included if needed

#### 7. E2E Test Failures
- Check Playwright browser installation
- Verify application builds before tests
- Review test artifacts in GitHub Actions

### Support Resources

- **Vercel**: [vercel.com/support](https://vercel.com/support)
- **GitHub Actions**: [docs.github.com/actions](https://docs.github.com/actions)
- **Sentry**: [docs.sentry.io](https://docs.sentry.io)
- **PostgreSQL**: [postgresql.org/docs](https://postgresql.org/docs)
- **Playwright**: [playwright.dev/docs](https://playwright.dev/docs)

### Getting Help

- **Documentation**: Check `docs/` directory for detailed guides
- **CI Configuration**: Review `.github/workflows/` for pipeline details
- **Development Setup**: See `tools/scripts/` for automation scripts
- **Issues**: Report problems at the GitHub repository issues section

---

*This completes the comprehensive setup guide for Ventry. The system is configured with production-ready settings, proper security, and monitoring. The CI/CD pipeline enforces quality gates including documentation updates, coverage requirements, and automated deployments.*