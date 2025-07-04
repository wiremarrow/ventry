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
- **Package Management**: pnpm + Turborepo
- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Jest (backend & frontend)
- **Containerization**: Docker + Docker Compose
- **AI Integration**: OpenAI/Anthropic SDK with configurable providers

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
// Agent Service Pattern
@Injectable()
export class StockAdvisorService {
  async generateRecommendation(productId: string): Promise<ReorderRecommendation> {
    // 1. Fetch historical data via Prisma
    // 2. Apply business logic and context
    // 3. Generate structured prompt
    // 4. Call LLM with chain-of-thought reasoning
    // 5. Parse and validate response
    // 6. Log action to AgentLogs
  }
}
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

### NestJS Modules
- **InventoryModule**: Core inventory operations
- **ProductsModule**: Product catalog management
- **SuppliersModule**: Supplier relationship management
- **AgentsModule**: AI agent orchestration
- **AuthModule**: Authentication & authorization
- **NotificationsModule**: Email/SMS alerts

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

# Start development servers
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

### Project Status
✅ **Phase 0 Complete**: Foundation & CI/CD Setup
- Monorepo structure with Turborepo
- Docker development environment (optional)
- ESLint & Prettier configuration
- TypeScript setup
- GitHub Actions CI/CD pipelines
- Development scripts and tooling

✅ **Stack Enhancement Complete**: Lightweight Development Experience
- **Testing**: Jest for unit tests + Playwright for E2E tests
- **Database**: SQLite for development (zero setup) + PostgreSQL for production
- **Deployment**: Vercel for Next.js frontend
- **Monitoring**: Sentry for error tracking and performance insights
- **Development**: Optional Docker - use SQLite for instant setup

### Environment Configuration
```env
# Database
DATABASE_URL="postgresql://..."

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

### CI/CD Pipeline
- **GitHub Actions**: Automated testing, building, deployment
- **Docker Images**: Containerized applications
- **Environment Promotion**: Dev → Staging → Production
- **Database Migrations**: Automated schema updates

### Monitoring & Observability
- **Application Monitoring**: Error tracking, performance metrics
- **AI Usage Tracking**: LLM API costs, response times
- **Business Metrics**: Inventory accuracy, user engagement
- **Alerting**: Proactive issue detection

## 🎯 Roadmap & Future Enhancements

### Phase 1: Core Foundation (Months 1-2)
- [ ] Monorepo setup with Turborepo
- [ ] Basic inventory CRUD operations
- [ ] Real-time dashboard
- [ ] First AI agent (Stock Advisor)

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