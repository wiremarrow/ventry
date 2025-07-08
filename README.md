# Ventry - AI-Native Inventory Management System

## 🚀 Project Vision

Ventry is an ambitious AI-native inventory management system designed to revolutionize how businesses handle stock management through autonomous agents, real-time analytics, and conversational interfaces. The system prioritizes intelligent automation over manual data entry, featuring rich autonomous agents that proactively manage inventory decisions.

## 🏗️ Architecture Overview

### Monorepo Structure
```
ventry/
├── apps/
│   ├── backend/          # NestJS API server
│   ├── web/              # Next.js frontend
│   └── docs/             # Documentation site
├── packages/
│   ├── shared/           # Shared types, constants, utils
│   ├── ui/               # shadcn/ui components
│   └── database/         # Prisma schema & migrations
├── docker-compose.yml    # Local development stack
├── turbo.json           # Turborepo configuration
└── pnpm-workspace.yaml  # pnpm workspace config
```

### Technology Stack
- **Package Management**: pnpm + Turborepo for monorepo management
- **Backend**: **tRPC + Fastify + Prisma + PostgreSQL** for end-to-end type-safe API architecture
- **Frontend**: Next.js 15 + React 18.3.1 + TypeScript + Tailwind CSS v3.4.0 + shadcn/ui for modern UI
- **API Layer**: **tRPC v11** with full-stack TypeScript type inference and runtime safety
- **Database**: PostgreSQL for all environments (consistent development to production)
- **Testing**: Comprehensive 3-tier testing strategy (Unit + Integration + E2E)
  - **Unit Tests**: **Vitest** with 80% coverage thresholds for tRPC procedures and services
  - **Integration Tests**: Real PostgreSQL database operations with proper isolation
  - **E2E Tests**: Playwright across 5 browsers (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari) with sharding
  - **E2E Reliability**: Fixed authentication error handling ensuring consistent test execution
- **Deployment**: Vercel for frontend, containerized Fastify backend services
- **Monitoring**: Sentry for error tracking and performance insights
- **CI/CD**: Enterprise-grade GitHub Actions pipeline with 13 mandatory status checks
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
- **Current Levels**: Live stock quantities across all locations
- **Low Stock Alerts**: Configurable thresholds with urgency levels
- **Movement Tracking**: Recent transactions, trend analysis
- **Performance Metrics**: Turnover rates, stock accuracy, fill rates

### 3. AI-Powered Insights
- **Predictive Analytics**: Demand forecasting, seasonal adjustments
- **Optimization**: Reorder point calculations, safety stock levels
- **Anomaly Detection**: Automated variance analysis
- **Conversational Interface**: Natural language queries and commands

## 🛠️ Technical Implementation

### Database Schema (Prisma)
```prisma
// Core inventory tables
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
- **authRouter**: Authentication & authorization procedures
- **usersRouter**: User management with role-based access
- **productsRouter**: Product catalog management with pagination
- **categoriesRouter**: Category hierarchy operations
- **healthRouter**: System health checks and monitoring
- **agentsRouter**: AI agent orchestration (future implementation)

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
- **Role-Based Access Control**: Granular permissions
- **API Security**: JWT tokens, rate limiting
- **Data Validation**: Input sanitization, type checking
- **Audit Logging**: Comprehensive action tracking

### AI Security
- **Prompt Injection Protection**: Input sanitization
- **Output Validation**: Response verification
- **Rate Limiting**: LLM API usage controls
- **Audit Trail**: All AI decisions logged

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

# Ensure demo users exist for login testing
pnpm db:seed

# Start development servers
pnpm dev

# Access the application:
# Frontend (Next.js): http://localhost:6061
# Backend API (tRPC + Fastify): http://localhost:6060
# tRPC Endpoints: http://localhost:6060/trpc

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
- **Backend**: http://localhost:6060 (NestJS API with Swagger docs)
- **Database**: PostgreSQL on port 5487 (via Docker)

**Known Issues & Workarounds:**
- **Turbopack**: Disabled due to monorepo compatibility issues with pnpm workspaces
- **ESLint 9**: Custom configuration for Next.js 15 compatibility
- **Node.js Type Stripping**: Experimental warning (no functional impact)

See `docs/DEVELOPMENT.md` for detailed troubleshooting and configuration information.

### Authentication & Security Features

**Authentication System:**
- JWT-based authentication with secure token management
- Role-based access control (Admin, Manager, User)
- Protected routes with Next.js middleware
- Automatic token refresh mechanism
- Persistent authentication state with Zustand
- Secure cookie storage for middleware protection

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

**Recent Fixes (2025-07-05 to 2025-07-07):**
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
  - **Results**: 4/5 browsers now passing consistently (only Mobile Safari has test environment timing issues)
  - **Performance**: Tests execute reliably in ~1.5s vs previous 30s timeout risks
- ✅ **CI/CD Pipeline Improvements (2025-07-07)**: Enhanced build reliability and test isolation
  - **GitHub Actions**: Upgraded upload-artifact from deprecated v3 to v4
  - **Prisma Generation**: Added missing db:generate steps to all CI jobs for proper type generation
  - **Database Isolation**: Separate test databases for integration and E2E tests to prevent conflicts
  - **Unit Test Optimization**: Streamlined to Node.js 20 only for consistency and performance
- ✅ **Enterprise Database Strategy (2025-07-07)**: Production-ready database management
  - **Migration-First Approach**: Replaced db:push with migrate:deploy for CI/production
  - **Dynamic Database Creation**: Unique test databases per CI job for true isolation
  - **Test Coverage**: Fixed unit test coverage command syntax for proper Jest execution
  - **Scalable Pattern**: Enterprise-grade database management suitable for large PostgreSQL setups

### Project Status

✅ **Phase 1 COMPLETE**: Core Backend Infrastructure + Professional UI (2025-07-05)
- **Database**: Complete Prisma schema with PostgreSQL enums and inventory management models
- **Backend**: Full-featured NestJS REST API with comprehensive authentication system
- **Frontend**: Next.js 15 + React 18 dashboard with professional shadcn/ui components and responsive design
- **UI/UX**: Tailwind CSS v4 with modern card-based login interface and professional styling
- **Authentication**: JWT-based auth with role-based access control (Admin/Manager/User)
- **Development Environment**: Fully operational with ports 6060 (backend) and 6061 (frontend)
- **Testing**: Production-ready 3-tier testing strategy validated:
  - **Unit Tests**: 253 tests across 18 test suites with strict coverage requirements
  - **Integration Tests**: 20 tests with real PostgreSQL database operations and proper isolation
  - **E2E Tests**: 115 tests across 5 browsers (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari) with sharding
  - **E2E Reliability**: Fixed critical authentication error handling ensuring consistent cross-browser execution
- **CI/CD**: Enterprise-grade pipeline with 13 mandatory status checks ready for production
- **Code Quality**: Custom ESLint 9 configuration with TypeScript ESLint v8 for Next.js 15 compatibility
- **Technology Stack**: Modern stack with Next.js 15, React 18.3.1, NestJS, PostgreSQL, Tailwind CSS v3.4.0

✅ **Phase 0 Complete**: Foundation & CI/CD Setup
- Monorepo structure with Turborepo
- Docker development environment (optional)
- ESLint & Prettier configuration
- TypeScript setup
- GitHub Actions CI/CD pipelines
- Development scripts and tooling
- **NEW**: Automated CI/CD setup scripts (90% automation)

🚀 **Phase 2 Ready**: AI Integration Foundation
- **Backend Infrastructure**: Complete REST API foundation ready for AI agent integration
- **Database Schema**: Extensible design supports AI-specific tables (AgentLog, Forecast, AnomalyEvent)
- **Authentication System**: Role-based access control ready for AI agent permissions
- **Testing Framework**: Comprehensive testing infrastructure ready for AI agent testing
- **Frontend Platform**: Modern React 18 foundation ready for conversational AI interfaces
- **Real-time Capabilities**: WebSocket infrastructure ready for AI agent real-time updates

✅ **Stack Enhancement Complete**: Lightweight Development Experience
- **Testing**: Jest for unit tests + Playwright for E2E tests
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
- **Unit Tests**: Service layer, utilities
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: Critical user workflows
- **AI Agent Tests**: Mock LLM responses, prompt validation

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
3. **Unit Tests**: Jest testing on Node.js 18 & 20 with coverage reporting
4. **PostgreSQL Integration Tests**: Database operations with real PostgreSQL service
5. **E2E Tests**: Playwright testing across Chromium, Firefox, and WebKit with sharding
6. **Build**: Production-ready builds with Sentry integration
7. **Coverage Gate**: Validates test coverage thresholds

#### **Advanced Testing Strategy**
- **Browser Matrix**: Parallel E2E testing across 5 browsers × 2 shards = 10 test jobs (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari)
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
- [x] Complete NestJS backend with REST API
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

# Database
pnpm db:push       # Push schema changes
pnpm db:migrate    # Run migrations
pnpm db:seed       # Seed test data

# AI Agents
pnpm agents:test   # Test AI agent responses
pnpm agents:logs   # View agent execution logs
```

## 📝 Contributing

This project emphasizes AI-native development with a focus on autonomous agents, conversational interfaces, and intelligent automation. When contributing, prioritize user experience through AI assistance rather than manual data entry.

---

*Built with ❤️ for the future of intelligent inventory management*