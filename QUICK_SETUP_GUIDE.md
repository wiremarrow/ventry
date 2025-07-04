# Ventry Quick Setup Guide

## ✅ Completed
- [x] GitHub repository created and code pushed
- [x] GitHub environments created (staging/production)
- [x] Vulnerability alerts enabled
- [x] Automated security fixes enabled

## 🔄 Next Steps (In Order)

### 1. Set Up Branch Protection Rules

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
  - lint-and-typecheck
  - test
  - build
  - docs-check

✅ Require conversation resolution before merging
✅ Require linear history
✅ Include administrators
```

### 2. Add Repository Secrets

**Go to:** https://github.com/wiremarrow/ventry/settings/secrets/actions

**Click:** "New repository secret" for each:

```bash
# Required for CI/CD
TURBO_TOKEN=          # Get from https://turbo.build (optional for now)
TURBO_TEAM=           # Your Turborepo team name (optional for now)

# Required for deployment (set up later)
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

### 3. Set Up External Services

#### A. Database (Choose One)

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

#### B. Error Tracking (Sentry)

1. Go to https://sentry.io
2. Create account and organization
3. Create new project: "Next.js"
4. Copy DSN from project settings
5. Go to Settings → Account → API → Auth Tokens
6. Create token with scopes: `project:releases`, `org:read`
7. Add all Sentry values to GitHub secrets

#### C. Deployment (Vercel)

1. Go to https://vercel.com
2. Create account
3. Install Vercel CLI: `npm install -g vercel`
4. In your project: `vercel link`
5. Follow prompts to create/link project
6. Get tokens from Vercel dashboard → Settings → Tokens
7. Add VERCEL_* values to GitHub secrets

### 4. Test the Setup

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

### 5. Complete Setup Verification

After the test PR passes:

1. **Check CI/CD:** All GitHub Actions should be green
2. **Check Vercel:** Preview deployment should be created
3. **Check Sentry:** Should be receiving events
4. **Check Database:** Connection should work

## 🚨 Important Notes

1. **Don't merge the test PR until all CI/CD checks pass**
2. **Branch protection will prevent merging until checks pass**
3. **Add required status checks to branch protection after first successful CI run**
4. **Keep your secrets secure and never commit them to the repository**

## 📞 Need Help?

- Check the detailed setup guide: `EXTERNAL_INTEGRATIONS_SETUP.md`
- Review CI configuration: `.github/workflows/`
- Check documentation: `docs/`

## 🎯 Ready for Development

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