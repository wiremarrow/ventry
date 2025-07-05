# VENTRY DEVELOPMENT CHARTER
## MANDATORY INSTRUCTIONS FOR ALL CLAUDE CODE INSTANCES

---

## 🚨 CRITICAL RULES - NEVER VIOLATE THESE

### **DOCUMENTATION REQUIREMENT**
**MANDATORY**: After implementing/debugging ANY feature or task, update **BOTH** `README.md` and `TODO.md` **BEFORE** opening a PR. PRs missing either update will be **REJECTED** by CI.

### **CI/CD PIPELINE COMPLIANCE**
**MANDATORY**: ALL 13 status checks MUST pass. **NEVER** bypass or ignore failing checks. **NEVER** commit if CI is broken.

### **TESTING REQUIREMENT** 
**MANDATORY**: **ALL** tests must pass across **ALL** browsers (Chromium, Firefox, WebKit). **NEVER** merge with failing E2E tests.

### **ARCHITECTURE COMPLIANCE**
**MANDATORY**: Follow existing patterns. **NEVER** introduce new frameworks without justification. **ALWAYS** use TypeScript strict mode.

---

## 🔧 CI/CD SYSTEM - 13 REQUIRED STATUS CHECKS

These checks **MUST** pass for every PR. **NO EXCEPTIONS**.

1. **Documentation Check** - README.md + TODO.md updates for feat/fix/refactor/perf PRs
2. **Lint and Type Check** - ESLint + TypeScript strict validation  
3. **Unit Tests (18)** - Jest on Node.js 18
4. **Unit Tests (20)** - Jest on Node.js 20
5. **PostgreSQL Integration Tests** - Real database operations
6. **E2E Tests - chromium (1)** - Browser testing, shard 1/2
7. **E2E Tests - chromium (2)** - Browser testing, shard 2/2  
8. **E2E Tests - firefox (1)** - Browser testing, shard 1/2
9. **E2E Tests - firefox (2)** - Browser testing, shard 2/2
10. **E2E Tests - webkit (1)** - Browser testing, shard 1/2
11. **E2E Tests - webkit (2)** - Browser testing, shard 2/2
12. **Build** - Production build with Sentry integration
13. **Coverage Gate** - Test coverage threshold validation

### **Optional Checks**
- **Docker Build** - Only runs when Docker files change

---

## 📝 DOCUMENTATION - 1-TO-1 SYNC REQUIREMENT

### **File Locations & Purposes**
- `README.md` - Project overview, tech stack, CI/CD details, development setup
- `TODO.md` - Implementation roadmap, phase completion status  
- `SETUP_GUIDE.md` - Complete external integration setup
- `docs/CI_SETUP.md` - GitHub Actions, branch protection, secrets
- `docs/TESTING.md` - Testing strategy, commands, CI integration
- `docs/DEVELOPMENT.md` - Local setup, database switching, scripts
- `docs/DEPLOYMENT.md` - Vercel, environment configs, rollbacks
- `docs/ARCHITECTURE.md` - System design, module structure

### **Documentation Update Rules**
1. **feat:** PRs → Update README.md (features) + TODO.md (progress)
2. **fix:** PRs → Update README.md (if user-facing) + TODO.md (status)  
3. **refactor:** PRs → Update README.md (if architecture) + TODO.md (quality)
4. **perf:** PRs → Update README.md (performance) + TODO.md (optimization)

### **NEVER**
- **NEVER** create new markdown files without justification
- **NEVER** duplicate information across files
- **NEVER** let documentation drift from implementation

---

## 🧪 TESTING - COMPREHENSIVE REQUIREMENTS

### **Test Commands - Run BEFORE Every PR**
```bash
# MANDATORY: All must pass
pnpm lint                    # ESLint validation
pnpm typecheck              # TypeScript strict mode
pnpm test                    # Unit tests (Node 18 & 20)
pnpm test:integration        # PostgreSQL integration
pnpm test:e2e               # E2E tests (all browsers)
pnpm build                  # Production build

# Backend-specific commands (run from /apps/backend or use filter)
pnpm test:cov               # Unit tests with coverage thresholds
# OR: pnpm --filter @ventry/backend test:cov
```

### **Database Testing Requirements**
- **Development**: PostgreSQL 16 with Docker for consistent environment
- **CI Integration**: PostgreSQL 16 service container  
- **ALWAYS** test migrations with `pnpm db:push`
- **ALWAYS** use PostgreSQL for all environments (dev, test, prod)

### **E2E Testing Requirements**
- **Browser Matrix**: Chromium, Firefox, WebKit (ALL must pass)
- **Sharding**: 2 shards per browser = 6 parallel jobs
- **Artifacts**: Test videos preserved on failure
- **Build First**: `pnpm build` before E2E tests

### **Coverage Requirements**
- **Unit Tests**: Threshold gates enforced
- **Integration**: Real database operations
- **E2E**: Critical user workflows

---

## ⚡ DEVELOPMENT - QUICK SETUP & WORKFLOW

### **First Time Setup**
```bash
# Complete setup (PostgreSQL + Docker)  
./tools/scripts/dev-setup.sh
pnpm dev
```

### **Database Management**
```bash
./tools/scripts/switch-db.sh status    # Check current DB status
./tools/scripts/switch-db.sh setup     # Setup PostgreSQL configuration
./tools/scripts/switch-db.sh start     # Start PostgreSQL with Docker
./tools/scripts/switch-db.sh stop      # Stop PostgreSQL
```

### **Daily Workflow Commands**
```bash
pnpm dev                    # Start all services
pnpm test:watch            # Watch mode testing
pnpm lint                  # Check code quality
pnpm format                # Format code
```

### **Technology Stack - FOLLOW THESE PATTERNS**
- **Monorepo**: Turborepo + pnpm workspaces
- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui
- **Testing**: Jest (unit) + Playwright (E2E) + PostgreSQL (integration)
- **Deployment**: Vercel (frontend) + containerized backend
- **Monitoring**: Sentry error tracking + performance

---

## 🚀 DEPLOYMENT - PRODUCTION READINESS

### **Environment Setup**
- **Development**: PostgreSQL + Docker + local services
- **Staging**: PostgreSQL + preview deployments  
- **Production**: PostgreSQL + Sentry + full monitoring

### **Branch Protection Rules**
- **main** branch: 13 status checks + PR reviews + linear history
- **Feature branches**: Full CI validation required
- **NEVER** force push to main
- **NEVER** bypass status checks

### **Security Requirements**
- **Environment Variables**: NEVER commit secrets
- **Dependencies**: Dependabot auto-updates enabled
- **Scanning**: CodeQL + secret scanning active
- **Headers**: Security headers in vercel.json

---

## 📋 PROJECT STRUCTURE - KNOW WHERE THINGS GO

```
ventry/
├── apps/
│   ├── backend/          # NestJS API (Phase 1 implementation)
│   ├── web/              # Next.js frontend (Phase 2 implementation)  
│   └── docs/             # Documentation site (future)
├── packages/
│   ├── shared/           # Types, utils, constants
│   ├── ui/               # shadcn/ui components
│   └── database/         # Prisma schema (Phase 1)
├── e2e/                  # Playwright tests
├── docs/                 # Development documentation
└── tools/scripts/        # Automation scripts
```

### **Key Files**
- `.github/workflows/ci.yml` - Unified CI pipeline (13 checks)
- `playwright.config.ts` - E2E testing configuration
- `vercel.json` - Deployment configuration
- `turbo.json` - Monorepo build pipeline
- `package.json` - Root scripts and dependencies

---

## ⚠️ CONSEQUENCES - WHAT HAPPENS IF YOU VIOLATE THESE RULES

1. **Missing Documentation Updates** → CI `docs-check` job **FAILS** → PR **BLOCKED**
2. **Failing Tests** → 13 status checks **FAIL** → PR **BLOCKED**  
3. **Poor Code Quality** → Lint/TypeScript checks **FAIL** → PR **BLOCKED**
4. **Architecture Violations** → Code review **REJECTION** → Rework required

---

## 🎯 SUCCESS CRITERIA - WHEN YOU'VE DONE IT RIGHT

✅ All 13 CI status checks are **GREEN**  
✅ README.md and TODO.md are **UPDATED**  
✅ All browsers pass E2E tests  
✅ Both SQLite and PostgreSQL work  
✅ Production build succeeds  
✅ Documentation is **1-TO-1** with implementation  
✅ No security vulnerabilities introduced  
✅ Code follows existing patterns  

---

## 📝 KEEPING THIS CHARTER CURRENT

**MANDATORY**: Update CLAUDE.md when changing:
1. **CI Pipeline** (`.github/workflows/ci.yml`) → Update status check list
2. **Test Commands** (`package.json` scripts) → Update testing requirements section
3. **Documentation Files** (any `.md` files) → Update file locations section
4. **Technology Stack** (new frameworks/tools) → Update development patterns
5. **Project Structure** (new directories) → Update directory tree
6. **Branch Protection** (GitHub settings) → Update required checks
7. **Dependencies** (major version changes) → Update technology stack

**VALIDATION**: After any changes, verify:
- Count of required status checks matches CI jobs
- All test commands in CLAUDE.md exist in package.json
- File paths and locations are accurate
- Technology versions are current

**SELF-CHECK QUESTIONS**:
- Did I change the CI pipeline? → Update Section 2 (CI/CD System)
- Did I add/remove test commands? → Update Section 3 (Testing)
- Did I restructure documentation? → Update Section 4 (Documentation)
- Did I change the tech stack? → Update Section 5 (Development)
- Did I modify deployment? → Update Section 6 (Deployment)

**WARNING**: An outdated charter misleads future developers. When in doubt, update CLAUDE.md!

**REMEMBER**: This charter is your source of truth. Keep it accurate, keep it current, keep it authoritative.

---

**REMEMBER**: This is an enterprise-grade system with rigorous quality standards. **EVERY** check exists for a reason. **FOLLOW** these rules exactly for successful development.