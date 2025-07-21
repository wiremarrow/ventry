# Ventry AI-Native Inventory Management System - Implementation TODO

## 🎯 Project Overview
This TODO outlines the complete implementation roadmap for Ventry, an AI-native inventory management system built with **tRPC + Fastify** backend, Next.js frontend, and AI agents for intelligent automation.

## 📊 Current Status
✅ **Phase 0 COMPLETE** - Foundation & CI/CD Setup (2024-01-04)
- All foundation tasks completed
- Monorepo with Turborepo configured
- CI/CD pipelines ready

✅ **Stack Enhancement COMPLETE** - Lightweight Development Stack (2024-07-04)
- Playwright E2E testing configured with sharding
- SQLite for zero-setup development
- Vercel deployment for Next.js
- Sentry error tracking integrated
- Optional Docker (PostgreSQL available when needed)
- Comprehensive testing and deployment documentation

✅ **CI/CD Unification COMPLETE** - Comprehensive Quality Pipeline (2024-07-04)
- Unified CI workflow combining best practices from all sources
- 13 required status checks enforcing enterprise-grade quality
- Advanced E2E testing with browser matrix (chromium, firefox, webkit) and sharding
- PostgreSQL integration tests with service containers
- Documentation enforcement for feature PRs (README.md + TODO.md)
- Optional Docker build triggered by file changes
- Artifact management and test reporting
- Production-ready build validation with Sentry integration

✅ **CI/CD Automation COMPLETE** - 90% Automated Setup (2025-07-04)
- Automated branch protection with all 13 required status checks
- Security features automation (Dependabot, vulnerability alerts, secret scanning)
- Environment creation with protection rules
- Interactive secrets setup for all required services
- Validation script to verify complete CI/CD configuration
- Reduced manual setup from ~30 steps to 3 scripts

✅ **Phase 1 COMPLETE** - Core Backend Infrastructure + Professional UI (2025-07-05)
✅ **Authentication Fix COMPLETE** - Login Issues Resolved (2025-07-05)
✅ **Sentry Integration COMPLETE** - Error Tracking & Monitoring (2025-07-05)
✅ **React 18 Downgrade COMPLETE** - Fixed Button Component Compatibility (2025-07-05)
✅ **Tailwind CSS Migration COMPLETE** - v4 to v3 Compatibility Fix (2025-07-05)
✅ **Dashboard Loading Fix COMPLETE** - Fixed ProtectedRoute Infinite Loading (2025-07-05)
✅ **shadcn/ui Button Fix COMPLETE** - Button Click Events and Hover Effects Working (2025-07-05)
✅ **E2E Test Fix COMPLETE** - Login Error Handling and Page Reload Issues Resolved (2025-07-07)
✅ **E2E Architecture Modernization COMPLETE** - Enterprise Workspace Package Structure (2025-07-08)
✅ **tRPC Migration COMPLETE** - NestJS to tRPC + Fastify Migration (2025-07-08)
✅ **Authentication Standardization COMPLETE** - Phase 1 Auth Flow (2025-01-18)
✅ **Items/Products Management COMPLETE** - Full CRUD with Categories & UOM (2025-01-18)
✅ **Row-Level Security Implementation COMPLETE** - Enterprise Multi-Tenancy (2025-01-20)
✅ **Database Admin Operations & Comprehensive Seeding COMPLETE** (2025-07-21)
✅ **Frontend Performance & Rate Limiting Fixes COMPLETE** (2025-07-21)
✅ **Users Page RLS Fix COMPLETE** - Organization-Scoped User Management (2025-07-21)
- **Created db-admin.sh script** for consistent admin database operations
- **Fixed seed script** to include organizationId for all models (Location, Lot, Inventory, StockMovement, OrderItem)
- **Fixed Order model** field mapping (tax → taxTotal, total → grandTotal)
- **Comprehensive demo data** seeding with full inventory scenario:
  - 45 products across Electronics, Office Supplies, and Furniture categories
  - 4 warehouses (Main, West Coast, East Coast, Central) with 40 locations total
  - 540 inventory records tracking stock levels across locations
  - 365 historical stock movements showing realistic activity
  - 25 customers and 33 orders with various statuses
  - 12 suppliers with lead time and contact information
- **Renamed migrate-with-admin.sh** to db-admin.sh for broader database admin functionality
- **Updated all package.json scripts** to use unified db-admin.sh approach
- **Updated CLAUDE.md** with new database operation patterns and documentation
- **Rate Limiting Improvements**:
  - **Increased backend rate limit** from 100 to 500 requests/minute to accommodate comprehensive seed data
  - **Re-enabled tRPC request batching** using httpBatchLink to reduce HTTP request count by 50-80%
  - **Fixed infinite re-render issues** on date-filtered pages (receipts, shipments, movements) using useMemo
  - **Resolved 429 rate limit errors** preventing data loading on multiple pages
  - **Fixed customers page data access** pattern to correctly handle paginated response structure
- **Users Page RLS Fix**:
  - **Converted users router** from protectedProcedure to organizationProcedure for proper multi-tenant isolation
  - **Implemented organization filtering** - users now filtered through OrganizationMember relationship
  - **Fixed critical RLS violation** where users could see accounts from other organizations
  - **Updated permissions** - activate/deactivate now use organizationAdminProcedure
  - **Enhanced frontend** - shows organization-specific user counts and permissions
  - **Proper tenant isolation** - all user queries now respect organization boundaries
- **Complete tRPC + Fastify backend** with end-to-end type-safe API architecture
- **Comprehensive Prisma database schema** with inventory models and proper PostgreSQL enums
- **JWT authentication with role-based access control** (Admin/Manager/User) via tRPC procedures
- **Centralized AuthService** handling all authentication logic (login/logout/register)
- **CookieService** for consistent signed cookie management with error handling
- **Zustand-based organization store** replacing window.__organizationId anti-pattern
- **Organization switching** via tRPC mutation with persistent state
- **Item Categories Router** with hierarchical category management and validation
- **Units of Measure Router** with base unit enforcement and conversion factors
- **Warehouse Analytics Fix** for proper decimal handling in inventory valuation
- **Next.js 15 + React 18 frontend** with professional shadcn/ui components and responsive design
- **tRPC v11 Integration**: Full-stack TypeScript type inference with React Query
- **Professional UI/UX**: Tailwind CSS v3.4.0 with modern card-based login interface and complete styling
- **Development Environment**: Fully operational on ports 6060 (tRPC + Fastify) and 6061 (frontend)
- **Workspace Dependencies**: Proper package resolution for AppRouter type sharing
- **Production-ready monorepo** with ESM-only architecture and workspace package dependencies
- **PostgreSQL-only architecture**: Complete migration with proper TypeScript enum support
- **Modern Frontend Stack**: Next.js 15 + React 18 + TypeScript + Tailwind CSS v3.4.0 + shadcn/ui
- **Enterprise Row-Level Security (RLS)**:
  - **Dual-user pattern**: `ventry` (admin) vs `ventry_app` (runtime) for proper security isolation
  - **Organization_id denormalization**: Added to all 20+ business tables for performant RLS
  - **PostgreSQL RLS policies**: Enforced on all business tables with `current_organization_id()` checks
  - **Zero cross-tenant data leakage**: Aggregate queries respect organization boundaries
  - **RLS proxy service**: Automatic context injection for all database operations
  - **Comprehensive testing**: RLS isolation verified across multiple organizations
- **Enterprise-grade testing infrastructure**:
  - **Unit Tests**: **Vitest** with 253 tests across 18 test suites and strict coverage requirements
  - **Integration Tests**: 20 tests with real PostgreSQL database operations and proper isolation
  - **E2E Tests**: 135 tests across 5 browsers (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari) with dedicated `@ventry/e2e` workspace package
  - **E2E Reliability**: Fixed critical authentication error handling ensuring tests pass consistently
  - **Coverage Reporting**: Automated coverage thresholds and comprehensive reporting with Vitest
  - **Test Infrastructure**: Professional-grade mocking, database cleanup, and environment isolation
  - **Browser Compatibility**: Cross-browser testing with reliable error state management
  - **tRPC Testing**: Direct caller pattern for testing tRPC procedures with type safety
- **Code Quality**: ESLint 9 + TypeScript ESLint v8 compatibility resolved
- **CI/CD Pipeline**: 13 mandatory status checks validated and production-ready
- **Technical Issues Resolved**: Turbopack compatibility, environment variable loading, Tailwind CSS v4 configuration
- **Authentication Issues Fixed**: 
  - Login redirect loop resolved with Next.js middleware
  - Protected route components for authenticated pages
  - Token persistence in Zustand store and cookies
  - Proper hydration handling for SSR/CSR
  - Enhanced debugging utilities for troubleshooting
  - **401 "Invalid credentials" error fixed**: Database seeding requirement for demo users (admin@ventry.com/password123, manager@ventry.com/password123, user@ventry.com/password123)
- **Sentry Integration Complete**:
  - Full error tracking with stack traces
  - User context and breadcrumb trails
  - Login form error capture with detailed context
  - Protected route tracking
  - Test page at `/sentry-test` for verification (now accessible without auth)
  - Performance monitoring enabled
  - Debug mode enabled for initialization troubleshooting
  - Fixed initialization with instrumentation.ts and instrumentation-client.ts
  - Cookie sync on hydration for middleware compatibility
  - Removed disableLogger to fix debug mode error
  - Disabled tunnelRoute temporarily to avoid conflicts
- **React 18 Downgrade Complete**:
  - Downgraded from React 19 to React 18.3.1 to fix Radix UI compatibility
  - Fixed Button component onClick handlers not working
  - Resolved @radix-ui/react-slot v1.0.2 incompatibility with React 19
  - All shadcn/ui components now working correctly
  - Login form functionality restored
  - Note: Upgrade to React 19 when Radix UI releases compatible versions
- **E2E Test Infrastructure Fix Complete**:
  - **Root Cause**: API response interceptor causing hard page reloads on login errors
  - **Solution**: Smart navigation logic to skip redirects for login endpoint errors
  - **Implementation**: Enhanced API interceptor with endpoint-specific error handling
  - **Results**: 4/5 browsers now passing consistently (Chromium, Firefox, WebKit, Mobile Chrome)
  - **Architecture**: Proper separation of API interceptor vs component error handling
  - **Form Standards**: Standardized HTML form submission patterns for cross-browser compatibility
  - **State Management**: Pure React state without localStorage workarounds
  - **Performance**: E2E tests now execute in ~1.5s vs previous 30s timeout risks
- **E2E Architecture Modernization Complete (2025-07-08)**:
  - **Dedicated Workspace Package**: Created `@ventry/e2e` workspace package following monorepo best practices
  - **ESM Module Resolution**: Fixed database package compilation from CommonJS to ES2022 modules for proper workspace imports
  - **Proper Dependencies**: E2E package declares explicit workspace dependencies (`@ventry/database`, `@ventry/shared`)
  - **Monorepo Structure**: Moved from root `e2e/` to `apps/e2e/` following established patterns (backend, web, e2e)
  - **Build Pipeline Integration**: Updated turbo.json with proper `test:e2e` task and dependency chains
  - **CI/CD Compatibility**: Updated GitHub Actions for new package structure and workspace filtering
  - **Backward Compatibility**: Root-level Playwright commands still work via configuration delegation
  - **Race Condition Fix**: Removed duplicate `db:seed` script from backend package to prevent conflicts
  - **Enterprise Grade**: Clean separation of concerns with proper TypeScript compilation and workspace isolation
- **CI/CD Pipeline Optimization Complete**:
  - **GitHub Actions Upgrade**: Updated upload-artifact from deprecated v3 to v4
  - **Prisma Client Generation**: Added missing db:generate steps to all 4 CI jobs (lint, unit, integration, E2E)
  - **Database Isolation**: Separate PostgreSQL databases (ventry_integration_test, ventry_e2e_test) prevent parallel job conflicts
  - **Unit Test Streamlining**: Simplified from Node.js 18+20 matrix to Node.js 20 only for consistency and performance
  - **Build Reliability**: Resolved 85+ TypeScript compilation errors from missing Prisma types
- **Enterprise Database Strategy Complete (2025-07-07)**:
  - **Migration-First Approach**: Replaced db:push with migrate:deploy for CI/production readiness
  - **Dynamic Database Creation**: Unique test databases per CI job (ventry_integration_${GITHUB_RUN_ID}, ventry_e2e_${GITHUB_RUN_ID}) for true isolation
  - **Test Coverage Command Fix**: Corrected unit test coverage syntax from `pnpm test -- --coverage` to `pnpm test:cov`
  - **Package.json Scripts**: Added db:migrate:deploy commands to root, backend, and database packages
  - **Turbo.json Pipeline**: Added test:cov and db:migrate:deploy task configurations with proper dependencies
  - **Scalable Pattern**: Enterprise-grade database management suitable for large PostgreSQL setups and startup growth
✅ **E2E Cookie Authentication Fix Complete (2025-07-09)**:
✅ **Authentication Password Fix Complete (2025-07-14)**:
  - **Root Cause**: Login page displayed incorrect demo passwords (admin123, manager123, user123) while comprehensive seed script uses "password123" for all accounts
  - **Solution**: Updated login form to show correct password "password123" for all demo accounts
  - **Implementation**:
    - Updated apps/web/components/auth/login-form.tsx demo credentials display
    - Fixed E2E tests in example.spec.ts, dashboard.spec.ts, navigation.spec.ts to use password123
    - Updated README.md with correct demo credentials and troubleshooting section
    - Added comprehensive troubleshooting guide for authentication issues
  - **Results**: Users can now login successfully with documented credentials

✅ **Dashboard Live Data Integration Complete (2025-07-15)**:
  - **Implementation**: Connected dashboard info cards to live tRPC analytics endpoints
  - **Auto-refresh**: Added 30-second auto-refresh with user toggle controls
  - **Real-time Health**: Integrated API and database status monitoring
  - **User Controls**: Manual refresh button and auto-refresh toggle
  - **Data Sources**: 
    - `trpc.analytics.dashboard.useQuery()` for inventory metrics
    - `trpc.warehouses.list.useQuery()` for location counts  
    - `trpc.health.check.useQuery()` for system status
  - **UI Enhancements**: Loading states, error handling, and refresh indicators
  - **Results**: Dashboard displays live data with automatic updates every 30 seconds

✅ **Enterprise Row-Level Security Implementation Complete (2025-01-15)**:
  - **Database Functions**: SECURITY DEFINER functions for SQL injection prevention
    - `set_rls_context()` - Validates CUIDs and sets session variables
    - `clear_rls_context()` - Clears session variables
    - `get_rls_context()` - Returns current context for debugging
  - **Application Integration**: One canonical `withRLS()` wrapper pattern
  - **Database Policies**: RLS enabled on all 26 tenant-scoped tables
  - **Quality Assurance**: pgTAP test ensures no table ships without RLS
  - **Documentation**: [RLS Guide](./docs/RLS_GUIDE.md) for developers
  - **Results**: Enterprise-grade multi-tenant isolation with zero application code

✅ **RLS Test Migration & Cleanup Complete (2025-07-17)**:
  - **Test Migration**: All RLS integration tests updated to use dual-connection pattern
  - **Production Module**: Migrated to canonical RLS implementation in `/lib/rls/`
  - **Cleanup**: Removed deprecated `rls-middleware-v2.ts` and `rls-v2.integration.spec.ts`
  - **ID Format**: Enforcing CUID format (25 lowercase alphanumeric) at database level
  - **Test Status**: All RLS tests passing with proper tenant isolation
  - **Documentation**: Updated [RLS Implementation Guide](./RLS_IMPLEMENTATION_GUIDE.md)

✅ **Frontend Import Path Fix Complete (2025-07-14)**:
  - **Root Cause**: Systematic import path inconsistencies preventing build compilation across 23 frontend files
  - **Analysis**: 4 major root causes identified through comprehensive codebase review
  - **Implementation**: 
    - Fixed UI component imports: `@/components/ui/*` → `@ventry/ui` (11 files)
    - Fixed tRPC client imports: `@/lib/trpc/client` → `@/lib/trpc` (11 files)
    - Fixed ProtectedRoute imports: default → named import pattern (10 files)
    - Fixed legacy Supabase import paths in hooks (1 file)
    - Cleaned up linting issues: removed unused imports/variables, consolidated imports
  - **Results**: Build compilation successful, all warehouse tests passing (9/9), zero TypeScript errors

## 🔒 Production Readiness Progress (NEW - 2025-01-15)

### Comprehensive Security & Performance Audit Completed
- **Audit Report**: [Production Readiness Audit](./docs/PRODUCTION_READINESS_AUDIT.md)
- **Status**: 6/10 Production Ready (RLS v2 completed, database config required)

### ✅ Completed Security Improvements:
1. **Fixed Hardcoded Secrets**: JWT and cookie secrets now require environment variables
2. **Structured Logging**: Implemented Pino logger, removed 100+ console.log statements  
3. **Cookie Security**: Created secure cookie utilities with proper configuration
4. **Database Indexes**: Added 50+ performance indexes for all critical queries
5. **Environment Validation**: Application refuses to start without required security config
6. **Row-Level Security (RLS) v2**: ✅ COMPLETE - Enterprise-grade RLS implementation
   - Created secure RLS module with full type safety (zero `any` types)
   - Input validation with Zod schemas prevents SQL injection
   - Comprehensive audit logging for all RLS operations
   - Performance monitoring and metrics collection
   - 40 unit tests with 100% coverage of critical paths
   - Developer guide: [RLS Developer Guide](./docs/RLS_DEVELOPER_GUIDE.md)
   - **CRITICAL**: Requires non-superuser database role for production

### 🚨 Critical Tasks Remaining:
1. **Database Configuration**: Must use non-superuser role (current user bypasses RLS)
2. **Test Coverage Crisis**: 18 of 22 backend routers have zero tests (82% untested)
3. **Type Safety**: 170+ uses of `any` type throughout codebase
4. **Auth Architecture**: Race conditions in authentication flow
5. **Production Config**: Missing connection pooling, backups, monitoring

### 📚 New Documentation Created:
- [Production Readiness TODO](./docs/PRODUCTION_READINESS_TODO.md) - 200+ detailed tasks
- [Security Hardening Guide](./docs/SECURITY_HARDENING_GUIDE.md) - OWASP compliance
- [Database Migration Strategy](./docs/DATABASE_MIGRATION_STRATEGY.md) - Zero-downtime procedures
- [Performance Optimization Guide](./docs/PERFORMANCE_OPTIMIZATION_GUIDE.md) - Full-stack optimization
- [Database Indexes Documentation](./docs/DATABASE_INDEXES.md) - Index strategy
- [RLS Developer Guide](./docs/RLS_DEVELOPER_GUIDE.md) - Complete RLS usage and troubleshooting

See the [full audit report](./docs/PRODUCTION_READINESS_AUDIT.md) for detailed findings and roadmap.

## 🎨 UI Development Progress

### ✅ All Major UI Pages Complete (2025-01-21)

All 13 major pages have been implemented with consistent patterns:
- **ProtectedRoute and DashboardLayout wrappers** for proper authentication and navigation
- **Dialog-based CRUD operations** for better UX
- **Card components for stats** displaying key metrics
- **Table views with filtering** for data management
- **Consistent styling** with muted-foreground for secondary text

#### ✅ Phase 1: Core Pages (COMPLETE)
- **Inventory Page**: Full tRPC integration with stock adjustments and filtering
- **Products/Items Page**: Complete CRUD operations with categories and units of measure
- **Warehouses Page**: Location hierarchy, capacity tracking, and analytics

#### ✅ Phase 2: Business Operations (COMPLETE) 
- **Purchase Orders Page**: Full workflow with create, list, detail views and approval actions
- **Customers Page**: Complete CRUD with credit limits and detail views
- **Orders Page**: List and detail pages with order workflow and fulfillment tracking
- **Suppliers Page**: Contact tracking and performance metrics
- **Users Page**: User management with role-based permissions and status control

#### ✅ Phase 3: Additional Features (COMPLETE)
- **Categories Page**: Hierarchical tree view with parent-child relationships
- **Locations Page**: Consolidated warehouse/location management
- **Movements Page**: Comprehensive stock movement tracking with filters
- **Reports Page**: Report templates with filtering and export capabilities
- **Analytics Dashboard**: Live data integration with auto-refresh

✅ **E2E Cookie Authentication Fix Complete (2025-07-09)**:
  - **Root Cause**: Cross-origin cookie restrictions between backend (localhost:6060) and frontend (localhost:6061) ports preventing httpOnly cookies from being stored/sent
  - **Browser Behavior**: Modern browsers treat different ports as different origins, blocking cookie sharing even with Domain=localhost
  - **Solution**: Next.js proxy configuration routing `/api/trpc/*` to backend, making all requests appear same-origin
  - **Implementation**: 
    - Added rewrites to next.config.ts: `/api/trpc/:path*` → `http://localhost:6060/trpc/:path*`
    - Updated E2E playwright.config.ts NEXT_PUBLIC_API_URL from `http://localhost:6060/trpc` to `/api/trpc`
    - Removed Domain=localhost from cookies (no longer needed with proxy)
    - Fixed test error handling that was masking the real authentication issue
    - Removed problematic clearCookies() calls on closing browser contexts
  - **Results**: All 9 auth E2E tests now passing consistently across all browsers
  - **Performance**: E2E tests execute reliably without timeout issues
  - **Lessons**: 
    - Browser security prevents cookie sharing across ports even with same domain
    - Playwright browser contexts automatically clean up cookies when closed
    - Proxy pattern is the proper solution for cookie-based auth in development

✅ **Phase 1.1 UI Connection Complete (2025-07-14)**:
  - **Inventory Page Connected**: Successfully connected inventory page to tRPC router
  - **Stock Adjustment Dialog**: Implemented functional stock adjustment with real-time updates
  - **Organization Context**: Added multi-tenant support with organization switcher
  - **Sonner Toast Integration**: Modern toast notifications for user feedback
  - **Database Seeding**: Comprehensive seed script creates demo data (50 items, 3 warehouses, organizations)
  - **Authentication Flow**: Fixed JWT to include organizationId for proper context
  - **UI State Management**: Integrated Zustand store with tRPC queries

✅ **Phase 1.2 & 1.3 Complete (2025-07-14)**:
- [x] Connected Products/Items page to items router with full CRUD operations
- [x] Connected Warehouses page to warehouses router with management UI
- [x] Comprehensive test coverage for all implemented pages
- [x] Fixed systematic import path issues across frontend codebase
- [x] All 12 status checks passing in CI/CD pipeline

✅ **Phase 1.4 Dashboard Enhancement Complete (2025-07-15)**:
- [x] Connect dashboard info cards to live backend analytics data via tRPC
- [x] Implement auto-refresh functionality with 30-second intervals
- [x] Add manual refresh controls and auto-refresh toggle
- [x] Integrate real-time system health monitoring with API/database status
- [x] Replace mock data with live analytics from `trpc.analytics.dashboard.useQuery()`
- [x] Add proper loading states and error handling for live data
- [x] Include EMPLOYEE role support in AuthenticatedUser type definition

✅ **TypeScript Migration Complete (2025-07-15)**:
- [x] Resolved all tRPC type inference issues by removing problematic type annotations
- [x] Configured backend as internal service with `noEmit: true` to eliminate TS2742 errors
- [x] Updated build configuration to use `tsx` for runtime execution
- [x] Achieved 0 TypeScript errors without suppression comments
- [x] Maintained full type safety and tRPC inference capabilities

✅ **Database Column Naming Convention Fix Complete (2025-07-15)**:
- [x] Added @map directives to all camelCase fields in Prisma schema for snake_case database columns
- [x] Updated all raw SQL queries to use snake_case column names
- [x] Fixed Prisma client generation issue causing integration test failures
- [x] Rebuilt database package after Prisma client regeneration to ensure consistency
- [x] All integration tests now passing with proper column name mapping
- [x] Maintained PostgreSQL best practice: snake_case in database, camelCase in TypeScript/JavaScript

✅ **Build Compilation Fixes Complete (2025-07-15)**:
- [x] Fixed React Query v5 migration issues (isLoading → isPending) in customer-form and organization pages
- [x] Added required fields to customer form schema: customerCode, firstName, lastName, email
- [x] Fixed Prisma Decimal type conversions using parseFloat(value.toString())
- [x] Fixed paginated API response access patterns (items.items, suppliers.suppliers, etc.)
- [x] Updated warehouse list query parameters in stats-cards component
- [x] Fixed create-order-dialog schema to match backend expectations
- [x] Removed address fields from order creation form (billing/shipping addresses)
- [x] Fixed purchase order mutations with correct parameter structures
- [x] Build now compiles successfully with only ESLint warnings about `any` types

✅ **ESLint Type Safety Improvements Complete (2025-07-15)**:
- [x] Fixed `any` type warnings in all production code (non-test files)
- [x] Used proper type inference with `typeof` for tRPC query results
- [x] Imported database model types from `@ventry/database` package
- [x] Fixed create-order-dialog field mismatches and removed non-existent fields
- [x] Added proper type annotations for all component props and state
- [x] Replaced `any` with `unknown` in Supabase placeholder types
- [x] Test files retain `as any` casts for mocks (standard practice)

✅ **Code Style Standardization Complete (2025-07-15)**:
- [x] **Import Ordering**: Implemented ESLint-enforced import ordering across entire codebase
  - React/Next.js → External packages → Workspace → Absolute → Relative → Type imports
  - Updated ~50 files to follow consistent import patterns
  - Configured ESLint import/order rule with pathGroups
- [x] **CLAUDE.md Style Guide**: Added comprehensive CODE STYLE GUIDE section
  - Import ordering rules with examples
  - File naming conventions (components, routers, tests)
  - TypeScript patterns (interfaces for props, type imports)
  - Component structure patterns
  - tRPC router patterns
  - Error handling conventions
  - Testing patterns
- [x] **File Standardization**: 
  - Renamed test files from `.spec.ts` to `.test.ts`
  - Removed explicit type annotations from tRPC routers
  - Fixed type-only imports across codebase
- [x] **Quality Improvements**:
  - Zero import ordering violations
  - Consistent code organization
  - Enhanced readability and maintainability

✅ **Phase 2: Authentication & Organization Context (2025-01-18)**:
- [x] Fixed React Hook usage violation in organization switching (useUtils must be at component level)
- [x] Implemented automatic active-organization cookie setting on login
- [x] Enhanced AuthService to set both auth-token and active-organization cookies
- [x] Verified login → dashboard flow with proper cookie persistence
- [x] Tested organization context maintains across page refreshes
- [x] Fixed organization switching functionality

✅ **Phase 2.1: Warehouse & Location Management Complete (2025-01-20)**:
- [x] Verified warehouses tRPC router exists with comprehensive functionality
- [x] Confirmed warehouse UI pages already implemented (list, create, edit, details)
- [x] Validated location sub-router within warehouses for storage hierarchy
- [x] Checked seed data includes multiple warehouses with 8-12 locations each
- [x] All warehouse-related components tested and working
- [x] Capacity tracking, utilization analytics, and activity monitoring implemented

✅ **Phase 2.2: Supplier Management Complete (2025-01-20)**:
- [x] Enhanced suppliers router with archive and getStats methods
- [x] Connected suppliers page to live statistics display
- [x] Fixed supplier list component with proper type safety
- [x] Added visual activity indicators (green for recent orders)
- [x] Implemented supplier metrics: total, active, lead times, YTD value
- [x] Added suppliers to navigation sidebar
- [x] Improved display to match app patterns (warehouse/product pages)

✅ **Phase 2.3 Complete**: Purchase Orders & Customer Management (2025-01-21)
- [x] **Priority 2**: Create Purchase Orders page UI ✅ COMPLETE
  - Connected to purchaseOrders router
  - Built PO creation workflow with supplier selection
  - Added approval process UI (approve/cancel/reject)
  - Implemented detail view with line items
- [x] **Priority 3**: Create Customers page UI components ✅ COMPLETE
  - Connected to customers router  
  - Customer list and management with CRUD operations
  - Credit limit tracking and detail views
- [x] **Priority 4**: Create Orders page with workflow ✅ COMPLETE
  - Connected to orders router
  - Order list and detail pages implemented
  - Order workflow and fulfillment tracking

✅ **Additional Pages Completed**:
- [x] Categories page with hierarchical tree view
- [x] Locations page with consolidated warehouse management
- [x] Movements page with comprehensive stock tracking
- [x] Reports page layout fixed with sidebar navigation

📅 **Remaining Tasks**:
- [ ] Complete E2E tests for authentication flow and RLS isolation
- [ ] Implement advanced analytics dashboards with additional charts
- [ ] Add real-time notifications and updates

## 📋 Implementation Phases

---

## Phase 0: Foundation & CI/CD Setup (Week 1-2) ✅ COMPLETED

### 0.1 Project Scaffolding & Monorepo Setup
- [x] **0.1.1** Initialize Git repository with proper .gitignore
  - Add Node.js, TypeScript, Docker, and IDE-specific ignores
  - Include environment files, build outputs, and dependency directories
  - Add AI-specific ignores (model files, logs, cache directories)

- [x] **0.1.2** Create pnpm workspace configuration
  - Create `pnpm-workspace.yaml` with apps and packages structure
  - Configure workspace dependencies and shared scripts
  - Set up version management strategy

- [x] **0.1.3** Configure Turborepo for monorepo management
  - Create `turbo.json` with optimized build pipelines
  - Define task dependencies: build, test, lint, typecheck, dev
  - Configure remote caching for CI/CD optimization
  - Set up parallel execution for independent tasks

- [x] **0.1.4** Create directory structure
  ```
  ventry/
  ├── apps/
  │   ├── backend/
  │   ├── web/
  │   └── docs/
  ├── packages/
  │   ├── shared/
  │   ├── ui/
  │   └── database/
  ├── tools/
  │   └── scripts/
  └── docs/
  ```

### 0.2 Docker Development Environment
- [x] **0.2.1** Create Docker Compose configuration
  - PostgreSQL 14+ service with persistent volumes
  - Redis service for caching and session management
  - pgAdmin for database management (dev only)
  - Volume mounts for source code hot-reloading

- [x] **0.2.2** Create Dockerfiles for each application
  - Multi-stage builds for production optimization
  - Node.js 18+ Alpine base images
  - Proper layer caching for dependency installation
  - Security best practices (non-root user, minimal attack surface)

- [x] **0.2.3** Development environment scripts
  - `scripts/dev-setup.sh` for initial environment setup
  - `scripts/reset-db.sh` for database reset and seeding
  - `scripts/backup-db.sh` for database backup utilities
  - Health check scripts for all services

### 0.3 Code Quality & Development Tools
- [x] **0.3.1** ESLint configuration
  - Shared ESLint config in `packages/eslint-config`
  - TypeScript-specific rules for strict type checking
  - React/Next.js specific rules for frontend
  - NestJS specific rules for backend
  - Import sorting and unused import detection

- [x] **0.3.2** Prettier configuration
  - Shared Prettier config for consistent formatting
  - Integration with ESLint for conflict resolution
  - Pre-commit formatting hooks
  - IDE integration instructions

- [x] **0.3.3** Husky pre-commit hooks
  - Install and configure Husky
  - Pre-commit: lint-staged for incremental linting
  - Pre-commit: TypeScript compilation check
  - Pre-commit: test execution for changed files
  - Commit message validation (Conventional Commits)

- [x] **0.3.4** TypeScript configuration
  - Root `tsconfig.json` with strict mode enabled
  - Shared `tsconfig.base.json` for consistent settings
  - Path mapping for internal packages
  - Workspace-specific TypeScript configs

### 0.4 GitHub Actions CI/CD Pipeline
- [x] **0.4.1** Create CI workflow (`.github/workflows/ci.yml`)
  - Trigger on push to main and pull requests
  - Matrix strategy for Node.js versions (18, 20)
  - Dependency caching with pnpm
  - Turborepo remote caching setup
  - Parallel execution of lint, typecheck, test, build

- [x] **0.4.2** Create deployment workflow (`.github/workflows/deploy.yml`)
  - Staging deployment on merge to main
  - Production deployment on tag creation
  - Docker image building and registry push
  - Database migration automation
  - Environment-specific secret management

- [x] **0.4.3** Create security workflow (`.github/workflows/security.yml`)
  - Dependency vulnerability scanning (npm audit)
  - SAST scanning with CodeQL
  - Secret scanning and leak detection
  - License compliance checking

- [x] **0.4.4** Branch protection rules
  - Require PR reviews for main branch
  - Require CI checks to pass before merge
  - Require up-to-date branches before merge
  - Dismiss stale reviews on new commits

### 0.5 Documentation & Project Setup
- [x] **0.5.1** Create development documentation
  - `docs/DEVELOPMENT.md` with setup instructions
  - `docs/ARCHITECTURE.md` with system overview
  - `docs/CONTRIBUTING.md` with contribution guidelines
  - `docs/API.md` placeholder for API documentation

- [x] **0.5.2** Environment configuration templates
  - `.env.example` with all required variables
  - `docker-compose.override.yml.example` for local customization
  - Development vs production configuration documentation
  - Security considerations for environment variables

- [x] **0.5.3** Package.json scripts organization
  - Root package.json with workspace-level scripts
  - Consistent script naming across packages
  - Development shortcuts (dev, build, test, lint)
  - Production deployment scripts

---

## Phase 1: Core Backend Infrastructure ✅ COMPLETED

### 1.1 tRPC + Fastify Application Setup ✅ COMPLETED
- [x] **1.1.1** Initialize tRPC + Fastify backend application
  - Created `apps/backend` with complete tRPC + Fastify application
  - Configured TypeScript with strict mode and ESM-only architecture
  - Set up proper project structure (src/, test/, dist/)
  - Configured module resolution for monorepo with workspace dependencies

- [x] **1.1.2** Core tRPC router architecture
  - `AppRouter` as root router with type-safe procedures
  - Context system for dependency injection and authentication
  - Modular router structure (auth, users, products, categories, health)
  - JWT authentication middleware with role-based access control

- [x] **1.1.3** Fastify server configuration
  - CORS configuration for frontend integration
  - Request logging and security middleware
  - tRPC adapter integration with HTTP batch linking
  - Error handling with proper HTTP status codes

- [x] **1.1.4** Type-safe validation with Zod
  - Input/output schemas for all tRPC procedures
  - Runtime validation with compile-time type inference
  - Custom Zod schemas for business rule validation
  - Automatic TypeScript type generation for frontend consumption

### 1.2 Database Setup with Prisma ✅ COMPLETED
- [x] **1.2.1** Prisma configuration and setup
  - Initialized Prisma in `packages/database`
  - Configured PostgreSQL/SQLite dual compatibility
  - Set up Prisma Client generation
  - Database URL configuration for all environments

- [x] **1.2.2** Core database schema design
  ```prisma
  // User management
  model User {
    id        String   @id @default(cuid())
    email     String   @unique
    password  String
    role      Role     @default(USER)
    profile   Profile?
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
  }

  // Inventory core entities
  model Product {
    id          String   @id @default(cuid())
    sku         String   @unique
    name        String
    description String?
    categoryId  String
    category    Category @relation(fields: [categoryId], references: [id])
    // ... additional fields
  }

  model Category {
    id       String    @id @default(cuid())
    name     String
    parentId String?
    parent   Category? @relation("CategoryHierarchy", fields: [parentId], references: [id])
    children Category[] @relation("CategoryHierarchy")
    products Product[]
  }

  model Location {
    id          String @id @default(cuid())
    name        String
    address     String
    type        LocationType
    isActive    Boolean @default(true)
    stockLevels StockLevel[]
  }

  model StockLevel {
    id         String   @id @default(cuid())
    productId  String
    locationId String
    quantity   Int
    reserved   Int      @default(0)
    product    Product  @relation(fields: [productId], references: [id])
    location   Location @relation(fields: [locationId], references: [id])
    updatedAt  DateTime @updatedAt
    @@unique([productId, locationId])
  }

  model StockMovement {
    id         String      @id @default(cuid())
    productId  String
    locationId String
    type       MovementType
    quantity   Int
    reference  String?     // PO number, invoice, etc.
    reason     String?
    userId     String
    product    Product     @relation(fields: [productId], references: [id])
    location   Location    @relation(fields: [locationId], references: [id])
    user       User        @relation(fields: [userId], references: [id])
    createdAt  DateTime    @default(now())
  }

  // AI-specific tables
  model AgentLog {
    id        String    @id @default(cuid())
    agentType AgentType
    input     Json
    output    Json
    metadata  Json?
    userId    String?
    user      User?     @relation(fields: [userId], references: [id])
    createdAt DateTime  @default(now())
  }

  model Forecast {
    id         String   @id @default(cuid())
    productId  String
    locationId String
    period     String   // YYYY-MM format
    predicted  Float
    confidence Float
    algorithm  String
    product    Product  @relation(fields: [productId], references: [id])
    location   Location @relation(fields: [locationId], references: [id])
    createdAt  DateTime @default(now())
  }

  model AnomalyEvent {
    id         String      @id @default(cuid())
    type       AnomalyType
    severity   Severity
    productId  String?
    locationId String?
    detected   Json
    resolved   Boolean     @default(false)
    product    Product?    @relation(fields: [productId], references: [id])
    location   Location?   @relation(fields: [locationId], references: [id])
    createdAt  DateTime    @default(now())
  }
  ```

- [x] **1.2.3** Database migrations and seeding
  - Complete schema with all inventory management models
  - Comprehensive seed script with test users and sample data
  - Proper migration structure for schema evolution
  - Data integrity constraints and optimized indexes

- [x] **1.2.4** Prisma service integration
  - `DatabaseService` as injectable provider extending PrismaClient
  - Connection management with health checks
  - Transaction management utilities
  - Database health monitoring endpoint

### 1.3 Authentication & Authorization ✅ COMPLETED
- [x] **1.3.1** JWT authentication setup
  - Complete JWT strategy with jsonwebtoken
  - Token generation and validation
  - Refresh token implementation
  - Secure token handling for logout

- [x] **1.3.2** Role-based access control (RBAC)
  - Implemented roles: ADMIN, MANAGER, USER
  - Permission system with tRPC middleware
  - Protected procedures with role checking
  - Resource-based authorization system

- [x] **1.3.3** Authentication procedures
  - `auth.login` mutation - User authentication with validation
  - `auth.register` mutation - User registration with validation
  - `auth.refresh` mutation - Token refresh mechanism
  - `auth.logout` mutation - Secure user logout
  - `auth.profile` query - User profile retrieval

- [x] **1.3.4** Password security
  - Bcrypt for secure password hashing
  - Password validation with Zod schemas
  - User account management
  - Secure authentication flow

### 1.4 tRPC API Development ✅ COMPLETED
- [x] **1.4.1** Type-safe procedure implementation
  - Complete tRPC router with full type inference
  - Zod schemas for input/output validation
  - Modular router architecture (auth, users, products, categories, health)
  - Automatic TypeScript type generation

- [x] **1.4.2** Complete tRPC API implementation
  - Full CRUD operations for all entities
  - Type-safe procedure definitions
  - Consistent error handling with tRPC error codes
  - Runtime validation with compile-time type safety

- [x] **1.4.3** API security implementation
  - Protected procedures with JWT middleware
  - Role-based access control via tRPC middleware
  - Input sanitization and validation with Zod
  - Comprehensive security via Fastify integration

- [x] **1.4.4** Full tRPC router coverage
  - Users management with role-based access
  - Products CRUD with category relationships
  - Categories management with validation
  - Health monitoring with database checks
  - Complete workspace dependency integration for type sharing

### 1.5 Frontend Integration ✅ COMPLETED
- [x] **1.5.1** Next.js 15 application setup
  - Complete Next.js 15 app with App Router
  - TypeScript configuration with workspace integration
  - Package dependencies with shared packages
  - Environment configuration for API integration

- [x] **1.5.2** Authentication frontend implementation
  - Login form with validation using react-hook-form + zod
  - Authentication store with Zustand + persistence
  - JWT token management with refresh
  - Route protection and redirect logic

- [x] **1.5.3** Dashboard and layout system
  - Responsive dashboard layout with sidebar navigation
  - Real-time inventory statistics display
  - Role-based navigation and permissions
  - Mobile-responsive design with collapsible sidebar

- [x] **1.5.4** tRPC client integration
  - tRPC React Query client with type inference
  - Automatic token refresh handling
  - Error handling and retry logic
  - Full-stack TypeScript type safety

- [x] **1.5.5** UI component foundation
  - shadcn/ui component library setup
  - Core components (Button, Input, Card, Table, etc.)
  - Tailwind CSS configuration with design tokens
  - Component documentation and usage

### 1.6 Testing Infrastructure ✅ COMPLETED
- [x] **1.6.1** E2E test coverage update
  - Authentication flow testing (login, logout, validation)
  - Dashboard navigation and functionality testing
  - Responsive design testing across viewports
  - Browser compatibility testing (Chromium, Firefox, WebKit)

- [x] **1.6.2** Test automation enhancement
  - Updated Playwright tests for new authentication system
  - Navigation testing with role-based access
  - Form validation and error handling tests
  - Real-time data display testing

---

## Phase 2: Supabase Migration (Week 7-8) 🚧 IN PROGRESS

### 2.0 Supabase Integration
- [x] **2.0.1** Analyze Supabase feasibility and create migration plan
  - Documented comprehensive migration strategy
  - Created 40+ table schema for inventory management
  - Planned gradual migration approach (3-4 weeks)
  - Identified key benefits: realtime, RLS, storage

- [x] **2.0.2** Create new Prisma schema with inventory tables
  - Items, Categories, UnitOfMeasure, Lots, SerialNumbers
  - Warehouses, Locations, Inventory tracking
  - Procurement: Suppliers, PurchaseOrders, Receipts
  - Sales: Customers, Orders, Shipments, Returns
  - POS transactions and discount management
  - Audit logs and notifications

- [ ] **2.0.3** Setup Supabase project and authentication
  - Initialize Supabase project
  - Configure environment variables
  - Implement auth migration strategy
  - Test Supabase connection with Prisma

- [ ] **2.0.4** Implement Row Level Security policies
  - User role-based access policies
  - Multi-tenant data isolation
  - Inventory operation permissions
  - Audit trail security

- [ ] **2.0.5** Integrate Supabase realtime features
  - Live inventory updates across locations
  - Stock movement notifications
  - Collaborative features
  - WebSocket integration with tRPC

- [x] **2.0.6** Migrate data and update tRPC procedures
  - ✅ Created all 13 comprehensive backend routers:
    - Items router with bulk operations and history
    - Warehouses router with locations management
    - Inventory router with lot/serial tracking
    - Stock movements router with audit trail
    - Suppliers router with performance metrics
    - Customers router with credit management
    - Orders router with allocation/shipment
    - Purchase orders router with approvals
    - Returns router with RMA and refunds
    - Shipments router with tracking and delivery
    - Reports router with comprehensive analytics
    - Analytics router with real-time insights
    - Categories router for product categorization
    - Organizations router for multi-tenant management
  - ✅ All routers complete! Ready for UI implementation
  - ✅ All routers include: filtering, pagination, export, audit logging
  - ✅ **TypeScript Migration COMPLETE (2025-07-14)**: All 619 TypeScript errors resolved, 0 production errors
  - ✅ **Prisma 6.x ESM Migration COMPLETE (2025-07-14)**: Native ESM support with dotenv-cli
  - ✅ **Database Seeding Fixed (2025-07-14)**: Demo users properly seeded with correct passwords
  - 📅 Data migration scripts pending
  - 📅 Performance optimization pending

- [x] **2.0.7** Build inventory management UI components
  - ✅ Created inventory list page with filters and search
  - ✅ Built stock adjustment dialog with reasons
  - ✅ Implemented product management pages (list, create, edit)
  - ✅ Created warehouse management pages (list, create, edit)
  - ✅ Added UI components: Select, Textarea, Switch, Skeleton, DropdownMenu, RadioGroup
  - ✅ Built order management UI (list, create, edit, view)
  - ✅ Created supplier management pages (list, create, edit)
  - ✅ Created customer management UI (list, create, edit, detail view)
  - ✅ Built purchase order management UI (list, create, detail, approval workflow)
  - ✅ Created analytics dashboard with KPIs, charts, and insights
  - ✅ Added Tabs component and Recharts integration for data visualization
  - 📅 Reports builder and custom report generation pending

### 2.1 UI Implementation Phase (Week 9-11) 🚧 IN PROGRESS
- [x] **2.1.1** Phase 1.1: Connect Inventory Page to tRPC router ✅ COMPLETE (2025-07-14)
  - ✅ Connected inventory list to backend with proper field mapping
  - ✅ Implemented search functionality
  - ✅ Fixed stock adjustment to use correct API schema
  - ✅ Added warehouse filtering
  - 📅 Write tests for Inventory page (unit, integration, E2E)

- [ ] **2.1.2** Phase 1.2: Connect Products/Items page to items router
  - 📅 Implement CRUD operations for items
  - 📅 Write tests for Products page

- [x] **2.1.3** Phase 1.3: Connect Warehouses page to warehouses router ✅ COMPLETE (2025-07-14)
  - 📅 Implement location hierarchy visualization
  - 📅 Write tests for Warehouses page

- [x] **2.1.4** Phase 2: Procurement Module ✅ COMPLETE
  - ✅ Connect Suppliers page to backend
  - ✅ Connect Purchase Orders page 
  - ✅ Create Receipts page

- [x] **2.1.5** Phase 3: Sales Module ✅ MOSTLY COMPLETE
  - ✅ Complete Customers page integration
  - ✅ Complete Orders page with workflow
  - 📅 Create Shipments tracking page (remaining)

## Phase 3: AI Integration (Week 9-10)

### 3.1 AI Agent Foundation
- [ ] **3.1.1** Agent infrastructure setup
  - Create AI agent base classes and interfaces
  - Implement agent execution framework
  - Set up LLM provider abstraction (OpenAI/Anthropic)
  - Configure agent logging and monitoring

- [ ] **3.1.2** Stock Advisor Agent implementation
  - Implement reorder quantity recommendation logic
  - Historical sales analysis algorithms
  - Seasonality detection and trend analysis
  - Integration with tRPC backend procedures

- [ ] **3.1.3** Forecast Agent implementation
  - Time-series forecasting algorithms
  - Demand prediction with confidence intervals
  - External factor integration (seasonality, trends)
  - tRPC procedures for forecast generation

- [ ] **3.1.4** Anomaly Detection Agent
  - Statistical anomaly detection algorithms
  - Stock movement pattern analysis
  - Alert generation and notification system
  - Integration with existing inventory monitoring

### 3.2 Conversational AI Interface
- [ ] **3.2.1** Chat interface implementation
  - Real-time chat UI with streaming responses
  - Natural language query processing
  - Intent recognition and context management
  - Integration with existing shadcn/ui components

- [ ] **3.2.2** Agent orchestration system
  - Agent routing based on user queries
  - Multi-agent conversation handling
  - Context preservation across interactions
  - Response aggregation and formatting
  - Theme configuration and customization
  - Component documentation and examples

- [ ] **3.2.3** Design system implementation
  - Color palette and typography
  - Spacing and sizing scales
  - Component variants and states
  - Accessibility compliance (WCAG 2.1)

- [ ] **3.2.4** UI component organization
  - Atomic design principles
  - Shared components in packages/ui
  - App-specific components in apps/web
  - Storybook setup for component development

### 3.3 State Management & Data Fetching
- [ ] **3.3.1** React Context setup
  - Authentication context
  - Theme context for dark/light mode
  - Global app state management
  - Context providers organization

- [ ] **3.3.2** TanStack Query (React Query) setup
  - Query client configuration
  - API client integration
  - Caching strategies
  - Optimistic updates implementation

- [ ] **3.3.3** API client configuration
  - Axios or fetch wrapper
  - Request/response interceptors
  - Error handling and retry logic
  - Authentication header management

- [ ] **3.3.4** Form handling
  - React Hook Form integration
  - Zod schema validation
  - Form components and validation
  - Error message handling

### 3.4 Routing & Navigation
- [ ] **3.4.1** App Router structure
  ```
  app/
  ├── (auth)/
  │   ├── login/
  │   └── register/
  ├── (dashboard)/
  │   ├── dashboard/
  │   ├── inventory/
  │   ├── suppliers/
  │   ├── reports/
  │   └── settings/
  ├── chat/
  └── api/
  ```

- [ ] **3.4.2** Navigation components
  - Sidebar navigation with collapsible menu
  - Breadcrumb navigation
  - Tab navigation for sub-pages
  - Mobile-responsive navigation

- [ ] **3.4.3** Route protection
  - Authentication guards
  - Role-based route access
  - Redirect logic for unauthorized access
  - Loading states during authentication

- [ ] **3.4.4** SEO and metadata
  - Dynamic metadata generation
  - Open Graph tags
  - Structured data implementation
  - Sitemap generation

### 3.5 Real-time Features Foundation
- [ ] **3.5.1** WebSocket client setup
  - Socket.io client configuration
  - Connection management
  - Event handling system
  - Reconnection logic

- [ ] **3.5.2** Real-time state synchronization
  - WebSocket integration with React Query
  - Optimistic updates for real-time data
  - Conflict resolution strategies
  - Connection status indicators

- [ ] **3.5.3** Notification system
  - Toast notifications for user feedback
  - Real-time alerts for critical events
  - Notification persistence and history
  - Push notification setup (future)

- [ ] **3.5.4** Live data components
  - Real-time dashboard widgets
  - Live stock level indicators
  - Activity feeds with real-time updates
  - Performance monitoring displays

---

## Phase 4: Core Inventory Features (Week 11-12)

### 3.1 Products Management
- [ ] **3.1.1** Product CRUD operations
  - `ProductsController` with full CRUD endpoints
  - `ProductsService` with business logic
  - Product DTO classes for validation
  - Product search and filtering

- [ ] **3.1.2** Product frontend components
  - Product list with pagination and filtering
  - Product creation and editing forms
  - Product detail view with image gallery
  - Product import/export functionality

- [ ] **3.1.3** Product categorization
  - Category hierarchy management
  - Category-based product filtering
  - Category tree visualization
  - Product category assignment

- [ ] **3.1.4** Product attributes and specifications
  - Custom attribute definitions
  - Attribute value management
  - Attribute-based search and filtering
  - Attribute validation and constraints

### 3.2 Stock Management
- [ ] **3.2.1** Stock level tracking
  - Real-time stock level updates
  - Multi-location stock management
  - Reserved stock tracking
  - Stock level history

- [ ] **3.2.2** Stock movement operations
  - Stock adjustment transactions
  - Transfer between locations
  - Stock movement audit trail
  - Batch stock operations

- [ ] **3.2.3** Stock alerts and notifications
  - Low stock threshold configuration
  - Automated alert generation
  - Stock alert dashboard
  - Email notifications for critical alerts

- [ ] **3.2.4** Stock reconciliation
  - Physical count vs system count
  - Variance reporting and analysis
  - Stock adjustment workflows
  - Reconciliation history tracking

### 3.3 Supplier Management
- [ ] **3.3.1** Supplier CRUD operations
  - Supplier profile management
  - Contact information tracking
  - Supplier performance metrics
  - Supplier categorization

- [ ] **3.3.2** Purchase order management
  - Purchase order creation and editing
  - Approval workflow implementation
  - Purchase order tracking
  - Receiving and fulfillment tracking

- [ ] **3.3.3** Supplier relationship management
  - Supplier performance scoring
  - Lead time tracking
  - Price history and comparison
  - Supplier communication log

- [ ] **3.3.4** Procurement automation
  - Automated reorder point calculation
  - Purchase order generation
  - Supplier selection algorithms
  - Contract and pricing management

### 3.4 Location Management
- [ ] **3.4.1** Location hierarchy
  - Warehouse and zone management
  - Location-based stock tracking
  - Location capacity management
  - Location performance analytics

- [ ] **3.4.2** Location operations
  - Stock transfers between locations
  - Location-specific pricing
  - Location access control
  - Location operational hours

- [ ] **3.4.3** Location analytics
  - Location performance metrics
  - Space utilization analysis
  - Location profitability analysis
  - Movement pattern analysis

- [ ] **3.4.4** Location optimization
  - Optimal stock placement
  - Location efficiency metrics
  - Automated location recommendations
  - Location-based forecasting

### 3.5 Dashboard & Analytics
- [ ] **3.5.1** Real-time dashboard
  - Key performance indicators (KPIs)
  - Stock level overview
  - Recent activity feed
  - Alert notifications panel

- [ ] **3.5.2** Inventory analytics
  - Stock turnover analysis
  - ABC analysis implementation
  - Demand pattern analysis
  - Seasonal trend identification

- [ ] **3.5.3** Reporting system
  - Standard report templates
  - Custom report builder
  - Scheduled report generation
  - Report export functionality

- [ ] **3.5.4** Performance monitoring
  - System performance metrics
  - User activity tracking
  - API performance monitoring
  - Database query optimization

---

## Phase 5: AI Agent Implementation (Week 13-14)

### 4.1 LLM Service Infrastructure
- [ ] **4.1.1** LLM service wrapper
  - `LLMService` as configurable provider
  - Support for OpenAI and Anthropic APIs
  - Request/response standardization
  - Error handling and retry logic

- [ ] **4.1.2** Prompt template system
  - Template storage in `packages/shared/prompts/`
  - Variable substitution system
  - Template versioning and management
  - A/B testing framework for prompts

- [ ] **4.1.3** LLM usage monitoring
  - Request logging and analytics
  - Cost tracking and budgeting
  - Performance metrics (latency, tokens)
  - Usage alerts and quotas

- [ ] **4.1.4** LLM response processing
  - Response parsing and validation
  - Structured output extraction
  - Fallback mechanisms for failures
  - Response caching strategies

### 4.2 Stock Advisor Agent
- [ ] **4.2.1** Stock Advisor service implementation
  ```typescript
  @Injectable()
  export class StockAdvisorService {
    async generateRecommendation(productId: string): Promise<ReorderRecommendation> {
      // 1. Fetch product and historical data
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          stockMovements: {
            where: { createdAt: { gte: sixMonthsAgo } },
            orderBy: { createdAt: 'desc' }
          },
          stockLevels: true,
          supplier: true
        }
      });

      // 2. Calculate key metrics
      const metrics = this.calculateMetrics(product);
      
      // 3. Generate structured prompt
      const prompt = this.promptTemplates.stockAdvisor({
        product,
        metrics,
        currentStock: product.stockLevels.reduce((sum, level) => sum + level.quantity, 0),
        salesHistory: product.stockMovements.filter(m => m.type === 'OUT')
      });

      // 4. Call LLM with chain-of-thought reasoning
      const response = await this.llmService.complete(prompt);
      
      // 5. Parse and validate response
      const recommendation = this.parseRecommendation(response);
      
      // 6. Log action to AgentLogs
      await this.logAgentAction('STOCK_ADVISOR', { productId }, recommendation);
      
      return recommendation;
    }
  }
  ```

- [ ] **4.2.2** Stock Advisor API endpoints
  - POST /api/agents/stock-advisor/recommendation
  - GET /api/agents/stock-advisor/history
  - POST /api/agents/stock-advisor/feedback
  - GET /api/agents/stock-advisor/metrics

- [ ] **4.2.3** Stock Advisor frontend integration
  - Recommendation display component
  - Request form with product selection
  - Recommendation history viewer
  - Feedback collection interface

- [ ] **4.2.4** Stock Advisor prompt engineering
  - Chain-of-thought reasoning prompts
  - Few-shot examples for consistency
  - Prompt optimization and testing
  - Business rule integration

### 4.3 Agent Logging & Monitoring
- [ ] **4.3.1** Agent logging system
  - Structured logging for all agent actions
  - Request/response data storage
  - Performance metrics collection
  - Error tracking and alerting

- [ ] **4.3.2** Agent monitoring dashboard
  - Real-time agent activity feed
  - Performance metrics visualization
  - Error rate and success rate tracking
  - Usage patterns analysis

- [ ] **4.3.3** Agent feedback system
  - User feedback collection
  - Recommendation quality scoring
  - Feedback-based model improvement
  - A/B testing for prompt variations

- [ ] **4.3.4** Agent audit trail
  - Complete action history
  - Decision reasoning capture
  - Compliance and governance tracking
  - Data lineage for recommendations

### 4.4 Event-Driven Architecture
- [ ] **4.4.1** Event system implementation
  - Event emitter service
  - Event handler registration
  - Event persistence and replay
  - Event-driven workflow orchestration

- [ ] **4.4.2** Stock threshold events
  - Low stock detection events
  - Automated agent trigger system
  - Event-based notification system
  - Event correlation and aggregation

- [ ] **4.4.3** Background job processing
  - Queue system for async tasks
  - Job scheduling and execution
  - Job retry and failure handling
  - Job monitoring and alerting

- [ ] **4.4.4** Workflow automation
  - Workflow definition system
  - Conditional logic and branching
  - Human-in-the-loop workflows
  - Workflow performance tracking

### 4.5 AI Security & Compliance
- [ ] **4.5.1** Input validation and sanitization
  - Prompt injection prevention
  - Input length and content validation
  - Malicious content detection
  - Rate limiting for AI endpoints

- [ ] **4.5.2** Output validation and filtering
  - Response content validation
  - Harmful content filtering
  - Business rule compliance checking
  - Output format standardization

- [ ] **4.5.3** AI decision auditing
  - Decision reasoning capture
  - Bias detection and mitigation
  - Fairness and transparency measures
  - Regulatory compliance tracking

- [ ] **4.5.4** Privacy and data protection
  - Data anonymization for AI training
  - PII detection and handling
  - Data retention policies
  - Consent management for AI features

---

## Phase 6: Advanced Features & Testing (Week 15-16)

### 5.1 Forecast Agent Implementation
- [ ] **5.1.1** Time-series forecasting service
  - Historical data preparation
  - Statistical forecasting models
  - Seasonal pattern detection
  - Trend analysis algorithms

- [ ] **5.1.2** Forecast agent LLM integration
  - Prompt engineering for forecasting
  - External factor consideration
  - Forecast explanation generation
  - Confidence interval calculation

- [ ] **5.1.3** Forecast API and frontend
  - Forecast generation endpoints
  - Forecast visualization components
  - Forecast accuracy tracking
  - Forecast adjustment interface

- [ ] **5.1.4** Forecast accuracy monitoring
  - Actual vs predicted tracking
  - Model performance metrics
  - Forecast error analysis
  - Model retraining triggers

### 5.2 Anomaly Detection Agent
- [ ] **5.2.1** Anomaly detection algorithms
  - Statistical anomaly detection
  - Machine learning-based detection
  - Pattern recognition systems
  - Threshold-based alerts

- [ ] **5.2.2** Anomaly agent implementation
  - Real-time anomaly monitoring
  - Anomaly classification system
  - Investigation workflow
  - False positive reduction

- [ ] **5.2.3** Anomaly response system
  - Automated alert generation
  - Escalation procedures
  - Investigation tracking
  - Resolution workflows

- [ ] **5.2.4** Anomaly analytics
  - Anomaly trend analysis
  - Root cause identification
  - Prevention recommendations
  - Impact assessment

### 5.3 Conversational Agent
- [ ] **5.3.1** Chat interface backend
  - WebSocket server for real-time chat
  - Message processing pipeline
  - Context management system
  - Session persistence

- [ ] **5.3.2** Natural language processing
  - Intent recognition system
  - Entity extraction
  - Query parsing and understanding
  - Response generation

- [ ] **5.3.3** Chat interface frontend
  - Real-time chat component
  - Message history display
  - File upload and sharing
  - Voice input integration

- [ ] **5.3.4** Conversational AI features
  - Context-aware responses
  - Multi-turn conversations
  - Action execution from chat
  - Conversation analytics

### 5.4 Comprehensive Testing Suite
- [ ] **5.4.1** Backend testing
  - Unit tests for all services
  - Integration tests for APIs
  - E2E tests for critical workflows
  - Performance testing

- [ ] **5.4.2** Frontend testing
  - Component unit tests
  - User interaction tests
  - Visual regression testing
  - Accessibility testing

- [ ] **5.4.3** AI agent testing
  - Mock LLM response testing
  - Prompt validation testing
  - Agent behavior testing
  - Performance benchmarking

- [ ] **5.4.4** System integration testing
  - End-to-end workflow testing
  - Cross-service integration testing
  - Database consistency testing
  - Real-time feature testing

### 5.5 Performance Optimization
- [ ] **5.5.1** Backend optimization
  - Database query optimization
  - API response caching
  - Background job optimization
  - Memory usage optimization

- [ ] **5.5.2** Frontend optimization
  - Code splitting and lazy loading
  - Image optimization
  - Bundle size optimization
  - Runtime performance optimization

- [ ] **5.5.3** AI system optimization
  - LLM request optimization
  - Prompt efficiency improvement
  - Response caching strategies
  - Model inference optimization

- [ ] **5.5.4** Infrastructure optimization
  - Docker image optimization
  - Database indexing
  - CDN configuration
  - Load balancing setup

---

## 📊 Success Metrics & Acceptance Criteria

### Phase 0 Success Metrics
- [ ] CI/CD pipeline successfully builds and deploys
- [ ] All code quality checks pass (lint, typecheck, test)
- [ ] Docker environment starts without errors
- [ ] Development setup completed in under 10 minutes

### Phase 1 Success Metrics
- [ ] All API endpoints documented and tested
- [ ] Database migrations execute successfully
- [ ] Authentication system fully functional
- [ ] API response time under 200ms for simple queries

### Phase 2 Success Metrics
- [ ] Frontend application loads and navigates correctly
- [ ] All UI components render properly
- [ ] Real-time features work without lag
- [ ] Mobile responsiveness achieved

### Phase 3 Success Metrics
- [ ] All inventory operations complete successfully
- [ ] Dashboard updates in real-time
- [ ] Search and filtering work efficiently
- [ ] Data export/import functions correctly

### Phase 4 Success Metrics
- [ ] Stock Advisor provides accurate recommendations
- [ ] LLM integration works reliably
- [ ] Agent logging captures all actions
- [ ] Event-driven workflows execute correctly

### Phase 5 Success Metrics
- [ ] All AI agents function as specified
- [ ] Test coverage exceeds 80%
- [ ] Performance benchmarks met
- [ ] Security audit passes

## 🔧 Technical Debt & Maintenance

### Regular Maintenance Tasks
- [ ] **Weekly**: Dependency updates and security patches
- [ ] **Monthly**: Performance monitoring and optimization
- [ ] **Quarterly**: Security audit and penetration testing
- [ ] **Annually**: Technology stack evaluation and updates

### Technical Debt Prevention
- [ ] Code review requirements for all changes
- [ ] Automated testing for new features
- [ ] Documentation updates with code changes
- [ ] Regular refactoring sessions

### Monitoring & Alerting
- [ ] Application performance monitoring
- [ ] Error tracking and alerting
- [ ] Business metrics monitoring
- [ ] User experience monitoring

## 📋 Implementation Notes for AI Coding Agents

### Code Style Guidelines
- Use TypeScript with strict mode enabled
- Follow ESLint and Prettier configurations
- Use conventional commit messages
- Implement proper error handling
- Write comprehensive tests

### Architecture Patterns
- Use dependency injection for services
- Implement repository pattern for data access
- Use event-driven architecture for loose coupling
- Follow clean architecture principles
- Implement proper logging and monitoring

### AI Integration Best Practices
- Validate all LLM inputs and outputs
- Implement proper rate limiting
- Use structured prompts for consistency
- Log all AI decisions for auditing
- Implement fallback mechanisms

### Security Considerations
- Sanitize all user inputs
- Implement proper authentication/authorization
- Use parameterized queries to prevent SQL injection
- Implement rate limiting on all endpoints
- Regular security audits and updates

### Performance Considerations
- Use database indexes for frequently queried columns
- Implement proper caching strategies
- Use connection pooling for database connections
- Optimize bundle sizes for frontend
- Monitor and profile performance regularly

---

## 🚀 Getting Started

### Prerequisites Checklist
- [ ] Node.js 18+ installed
- [ ] pnpm 8+ installed
- [ ] Docker and Docker Compose installed
- [ ] Git configured with proper credentials
- [ ] IDE configured with recommended extensions

### First Steps
1. Clone the repository
2. Run `pnpm install` to install dependencies
3. Copy `.env.example` to `.env` and configure
4. Run `docker-compose up -d` to start services
5. Run `pnpm dev` to start development servers

### Development Workflow
1. Create feature branch from main
2. Implement changes with tests
3. Run quality checks locally
4. Submit pull request
5. Wait for CI/CD pipeline to complete
6. Merge after approval

This comprehensive TODO provides clear, actionable tasks for implementing the Ventry AI-Native Inventory Management System. Each task includes specific technical requirements, acceptance criteria, and implementation guidance for AI coding agents to execute effectively.