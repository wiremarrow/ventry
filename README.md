# Ventry - AI-Native Inventory Management System

## 🚀 Project Vision

Ventry is an ambitious AI-native inventory management system designed to revolutionize how businesses handle stock management through autonomous agents, real-time analytics, and conversational interfaces. The system prioritizes intelligent automation over manual data entry, featuring rich autonomous agents that proactively manage inventory decisions.

## 🔒 Production Readiness Status

**Current Status**: 🟡 In Development - Enterprise RLS Implementation Complete  
**Production Readiness**: 8/10 (Test Coverage 100% Complete!)  
**Active Branch**: `feat/supabase-migration` - Working on Supabase migration features  
**Full Audit Report**: [Production Readiness Audit](./docs/PRODUCTION_READINESS_AUDIT.md)

Recent security improvements include enterprise-grade Row-Level Security (RLS) implementation with PostgreSQL SECURITY DEFINER functions, preventing SQL injection at the database level. The lean implementation follows enterprise best practices while maintaining simplicity.

**✅ Enterprise RLS Features**:
- SECURITY DEFINER functions validate inputs at database level (CUID format enforced)
- Transaction-scoped session variables (connection pool safe)
- One canonical pattern: `withRLS()` wrapper with full TypeScript type safety
- RLS policies on all 31 business tables (with organization_id denormalization)
- Dual-role architecture: `ventry` (superuser) and `ventry_app` (application role)
- All RLS integration tests passing with dual-connection pattern
- **CRITICAL**: Application uses `ventry_app` user to enforce RLS (no bypass)
- [RLS Implementation Guide](./RLS_IMPLEMENTATION_GUIDE.md) | [RLS Guide](./docs/RLS_GUIDE.md) | [Implementation Summary](./docs/RLS_IMPLEMENTATION_SUMMARY.md)

**✅ ACHIEVEMENT**: Test coverage for business logic is now 100% complete! All 22 backend routers have comprehensive unit tests with 550+ tests total. Security vulnerabilities discovered during testing have been fixed.

## 🏗️ Architecture Overview

### Monorepo Structure
```
ventry/
├── apps/
│   ├── backend/          # tRPC + Fastify API server (@ventry/backend)
│   ├── web/              # Next.js frontend (@ventry/web)
│   ├── e2e/              # Playwright E2E tests (@ventry/e2e)
│   └── docs/             # Documentation site
├── packages/
│   ├── shared/           # Shared types, constants, utils (@ventry/shared)
│   ├── ui/               # shadcn/ui components (@ventry/ui)
│   └── database/         # Prisma schema & migrations (@ventry/database)
├── docker-compose.yml    # Local development stack
├── turbo.json           # Turborepo configuration
└── pnpm-workspace.yaml  # pnpm workspace config
```

### Technology Stack
- **Package Management**: pnpm + Turborepo for monorepo management
- **Backend**: **tRPC + Fastify + Prisma + PostgreSQL** for end-to-end type-safe API architecture
- **Frontend**: Next.js 15 + React 18.3.1 + TypeScript + Tailwind CSS v3.4.0 + shadcn/ui for modern UI
- **API Layer**: **tRPC v11** with full-stack TypeScript type inference and runtime safety
- **Database**: PostgreSQL with **multi-tenant support** and **Supabase-ready architecture**:
  - **Current**: PostgreSQL 16 with Prisma 6.x ORM (ESM support) for type-safe database access
  - **Multi-tenant**: Full organizationId scoping across all 40+ tables
  - **Schema**: Enterprise-grade inventory management (Items, Warehouses, Orders, PurchaseOrders, etc.)
  - **Admin Operations**: All database operations use `db-admin.sh` for consistent admin privileges
  - **Comprehensive Seeding**: Full demo data with 45 products, warehouses, inventory, and historical data
  - **TypeScript Migration**: ✅ **COMPLETE** - Backend configured as internal service with 0 TypeScript errors
  - **Testing**: ✅ All unit tests (19/19) and integration tests (49/49) passing
  - **Architecture**: Clean tRPC factory pattern avoiding circular dependencies
  - **Column Naming**: ✅ PostgreSQL best practices with snake_case in database, camelCase in TypeScript via Prisma @map directives
  - **UI Components**: 
    - ✅ **Inventory Page**: Full tRPC integration with stock adjustments and filtering
    - ✅ **Products Page**: Complete CRUD operations with categories and units of measure
    - ✅ **Warehouses Page**: Complete location hierarchy, analytics, and warehouse management
    - ✅ **Analytics Dashboard**: **Live data integration with auto-refresh** - Real-time metrics and charts connected to tRPC analytics endpoints
    - ✅ **Suppliers Page**: Complete with UI and backend integration
    - ✅ **Purchase Orders Page**: Full workflow with create, list, detail views and approval actions
    - ✅ **Customers Page**: Complete CRUD with credit limits and detail views
    - ✅ **Orders Page**: List and detail pages with order workflow and fulfillment tracking
    - ✅ **Categories Page**: Hierarchical tree view with parent-child category management
    - ✅ **Locations Page**: Consolidated warehouse/location management with capacity tracking
    - ✅ **Movements Page**: Comprehensive stock movement tracking with filters and dialogs
    - ✅ **Reports Page**: Report templates with filtering and export capabilities
    - ✅ **Users Page**: User management with role-based access control and profile editing
  - **Shared UI**: Enhanced with Select, Textarea, Switch, Skeleton, DropdownMenu, RadioGroup, Tabs components and Recharts integration
- **Testing**: Comprehensive 3-tier testing strategy (Unit + Integration + E2E)
  - **Unit Tests**: **Vitest** with component testing for all UI components
  - **Integration Tests**: Real PostgreSQL database operations with proper isolation
  - **E2E Tests**: Dedicated `@ventry/e2e` workspace package with Playwright across 3 browsers
  - **Test Coverage**: 
    - ✅ Inventory components and router (100% coverage)
    - ✅ Products/Items components and router (100% coverage)
    - ✅ Auth flow and organization context
    - ✅ RLS isolation tests ensuring multi-tenant data security
  - **E2E Architecture**: Enterprise-grade test isolation with dotenv-cli for environment management
  - **E2E Features**:
    - Multi-organization RLS isolation verification across all browsers
    - React hydration issue handling with `waitForLoadState('networkidle')`
    - Comprehensive test helpers for organization-scoped testing
    - Cross-browser compatibility (Chromium, Firefox, WebKit, Mobile)
- **Authentication**: Centralized auth system with secure signed cookies
  - **AuthService**: Unified authentication service handling login/logout/register
  - **CookieService**: Consistent cookie management with proper error handling and unsigning
  - **Organization Context**: Zustand-based state management with automatic cookie persistence
  - **httpOnly Cookies**: JWT tokens stored in signed cookies for XSS protection
  - **Dual Cookie System**: Both auth-token and active-organization cookies for seamless context switching
  - **RLS Integration**: Organization context enforced at database level via `organizationProcedure`
- **API Proxy**: Next.js rewrites ensure same-origin requests for cookie authentication (avoids cross-port CORS issues)
- **Deployment**: Vercel for frontend, containerized Fastify backend services
- **Monitoring**: Sentry for error tracking and performance insights
- **CI/CD**: Enterprise-grade GitHub Actions pipeline with 12 mandatory status checks
- **AI Integration**: OpenAI/Anthropic SDK with configurable providers
- **Architecture**: **ESM-only** monorepo with workspace dependencies for type sharing

## 🧠 AI Agent Architecture

### Core AI Agents

#### 1. Stock Advisor Agent
- **Purpose**: Intelligent reorder quantity recommendations
- **Input**: Product ID, current stock levels, sales history
- **Analysis**: Historical sales patterns, seasonality, lead times
- **Output**: Actionable reorder suggestions with reasoning

#### 2. Forecast Agent
- **Purpose**: Demand prediction using time-series analysis
- **Input**: SKU/location data, historical sales, external factors
- **Analysis**: Time-series forecasting, trend analysis, seasonal patterns
- **Output**: Demand forecasts with confidence intervals

#### 3. Anomaly Detector
- **Purpose**: Identify unexpected stock changes
- **Input**: Stock movement patterns, historical baselines
- **Analysis**: Statistical anomaly detection, pattern recognition
- **Output**: Alerts for potential theft, miscounts, or data errors

#### 4. Conversational Agent
- **Purpose**: Natural language inventory queries and actions
- **Input**: User questions via chat interface
- **Analysis**: Intent recognition, query parsing, context understanding
- **Output**: Conversational responses with actionable insights

### AI Integration Pattern
```typescript
// tRPC Agent Procedure Pattern
export const agentsRouter = createTRPCRouter({
  stockAdvisor: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .output(reorderRecommendationSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch historical data via Prisma
      const product = await ctx.prisma.product.findUnique({
        where: { id: input.productId },
        include: { stockMovements: true, stockLevels: true }
      });
      
      // 2. Apply business logic and context
      // 3. Generate structured prompt
      // 4. Call LLM with chain-of-thought reasoning
      // 5. Parse and validate response with Zod
      // 6. Log action to AgentLogs
      return recommendation;
    }),
});
```

## 🔄 Automated Workflows

### Event-Driven Architecture
- **Stock Threshold Events**: Automatic draft purchase order creation
- **Daily Summary Jobs**: Critical alerts via email
- **Real-time Updates**: WebSocket connections for live dashboard updates
- **Agent Orchestration**: Message bus for coordinating agent tasks

### Workflow Examples
1. **Low Stock Detection**: Stock < threshold → Agent analysis → Draft PO → UI notification
2. **Anomaly Response**: Unusual stock movement → Investigation → Alert → Human review
3. **Forecast Updates**: Daily forecast refresh → Threshold adjustments → Proactive alerts

## 📊 Core Functional Requirements

### 1. Inventory CRUD Operations
- **Products**: SKU management, categorization, specifications
- **Categories**: Hierarchical organization, custom attributes
- **Locations**: Multi-warehouse support, location-specific stock
- **Stock Movements**: Comprehensive audit trail, movement types
- **Suppliers**: Contact management, lead times, pricing

### 2. Real-time Stock Dashboard
- **Live Analytics Integration**: Real-time data from tRPC analytics endpoints with auto-refresh
- **Current Levels**: Live stock quantities across all locations with 30-second updates
- **Low Stock Alerts**: Configurable thresholds with urgency levels and real-time monitoring
- **Movement Tracking**: Recent transactions, trend analysis with live data feeds
- **Performance Metrics**: Turnover rates, stock accuracy, fill rates with automatic updates
- **System Health Monitoring**: Real-time API and database status with connection monitoring
- **User Controls**: Manual refresh and auto-refresh toggle for customized experience

### 3. AI-Powered Insights
- **Predictive Analytics**: Demand forecasting, seasonal adjustments
- **Optimization**: Reorder point calculations, safety stock levels
- **Anomaly Detection**: Automated variance analysis
- **Conversational Interface**: Natural language queries and commands

## 🛠️ Technical Implementation

### Database Schema (Prisma)

**📊 Complete Schema Documentation**: See [DATABASE.md](./DATABASE.md) for the full database schema with all 42 models and relationships.

```prisma
// Core inventory tables (simplified view)
model Product { ... }
model Category { ... }
model Location { ... }
model StockMovement { ... }
model Supplier { ... }

// AI-specific tables
model AgentLog { ... }
model Forecast { ... }
model AnomalyEvent { ... }
model ChatSession { ... }
```

### tRPC Router Architecture
All 22 routers are implemented and operational. The `agentsRouter` for AI agent orchestration is planned for Phase 3.

### Next.js App Router Structure
```
app/
├── dashboard/           # Real-time analytics dashboard
├── inventory/          # Product & stock management
├── suppliers/          # Supplier management
├── chat/              # Conversational AI interface
├── reports/           # Analytics & reporting
└── settings/          # System configuration
```

## 🎨 Frontend Architecture

### Component Library (shadcn/ui)
- **UI Components**: Consistent design system
- **Data Tables**: Advanced filtering, sorting, pagination
- **Forms**: Type-safe form validation
- **Charts**: Real-time data visualization
- **Chat Interface**: Streaming AI responses

### State Management
- **React Context**: Global app state
- **SWR/TanStack Query**: Server state management
- **Real-time Updates**: WebSocket integration
- **Optimistic Updates**: Improved user experience

## 🔐 Security & Permissions

### Authentication & Authorization
- **Signed Cookie Authentication**: Secure httpOnly cookies with signatures
- **JWT Tokens**: Stateless authentication with organization context
- **Role-Based Access Control**: Granular permissions (USER, ADMIN, MANAGER, etc.)
- **Multi-Tenant Security**: Organization-level isolation with RLS
  - All users, inventory, and business data scoped by organization
  - Users page shows only members of the current organization
  - Organization admins can only manage users within their organization
- **API Security**: Rate limiting, CORS protection
- **Data Validation**: Input sanitization, type checking
- **Audit Logging**: Comprehensive action tracking

### AI Security
- **Prompt Injection Protection**: Input sanitization
- **Output Validation**: Response verification
- **Rate Limiting**: LLM API usage controls
- **Audit Trail**: All AI decisions logged

### Authentication Flow
The system uses a centralized authentication architecture with secure signed cookies:

1. **Login Process**:
   - User provides credentials → AuthService validates against database
   - JWT token generated with user info and organization context
   - Token stored via CookieService in signed httpOnly cookie (`auth-token`)
   - Active organization cookie (`active-organization`) set automatically on login
   - Default organization created for new users during registration

2. **Request Authentication**:
   - CookieService safely extracts and verifies signed cookies
   - JWT payload validated through AuthService
   - User and organization context established for the request
   - Organization priority: header > cookie > JWT payload

3. **Organization Management**:
   - Zustand store manages active organization state (no window globals)
   - tRPC client automatically includes organization header
   - Organization switching via `organizations.switchOrganization` mutation
   - Persistent organization selection across sessions

4. **Cookie Security**:
   - httpOnly: Prevents JavaScript access (XSS protection)
   - Signed: Cryptographic signature prevents tampering
   - SameSite=Lax: CSRF protection
   - Secure flag in production: HTTPS-only transmission

## 📊 Project Status

### Current Phase: Supabase Migration (Phase 2)
- ✅ **Phase 0**: Foundation & CI/CD Setup - Complete
- ✅ **Phase 1**: Core Backend Infrastructure - Complete
  - tRPC + Fastify backend with full authentication
  - Next.js 15 frontend with shadcn/ui components
  - Comprehensive testing infrastructure (Unit, Integration, E2E)
  - Production-ready CI/CD pipeline with 12 required status checks
- 🚧 **Phase 2**: Supabase Migration - In Progress
  - ✅ Designed comprehensive 40+ table inventory schema
  - ✅ Created detailed migration plan (3-4 week timeline)
  - ✅ Implemented all 22 backend routers:
    - **auth** - Authentication & authorization
    - **users** - User management
    - **products** - Product catalog management
    - **categories** - Category hierarchy operations
    - **health** - System health checks
    - **organizations** - Organization/tenant management
    - **items** - Item/inventory management (with bulk operations, history tracking)
    - **itemCategories** - Item category management
    - **unitsOfMeasure** - Units of measure management
    - **warehouses** - Warehouse & location management (with capacity planning)
    - **inventory** - Inventory tracking (with lot/serial number support)
    - **stockMovements** - Stock movement history (with full audit trail)
    - **suppliers** - Supplier management (with performance metrics)
    - **customers** - Customer management (with credit limits)
    - **orders** - Sales order management (with allocation & shipment)
    - **purchaseOrders** - Purchase order management (with approval workflow)
    - **receipts** - Receipt processing
    - **returns** - Return management (with RMA and refunds)
    - **shipments** - Shipment tracking (with tracking and delivery)
    - **reports** - Reporting system (with 10+ comprehensive report types)
    - **analytics** - Analytics & dashboards (with real-time dashboards and predictions)
  - ✅ All backend routers completed!
  - ✅ All major UI components completed:
    - ✅ Inventory management page with stock adjustment
    - ✅ Products management with CRUD operations  
    - ✅ Warehouses management with capacity tracking and location hierarchy
    - ✅ Suppliers management with contact tracking and performance metrics
    - ✅ Purchase orders with complete approval workflow
    - ✅ Receipts management with discrepancy tracking and PO receiving
    - ✅ Customers management interface with credit limits
    - ✅ Sales orders management with full workflow
    - ✅ Categories with hierarchical tree management
    - ✅ Locations with consolidated warehouse view
    - ✅ Stock movements with comprehensive tracking
    - ✅ Reports dashboard with templates and analytics
    - ✅ Users management with organization-scoped user lists and role-based permissions
    - ✅ Enhanced UI components library with comprehensive shadcn/ui integration
  - ✅ Enterprise Row-Level Security (RLS) implementation complete
  - 📅 Adding realtime capabilities with Supabase
- 📅 **Phase 3**: AI Integration - Planned
- 📅 **Phase 4**: Core Inventory Features - Planned
- 📅 **Phase 5**: AI Agent Implementation - Planned
- 📅 **Phase 6**: Advanced Features & Testing - Planned

### Key Achievements
- **Enterprise-grade foundation** with tRPC + Fastify + Next.js 15
- **Comprehensive testing** with 253 unit tests, 20 integration tests, and 135 E2E tests
- **Production-ready authentication** with JWT and role-based access control
- **Scalable database design** supporting multi-warehouse inventory management
- **Live Dashboard Integration** with real-time analytics, auto-refresh, and system monitoring
- **Complete UI Implementation** (2025-01-21):
  - All 14 major pages implemented and connected to tRPC routers
  - Consistent UI patterns: ProtectedRoute wrappers, dialog-based CRUD, card stats, table views
  - Purchase Orders: Create, list, detail views with approval workflow (draft/approved/cancelled)
  - Receipts: Purchase order receipt processing with discrepancy tracking and item-level notes
  - Customers: Full CRUD with credit limits, contact info, and detailed customer views
  - Orders: List and detail pages with order workflow, line items, and fulfillment tracking
  - Categories: Hierarchical tree view with drag-drop support and parent-child relationships
  - Locations: Consolidated warehouse/location management with capacity utilization
  - Movements: Stock movement tracking with filters by type, date range, and detailed history
  - Reports: Pre-built report templates with category filtering and export capabilities
  - Users: User management with role-based access, status control, and profile editing
- **Warehouse & Location Management**:
  - Comprehensive warehouses router with CRUD operations and statistics
  - Hierarchical location management with zone/aisle/shelf/bin structure
  - Capacity tracking and utilization analytics
  - Activity monitoring and optimization suggestions
  - Full UI implementation with search, filtering, and bulk operations
  - Seed data with multiple warehouses and realistic location hierarchies
- **Supplier Management**:
  - Complete suppliers router with archive and statistics endpoints
  - Live supplier metrics: total, active, lead times, YTD purchase value
  - Visual activity indicators for suppliers with recent orders
  - Contact information management (email, phone)
  - Performance tracking with purchase order history
  - Payment terms and lead time tracking
- **Enterprise RLS** with PostgreSQL policies enforcing tenant isolation
- **Real-time ready** with planned Supabase integration

## 🏗️ tRPC Architecture Details

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

## 📦 Development Setup

### Prerequisites
- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 14+

### Quick Start
```bash
# Clone and install dependencies
git clone <repo-url>
cd ventry

# Run the automated setup script
./tools/scripts/dev-setup.sh

# This will:
# - Check prerequisites
# - Install dependencies
# - Create .env file
# - Start Docker services
# - Prepare the development environment

# Seed the database (choose one based on your needs):
# Option 1: Default seed - Users + organization with basic data (RECOMMENDED)
pnpm --filter @ventry/database db:seed

# Option 2: Comprehensive seed - Full demo data for testing/demos
pnpm --filter @ventry/database db:seed:comprehensive

# Option 3: Basic seed - Only creates users (minimal)
pnpm --filter @ventry/database db:seed:basic

# Option 4: Multi-org seed - For testing RLS/multi-tenancy
pnpm --filter @ventry/database db:seed:multi-org

# Start development servers
pnpm dev

# Access the application:
# Frontend (Next.js): http://localhost:6061
# Backend API (tRPC + Fastify): http://localhost:6060
# tRPC Endpoints: http://localhost:6060/trpc

# Demo Credentials (default/comprehensive seeds):
# Admin: admin@ventry.com / password123 (full access)
# Manager: manager@ventry.com / password123 (full access)
# Employee: employee@ventry.com / password123 (limited access)
# User: user@ventry.com / password123 (no org access - tests boundaries)

# Multi-org seed credentials:
# TechStart: alice@techstart.com / password123, bob@techstart.com / password123
# GlobalRetail: charlie@globalretail.com / password123, david@globalretail.com / password123

# Note: All demo accounts use the same password: password123
# Note: Dashboard displays live analytics data with 30-second auto-refresh
```

### Supabase Migration Setup (Optional - Phase 2)
```bash
# Set up Supabase for enhanced features
./tools/scripts/setup-supabase.sh

# This will:
# - Initialize Supabase project
# - Link to your Supabase instance
# - Apply database schema
# - Set up Row Level Security
# - Generate TypeScript types

# Run data migration from existing schema
pnpm tsx tools/scripts/migrate-to-supabase.ts

# Run tests (3-tier testing strategy)
pnpm test                    # Vitest unit tests across all packages
pnpm test:integration        # PostgreSQL integration tests
pnpm test:e2e               # Multi-browser E2E tests

# Backend-specific testing with coverage
pnpm test:cov               # Vitest unit tests with coverage thresholds (backend only)
# OR: pnpm --filter @ventry/backend test:cov

# Run all tests for CI
pnpm lint                   # ESLint validation
pnpm typecheck             # TypeScript strict mode validation

# Build for production
pnpm build
```

### Environment Variable Configuration

**Enterprise-Grade Database Strategy**: All tests respect environment-provided `DATABASE_URL` for CI/CD compatibility while providing sensible local development fallbacks.

**Integration Tests** (`pnpm test:integration`):
- **CI Environment**: Uses dynamic database from `DATABASE_URL` environment variable
- **Local Development**: Falls back to `postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev`
- **Debugging**: Check console output for database connection details

**Unit Tests** (`pnpm test` / `pnpm test:cov`):
- **CI Environment**: Respects any environment-provided `DATABASE_URL`
- **Local Development**: Falls back to local development database
- **Architecture**: Most unit tests use mocked services, some may require real database

**Environment Variable Precedence**:
1. **CI-provided `DATABASE_URL`** (highest priority) - enables enterprise database strategy
2. **Local `.env` files** - for development convenience
3. **Test setup fallbacks** (lowest priority) - ensures tests always have a database URL

This pattern follows **12-Factor App principles** and ensures seamless operation across development, CI, and production environments.

## 📚 Code Style Guide

### Overview
Ventry follows strict code style conventions documented in `CLAUDE.md`. All code must adhere to these patterns for consistency and maintainability.

### Key Conventions
- **Import Ordering**: Enforced by ESLint with specific group ordering
- **File Naming**: Components use kebab-case, routers use camelCase
- **TypeScript**: Interfaces for props, proper type imports, no explicit router types
- **Testing**: Unit tests use `.test.ts`, integration tests use `.integration.test.ts`

For complete style guide, see the "CODE STYLE GUIDE - MANDATORY CONVENTIONS" section in `CLAUDE.md`.

## 🔧 Technical Configuration

### Frontend Styling (Tailwind CSS v3.4.0)

Ventry uses **Tailwind CSS v3.4.0** for optimal shadcn/ui compatibility:

```css
/* apps/web/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 215 78% 24%;
    --secondary: 210 40% 96%;
    /* ... additional design tokens */
  }
}
```

**Key Features:**
- Tailwind CSS v3 syntax optimized for shadcn/ui component compatibility
- Professional shadcn/ui components with consistent design system
- Responsive card-based login interface with proper hover effects
- Full TypeScript integration with component props

**Migration Notes:**
- Downgraded from Tailwind CSS v4 to v3.4.0 for Radix UI compatibility
- React downgraded from 19.0.0 to 18.3.1 for @radix-ui/react-slot compatibility
- All shadcn/ui components now render correctly with proper styling

### Development Environment

**Ports Configuration:**
- **Frontend**: http://localhost:6061 (Next.js with Tailwind CSS v3.4.0)
- **Backend**: http://localhost:6060 (tRPC + Fastify API)
- **Database**: PostgreSQL on port 5487 (via Docker)

**Known Issues & Workarounds:**
- **Turbopack**: Disabled due to monorepo compatibility issues with pnpm workspaces
- **ESLint 9**: Custom configuration for Next.js 15 compatibility
- **Node.js Type Stripping**: Experimental warning (no functional impact)

See `docs/DEVELOPMENT.md` for detailed troubleshooting and configuration information.

### Authentication & Security Features

**Authentication System:**
- **httpOnly Cookie Authentication** with maximum security (XSS protection)
- **Pure tRPC Architecture** - no legacy REST patterns for auth
- Role-based access control (Admin, Manager, User)
- Protected routes with Next.js middleware reading httpOnly cookies
- Automatic cookie management by browser (no manual token handling)
- Persistent user profile state with Zustand (tokens server-managed only)

**Debugging & Monitoring:**
- Enhanced debugging utilities in `lib/debug.ts`
- **Sentry integration fully configured** for error tracking
  - Automatic error capture with stack traces
  - User context tracking
  - Breadcrumb trails for debugging
  - Performance monitoring
  - Session replay capability
  - Test page at `/sentry-test` for verification
- Component render tracking with `useWhyDidYouUpdate`
- API error logging with context
- Performance measurement utilities
- Development-only debug logging

**Recent Fixes (2025-07-05 to 2025-07-15):**
- ✅ **Code Style Standardization (2025-07-15)**: Comprehensive codebase standardization
  - **Import Ordering**: Implemented mandatory import ordering across ~50 files with ESLint enforcement
  - **Style Guide**: Added comprehensive CODE STYLE GUIDE section to CLAUDE.md
  - **File Naming**: Standardized test files from `.spec.ts` to `.test.ts`
  - **Type Safety**: Removed unnecessary type annotations from tRPC routers
  - **ESLint Rules**: Updated import/order rule with proper pathGroups configuration
  - **Component Patterns**: Documented component structure, form handling, and error patterns
  - **Testing Patterns**: Established consistent patterns for unit, integration, and E2E tests
- ✅ **Login Authentication Bug**: Fixed infinite redirect loop on login
- ✅ **shadcn/ui Button Component**: Fixed button click events not working
- ✅ **CSS Framework Compatibility**: Migrated from Tailwind CSS v4 to v3.4.0 for Radix UI compatibility  
- ✅ **React Version Compatibility**: Downgraded from React 19 to 18.3.1 for @radix-ui/react-slot compatibility
- ✅ **Dashboard Loading Issue**: Fixed infinite loading spinner in ProtectedRoute component
- ✅ **API Token Management**: Fixed axios interceptor to use Zustand auth store instead of localStorage
- ✅ **Authentication State Persistence**: Proper hydration handling across page reloads
- ✅ **Cookie Management**: Secure cookie setting for middleware authentication
- ✅ **Sentry Integration**: Complete error tracking setup with instrumentation
- ✅ **Navigation Flow**: Optimized login-to-dashboard navigation timing
- ✅ **E2E Test Infrastructure (2025-07-07)**: Fixed critical authentication error handling causing page reloads
  - **Root Cause**: API response interceptor causing hard page reloads on login errors
  - **Solution**: Smart navigation logic with endpoint-specific error handling
  - **Results**: All 3 browsers (Chromium, Firefox, WebKit) passing consistently in CI
  - **Performance**: Tests execute reliably in ~1.5s vs previous 30s timeout risks
- ✅ **CI/CD Pipeline Improvements (2025-07-07)**: Enhanced build reliability and test isolation
  - **GitHub Actions**: Upgraded upload-artifact from deprecated v3 to v4
  - **Prisma Generation**: Added missing db:generate steps to all CI jobs for proper type generation
  - **Database Isolation**: Separate test databases for integration and E2E tests to prevent conflicts
  - **Unit Test Optimization**: Streamlined to Node.js 20 only for consistency and performance
- ✅ **Enterprise Database Strategy (2025-07-07)**: Production-ready database management
  - **Migration-First Approach**: Replaced db:push with migrate:deploy for CI/production
  - **Dynamic Database Creation**: Unique test databases per CI job for true isolation
  - **Test Coverage**: Fixed unit test coverage command syntax for proper test execution
  - **Scalable Pattern**: Enterprise-grade database management suitable for large PostgreSQL setups
- ✅ **Build Compilation Fixes (2025-07-15)**: Fixed multiple TypeScript and build errors
  - **React Query v5 Migration**: Fixed `isLoading` → `isPending` migration (customer-form, organization pages)
  - **Customer Form**: Added required fields (customerCode, firstName, lastName, email) matching backend schema
  - **Prisma Decimal Conversions**: Fixed Decimal type conversions using `parseFloat(value.toString())`
  - **Paginated Response Access**: Fixed access patterns for paginated API responses (items.items, suppliers.suppliers, etc.)
  - **tRPC Parameter Fixes**: Fixed purchase order approve/cancel/reject mutations with correct parameters
  - **Warehouse List Query**: Fixed stats-cards component to use correct warehouse list parameters
  - **Order Dialog**: Updated create-order-dialog to match backend schema expectations
  - **Result**: Build now compiles successfully with only ESLint warnings about `any` types
- ✅ **Database Verification Tool Enhancement (2025-07-23)**: Comprehensive database inspection utility
  - **Enhanced WHERE Clauses**: Added support for IN, LIKE, IS NULL/NOT NULL, AND conditions, date comparisons
  - **Cross-Table Comparisons**: Can now compare fields across related tables (e.g., `inventory.qtyOnHand <= item.reorderPoint`)
  - **Utility Commands**: Added fields, relationships, sample, validate commands for database inspection
  - **Business Queries**: Pre-built patterns for inventory, orders, suppliers, customers, finance analysis
  - **45+ Tables Support**: All core business entities with proper relationships
  - **Multiple Output Formats**: table (default), json, csv, count
  - **RLS Testing**: Simulate any user context to test Row-Level Security policies
  - **Documentation**: Comprehensive DATABASE_VERIFICATION.md with 50+ business query examples
- ✅ **Seed Script Enhancements (2025-07-23)**: Fixed missing receipt and shipment data
  - **Receipt Creation**: Added receipt generation for RECEIVED/PARTIAL purchase orders in single-org seed
  - **Shipment Creation**: Added shipment generation for SHIPPED orders in single-org seed
  - **Field Name Fixes**: Corrected receipt table field names (poId, reference) in verification tool
  - **Documentation**: Updated CLAUDE.md seed command names to match actual scripts
- ✅ **UI Bug Fixes (2025-07-23)**: Fixed frontend display issues
  - **Categories Page**: Fixed limit validation error (changed from 1000 to 100 to comply with backend)
  - **Stock Movements**: Fixed double minus sign display for outbound quantities (removed redundant minus)
- ✅ **ESLint Type Safety Improvements (2025-07-15)**: Fixed `any` type warnings in production code
  - **Page Components**: Fixed type inference for customer, organization member, and warehouse types
  - **Dialog Components**: Imported proper types from `@ventry/database` for Order and Supplier entities
  - **Create Order Dialog**: Fixed schema mismatches and removed non-existent fields
  - **Purchase Order Pages**: Fixed status badge type safety with proper variant types
  - **Reports Page**: Added return type annotation for frequency badge function
  - **Warehouse Stats**: Created proper types for warehouse with stats data
  - **tRPC Client**: Replaced `any` with proper window type extension
  - **Database Types**: Replaced `any` with `unknown` in Supabase placeholder types
  - **Remaining**: Test files contain mock `as any` casts which are common practice
- ✅ **Low Stock Filter Fix (2025-01-22)**: Fixed low stock filter to include items with zero quantity
  - **Root Cause**: Backend inventory list procedure was filtering out items with `qtyOnHand = 0` by default
  - **Solution**: Modified filter logic to automatically include zero quantity items when `lowStock` is true
  - **Impact**: All items below their reorder point now appear in the low stock filter, including out-of-stock items
  - **Test Coverage**: Added unit test to verify zero quantity items are included in low stock filtering

### Project Status

✅ **Phase 1 COMPLETE**: Core Backend Infrastructure + Professional UI (2025-07-05)
- **Database**: Complete Prisma schema with PostgreSQL enums and inventory management models
- **Backend**: Full-featured tRPC + Fastify API with comprehensive authentication system
- **Frontend**: Next.js 15 + React 18 dashboard with professional shadcn/ui components and responsive design
- **UI/UX**: Tailwind CSS v4 with modern card-based login interface and professional styling
- **Authentication**: JWT-based auth with role-based access control (Admin/Manager/User)
- **Development Environment**: Fully operational with ports 6060 (backend) and 6061 (frontend)
- **Testing**: Production-ready 3-tier testing strategy validated:
  - **Unit Tests**: 253 tests across 18 test suites with strict coverage requirements
  - **Integration Tests**: 20 tests with real PostgreSQL database operations and proper isolation
  - **E2E Tests**: 115 tests across 3 browsers (Chromium, Firefox, WebKit) with sharding
  - **E2E Reliability**: Fixed critical authentication error handling ensuring consistent cross-browser execution
- **CI/CD**: Enterprise-grade pipeline with 12 mandatory status checks ready for production
- **Code Quality**: Custom ESLint 9 configuration with TypeScript ESLint v8 for Next.js 15 compatibility
- **Technology Stack**: Modern stack with Next.js 15, React 18.3.1, tRPC + Fastify, PostgreSQL, Tailwind CSS v3.4.0

✅ **Phase 0 Complete**: Foundation & CI/CD Setup
- Monorepo structure with Turborepo
- Docker development environment (optional)
- ESLint & Prettier configuration
- TypeScript setup
- GitHub Actions CI/CD pipelines
- Development scripts and tooling
- **NEW**: Automated CI/CD setup scripts

🚀 **Phase 2 Ready**: AI Integration Foundation
- **Backend Infrastructure**: Complete tRPC API foundation ready for AI agent integration
- **Database Schema**: Extensible design supports AI-specific tables (AgentLog, Forecast, AnomalyEvent)
- **Authentication System**: Role-based access control ready for AI agent permissions
- **Testing Framework**: Comprehensive testing infrastructure ready for AI agent testing
- **Frontend Platform**: Modern React 18 foundation ready for conversational AI interfaces
- **Real-time Capabilities**: WebSocket infrastructure ready for AI agent real-time updates

✅ **Stack Enhancement Complete**: Lightweight Development Experience
- **Testing**: Vitest for unit tests + Playwright for E2E tests
- **Database**: PostgreSQL for all environments with Docker for development
- **Deployment**: Vercel for Next.js frontend
- **Monitoring**: Sentry for error tracking and performance insights
- **Development**: Docker-based PostgreSQL for consistent environments

### Environment Configuration
```env
# Database
DATABASE_URL="postgresql://..."

# Application Ports
PORT="6060"                      # Backend API server
FRONTEND_URL="http://localhost:6061"  # Frontend application

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-..."

# Application
JWT_SECRET="..."
SMTP_CONFIG="..."
```

## 🧪 Testing Strategy

### Backend Testing
- **Unit Tests**: Service layer, utilities, tRPC routers
  - **Current Coverage**: 100% of backend routers have comprehensive unit tests (22 of 22) ✅
  - **Completed Routers**: auth, users, orders, inventory, items, warehouses, customers, suppliers, purchaseOrders, receipts, stockMovements, products, categories, itemCategories, unitsOfMeasure, analytics, health, organizations, reports, returns, shipments
  - **Test Count**: 591 unit tests across all routers (all passing)
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: Critical user workflows
- **AI Agent Tests**: Mock LLM responses, prompt validation

### Test Coverage Progress (2025-01-22)
- **✅ auth.test.ts**: 17 tests - Authentication, JWT tokens, cookie management
- **✅ users.test.ts**: 17 tests - User CRUD, role management, organization context
- **✅ orders.test.ts**: 33 tests - Order lifecycle, allocations, shipments, returns
- **✅ inventory.test.ts**: 21 tests - Stock adjustments, movement tracking, lot management
- **✅ items.test.ts**: 21 tests - Item CRUD, bulk operations, variant management
- **✅ warehouses.test.ts**: 19 tests - Warehouse operations, location hierarchy
- **✅ customers.test.ts**: 20 tests - Customer management, addresses, credit checks
- **✅ suppliers.test.ts**: 21 tests - Supplier CRUD, contacts management, import operations
- **✅ purchaseOrders.test.ts**: 21 tests - PO lifecycle, approvals, receiving workflow
- **✅ receipts.test.ts**: 21 tests - Receipt creation, item management, discrepancy tracking
- **✅ stockMovements.test.ts**: 21 tests - Movement tracking, batch operations, history
- **✅ products.test.ts**: 21 tests - Product management, search, activity tracking
- **✅ categories.test.ts**: 24 tests - Hierarchical category management, tree structure, statistics
- **✅ itemCategories.test.ts**: 18 tests - Category-item associations, validation
- **✅ unitsOfMeasure.test.ts**: 23 tests - UOM management, conversion factors, base unit constraints
- **✅ analytics.test.ts**: 21 tests - Dashboard data, inventory metrics, trend analysis
- **✅ health.test.ts**: 8 tests - System health checks, database connectivity
- **✅ organizations.test.ts**: 29 tests - Organization management, member operations, role assignments
- **✅ reports.test.ts**: 30 tests - Report generation, filtering, export functionality
- **✅ returns.test.ts**: 21 tests - Return processing, RMA management, refund handling
- **✅ shipments.test.ts**: 21 tests - Shipment tracking, delivery management, package operations

### Testing Patterns Established
- **Mock Infrastructure**: Comprehensive Prisma client mocking with transaction support
- **Auth Testing**: Response object mocks with setCookie/clearCookie methods
- **ID Generation**: CUID helper function for valid test identifiers
- **Permission Testing**: Role-based access control validation across all endpoints
- **Error Coverage**: Comprehensive testing of error scenarios (NOT_FOUND, CONFLICT, FORBIDDEN)
- **Hierarchical Data**: Testing tree structures and parent-child relationships
- **Statistics Aggregation**: Testing complex aggregation queries
- **Implementation Bug Discovery**: Tests revealing security issues (e.g., missing organizationId checks)

### Implementation Issues Discovered Through Testing
- **categories router**: Fixed missing organizationId checks in several findFirst queries, eliminating a security vulnerability where users could access categories from other organizations
- **itemCategories router**: Properly implements organization-scoped queries throughout, serving as the correct pattern to follow

### Recent Test Infrastructure Updates (2025-01-22)
- **Authentication Testing**: Updated transaction mocking to properly handle user registration flow with organization creation
- **Cookie Service Integration**: Migrated all cookie handling tests to use CookieService for signed cookie management
- **RLS Service Updates**: Updated tests to use secure `$executeRaw` tagged templates instead of `$executeRawUnsafe`
- **Context Creation**: Fixed tRPC context tests to work with new RLS proxy implementation
- **Integration Test Fixes**: Resolved username length validation issues in user update tests

### Frontend Testing
- **Component Tests**: UI component behavior
- **Integration Tests**: User interactions, API calls
- **E2E Tests**: Complete user journeys
- **Visual Regression**: UI consistency

## 📈 Performance & Scalability

### Backend Optimization
- **Database Indexing**: Query optimization
- **Caching Strategy**: Redis for frequently accessed data
- **Background Jobs**: Async processing for AI tasks
- **Load Balancing**: Horizontal scaling support

### Frontend Performance
- **Code Splitting**: Route-based chunking
- **Image Optimization**: Next.js image optimization
- **Caching**: Aggressive caching strategies
- **Progressive Loading**: Skeleton states, lazy loading
- **Rate Limiting**: Increased from 100 to 500 requests/minute to accommodate comprehensive data
- **Request Batching**: Re-enabled tRPC batching to reduce HTTP request count by 50-80%
- **Query Optimization**: Memoized date calculations to prevent infinite re-renders on filtered pages

## 🚀 Deployment & DevOps

### Automated CI/CD Setup (NEW!)
We provide automated scripts that configure ~90% of the GitHub CI/CD setup:

```bash
# Configure repository settings, branch protection, and security features
./tools/scripts/setup-github-repo.sh

# Set up all required secrets interactively
./tools/scripts/setup-ci-secrets.sh

# Validate your CI/CD configuration
./tools/scripts/validate-ci-setup.sh
```

### Comprehensive CI/CD Pipeline
Our unified CI/CD pipeline enforces rigorous quality standards through multiple validation stages:

#### **Quality Gates & Required Status Checks**
1. **Documentation Check**: Enforces README.md and TODO.md updates for feature PRs
2. **Lint and Type Check**: ESLint + TypeScript strict mode validation
3. **Unit Tests**: Vitest testing on Node.js 20 LTS with coverage reporting
4. **PostgreSQL Integration Tests**: Database operations with real PostgreSQL service
5. **E2E Tests - chromium (1)**: Browser testing, shard 1/2
6. **E2E Tests - chromium (2)**: Browser testing, shard 2/2
7. **E2E Tests - firefox (1)**: Browser testing, shard 1/2
8. **E2E Tests - firefox (2)**: Browser testing, shard 2/2
9. **E2E Tests - webkit (1)**: Browser testing, shard 1/2
10. **E2E Tests - webkit (2)**: Browser testing, shard 2/2
11. **Build**: Production-ready builds with Sentry integration
12. **Coverage Gate**: Validates test coverage thresholds

#### **Advanced Testing Strategy**
- **Browser Matrix**: Parallel E2E testing across 3 browsers × 2 shards = 6 test jobs (Chromium, Firefox, WebKit)
- **E2E Reliability**: Fixed critical authentication error handling ensuring consistent cross-browser execution
- **Database Testing**: PostgreSQL validation across all environments with isolated test databases
- **Database Isolation**: Separate databases for integration (`ventry_integration_test`) and E2E (`ventry_e2e_test`) tests
- **Artifact Management**: Test results, videos, and build artifacts preserved with upload-artifact v4
- **Optional Docker Build**: Triggered only when Docker files change

#### **Deployment Pipeline**
- **Frontend**: Automatic Vercel deployment with preview environments
- **Backend**: Containerized services with automated migrations
- **Environment Promotion**: Staging → Production with approval gates
- **Monitoring**: Sentry integration for error tracking and performance

### Monitoring & Observability
- **Application Monitoring**: Error tracking, performance metrics
- **AI Usage Tracking**: LLM API costs, response times
- **Business Metrics**: Inventory accuracy, user engagement
- **Alerting**: Proactive issue detection

## 🎯 Roadmap & Future Enhancements

### Phase 1: Core Foundation (Completed ✅)
- [x] Monorepo setup with Turborepo
- [x] Complete tRPC + Fastify backend with type-safe API
- [x] Prisma database schema with inventory models
- [x] Next.js frontend with authentication
- [x] Real-time dashboard with inventory statistics
- [x] Role-based access control (Admin/Manager/User)
- [x] Comprehensive E2E test coverage
- [x] Production-ready CI/CD pipeline

### Phase 2: AI Integration (Months 3-4)
- [ ] Complete AI agent suite
- [ ] Conversational interface
- [ ] Automated workflows
- [ ] Advanced analytics

### Phase 3: Advanced Features (Months 5-6)
- [ ] Multi-tenant support
- [ ] Advanced forecasting
- [ ] Mobile applications
- [ ] Third-party integrations

### Phase 4: Enterprise Features (Months 7+)
- [ ] Custom AI model training
- [ ] Advanced reporting suite
- [ ] Workflow automation builder
- [ ] API marketplace

## 🤝 Development Guidelines

### Code Quality
- **TypeScript**: Strict type checking
- **ESLint/Prettier**: Consistent formatting
- **Husky**: Pre-commit hooks
- **Conventional Commits**: Standardized commit messages

### Best Practices
- **AI-First Design**: Prioritize intelligent automation
- **Type Safety**: End-to-end type safety
- **Performance**: Optimize for speed and efficiency
- **Security**: Security-first development approach
- **Testing**: Comprehensive test coverage

## 🔍 Claude Code Integration Notes

### For Future Development Sessions
1. **Agent Implementation**: Focus on chain-of-thought reasoning in prompts
2. **Real-time Features**: Implement WebSocket connections for live updates
3. **Type Safety**: Maintain strict TypeScript contracts between packages
4. **Testing**: Prioritize testing of AI agent logic and business rules
5. **Performance**: Monitor LLM API costs and response times
6. **Security**: Implement proper input validation for AI interactions

### Key Commands
```bash
# Development
pnpm dev           # Start all services
pnpm build         # Build all packages
pnpm test          # Run all tests
pnpm test:cov      # Backend tests with coverage
pnpm lint          # Check code quality
pnpm typecheck     # Type checking

# Database (all use db-admin.sh for admin privileges)
pnpm db:push       # Push schema changes
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed basic test data
pnpm db:seed:single # Seed single org with comprehensive data
pnpm db:seed:multi  # Seed multi-org with comprehensive data
pnpm db:reset      # Reset database and reseed

# Database Verification
pnpm db:verify count all        # Verify seed data
pnpm db:verify show items --limit 5  # Check specific data
pnpm db:verify access items --as employee@ventry.com  # Test RLS
pnpm db:verify --help          # Full documentation

# AI Agents
pnpm agents:test   # Test AI agent responses
pnpm agents:logs   # View agent execution logs
```

## 🔧 Troubleshooting

For comprehensive troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

### Authentication Issues

#### "Invalid credentials" Error
If you receive an "Invalid credentials" error when trying to login:

1. **Verify Database Seeding**: Ensure you've run the comprehensive seed script:
   ```bash
   pnpm --filter @ventry/database db:seed-comprehensive
   ```

2. **Check Demo Credentials**: All demo accounts use the password `password123`:
   - admin@ventry.com / password123
   - manager@ventry.com / password123
   - user@ventry.com / password123
   - warehouse@ventry.com / password123

3. **Clear Browser Cache**: Sometimes old authentication cookies can interfere. Clear your browser's cookies for localhost:6061.

4. **Verify Backend is Running**: Ensure both frontend and backend are running:
   ```bash
   pnpm dev  # Should start both services
   ```

5. **Check Database Connection**: Verify PostgreSQL is running:
   ```bash
   ./tools/scripts/switch-db.sh status
   ```

#### Organization Context Errors
If you see "No organization selected" errors:
- This is expected behavior for multi-tenant support
- The login process automatically assigns your first organization
- Use the organization switcher in the header to change organizations

## 📝 Contributing

This project emphasizes AI-native development with a focus on autonomous agents, conversational interfaces, and intelligent automation. When contributing, prioritize user experience through AI assistance rather than manual data entry.

---

*Built with ❤️ for the future of intelligent inventory management*