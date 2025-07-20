# Ventry Local Development Guide

This guide provides comprehensive instructions for setting up and running the Ventry inventory management system on your local development machine.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step-by-Step Setup](#step-by-step-setup)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Development Workflow](#development-workflow)
- [Common Development Tasks](#common-development-tasks)
- [Useful Scripts and Commands](#useful-scripts-and-commands)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have the following installed:

### Required Software

- **Node.js** v18 or higher (v20 LTS recommended)
- **pnpm** v8 or higher - Install with `npm install -g pnpm@8`
- **Docker** and **Docker Compose** - For PostgreSQL database
- **Git** - For version control

### System Requirements

- macOS, Linux, or Windows with WSL
- At least 4GB RAM available
- 2GB free disk space

## Quick Start

The fastest way to get started is using the automated setup script:

```bash
# Clone the repository
git clone <repository-url>
cd ventry

# Run the automated setup script
./tools/scripts/dev-setup.sh

# This script will:
# - Check all prerequisites
# - Install dependencies
# - Create .env file from template
# - Start Docker services (PostgreSQL)
# - Set up the database schema
# - Prepare the development environment

# Seed the database with demo data (REQUIRED for authentication)
pnpm --filter @ventry/database db:seed

# Start development servers
pnpm dev

# Access the application:
# Frontend: http://localhost:6061
# Backend API: http://localhost:6060
# tRPC Endpoints: http://localhost:6060/trpc
```

### Demo Credentials

After running `db:seed`, use these credentials to log in:

- **Admin**: admin@ventry.com / password123 (full access)
- **Manager**: manager@ventry.com / password123 (full access)
- **Employee**: employee@ventry.com / password123 (limited access)
- **User**: user@ventry.com / password123 (no organization access)

## Step-by-Step Setup

If you prefer manual setup or the automated script fails:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ventry
```

### 2. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm@8

# Install all project dependencies
pnpm install
```

### 3. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and configure:
# - Database connection (if changed from defaults)
# - AI provider API keys (OpenAI/Anthropic)
# - JWT secret for authentication
# - Any other service configurations
```

### 4. Database Setup

See [Database Setup](#database-setup) section below for detailed instructions.

### 5. Start Development Servers

```bash
# Start all services
pnpm dev

# Or start specific services
pnpm --filter @ventry/backend dev    # Backend only
pnpm --filter @ventry/web dev        # Frontend only
```

## Database Setup

Ventry uses PostgreSQL for all environments. The development setup uses Docker for consistency.

### Using Docker (Recommended)

```bash
# Check current database status
./tools/scripts/switch-db.sh status

# Setup PostgreSQL configuration
./tools/scripts/switch-db.sh setup

# Start PostgreSQL with Docker
./tools/scripts/switch-db.sh start

# The database will be available at:
# Host: localhost
# Port: 5487
# Database: ventry_dev
# Username: ventry
# Password: ventry_dev_password
```

### Initial Database Setup

```bash
# Push the Prisma schema to create tables
pnpm --filter @ventry/database db:push

# Seed with demo data (REQUIRED for first login)
pnpm --filter @ventry/database db:seed

# For comprehensive demo data including analytics
pnpm --filter @ventry/database db:seed:comprehensive
```

### Database Management Commands

```bash
# Reset database (WARNING: Deletes all data)
./tools/scripts/reset-db.sh

# Create database backup
./tools/scripts/backup-db.sh

# Stop PostgreSQL
./tools/scripts/switch-db.sh stop
```

### Accessing the Database

You can connect to PostgreSQL using any client:

```bash
# Using psql
psql postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev

# Using Docker exec
docker exec -it ventry-postgres psql -U ventry -d ventry_dev
```

For GUI access, pgAdmin is included:
- URL: http://localhost:5050
- Email: admin@ventry.local
- Password: pgadmin_dev_password

## Running the Application

### Development Mode

```bash
# Start all services (recommended)
pnpm dev

# This starts:
# - Backend API (tRPC + Fastify) on http://localhost:6060
# - Frontend (Next.js) on http://localhost:6061
# - File watching and hot reload enabled
```

### Individual Services

```bash
# Backend only
pnpm --filter @ventry/backend dev

# Frontend only
pnpm --filter @ventry/web dev

# Database operations
pnpm --filter @ventry/database studio  # Open Prisma Studio
```

### Build for Production

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @ventry/backend build
pnpm --filter @ventry/web build
```

## Development Workflow

### 1. tRPC Development Flow

When developing new features:

1. **Define Backend Procedure**:
   ```typescript
   // apps/backend/src/routers/items.ts
   export const itemsRouter = createTRPCRouter({
     create: organizationProcedure
       .input(itemCreateSchema)
       .mutation(async ({ ctx, input }) => {
         // Implementation
       }),
   });
   ```

2. **Backend builds automatically export types**

3. **Use in Frontend with full type safety**:
   ```typescript
   // apps/web/components/items/create-item.tsx
   const createMutation = trpc.items.create.useMutation({
     onSuccess: () => {
       toast.success('Item created');
     },
   });
   ```

### 2. Database Schema Changes

1. **Modify Prisma Schema**:
   ```prisma
   // packages/database/prisma/schema.prisma
   model Item {
     id    String @id @default(cuid())
     name  String
     // Add new fields here
   }
   ```

2. **Push Changes to Database**:
   ```bash
   pnpm --filter @ventry/database db:push
   ```

3. **Generate TypeScript Types**:
   ```bash
   pnpm --filter @ventry/database generate
   ```

### 3. Component Development

1. **Create Component**:
   ```bash
   # Component files use kebab-case
   touch apps/web/components/inventory/stock-adjustment-dialog.tsx
   ```

2. **Add shadcn/ui Components**:
   ```bash
   # Install from shadcn/ui registry
   pnpm --filter @ventry/ui add dialog
   ```

3. **Use in Pages**:
   ```typescript
   import { StockAdjustmentDialog } from '@/components/inventory/stock-adjustment-dialog';
   ```

## Common Development Tasks

### Running Tests

```bash
# Run all unit tests
pnpm test

# Run integration tests (requires database)
pnpm test:integration

# Run E2E tests
pnpm test:e2e

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Run tests for specific package
pnpm --filter @ventry/backend test
pnpm --filter @ventry/web test
```

### Code Quality Checks

```bash
# Run ESLint
pnpm lint

# Run TypeScript type checking
pnpm typecheck

# Format code with Prettier
pnpm format

# Run all checks (recommended before committing)
pnpm lint && pnpm typecheck && pnpm test
```

### Database Operations

```bash
# View current schema in Prisma Studio
pnpm --filter @ventry/database studio

# Create a migration (production)
pnpm --filter @ventry/database migrate:dev

# Reset database and reseed
./tools/scripts/reset-db.sh && pnpm --filter @ventry/database db:seed

# Create integration test database
DATABASE_URL="postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test" \
  pnpm --filter @ventry/database db:push
```

### Adding New Features

1. **Create Router** (Backend):
   ```bash
   touch apps/backend/src/routers/newFeature.ts
   ```

2. **Add to Root Router**:
   ```typescript
   // apps/backend/src/routers/index.ts
   import { newFeatureRouter } from './newFeature.js';
   
   export const appRouter = createTRPCRouter({
     // ... existing routers
     newFeature: newFeatureRouter,
   });
   ```

3. **Create UI Components**:
   ```bash
   mkdir -p apps/web/components/new-feature
   touch apps/web/components/new-feature/list.tsx
   ```

4. **Create Page**:
   ```bash
   mkdir -p apps/web/app/new-feature
   touch apps/web/app/new-feature/page.tsx
   ```

## Useful Scripts and Commands

### Development Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all development servers |
| `pnpm dev:backend` | Start backend only |
| `pnpm dev:frontend` | Start frontend only |
| `pnpm build` | Build all packages |
| `pnpm clean` | Clean all build artifacts |
| `pnpm fresh` | Clean install (removes node_modules) |

### Database Scripts

| Command | Description |
|---------|-------------|
| `pnpm db:push` | Push schema to database |
| `pnpm db:seed` | Seed with basic demo data |
| `pnpm db:seed:comprehensive` | Seed with full demo data |
| `pnpm db:migrate` | Run migrations (production) |
| `pnpm db:studio` | Open Prisma Studio GUI |

### Testing Scripts

| Command | Description |
|---------|-------------|
| `pnpm test` | Run unit tests |
| `pnpm test:integration` | Run integration tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:cov` | Run tests with coverage |

### Utility Scripts

| Command | Description |
|---------|-------------|
| `./tools/scripts/dev-setup.sh` | Initial development setup |
| `./tools/scripts/switch-db.sh` | Manage PostgreSQL database |
| `./tools/scripts/reset-db.sh` | Reset database |
| `./tools/scripts/backup-db.sh` | Backup database |

### Working with Packages

```bash
# Run command in specific package
pnpm --filter @ventry/backend <command>
pnpm --filter @ventry/web <command>
pnpm --filter @ventry/database <command>

# Examples
pnpm --filter @ventry/backend add express
pnpm --filter @ventry/web dev
pnpm --filter @ventry/database db:push
```

## Testing

### Test Structure

```
ventry/
├── apps/
│   ├── backend/
│   │   └── src/
│   │       └── **/*.test.ts        # Unit tests
│   │       └── **/*.integration.test.ts  # Integration tests
│   ├── web/
│   │   └── **/*.test.tsx           # Component tests
│   └── e2e/
│       └── tests/*.spec.ts         # E2E tests
```

### Running Different Test Types

```bash
# Unit tests (fast, mocked dependencies)
pnpm test

# Integration tests (real database)
pnpm test:integration

# E2E tests (full browser automation)
pnpm test:e2e

# E2E with UI (debugging)
pnpm test:e2e:ui

# Specific browser
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit
```

### Test Database Setup

Integration tests use a separate database:

```bash
# Create integration test database
DATABASE_URL="postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test" \
  pnpm --filter @ventry/database db:push

# Run integration tests
pnpm test:integration
```

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :6060  # Backend
lsof -i :6061  # Frontend

# Kill process
kill -9 <PID>
```

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart PostgreSQL
./tools/scripts/switch-db.sh stop
./tools/scripts/switch-db.sh start

# Check logs
docker logs ventry-postgres
```

#### Authentication Issues

If you get "Invalid credentials" errors:

1. Ensure database is seeded:
   ```bash
   pnpm --filter @ventry/database db:seed
   ```

2. Clear browser cookies for localhost:6061

3. Verify both frontend and backend are running:
   ```bash
   pnpm dev
   ```

4. Check backend logs for errors

#### TypeScript Errors

```bash
# Rebuild TypeScript project references
pnpm typecheck --build --force

# Generate Prisma types
pnpm --filter @ventry/database generate
```

#### Dependency Issues

```bash
# Clean and reinstall
pnpm clean
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Getting Help

1. Check the logs:
   - Backend: Terminal running `pnpm dev`
   - Frontend: Browser console
   - Database: `docker logs ventry-postgres`

2. Review documentation:
   - [README.md](./README.md) - Project overview
   - [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Detailed development guide
   - [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - Common issues

3. Debug mode:
   ```bash
   # Enable debug logging
   DEBUG=* pnpm dev
   ```

## Best Practices

### Code Style

- Follow the style guide in CLAUDE.md
- Use ESLint and Prettier
- Write tests for new features
- Use TypeScript strict mode

### Git Workflow

1. Create feature branch from `main`
2. Make changes following conventions
3. Run checks before committing:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```
4. Use conventional commits:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation
   - `refactor:` Code refactoring

### Performance Tips

- Use React Query for server state
- Implement proper loading states
- Use pagination for large lists
- Optimize database queries with indexes

## Next Steps

After setting up your development environment:

1. **Explore the Codebase**:
   - Backend routes: `apps/backend/src/routers/`
   - Frontend pages: `apps/web/app/`
   - UI components: `apps/web/components/`

2. **Try the Features**:
   - Login with demo credentials
   - Explore inventory management
   - Test stock adjustments
   - View analytics dashboard

3. **Make Your First Change**:
   - Pick a small issue or feature
   - Follow the development workflow
   - Submit a pull request

Happy coding! 🚀