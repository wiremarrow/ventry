# CI/CD External Configuration Guide

This guide walks you through setting up the external services and configurations required for the CI/CD pipelines to work properly.

## Prerequisites

- GitHub repository created and code pushed
- Admin access to the repository settings
- Accounts on required third-party services (optional but recommended)

## Step 1: Initialize Git Repository

```bash
# If not already done
git init
git add .
git commit -m "feat: initial project setup with CI/CD pipelines"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ventry.git
git push -u origin main
```

## Step 2: GitHub Actions Secrets

### Using GitHub CLI (Recommended)

Run our helper script:
```bash
./tools/scripts/setup-ci-secrets.sh
```

### Manual Setup via GitHub UI

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each:

| Secret Name | Description | Required | How to Get |
|------------|-------------|----------|------------|
| `TURBO_TOKEN` | Turborepo remote caching | Yes | [Sign up at turbo.build](https://turbo.build/repo/docs/core-concepts/remote-caching) |
| `TURBO_TEAM` | Your Turborepo team name | Yes | From your Turbo dashboard |
| `VERCEL_TOKEN` | Vercel deployment token | Yes | [Get from Vercel dashboard](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel organization ID | Yes | Run `vercel link` locally |
| `VERCEL_PROJECT_ID` | Vercel project ID | Yes | Run `vercel link` locally |
| `CODECOV_TOKEN` | Code coverage reporting | No | [Sign up at codecov.io](https://codecov.io/) |
| `SNYK_TOKEN` | Security scanning | No | [Sign up at snyk.io](https://snyk.io/) |
| `SLACK_WEBHOOK` | Deployment notifications | No | [Create Slack webhook](https://api.slack.com/messaging/webhooks) |
| `SENTRY_DSN` | Error tracking | No | [Get from Sentry](https://sentry.io/) |
| `SENTRY_AUTH_TOKEN` | Sentry source maps | No | [Create auth token](https://sentry.io/settings/auth-tokens/) |

## Step 3: Environment Configuration

### Create Environments

1. Go to **Settings** → **Environments**
2. Create two environments: `staging` and `production`

### Staging Environment

Click **New environment** → Name it `staging` → Add secrets:

- `DATABASE_URL`: Your staging database connection string
- `OPENAI_API_KEY`: Staging OpenAI API key
- `ANTHROPIC_API_KEY`: Staging Anthropic API key
- `REDIS_URL`: Staging Redis connection string

### Production Environment

Click **New environment** → Name it `production` → Add secrets:

- Same as staging but with production values
- **Add protection rules**:
  - ✅ Required reviewers (select specific people/teams)
  - ✅ Restrict deployments to specific users/teams

## Step 4: Branch Protection Rules

1. Go to **Settings** → **Branches**
2. Click **Add rule**
3. Branch name pattern: `main`
4. Enable these protections:

### Required Status Checks
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- Select these status checks:
  - `lint-and-typecheck`
  - `test (20)` (Node.js 20 test job)
  - `build`
  - `docker-build`

### Pull Request Requirements
- ✅ Require a pull request before merging
  - ✅ Require approvals: 1-2
  - ✅ Dismiss stale pull request approvals
  - ✅ Require review from CODEOWNERS
- ✅ Require conversation resolution before merging

### Additional Settings
- ✅ Include administrators (optional, for enforcement)
- ✅ Allow force pushes: ❌ Disabled
- ✅ Allow deletions: ❌ Disabled

## Step 5: Enable Security Features

Go to **Settings** → **Security & analysis**:

1. **Dependency graph**: ✅ Enable
2. **Dependabot**:
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Dependabot version updates (configured via `.github/dependabot.yml`)
3. **Code scanning**:
   - ✅ Set up code scanning (uses our `security.yml` workflow)
4. **Secret scanning**:
   - ✅ Enable secret scanning
   - ✅ Push protection (blocks commits with secrets)

## Step 6: Third-Party Service Setup

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

### Codecov Setup

1. Go to [codecov.io](https://codecov.io)
2. Sign in with GitHub
3. Add your repository
4. Copy the upload token
5. Add as `CODECOV_TOKEN` in GitHub Secrets

### Snyk Setup

1. Go to [snyk.io](https://snyk.io)
2. Sign in with GitHub
3. Import your repository
4. Go to Account Settings → API Token
5. Copy token and add as `SNYK_TOKEN` in GitHub Secrets

## Step 7: Container Registry Configuration

The workflows use GitHub Container Registry by default. No additional setup required!

To use a different registry:

### Docker Hub
Add these secrets:
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

Then update `.github/workflows/deploy.yml` to use Docker Hub.

### AWS ECR
Add these secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `ECR_REPOSITORY`

## Step 8: Verify Setup

### Create a Test PR

```bash
# Create a test branch
git checkout -b test/ci-verification

# Make a small change
echo "\n## CI Test" >> README.md

# Commit and push
git add README.md
git commit -m "test: verify CI pipeline"
git push origin test/ci-verification
```

### Check GitHub PR

1. Go to GitHub and create a Pull Request
2. Verify all checks are running:
   - ✅ Lint and Type Check
   - ✅ Test (matrix for Node 18 & 20)
   - ✅ Build
   - ✅ Docker Build
   - ✅ Security scans

### Deployment Test

Once merged to main:
1. Check Actions tab for deployment workflow
2. Verify staging deployment runs automatically
3. Create a tag to test production deployment:
   ```bash
   git tag v0.0.1
   git push origin v0.0.1
   ```

## Troubleshooting

### Common Issues

1. **"Resource not accessible by integration"**
   - Check repository permissions
   - Ensure secrets are set at correct level

2. **Failing security scans**
   - Some vulnerabilities might be in dev dependencies
   - Check if updates are available
   - Consider adding exceptions for false positives

3. **Deployment failures**
   - Verify environment secrets are set
   - Check deployment credentials
   - Review workflow logs

### Getting Help

- Check workflow run logs in Actions tab
- Enable debug logging: Add `ACTIONS_STEP_DEBUG: true` to secrets
- Review [GitHub Actions documentation](https://docs.github.com/en/actions)

## Maintenance

### Regular Tasks

- Review and merge Dependabot PRs
- Check security alerts weekly
- Update workflow versions monthly
- Review and rotate secrets quarterly

### Monitoring

Set up notifications:
1. **Actions** → **Settings** → Configure email notifications
2. **Watch** → Custom → Actions only
3. Configure Slack webhook for deployment notifications

## Next Steps

With CI/CD configured, you can:
1. Start developing with confidence
2. Create feature branches that auto-test
3. Deploy to staging automatically
4. Release to production with tags

Happy coding! 🚀