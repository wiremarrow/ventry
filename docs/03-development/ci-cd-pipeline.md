# CI/CD Pipeline

Ventry uses GitHub Actions for continuous integration and deployment with strict quality gates.

## Pipeline Overview

### Trigger Events
- **Push to main**: Full pipeline execution
- **Pull Requests**: All checks required
- **Manual dispatch**: For special deployments

### Pipeline Architecture

```yaml
┌─────────────────┐
│ Trigger Event   │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Setup   │ (Checkout, Node.js, pnpm)
    └────┬────┘
         │
    ┌────▼──────────────────────┐
    │ Parallel Quality Checks    │
    │ ┌────────┐ ┌────────────┐ │
    │ │ Docs   │ │ Lint/Type  │ │
    │ └────────┘ └────────────┘ │
    └────┬──────────────────────┘
         │
    ┌────▼──────────────────────┐
    │ Parallel Test Execution    │
    │ ┌──────┐ ┌─────────────┐  │
    │ │ Unit │ │ Integration │  │
    │ └──────┘ └─────────────┘  │
    └────┬──────────────────────┘
         │
    ┌────▼──────────────────────┐
    │ E2E Tests (Matrix)         │
    │ Chromium/Firefox/WebKit    │
    │ 2 shards each = 6 jobs     │
    └────┬──────────────────────┘
         │
    ┌────▼────┐
    │ Build   │
    └────┬────┘
         │
    ┌────▼────────┐
    │ Coverage    │
    └────┬────────┘
         │
    ┌────▼─────────┐
    │ Deployment   │ (main branch only)
    └──────────────┘
```

## Required Status Checks (9 Jobs)

### 1. Documentation Check
**Purpose**: Ensures documentation stays current with code changes

```yaml
- Triggers on: feat, fix, refactor, perf commits
- Verifies: README.md and TODO.md updates
- Failure: Block PR until docs updated
```

### 2. Lint and Type Check
**Purpose**: Code quality and type safety

```yaml
- ESLint validation
- TypeScript strict mode compilation
- Prettier formatting check
- Import order validation
```

### 3. Unit Tests
**Purpose**: Fast feedback on business logic

```yaml
- Framework: Vitest
- Node.js: 20 LTS
- Coverage: Required thresholds
- Excludes: Integration and E2E tests
```

### 4. PostgreSQL Integration Tests
**Purpose**: Database operation validation

```yaml
- Real PostgreSQL 16 service
- Isolated test database
- Migration testing
- RLS policy validation
```

### 5-7. E2E Tests (Browser Matrix)
**Purpose**: Cross-browser compatibility

```yaml
- Chromium (2 shards)
- Firefox (2 shards)
- WebKit (2 shards)
- Parallel execution
- Video artifacts on failure
```

### 8. Build
**Purpose**: Production build validation

```yaml
- Next.js production build
- Backend compilation
- Type generation
- Bundle size checks
```

### 9. Coverage Gate
**Purpose**: Maintain test coverage standards

```yaml
- Coverage thresholds enforcement
- Report generation
- Trend tracking
```

## Optional Checks

### Docker Build
- **Triggers**: Only when Dockerfile changes
- **Purpose**: Container build validation
- **Not blocking**: Advisory only

## Environment Setup

### Required Secrets

```yaml
# Turborepo
TURBO_TOKEN
TURBO_TEAM

# Deployment
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Monitoring
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
NEXT_PUBLIC_SENTRY_DSN

# Optional
CODECOV_TOKEN
SLACK_WEBHOOK_URL
```

### Database Configuration

Each job gets isolated database:
- Unit tests: Mocked or in-memory
- Integration: `ventry_integration_test`
- E2E: `ventry_e2e_test`

## Performance Optimization

### Caching Strategy
```yaml
- uses: actions/cache@v3
  with:
    path: |
      ~/.pnpm-store
      .next/cache
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
```

### Parallel Execution
- Independent jobs run concurrently
- Matrix strategy for E2E tests
- Sharding for test distribution

### Turborepo Remote Caching
- Shared build cache
- Skip unchanged packages
- Significant time savings

## Deployment Pipeline

### Staging (PR Preview)
```yaml
on:
  pull_request:
    types: [opened, synchronize]

# Vercel preview deployment
# Database migration dry-run
# E2E tests against preview
```

### Production (Main Branch)
```yaml
on:
  push:
    branches: [main]

# Full test suite
# Production build
# Database migrations
# Vercel production deployment
# Sentry release tracking
```

## Monitoring & Alerts

### Build Status
- GitHub commit status
- PR checks tab
- Branch protection enforcement

### Notifications
- GitHub notifications (default)
- Slack webhooks (optional)
- Email alerts (optional)

### Metrics Tracked
- Build duration
- Test execution time
- Success/failure rates
- Coverage trends

## Troubleshooting CI

### Common Issues

#### 1. Flaky E2E Tests
```bash
# Re-run specific test locally
pnpm test:e2e -- --grep "test name"

# Debug mode
pnpm test:e2e:debug
```

#### 2. Database Connection Errors
```yaml
# Check service health
- name: Check PostgreSQL
  run: pg_isready -h localhost -p 5432
```

#### 3. Out of Memory
```yaml
# Increase Node.js memory
env:
  NODE_OPTIONS: --max-old-space-size=4096
```

### Debugging CI Locally

```bash
# Use act to run GitHub Actions locally
brew install act
act -j "test"

# Or manually reproduce
docker-compose up -d
pnpm install
pnpm test
```

## Best Practices

### 1. Keep CI Fast
- Use caching effectively
- Parallelize where possible
- Skip unchanged code
- Optimize test suites

### 2. Fix Immediately
- Don't ignore failing tests
- Fix flaky tests
- Keep main branch green
- Quick rollback if needed

### 3. Security
- Rotate secrets regularly
- Use environment protection
- Audit dependencies
- Scan for vulnerabilities

## CI Configuration Files

### Main Workflow
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize]

jobs:
  # ... job definitions
```

### Dependabot
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
```

## Maintenance

### Weekly Tasks
- Review CI performance
- Update dependencies
- Check secret expiration
- Clear old artifacts

### Monthly Tasks
- Audit workflow permissions
- Review caching effectiveness
- Update runner versions
- Performance optimization

## Related Documentation

- [CI Setup Guide](../01-getting-started/external-services.md#cicd-pipeline-setup)
- [Testing Guide](./testing-guide.md)
- [Deployment Guide](../05-deployment/deployment-overview.md)
- [Troubleshooting](../01-getting-started/troubleshooting.md#ci-issues)