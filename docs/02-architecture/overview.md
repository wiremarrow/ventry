# Architecture Overview

Ventry is an AI-native inventory management system built with modern web technologies and designed for scalability, security, and developer productivity.

## System Architecture

### High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend API   │     │   Database      │
│   (Next.js)     │────▶│  (tRPC/Fastify) │────▶│  (PostgreSQL)   │
│   Port: 6061    │     │   Port: 6060    │     │   Port: 5487    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                         │
         └───────────────────────┴─────────────────────────┘
                          Monorepo (Turborepo)
```

### Core Design Principles

1. **Type Safety**: End-to-end TypeScript with tRPC for full-stack type inference
2. **Multi-Tenancy**: Row-Level Security (RLS) for complete data isolation
3. **AI-Native**: Built for AI agent integration from the ground up
4. **Real-time Ready**: WebSocket support for live updates
5. **Enterprise Security**: JWT auth, signed cookies, RLS at database level
6. **Developer Experience**: Hot reload, type safety, comprehensive testing

## Technology Stack

### Frontend
- **Framework**: Next.js 15.3.5 with App Router
- **Language**: TypeScript ^5
- **Styling**: Tailwind CSS ^3.4.0
- **UI Components**: shadcn/ui (Radix UI based)
- **State Management**: Zustand + React Query (TanStack Query)
- **API Client**: tRPC React Query integration

### Backend
- **Framework**: Fastify with tRPC adapter
- **API Layer**: tRPC v11.4.3 for type-safe APIs
- **ORM**: Prisma ^6.11.1
- **Database**: PostgreSQL 16
- **Authentication**: JWT with signed httpOnly cookies
- **Validation**: Zod for runtime type checking

### Infrastructure
- **Monorepo**: Turborepo + pnpm workspaces
- **Testing**: Vitest (unit), PostgreSQL (integration), Playwright (E2E)
- **CI/CD**: GitHub Actions with 9 main jobs
- **Deployment**: Vercel (frontend), containerized backend
- **Monitoring**: Sentry for error tracking
- **Development**: Docker for PostgreSQL

## Data Flow Architecture

### Request Flow

```
1. User Action (Browser)
   ↓
2. React Component
   ↓
3. tRPC Hook (useQuery/useMutation)
   ↓
4. HTTP Request with Auth Cookie
   ↓
5. Next.js Proxy (/api/trpc/*)
   ↓
6. Fastify Server (port 6060)
   ↓
7. tRPC Router + Middleware
   ↓
8. Business Logic + Validation
   ↓
9. Prisma ORM Query
   ↓
10. PostgreSQL with RLS
    ↓
11. Response (Type-safe)
```

### Authentication Flow

1. **Login**: Credentials → JWT generation → Signed cookie
2. **Requests**: Cookie → JWT validation → User context
3. **Organization**: Header/Cookie → RLS context → Data filtering
4. **Logout**: Cookie deletion → Session cleanup

## Security Architecture

### Multi-Layer Security

1. **Application Layer**
   - JWT authentication
   - Role-based access control (RBAC)
   - Input validation with Zod
   - CSRF protection

2. **Transport Layer**
   - HTTPS in production
   - Signed httpOnly cookies
   - CORS configuration
   - Rate limiting

3. **Database Layer**
   - Row-Level Security (RLS)
   - Prepared statements
   - Connection pooling
   - Audit logging

### Dual-User Database Pattern

```sql
-- Admin user (migrations only)
ventry: BYPASSRLS=true

-- Application user (runtime)
ventry_app: BYPASSRLS=false
```

## Scalability Considerations

### Horizontal Scaling
- Stateless backend design
- Database connection pooling
- Redis for session/cache (future)
- Load balancer ready

### Performance Optimization
- Database indexes on all foreign keys
- Optimistic UI updates
- React Query caching
- Code splitting

### Monitoring
- Sentry error tracking
- Performance monitoring
- Custom metrics (future)
- Health check endpoints

## Development Architecture

### Monorepo Structure
```
ventry/
├── apps/
│   ├── backend/     # tRPC + Fastify server
│   ├── web/         # Next.js frontend
│   └── e2e/         # Playwright tests
├── packages/
│   ├── database/    # Prisma schema
│   ├── shared/      # Shared types/utils
│   └── ui/          # shadcn/ui components
```

### Build Pipeline
1. TypeScript compilation
2. Prisma generation
3. Next.js build
4. Docker image (optional)

## Future Architecture

### Planned Enhancements
1. **AI Agents**: LLM integration for inventory insights
2. **Real-time**: WebSocket for live updates
3. **Analytics**: Time-series data for forecasting
4. **Mobile**: React Native app
5. **Microservices**: Service extraction as needed

### Migration Path
- Current: Monolithic with modular structure
- Next: Extract AI agents as services
- Future: Full microservices as scale demands

## Key Architectural Decisions

1. **tRPC over REST**: Type safety and developer experience
2. **PostgreSQL over NoSQL**: ACID compliance and RLS
3. **Monorepo**: Shared code and atomic commits
4. **ESM-only**: Modern JavaScript standards
5. **Fastify over Express**: Performance and TypeScript support

## Related Documentation

- [Technology Stack Details](./technology-stack.md)
- [Database Schema](./database-schema.md)
- [API Design](./api-design.md)
- [Security Architecture](./security-architecture.md)