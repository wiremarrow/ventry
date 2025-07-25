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
pnpm test                    # All tests via Turbo (includes unit + integration)
pnpm test:integration        # PostgreSQL integration tests
pnpm test:e2e               # E2E tests (all browsers)
pnpm build                  # Production build

# Backend-specific commands (run from /apps/backend or use filter)
pnpm test:cov               # Vitest unit tests with coverage thresholds
pnpm test:integration       # Integration tests with PostgreSQL
# OR: pnpm --filter @ventry/backend test:cov
# OR: pnpm --filter @ventry/backend test:integration

# Additional test commands
pnpm test:unit              # Unit tests only (excludes e2e)
pnpm test:unit:fast         # Fast unit tests
pnpm test:e2e:ui            # Playwright UI mode
pnpm test:e2e:debug         # Playwright debug mode
```

### **Database Testing Requirements**

- **Development**: PostgreSQL 16 with Docker for consistent environment
- **CI Integration**: PostgreSQL 16 service container
- **Integration Test Database**: Separate `ventry_integration_test` database for isolated testing
- **ALWAYS** test migrations with `pnpm db:push`
- **ALWAYS** use PostgreSQL for all environments (dev, test, prod)

### **Database Seeding Options**

```bash
# Basic seed - Only creates 4 demo users (minimal)
pnpm --filter @ventry/database db:seed

# Single-org comprehensive seed - Full demo data for single organization
pnpm --filter @ventry/database db:seed:single

# Multi-org comprehensive seed - Multiple organizations for testing RLS/multi-tenancy
pnpm --filter @ventry/database db:seed:multi
```

**Demo Accounts (all seeds)**:

- admin@ventry.com / password123 (ADMIN role)
- manager@ventry.com / password123 (MANAGER role)
- employee@ventry.com / password123 (EMPLOYEE role)
- user@ventry.com / password123 (USER role - no org access)

**Additional Multi-org Test Accounts (db:seed:multi only)**:

- alice@techstart.com / password123 (TechStart admin)
- charlie@globalretail.com / password123 (GlobalRetail admin)

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
pnpm lint                  # Check code quality
pnpm format                # Format code
```

### **Technology Stack - FOLLOW THESE PATTERNS**

- **Monorepo**: Turborepo + pnpm workspaces
- **Backend**: **tRPC + Fastify** + Prisma ^6.11.1 + PostgreSQL 16
- **Frontend**: Next.js 15.3.5 + React ^18.3.1 + TypeScript ^5 + Tailwind CSS ^3.4.0 + shadcn/ui
- **API Layer**: **tRPC v11.4.3** with full-stack TypeScript type inference
- **Testing**: **Vitest** (unit) + Playwright (E2E) + PostgreSQL (integration)
- **Deployment**: Vercel (frontend) + containerized Fastify backend
- **Architecture**: **ESM-only** monorepo with workspace dependencies
- **Monitoring**: Sentry error tracking + performance

### **🔐 DATABASE SECURITY - DUAL USER PATTERN (CRITICAL)**

**MANDATORY**: The system uses TWO PostgreSQL users for security:

1. **`ventry` (ADMIN USER)**:
   - **Purpose**: Migrations, seeding, admin tasks
   - **Privileges**: SUPERUSER, BYPASSRLS=true
   - **When to use**: ONLY for `db:migrate`, `db:seed`, `db:push`
   - **Connection**: DATABASE_ADMIN_URL
   - **WARNING**: NEVER use for application runtime

2. **`ventry_app` (APPLICATION USER)**:
   - **Purpose**: ALL runtime queries
   - **Privileges**: Limited, BYPASSRLS=false
   - **When to use**: ALWAYS for application runtime
   - **Connection**: DATABASE_URL
   - **Security**: Enforces Row-Level Security (RLS)

**Environment Variables**:

```bash
# Admin connection - migrations/seeding ONLY
DATABASE_ADMIN_URL="postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev"

# Application connection - runtime queries (RLS enforced)
DATABASE_URL="postgresql://ventry_app:ventry_app_password@localhost:5487/ventry_dev"
```

**Automatic Admin Connection for Database Operations**:
All Prisma schema and seed commands automatically use DATABASE_ADMIN_URL through the `db-admin.sh` script:

```bash
# These commands automatically use admin privileges:
pnpm db:push                      # Push schema changes
pnpm db:migrate                   # Create/apply migrations
pnpm db:reset                     # Reset database
pnpm db:seed                      # Seed with default data
pnpm db:seed:basic               # Seed with basic users only
pnpm db:seed:comprehensive       # Seed with full demo data
pnpm db:seed:multi-org          # Seed with multi-org test data

# Script location: packages/database/scripts/db-admin.sh
# Error handling: Clear message if DATABASE_ADMIN_URL is missing
```

**CRITICAL**: If you see cross-organization data leakage:

1. Check DATABASE_URL uses `ventry_app`, not `ventry`
2. Restart dev servers after env changes
3. Verify with: `SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user;`

### **Database Verification Tool**

A comprehensive READ-ONLY tool for inspecting database state, analyzing business data, and testing RLS policies. Supports cross-table comparisons, advanced WHERE clauses, and utility commands.

**Quick Examples**:

```bash
# After seeding, verify counts
pnpm db:verify count all

# INVENTORY ANALYSIS
# Low stock items (cross-table comparison!)
pnpm db:verify count inventory --where "qtyOnHand <= item.reorderPoint"
pnpm db:verify show inventory --where "qtyOnHand <= item.reorderPoint" --select "item.sku,item.name,qtyOnHand,item.reorderPoint"

# Over-reserved inventory
pnpm db:verify show inventory --where "qtyReserved > qtyOnHand" --select "item.sku,qtyOnHand,qtyReserved"

# Inventory value by warehouse
pnpm db:verify stats inventory --group-by locationId --sum qtyOnHand --count id

# ORDER MANAGEMENT
# Order status distribution
pnpm db:verify stats order --group-by status --count id --sum grandTotal

# Orders with specific statuses (IN operator)
pnpm db:verify count order --where "status IN ('PENDING', 'CONFIRMED')"

# High-value pending orders (AND conditions)
pnpm db:verify show order --where "status = 'PENDING' AND grandTotal > 5000" --order-by grandTotal --order desc

# Recent orders (date comparison)
pnpm db:verify count order --where "orderDate > NOW() - INTERVAL '7 days'"

# SUPPLIER PERFORMANCE
# Overdue purchase orders
pnpm db:verify show purchaseOrder --where "status = 'ORDERED' AND expectedDate < NOW()"

# CUSTOMER INSIGHTS
# Top customers by revenue
pnpm db:verify stats order --group-by customerId --sum grandTotal --count id

# Find customers by pattern (LIKE operator)
pnpm db:verify show customer --where "email LIKE '%@ventry.com'" --limit 10

# Customers missing data (IS NULL)
pnpm db:verify count customer --where "phone IS NULL"

# RLS TESTING
# Test what employee can see
pnpm db:verify access order --as employee@ventry.com

# Compare user access across roles
pnpm db:verify compare customer --users "admin@ventry.com,manager@ventry.com,employee@ventry.com"

# DATA EXPORT
# Export inventory snapshot
pnpm db:verify show inventory --select "item.sku,location.code,qtyOnHand" --format csv > inventory.csv

# UTILITY COMMANDS
# Show all fields for a table
pnpm db:verify fields inventory

# Show table relationships
pnpm db:verify relationships order

# Get random sample data
pnpm db:verify sample item --size 5

# Run data integrity checks
pnpm db:verify validate
```

**Key Features**:

- **Enhanced WHERE clauses**: IN, LIKE, IS NULL/NOT NULL, date comparisons, AND conditions
- **Cross-table comparisons**: Compare fields across related tables (e.g., `inventory.qtyOnHand <= item.reorderPoint`)
- **Utility commands**: fields, relationships, sample, validate for database inspection
- **Business queries**: Pre-built patterns for inventory, orders, suppliers, customers, finance
- **45+ tables supported**: All core business entities with proper relationships
- **Multiple output formats**: table (default), json, csv, count
- **RLS testing**: Simulate any user to test Row-Level Security policies
- **READ-ONLY**: All operations are safe SELECT queries, no data modifications

**Security Context**:

- `--user admin`: Uses DATABASE_ADMIN_URL (sees everything, bypasses RLS)
- `--user app`: Uses DATABASE_URL (respects RLS, requires auth)
- `--auth <email>`: Simulates authenticated context for RLS testing

**Full Documentation**: See [DATABASE_VERIFICATION.md](./docs/DATABASE_VERIFICATION.md) or run `pnpm db:verify --help` for extensive business query examples

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
    "@ventry/backend": "workspace:*", // Required for AppRouter types
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
  prisma: mockPrisma,
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

## 📊 DATABASE SCHEMA REFERENCE

**CRITICAL**: See [DATABASE.md](./DATABASE.md) for the complete, authoritative database schema documentation.

**Key Points for Development:**

- **32 Models**: Complete inventory, procurement, sales, and operations coverage
- **Multi-Tenant**: All business entities scoped by `organizationId`
- **Type Safety**: Full Prisma + TypeScript integration with camelCase ↔ snake_case mapping
- **Enterprise-Grade**: Comprehensive audit trails, relationships, and constraints

### Quick Reference - Core Models

- **Organization**: Multi-tenant root entity
- **Item**: Products/inventory items (`items` table)
- **Inventory**: Current stock levels by location (`inventory` table)
- **Warehouse/Location**: Storage hierarchy
- **Supplier/Customer**: Business partners
- **Order/PurchaseOrder**: Sales/procurement documents
- **StockMovement**: Complete movement history

### Field Naming Conventions

- **Prisma Models**: camelCase (e.g., `firstName`, `organizationId`)
- **PostgreSQL Tables**: snake_case via `@@map` directives
- **Relationships**: Descriptive names (`createdBy`, `defaultSupplier`)
- **Timestamps**: `createdAt`, `updatedAt`, domain-specific dates
- **Quantities**: Clear naming (`qtyOnHand`, `qtyReserved`)
- **Status Fields**: Enum types for type safety

**For complete field lists, relationships, and constraints:** → **[DATABASE.md](./DATABASE.md)**

---

## 📚 CODE STYLE GUIDE - MANDATORY CONVENTIONS

### **Import Ordering & Formatting**

**MANDATORY**: All files must follow this exact import order with blank lines between groups:

```typescript
// 1. React/Next.js built-ins
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. External packages (alphabetical)
import { format } from 'date-fns';
import { toast } from 'sonner';
import { z } from 'zod';

// 3. Workspace packages
import { Button, Card, Input } from '@ventry/ui';
import type { Order, Customer } from '@ventry/database';

// 4. Absolute imports (@/...)
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';

// 5. Relative imports
import { OrderList } from './order-list';
import { utils } from './utils';

// 6. Type imports (if not already imported above)
import type { LocalType } from './types';
```

**Rules:**

- Each group separated by exactly one blank line
- Within each group: alphabetical order
- Use `import type` for type-only imports
- Group imports from same package on one line when possible
- Multi-line imports when more than 3 items

### **File Naming Conventions**

| File Type             | Pattern                  | Example                       |
| --------------------- | ------------------------ | ----------------------------- |
| **Components**        | kebab-case.tsx           | `stock-adjustment-dialog.tsx` |
| **Pages**             | page.tsx                 | `app/inventory/page.tsx`      |
| **Layouts**           | layout.tsx               | `app/inventory/layout.tsx`    |
| **API Routes**        | route.ts                 | `app/api/health/route.ts`     |
| **tRPC Routers**      | camelCase.ts             | `purchaseOrders.ts`           |
| **Unit Tests**        | \*.test.ts(x)            | `order-list.test.tsx`         |
| **Integration Tests** | \*.integration.test.ts   | `auth.integration.test.ts`    |
| **E2E Tests**         | \*.spec.ts               | `login.spec.ts` (in e2e dir)  |
| **Utilities**         | camelCase.ts             | `formatDate.ts`               |
| **Constants**         | camelCase.ts             | `constants.ts`                |
| **Types**             | types.ts or camelCase.ts | `types.ts` or `orderTypes.ts` |

### **TypeScript Patterns**

#### **Component Props**

```typescript
// ✅ ALWAYS use interface for component props
interface OrderListProps {
  orders: Order[];
  onEdit: (id: string) => void;
}

// ❌ NEVER use type for component props
type OrderListProps = { ... }
```

#### **Type Imports**

```typescript
// ✅ Use import type for type-only imports
import type { Order, Customer } from '@ventry/database';

// ❌ Don't mix if only importing types
import { Order, Customer } from '@ventry/database';
```

#### **tRPC Router Exports**

```typescript
// ✅ No type annotation needed
export const ordersRouter = createTRPCRouter({...});

// ❌ Don't add explicit type
export const ordersRouter: ReturnType<typeof createTRPCRouter> = createTRPCRouter({...});
```

#### **Avoid any**

```typescript
// ✅ Use unknown for truly unknown types
function processData(data: unknown) { ... }

// ✅ Use proper type inference
const [selectedItem, setSelectedItem] = useState<typeof items[0] | null>(null);

// ❌ Never use any
function processData(data: any) { ... }
```

### **Component Structure Pattern**

```typescript
'use client'; // Only if client component

// Imports (following import order rules)

// Type definitions
interface ComponentProps {
  // props
}

// Zod schemas (if needed)
const formSchema = z.object({
  // schema
});

// Component
export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // Hooks first
  const router = useRouter();
  const [state, setState] = useState();

  // tRPC queries
  const { data, isLoading } = trpc.items.list.useQuery();

  // tRPC mutations
  const createMutation = trpc.items.create.useMutation({
    onSuccess: () => {
      toast.success('Item created');
      utils.items.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Event handlers
  const handleSubmit = () => { ... };

  // Early returns
  if (isLoading) return <Skeleton />;
  if (!data) return null;

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### **tRPC Router Structure Pattern**

```typescript
// 1. External imports (alphabetical)
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// 2. Local imports
import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

// 3. Type imports
import type { Prisma } from '@ventry/database';

// Input validation schemas (in order: create, update, filter, others)
const itemCreateSchema = z.object({...});
const itemUpdateSchema = z.object({...});
const itemFilterSchema = z.object({...});

// Router export (no type annotation)
export const itemsRouter = createTRPCRouter({
  // List/filter procedures first
  list: organizationProcedure
    .input(itemFilterSchema)
    .query(async ({ ctx, input }) => {...}),

  // Get by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {...}),

  // Create
  create: organizationProcedure
    .input(itemCreateSchema)
    .mutation(async ({ ctx, input }) => {...}),

  // Update
  update: organizationProcedure
    .input(itemUpdateSchema)
    .mutation(async ({ ctx, input }) => {...}),

  // Delete
  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {...}),
});
```

### **Form Handling Pattern**

```typescript
const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    name: '',
    email: '',
  },
});

const onSubmit = (data: FormData) => {
  createMutation.mutate(data);
};

// In JSX
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    {/* form fields */}
  </form>
</Form>
```

### **Error Handling Patterns**

#### **Frontend Error Display**

```typescript
// ✅ Use toast for user feedback
toast.error(error.message);
toast.success('Operation completed');

// ✅ Form validation errors
<FormMessage /> // Shows field-specific errors

// ❌ Don't use console.error in production
console.error(error); // Only in development
```

#### **Backend Error Handling**

```typescript
// ✅ Use TRPCError with appropriate codes
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Item not found',
});

// Common codes:
// - UNAUTHORIZED: No valid auth
// - FORBIDDEN: No permission
// - NOT_FOUND: Resource missing
// - BAD_REQUEST: Invalid input
// - CONFLICT: Duplicate/conflict
```

### **Naming Conventions**

| Type                    | Convention           | Example                       |
| ----------------------- | -------------------- | ----------------------------- |
| **Variables/Functions** | camelCase            | `userId`, `calculateTotal()`  |
| **React Components**    | PascalCase           | `OrderList`, `StockDialog`    |
| **Constants**           | UPPER_SNAKE_CASE     | `MAX_RETRIES`, `API_TIMEOUT`  |
| **Types/Interfaces**    | PascalCase           | `Order`, `CustomerData`       |
| **Enums**               | PascalCase           | `OrderStatus`                 |
| **Enum Values**         | UPPER_SNAKE_CASE     | `PENDING`, `COMPLETED`        |
| **Boolean Variables**   | is/has/should prefix | `isLoading`, `hasError`       |
| **Event Handlers**      | handle prefix        | `handleClick`, `handleSubmit` |

### **Common UI Patterns**

#### **Loading States**

```typescript
if (isLoading) {
  return <Skeleton className="h-10 w-full" />;
}
```

#### **Empty States**

```typescript
if (!data || data.length === 0) {
  return (
    <div className="text-center py-8">
      <p className="text-gray-500">No items found</p>
    </div>
  );
}
```

#### **Error States**

```typescript
if (error) {
  return (
    <div className="text-center py-8">
      <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <p className="text-red-600">{error.message}</p>
    </div>
  );
}
```

#### **Pagination**

```typescript
// Consistent pagination pattern
const { data } = trpc.items.list.useQuery({
  page: currentPage,
  limit: pageSize,
  search: searchTerm,
  sortBy: 'name',
  sortOrder: 'asc',
});

// Response structure
{
  items: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
  }
}
```

### **Testing Patterns**

#### **Component Tests**

```typescript
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock tRPC
vi.mock('@/lib/trpc');

describe('OrderList', () => {
  it('should render orders', () => {
    // test implementation
  });
});
```

#### **Integration Tests**

```typescript
import { createIntegrationContext } from '../test-utils/trpc-test-client.js';

describe('Orders Router', () => {
  it('should create order', async () => {
    const ctx = await createIntegrationContext();
    const caller = appRouter.createCaller(ctx);
    // test implementation
  });
});
```

### **Git Commit Messages**

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting, missing semicolons, etc)
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Performance improvement
- `test:` Adding missing tests
- `chore:` Changes to build process or auxiliary tools

---

## 🔒 PRODUCTION READINESS UPDATE (2025-01-15)

**MANDATORY**: A comprehensive security audit has been completed. See [Production Readiness Audit](./docs/PRODUCTION_READINESS_AUDIT.md) for full details.

### **Completed Security Improvements**

1. **Environment Security**: All secrets now require environment variables (no hardcoded fallbacks)
2. **Structured Logging**: Pino logger implemented, console.log statements removed
3. **Cookie Security**: Secure cookie utilities with signed cookies
4. **Database Performance**: 50+ indexes added for all critical queries
5. **Type Safety**: Logger service with full TypeScript support

### **Critical Tasks Before Production**

1. **Row-Level Security**: Implement database-level tenant isolation
2. **Test Coverage**: Add tests for 18 untested business routers (82% currently untested)
3. **Type Safety**: Replace 170+ `any` types with proper TypeScript types
4. **Auth Security**: Fix race conditions in authentication flow
5. **Infrastructure**: Configure connection pooling, backups, monitoring

### **New Security Patterns**

```typescript
// Environment validation (required)
import { env } from './config/env.js';

// Structured logging (required)
import { createLogger } from './lib/logger.js';
const logger = createLogger('module-name');

// Secure cookies (required)
import { setCookie, COOKIE_NAMES } from './lib/cookies.js';
setCookie(ctx.res, COOKIE_NAMES.AUTH_TOKEN, token);
```

**WARNING**: The system is NOT production-ready until all critical tasks are completed. Current readiness: 4/10.

---

## 🍪 AUTHENTICATION & COOKIE HANDLING - CRITICAL

### **Signed Cookie Implementation**

The system uses **signed cookies** for authentication security. **NEVER** read cookies directly.

#### **Correct Cookie Handling**

```typescript
// ✅ CORRECT - Always unsign cookies before use
const authCookie = request.cookies['auth-token'];
const token = authCookie ? request.unsignCookie(authCookie)?.value : undefined;

// ❌ WRONG - Never read signed cookies directly
const token = request.cookies['auth-token']; // This will include signature!
```

#### **Common Authentication Errors**

1. **"Signed cookie string must be provided"** - Cookie doesn't exist, handle null case
2. **"UNAUTHORIZED"** - Usually means cookie reading failed, not actual auth failure
3. **JWT verification errors** - Often caused by reading signed cookie directly

#### **Cookie Security Settings**

- **httpOnly**: true (prevents XSS)
- **signed**: true (prevents tampering)
- **sameSite**: 'lax' (CSRF protection)
- **secure**: true in production (HTTPS only)
- **maxAge**: 7 days

#### **Debugging Authentication**

1. Check if cookie exists: `request.cookies['auth-token']`
2. Verify it's being unsigned: `request.unsignCookie()`
3. Check JWT payload after unsigning
4. Verify organization context is set

---

**REMEMBER**: This is an enterprise-grade system with rigorous quality standards. **EVERY** check exists for a reason. **FOLLOW** these rules exactly for successful development.
