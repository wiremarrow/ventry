# Ventry Architecture Overview

## System Architecture

Ventry is built as a modern monorepo application using microservices principles while maintaining the simplicity of a monolithic deployment during development.

```mermaid
graph TB
    subgraph "Frontend"
        WEB[Next.js Web App]
        UI[Shared UI Components]
    end
    
    subgraph "Backend Services"
        API[NestJS API Server]
        AGENTS[AI Agents Module]
        AUTH[Auth Module]
        INV[Inventory Module]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL)]
        CACHE[(Redis)]
        QUEUE[Bull Queue]
    end
    
    subgraph "External Services"
        AI[AI Providers<br/>OpenAI/Anthropic]
        EMAIL[Email Service]
        STORAGE[Object Storage]
    end
    
    WEB --> API
    API --> DB
    API --> CACHE
    API --> QUEUE
    AGENTS --> AI
    AUTH --> CACHE
    API --> EMAIL
    API --> STORAGE
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Context + TanStack Query
- **Real-time**: Socket.io client
- **Forms**: React Hook Form + Zod

### Backend
- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis
- **Queue**: Bull (Redis-based)
- **Authentication**: JWT with Passport
- **Real-time**: Socket.io
- **API Documentation**: OpenAPI/Swagger

### Infrastructure
- **Monorepo**: Turborepo
- **Package Manager**: pnpm
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Monitoring**: OpenTelemetry ready

## Core Design Principles

### 1. AI-Native Architecture
- AI agents are first-class citizens
- Every major decision can be augmented by AI
- Human-in-the-loop for critical operations
- Transparent AI decision logging

### 2. Event-Driven Design
- Loose coupling between modules
- Asynchronous processing for heavy operations
- Real-time updates via WebSockets
- Event sourcing for audit trails

### 3. Domain-Driven Design
- Clear bounded contexts (Inventory, Users, AI Agents)
- Rich domain models
- Repository pattern for data access
- Use cases encapsulated in services

### 4. Security First
- Input validation at all layers
- Role-based access control (RBAC)
- API rate limiting
- Audit logging for all operations

## Module Architecture

### Backend Modules

#### Core Modules
1. **AppModule**: Root module, configuration
2. **ConfigModule**: Environment management
3. **DatabaseModule**: Prisma integration
4. **LoggerModule**: Structured logging

#### Feature Modules
1. **AuthModule**: Authentication & authorization
2. **UsersModule**: User management
3. **InventoryModule**: Core inventory operations
4. **ProductsModule**: Product catalog
5. **SuppliersModule**: Supplier management
6. **AgentsModule**: AI agent orchestration
7. **NotificationsModule**: Email/SMS alerts
8. **ReportsModule**: Analytics & reporting

### Frontend Structure

```
app/
├── (auth)/          # Authentication pages
├── (dashboard)/     # Main application
│   ├── dashboard/   # Overview & analytics
│   ├── inventory/   # Inventory management
│   ├── products/    # Product catalog
│   ├── suppliers/   # Supplier management
│   ├── chat/       # AI chat interface
│   └── settings/   # User & system settings
└── api/            # API routes (if needed)
```

## Data Flow

### Request Flow
1. Client makes request to Next.js app
2. Next.js app calls NestJS API
3. API validates request (DTO validation)
4. API checks authentication/authorization
5. Service layer processes business logic
6. Repository layer handles data access
7. Response transformed and returned

### Real-time Updates
1. Client establishes WebSocket connection
2. Server emits events on data changes
3. Client updates UI optimistically
4. Server confirms or corrects state

### AI Agent Flow
1. Trigger event (manual or automated)
2. Agent service prepares context
3. LLM call with structured prompt
4. Response parsing and validation
5. Action execution
6. Result logging and notification

## Database Schema Design

### Core Entities
- **User**: System users with roles
- **Product**: Inventory items
- **Category**: Product categorization
- **Location**: Warehouses/stores
- **StockLevel**: Current stock by location
- **StockMovement**: Stock change history
- **Supplier**: Vendor information
- **PurchaseOrder**: Procurement records

### AI-Specific Entities
- **AgentLog**: All AI agent actions
- **Forecast**: Demand predictions
- **AnomalyEvent**: Detected anomalies
- **ChatSession**: Conversation history

## Security Architecture

### Authentication Flow
1. User logs in with credentials
2. Server validates and generates JWT
3. Client stores JWT securely
4. JWT sent with each request
5. Server validates JWT and authorizes

### Data Protection
- Encryption at rest (database)
- Encryption in transit (HTTPS)
- Sensitive data masking in logs
- PII handling compliance

## Deployment Architecture

### Development
- Docker Compose for local services
- Hot reloading for all apps
- Shared volumes for code

### Production
- Containerized applications
- Horizontal scaling capability
- Load balancer for API
- CDN for static assets
- Database connection pooling

## Performance Considerations

### Backend
- Database query optimization
- Redis caching strategy
- Background job processing
- Connection pooling

### Frontend
- Code splitting
- Image optimization
- Static generation where possible
- Progressive enhancement

## Technical Decisions & Trade-offs

### ESLint Configuration Strategy

Due to incompatibility between Next.js 15 (requires ESLint 9) and eslint-config-next (uses TypeScript ESLint v6), we maintain a custom ESLint configuration:

**Decision**: Use TypeScript ESLint v8 with custom flat config instead of Next.js defaults
**Rationale**: Enables Next.js 15 adoption while maintaining type-safe linting
**Impact**: 
- Lose some Next.js-specific linting rules
- Gain compatibility with latest tooling
- Must maintain custom configuration

**Migration Path**: Return to standard Next.js ESLint config when official ESLint 9 support is released.

## Monitoring & Observability

### Metrics
- Application performance
- API response times
- Database query performance
- AI agent execution metrics

### Logging
- Structured JSON logging
- Correlation IDs for tracing
- Error aggregation
- Security event logging

### Alerting
- Performance degradation
- Error rate thresholds
- Security incidents
- Business metric anomalies