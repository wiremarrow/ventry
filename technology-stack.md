# Ventry Technology Stack

## Overview

Ventry is built on a modern, enterprise-grade technology stack optimized for AI-native inventory management. This document provides a comprehensive overview of all technologies used, their versions, rationale for selection, and how they work together.

## Architecture Overview

**Monorepo Structure**: ESM-only with workspace dependencies for type sharing

- **Build System**: Turborepo + pnpm workspaces
- **Language**: TypeScript (strict mode) across the entire stack
- **API Architecture**: tRPC v11 for end-to-end type safety

## Frontend Technologies

### Core Framework

- **Next.js 15.3.5** with App Router
  - **Why**: Latest features, server components, improved performance
  - **Integration**: Serves as the primary web application framework
  - **Configuration**: ESM-only with custom ESLint setup for v15 compatibility

### UI & Styling

- **React 18.3.1** (downgraded from 19.0.0)
  - **Why**: Compatibility with @radix-ui/react-slot and shadcn/ui components
  - **Note**: Will upgrade when ecosystem catches up
- **Tailwind CSS 3.4.0** (downgraded from v4)
  - **Why**: Optimal shadcn/ui compatibility, stable ecosystem
  - **Integration**: Professional design system with CSS variables
- **shadcn/ui** (latest)
  - **Why**: High-quality, customizable component library
  - **Components**: Button, Card, Form, Dialog, Table, Select, Textarea, Switch, Skeleton, etc.

### State Management & Data Fetching

- **@trpc/client 11.4.3** + **@trpc/react-query 11.4.3**
  - **Why**: Type-safe API calls with automatic TypeScript inference
  - **Integration**: Full-stack type safety from backend to frontend
- **@tanstack/react-query v5** (via tRPC)
  - **Why**: Powerful data synchronization, caching, background refetching
  - **Features**: Auto-refresh for live dashboards, optimistic updates

- **Zustand** (state management)
  - **Why**: Lightweight, TypeScript-first state management
  - **Usage**: Organization context, user preferences

### Form Handling

- **React Hook Form** + **Zod**
  - **Why**: Performance, validation, TypeScript integration
  - **Pattern**: Consistent form handling across the application

### Data Visualization

- **Recharts**
  - **Why**: React-native charting library with good performance
  - **Usage**: Analytics dashboards, real-time metrics

## Backend Technologies

### Core Framework

- **tRPC v11.4.3** + **Fastify**
  - **Why tRPC**: End-to-end type safety, no code generation needed
  - **Why Fastify**: High performance, plugin ecosystem, WebSocket support
  - **Architecture**: Factory pattern to avoid circular dependencies

### Database & ORM

- **PostgreSQL 16**
  - **Why**: Enterprise-grade, ACID compliance, JSON support, RLS capabilities
  - **Features**: Multi-tenant support, row-level security ready
  - **Migration Strategy**: Prisma migrations for production deployments

- **Prisma 6.11.1**
  - **Why**: Type-safe database access, migration system, ESM support
  - **Features**:
    - 42+ models for comprehensive inventory management
    - camelCase in code, snake_case in database via @map directives
    - Built-in connection pooling

### Security & Authentication

- **JWT** (jsonwebtoken)
  - **Why**: Stateless authentication, industry standard
  - **Implementation**: Stored in signed httpOnly cookies

- **Signed Cookies** (@fastify/cookie)
  - **Why**: Prevents tampering, XSS protection
  - **Settings**: httpOnly, secure (production), SameSite=Lax

- **Dual Database Users**
  - **ventry**: Admin user for migrations (SUPERUSER, BYPASSRLS=true)
  - **ventry_app**: Application user with RLS enforcement (limited privileges)

### API Security

- **CORS Protection** (@fastify/cors)
- **Rate Limiting** (planned)
- **Input Validation**: Zod schemas on all endpoints

## Testing Technologies

### Unit Testing

- **Vitest** (latest)
  - **Why**: Fast, ESM-native, Jest-compatible API
  - **Coverage**: Threshold enforcement via c8
  - **Pattern**: `.test.ts` files

### Integration Testing

- **Vitest** + Real PostgreSQL
  - **Why**: Test actual database operations
  - **Database**: Separate `ventry_integration_test` database
  - **Pattern**: `.integration.test.ts` files

### E2E Testing

- **Playwright** (latest)
  - **Why**: Multi-browser support, reliable, fast
  - **Browsers**: Chromium, Firefox, WebKit
  - **Architecture**: Dedicated @ventry/e2e workspace package
  - **Features**: 2-shard parallel execution per browser

## Development Tools

### Code Quality

- **TypeScript 5.x**
  - **Why**: Type safety, better refactoring, self-documenting code
  - **Config**: Strict mode enabled across all packages

- **ESLint 9** with custom configuration
  - **Why**: Next.js 15 requires ESLint 9
  - **Challenge**: eslint-config-next incompatibility
  - **Solution**: Custom flat config with TypeScript ESLint v8

- **Prettier**
  - **Why**: Consistent code formatting
  - **Integration**: Pre-commit hooks

### Build Tools

- **Turborepo**
  - **Why**: Optimized monorepo builds, caching, parallel execution
  - **Features**: Remote caching ready

- **pnpm 8+**
  - **Why**: Fast, disk-efficient, excellent workspace support
  - **Features**: Strict dependency resolution

### Development Environment

- **Docker & Docker Compose**
  - **Why**: Consistent development environment
  - **Services**: PostgreSQL 16, optional for development

- **Development Scripts**
  - `dev-setup.sh`: Automated environment setup
  - `switch-db.sh`: Database management utilities

## Infrastructure & Deployment

### Frontend Hosting

- **Vercel**
  - **Why**: Optimized for Next.js, edge network, preview deployments
  - **Features**: Automatic SSL, global CDN

### Backend Hosting

- **Containerized Fastify**
  - **Why**: Scalable, platform-agnostic
  - **Deployment**: Docker containers (platform flexible)

### Monitoring & Observability

- **Sentry**
  - **Why**: Error tracking, performance monitoring, session replay
  - **Integration**: Automatic error capture, user context, breadcrumbs

- **Structured Logging** (Pino)
  - **Why**: JSON logs, high performance, log aggregation ready
  - **Pattern**: Module-specific loggers

## CI/CD Pipeline

### GitHub Actions

- **9 Main CI Jobs** (mandatory)
  1. Documentation Check
  2. Lint and Type Check
  3. Unit Tests (Vitest)
  4. PostgreSQL Integration Tests
  5. E2E Tests - Chromium (2 shards)
  6. E2E Tests - Firefox (2 shards)
  7. E2E Tests - Webkit (2 shards)
  8. Build (Production)
  9. Coverage Gate

### Automation Tools

- **Dependabot**: Automated dependency updates
- **CodeQL**: Security scanning
- **Branch Protection**: Enforced CI checks

## AI & External Services

### AI Integration (Planned)

- **OpenAI SDK**
- **Anthropic SDK**
  - **Why**: Multiple provider support, best-in-class models
  - **Architecture**: Provider-agnostic interface

### Future Services

- **Redis**: Caching layer (planned)
- **Bull**: Job queue (planned)
- **WebSockets**: Real-time updates via Fastify
- **Email Service**: Transactional emails (planned)

## Version Management Strategy

### Core Dependencies

- **Security Updates**: Automated via Dependabot
- **Major Updates**: Quarterly review cycle
- **Breaking Changes**: Tested in feature branches first

### Version Pinning Policy

- **Production Dependencies**: Exact versions for stability
- **Dev Dependencies**: Range versions for flexibility
- **Security Patches**: Auto-merge for patch versions

## Technology Integration

### Type Safety Flow

```
Prisma Schema → Generated Types → tRPC Router → Frontend Components
     ↓               ↓                ↓              ↓
  Database      Type Safety      API Layer    UI Components
```

### Authentication Flow

```
Frontend → Next.js Proxy → Fastify Server → JWT Validation → Database
    ↓           ↓              ↓                ↓              ↓
 Cookies    Same Origin    Auth Service    Signed Cookies    RLS
```

### Build Pipeline

```
pnpm install → Turborepo → Parallel Builds → Type Generation → Deployment
      ↓            ↓            ↓                ↓               ↓
  Workspaces    Caching    ESM Modules      .d.ts files    Vercel/Docker
```

## Upgrade Considerations

### Immediate Priorities

1. **React 19**: Waiting for Radix UI compatibility
2. **Tailwind CSS v4**: Waiting for shadcn/ui support
3. **eslint-config-next**: Waiting for ESLint 9 support

### Future Considerations

1. **Supabase Integration**: Real-time capabilities, enhanced RLS
2. **Edge Runtime**: Next.js edge functions for global performance
3. **Bun Runtime**: Potential performance improvements

### Migration Risks

- **Database**: PostgreSQL version upgrades require careful testing
- **Node.js**: LTS version upgrades every 12 months
- **TypeScript**: Major versions may require code changes

## Technology Decision Rationale

### Why tRPC over REST/GraphQL?

- **Type Safety**: End-to-end without code generation
- **Developer Experience**: Excellent with TypeScript
- **Performance**: Minimal overhead, efficient batching
- **Simplicity**: No schema files or separate type definitions

### Why PostgreSQL over Others?

- **Features**: Advanced queries, JSON support, full-text search
- **Reliability**: ACID compliance, proven at scale
- **Multi-tenant**: Row-level security capabilities
- **Ecosystem**: Excellent tooling and community

### Why Monorepo?

- **Code Sharing**: Types, utilities, components
- **Atomic Changes**: Cross-package refactoring
- **Consistency**: Unified tooling and standards
- **CI/CD**: Single pipeline for all packages

### Why ESM-Only?

- **Future-Proof**: Node.js moving to ESM
- **Performance**: Better tree-shaking
- **Standards**: Align with web standards
- **Tooling**: Modern tools prefer ESM

## Performance Optimizations

### Frontend

- Route-based code splitting
- Image optimization (Next.js Image)
- Static generation where possible
- React Query caching strategies

### Backend

- Connection pooling (Prisma)
- Query optimization (indexes)
- Response compression (Fastify)
- Horizontal scaling ready

### Database

- 50+ indexes on critical paths
- Composite indexes for complex queries
- Partial indexes for filtered queries
- Query performance monitoring

## Security Hardening

### Application Security

- Input validation (Zod)
- SQL injection prevention (Prisma)
- XSS protection (React, httpOnly cookies)
- CSRF protection (SameSite cookies)

### Infrastructure Security

- Environment variable validation
- No hardcoded secrets
- Secure headers (HSTS, CSP)
- Rate limiting (planned)

### Data Security

- Encryption at rest (PostgreSQL)
- Encryption in transit (HTTPS)
- Signed cookies
- JWT expiration

## Conclusion

The Ventry technology stack is carefully chosen to provide:

- **Developer Productivity**: Type safety, modern tooling
- **Performance**: Optimized frameworks and libraries
- **Scalability**: Horizontal scaling capabilities
- **Security**: Enterprise-grade security practices
- **Maintainability**: Clear patterns and documentation

Each technology decision supports the goal of building an AI-native, enterprise-ready inventory management system that can scale with business needs while maintaining excellent developer experience.
