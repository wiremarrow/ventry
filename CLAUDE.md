# VENTRY DEVELOPMENT CHARTER
## MANDATORY INSTRUCTIONS FOR ALL CLAUDE CODE INSTANCES

---

## 🚨 CRITICAL RULES - NEVER VIOLATE THESE

### **DOCUMENTATION REQUIREMENT**
**MANDATORY**: After implementing/debugging ANY feature or task, update **BOTH** `README.md` and `TODO.md` **BEFORE** opening a PR. PRs missing either update will be **REJECTED** by CI.

### **CI/CD PIPELINE COMPLIANCE**
**MANDATORY**: ALL 12 status checks MUST pass. **NEVER** bypass or ignore failing checks. **NEVER** commit if CI is broken.

### **TESTING REQUIREMENT** 
**MANDATORY**: **ALL** tests must pass across **ALL** browsers (Chromium, Firefox, WebKit). **NEVER** merge with failing E2E tests.

### **ARCHITECTURE COMPLIANCE**
**MANDATORY**: Follow existing patterns. **NEVER** introduce new frameworks without justification. **ALWAYS** use TypeScript strict mode.

---

## 🔧 CI/CD SYSTEM - 12 REQUIRED STATUS CHECKS

These checks **MUST** pass for every PR. **NO EXCEPTIONS**.

1. **Documentation Check** - README.md + TODO.md updates for feat/fix/refactor/perf PRs
2. **Lint and Type Check** - ESLint + TypeScript strict validation  
3. **Unit Tests** - Vitest on Node.js 20 LTS
4. **PostgreSQL Integration Tests** - Real database operations
5. **E2E Tests - chromium (1)** - Browser testing, shard 1/2
6. **E2E Tests - chromium (2)** - Browser testing, shard 2/2  
7. **E2E Tests - firefox (1)** - Browser testing, shard 1/2
8. **E2E Tests - firefox (2)** - Browser testing, shard 2/2
9. **E2E Tests - webkit (1)** - Browser testing, shard 1/2
10. **E2E Tests - webkit (2)** - Browser testing, shard 2/2
11. **Build** - Production build with Sentry integration
12. **Coverage Gate** - Test coverage threshold validation

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
pnpm test                    # Vitest unit tests (excludes integration)
pnpm test:integration        # PostgreSQL integration tests
pnpm test:e2e               # E2E tests (all browsers)
pnpm build                  # Production build

# Backend-specific commands (run from /apps/backend or use filter)
pnpm test:cov               # Vitest unit tests with coverage thresholds
pnpm test:integration       # Integration tests with PostgreSQL
# OR: pnpm --filter @ventry/backend test:cov
# OR: pnpm --filter @ventry/backend test:integration
```

### **Database Testing Requirements**
- **Development**: PostgreSQL 16 with Docker for consistent environment
- **CI Integration**: PostgreSQL 16 service container  
- **Integration Test Database**: Separate `ventry_integration_test` database for isolated testing
- **ALWAYS** test migrations with `pnpm db:push`
- **ALWAYS** use PostgreSQL for all environments (dev, test, prod)

### **Integration Test Database Setup**
```bash
# Create integration test database schema (one-time setup)
DATABASE_URL="postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test" pnpm --filter @ventry/database db:push

# Run integration tests (uses isolated database)
pnpm --filter @ventry/backend test:integration
```

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
- **Backend**: **tRPC + Fastify** + Prisma + PostgreSQL
- **Frontend**: Next.js 15 + React 18.3.1 + TypeScript + Tailwind CSS v3.4.0 + shadcn/ui
- **API Layer**: **tRPC v11** with full-stack TypeScript type inference
- **Testing**: **Vitest** (unit) + Playwright (E2E) + PostgreSQL (integration)
- **Deployment**: Vercel (frontend) + containerized Fastify backend
- **Architecture**: **ESM-only** monorepo with workspace dependencies
- **Monitoring**: Sentry error tracking + performance

---

## 🚀 DEPLOYMENT - PRODUCTION READINESS

### **Environment Setup**
- **Development**: PostgreSQL + Docker + local services
- **Staging**: PostgreSQL + preview deployments  
- **Production**: PostgreSQL + Sentry + full monitoring

### **Branch Protection Rules**
- **main** branch: 12 status checks + PR reviews + linear history
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
│   ├── backend/          # tRPC + Fastify API (Phase 1 implementation)
│   ├── web/              # Next.js frontend (Phase 1 implementation)
│   ├── e2e/              # Playwright E2E tests (dedicated workspace package)
│   └── docs/             # Documentation site (future)
├── packages/
│   ├── shared/           # Types, utils, constants
│   ├── ui/               # shadcn/ui components
│   └── database/         # Prisma schema (Phase 1)
├── docs/                 # Development documentation
└── tools/scripts/        # Automation scripts
```

### **Key Files**
- `.github/workflows/ci.yml` - Unified CI pipeline (13 checks)
- `apps/e2e/playwright.config.ts` - E2E testing configuration
- `playwright.config.ts` - Root delegation to E2E package
- `vercel.json` - Deployment configuration
- `turbo.json` - Monorepo build pipeline
- `package.json` - Root scripts and dependencies

---

## ⚠️ CONSEQUENCES - WHAT HAPPENS IF YOU VIOLATE THESE RULES

1. **Missing Documentation Updates** → CI `docs-check` job **FAILS** → PR **BLOCKED**
2. **Failing Tests** → 12 status checks **FAIL** → PR **BLOCKED**  
3. **Poor Code Quality** → Lint/TypeScript checks **FAIL** → PR **BLOCKED**
4. **Architecture Violations** → Code review **REJECTION** → Rework required

---

## 🎯 SUCCESS CRITERIA - WHEN YOU'VE DONE IT RIGHT

✅ All 12 CI status checks are **GREEN**  
✅ README.md and TODO.md are **UPDATED**  
✅ All browsers pass E2E tests  
✅ PostgreSQL integration tests pass  
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

## 🔧 tRPC DEVELOPMENT - MANDATORY PATTERNS

### **Workspace Dependencies**
```json
// apps/web/package.json
{
  "dependencies": {
    "@ventry/backend": "workspace:*",  // Required for AppRouter types
    "@trpc/client": "^11.4.3",
    "@trpc/react-query": "^11.4.3"
  }
}
```

### **Type-Safe API Flow**
1. **Backend**: Define tRPC procedures with Zod schemas
2. **Export**: AppRouter type automatically generated
3. **Frontend**: Import AppRouter type for full inference
4. **Client**: `trpc.auth.login.useMutation()` fully typed

### **ESM Architecture**
- **Full ESM**: No CommonJS compatibility layer
- **Build First**: Backend must build before frontend
- **Type Generation**: Automatic .d.ts files for type inference

### **Common Issues & Solutions**
- **"useContext collision"**: Check procedures don't return `any` types
- **Module resolution**: Ensure workspace dependencies are correct
- **Build order**: Always build backend before frontend in CI
- **Type errors**: Verify AppRouter export in backend index.ts

### **Development Commands**
```bash
# Backend development
pnpm --filter @ventry/backend dev    # Start tRPC + Fastify server
pnpm --filter @ventry/backend build  # Build for type generation
pnpm --filter @ventry/backend test:cov  # Run Vitest with coverage

# Frontend development (requires backend to be built first)
pnpm --filter @ventry/web dev        # Start Next.js development
pnpm --filter @ventry/web build      # Build for production
```

### **Testing Patterns & Guidelines**

#### **When to Use Each Test Type**
- **Unit Tests** (`*.test.ts`): Test individual tRPC procedures, utilities, business logic
- **Integration Tests** (`*.integration.spec.ts`): Test procedures with real database operations
- **E2E Tests** (`e2e/*.spec.ts`): Test complete user workflows via browser automation

#### **tRPC Testing Best Practices**
```typescript
// Unit Tests - Use createDirectCaller for mocked dependencies
import { createDirectCaller } from '../test-utils/trpc-test-client.js';

const caller = await createDirectCaller({
  user: { id: '1', email: 'test@example.com', role: 'USER' },
  prisma: mockPrisma
});

// Integration Tests - Use createIntegrationContext for real database
import { createIntegrationContext } from '../test-utils/trpc-test-client.js';

const ctx = await createIntegrationContext();
const caller = appRouter.createCaller(ctx);
```

#### **Database Testing Strategy**
- **Unit Tests**: Use mocked Prisma client for fast, isolated testing
- **Integration Tests**: Use real `ventry_integration_test` database for actual data operations
- **E2E Tests**: Use dedicated E2E database with full application stack

### **Field Naming Convention**
- **Database Layer**: snake_case (e.g., `qty_ordered`, `created_at`)
- **Prisma Models**: camelCase with `@@map` directives
- **Application Code**: camelCase to match Prisma types
- **Translation**: Prisma handles snake_case ↔ camelCase conversion

---

## 📊 ORIGINAL DATABASE SCHEMA REFERENCE

**CRITICAL**: This is the authoritative source for all database field names and relationships. **ALWAYS** refer to this schema when implementing features or fixing issues.

### Core Inventory Models

**Items**
- item_id, sku, upc, name, description, category_id, uom_id, default_supplier_id, default_cost, default_price, weight_kg, length_cm, width_cm, height_cm, reorder_point, reorder_qty, is_active, created_at, updated_at

**ItemCategories**
- category_id, parent_id, name, description, created_at, updated_at

**UnitsOfMeasure**
- uom_id, code, description, is_base, conversion_factor_to_base

**ItemImages**
- image_id, item_id, url, alt_text, is_primary, uploaded_at

**Lots**
- lot_id, item_id, lot_number, manufacture_date, expiration_date, received_date, supplier_id, unit_cost, qty_initial, qty_on_hand, status, created_at, updated_at

**SerialNumbers**
- serial_id, item_id, serial_number, lot_id, purchase_date, warranty_expiration, status, location_id

**Warehouses**
- warehouse_id, code, name, phone, line1, line2, city, state, postal_code, country, notes, created_at, updated_at

**Locations**
- location_id, warehouse_id, code, description, zone, aisle, shelf, bin, max_capacity, is_temp_controlled, created_at, updated_at

**Inventory**
- inventory_id, item_id, lot_id, serial_id, location_id, qty_on_hand, qty_reserved, qty_in_transit, last_counted_at, updated_at

**StockMovements**
- movement_id, item_id, lot_id, serial_id, from_location_id, to_location_id, qty, movement_type, ref_type, ref_id, moved_by, moved_at, notes

**StockAdjustments**
- adjustment_id, item_id, lot_id, location_id, qty_before, qty_after, reason, adjusted_by, adjusted_at, notes

**CycleCounts**
- count_id, location_id, count_date, counted_by, reviewed_by, status, notes

**CycleCountItems**
- count_item_id, count_id, item_id, lot_id, qty_counted, qty_system, variance

**PriceHistory**
- price_id, item_id, price_type, price, currency_id, start_date, end_date, notes

### Procurement

**Suppliers**
- supplier_id, supplier_code, name, phone, email, website, currency_id, payment_terms, lead_time_days, line1, line2, city, state, postal_code, country, notes, created_at, updated_at

**SupplierContacts**
- contact_id, supplier_id, first_name, last_name, email, phone, role, notes

**PurchaseOrders**
- po_id, supplier_id, po_number, status, order_date, expected_date, currency_id, subtotal, tax, total, notes, created_by, approved_by, created_at, updated_at

**PurchaseOrderItems**
- po_item_id, po_id, item_id, description, qty_ordered, qty_received, unit_cost, tax_rate, total_cost

**Receipts**
- receipt_id, po_id, received_date, received_by, reference, notes, created_at

**ReceiptItems**
- receipt_item_id, receipt_id, item_id, lot_id, serial_number, qty_received, unit_cost, expiration_date, location_id

### Sales & Fulfillment

**Customers**
- customer_id, customer_code, company_name, first_name, last_name, email, phone, tax_id, currency_id, default_payment_terms, default_ship_method_id, website, created_at, updated_at

**Addresses**
- address_id, customer_id, supplier_id, address_type, line1, line2, city, state, postal_code, country, phone, attention, is_default, created_at, updated_at

**Orders**
- order_id, customer_id, order_number, status, order_date, requested_ship_date, currency_id, subtotal, discount_total, tax_total, shipping_total, grand_total, notes, created_by, updated_by, created_at, updated_at

**OrderItems**
- order_item_id, order_id, item_id, description, qty_ordered, qty_allocated, qty_shipped, unit_price, discount_pct, tax_rate, total_price, lot_id, serial_id

**Payments**
- payment_id, order_id, payment_method_id, amount, currency_id, payment_date, transaction_ref, status, processed_by, notes, created_at

**PaymentMethods**
- payment_method_id, method_name, provider, acct_last4, details_json, is_active, created_at, updated_at

**Shipments**
- shipment_id, order_id, shipment_number, carrier_id, carrier_service, tracking_number, ship_date, expected_delivery, shipped_from_location_id, shipped_by, status, weight_kg, shipping_cost, notes, created_at, updated_at

**ShipmentItems**
- shipment_item_id, shipment_id, order_item_id, item_id, lot_id, serial_id, qty_shipped

**Returns**
- return_id, order_id, customer_id, return_number, status, return_date, rma_number, reason, refund_amount, restock_fee, notes, created_at, updated_at

**ReturnItems**
- return_item_id, return_id, order_item_id, item_id, lot_id, serial_id, qty_returned, condition, refund_amount

### POS / Retail

**POS_Transactions**
- pos_tx_id, tx_number, store_id, register_id, employee_id, customer_id, tx_date, status, subtotal, tax_total, discount_total, grand_total, payment_received, change_given, notes

**POS_TransactionItems**
- pos_tx_item_id, pos_tx_id, item_id, lot_id, serial_id, qty, unit_price, discount_pct, total_price

**Discounts**
- discount_id, code, description, discount_type, value, start_date, end_date, min_order_value, max_uses, uses, is_active, created_at, updated_at

### Shipping & Carriers

**Carriers**
- carrier_id, name, phone, website, tracking_url_tpl

**ShippingMethods**
- shipping_method_id, carrier_id, service_name, transit_days, base_cost

### Staff & Security

**Employees**
- employee_id, first_name, last_name, email, phone, hire_date, role_id, status, hourly_rate, salary, manager_id, created_at, updated_at

**Users**
- user_id, employee_id, username, email, password_hash, password_salt, last_login, is_active, created_at, updated_at

**Roles**
- role_id, role_name, description, created_at, updated_at

**UserRoles**
- user_role_id, user_id, role_id, assigned_at

### Logging & Notifications

**AuditLogs**
- audit_id, table_name, record_pk, user_id, action, before_data, after_data, event_time, ip_address

**Notifications**
- notification_id, user_id, notif_type, message, related_table, related_id, read_at, created_at

### Financial & Global

**TaxRates**
- tax_rate_id, name, region, rate_pct, valid_from, valid_to, created_at, updated_at

**Currencies**
- currency_id, code, name, symbol, ex_rate_to_base, updated_at

### Field Naming Conventions
- **Quantities**: Use `qty_` prefix (e.g., qty_on_hand, qty_ordered)
- **Dates**: Use `_at` suffix for timestamps (e.g., created_at, moved_at)
- **Status**: Use enums with clear values
- **IDs**: Use `{table}_id` format
- **Booleans**: Use `is_` prefix (e.g., is_active, is_primary)

---

**REMEMBER**: This is an enterprise-grade system with rigorous quality standards. **EVERY** check exists for a reason. **FOLLOW** these rules exactly for successful development.