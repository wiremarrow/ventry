# Ventry Development Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher) - Install with `npm install -g pnpm@8`
- **Git**

Required:
- **Docker** and **Docker Compose** for PostgreSQL and Redis

## Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ventry
   ```

2. **Run the automated setup script**
   ```bash
   ./tools/scripts/dev-setup.sh
   ```
   - Sets up PostgreSQL and Redis with Docker
   - Installs all dependencies
   - Initializes database schema
   - Creates environment configuration

3. **Configure environment variables**
   
   Edit the `.env` file and update with your values:
   - Database credentials (if changed from defaults)
   - AI provider API keys (OpenAI/Anthropic)
   - Email configuration
   - Other service configurations

## Development Workflow

### Starting the Development Environment

```bash
# Start all services in development mode
pnpm dev

# Access the application:
# Frontend (Next.js): http://localhost:6061
# Backend API (tRPC + Fastify): http://localhost:6060
# tRPC endpoints: http://localhost:6060/trpc

# Or start specific apps
pnpm --filter @ventry/backend dev
pnpm --filter @ventry/web dev
```

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all development servers |
| `pnpm build` | Build all packages for production |
| `pnpm test` | Run unit tests with Vitest (excludes integration tests) |
| `pnpm test:integration` | Run integration tests with PostgreSQL |
| `pnpm test:e2e` | Run E2E tests with Playwright |
| `pnpm test:e2e:ui` | Run E2E tests with interactive UI |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm format` | Format code with Prettier |
| `pnpm clean` | Clean all build artifacts and node_modules |

### Database Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @ventry/database db:push` | Push schema changes to database |
| `pnpm --filter @ventry/database db:migrate` | Run database migrations |
| `pnpm --filter @ventry/database db:seed` | Seed database with test data (**Required for first-time setup** - Creates demo users for login) |
| `./tools/scripts/reset-db.sh` | Reset database (WARNING: Deletes all data) |
| `./tools/scripts/backup-db.sh` | Create database backup |

### Database Management

Manage PostgreSQL database:

```bash
# Check current database status
./tools/scripts/switch-db.sh status

# Setup PostgreSQL configuration
./tools/scripts/switch-db.sh setup

# Start PostgreSQL with Docker
./tools/scripts/switch-db.sh start

# Stop PostgreSQL
./tools/scripts/switch-db.sh stop
```

### Docker Services (Optional)

```bash
# Only needed if using PostgreSQL/Redis
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d postgres redis

# View logs
docker-compose logs -f [service-name]

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: Deletes data)
docker-compose down -v
```

## Project Structure

```
ventry/
├── apps/
│   ├── backend/         # tRPC + Fastify API server
│   ├── web/            # Next.js frontend
│   ├── e2e/            # Playwright E2E tests (dedicated workspace)
│   └── docs/           # Documentation site
├── packages/
│   ├── shared/         # Shared types, constants, utilities
│   ├── ui/            # Shared UI components (shadcn/ui)
│   ├── database/      # Prisma schema and client
│   └── eslint-config/ # Shared ESLint configuration
├── tools/
│   └── scripts/       # Development and deployment scripts
└── docs/              # Project documentation
```

## Code Quality

### Pre-commit Hooks

Husky is configured to run the following checks before each commit:
- ESLint for code quality
- Prettier for code formatting
- TypeScript compilation check

### Manual Checks

```bash
# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Format code
pnpm format

# Run all checks
pnpm lint && pnpm typecheck && pnpm test
```

## Testing

### Command Scope Reference

**Root Level Commands (via Turborepo)**
- Run across all packages in parallel
- Use when you want to test/check everything
- Example: `pnpm test`, `pnpm lint`, `pnpm typecheck`

**Package-Specific Commands**
- Run only in specific package context
- Use when working on specific features
- Navigate to package dir OR use `--filter` flag
- Example: `pnpm test:cov` (backend only), `pnpm test:integration`

**Filter Examples**
```bash
# From root directory
pnpm --filter @ventry/backend test:cov          # Backend coverage
pnpm --filter @ventry/backend test:integration  # Backend integration tests
pnpm --filter @ventry/backend test:watch        # Backend watch mode
pnpm --filter @ventry/web test                  # Frontend tests
```

### Running Tests

```bash
# Run all unit tests (excludes integration tests)
pnpm test

# Run integration tests with PostgreSQL
pnpm test:integration

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage (backend-specific)
pnpm test:cov
# OR from root: pnpm --filter @ventry/backend test:cov

# Run tests for specific package
pnpm --filter @ventry/backend test              # Unit tests only
pnpm --filter @ventry/backend test:integration  # Integration tests only
```

### Writing Tests

- Unit tests: `*.spec.ts` files next to source files
- Integration tests: `*.integration.spec.ts` files
- E2E tests: In `e2e/` directories

## Debugging

### Backend (tRPC + Fastify)

1. Start the backend in debug mode:
   ```bash
   pnpm --filter @ventry/backend dev
   ```

2. The tRPC server includes built-in debugging capabilities
3. Backend runs on http://localhost:6060
4. Access tRPC procedures at http://localhost:6060/trpc

### Frontend (Next.js)

1. Start the frontend in debug mode:
   ```bash
   pnpm --filter @ventry/web dev:debug
   ```

2. Use Chrome DevTools or VS Code debugger
3. Frontend runs on http://localhost:6061

### Database

Access pgAdmin at http://localhost:5050:
- Email: `admin@ventry.local`
- Password: `pgadmin_dev_password`

## Known Issues & Technical Decisions

### ESLint 9 Compatibility (Next.js 15)

**Issue**: Next.js 15 requires ESLint 9, but `eslint-config-next` includes TypeScript ESLint v6.21.0 which is incompatible, causing `context.getScope is not a function` errors.

**Current Solution**: 
We've implemented a custom ESLint configuration that bypasses the Next.js config:

```javascript
// apps/web/eslint.config.mjs
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
```

**Trade-offs**:
- ✅ Fixes ESLint 9 compatibility with TypeScript ESLint v8.35.1
- ✅ Maintains essential TypeScript and React linting
- ⚠️ Loses Next.js-specific linting rules (image optimization, font loading, etc.)
- ⚠️ Requires manual maintenance instead of inheriting Next.js defaults

**Future Action**: When Next.js updates `eslint-config-next` for ESLint 9 support, we should migrate back to the standard configuration.

### Turbopack Compatibility Issue (Next.js 15 + pnpm + Monorepo)

**Issue**: Turbopack fails with "Next.js package not found" error in monorepo setups using pnpm workspaces.

**Error**: 
```
[Error [TurbopackInternalError]: Next.js package not found
Debug info:
- Execution of get_next_package failed
- Next.js package not found
```

**Root Cause**: Known bug in Turbopack with module resolution in monorepo environments, particularly with pnpm's unique node_modules structure.

**Current Workaround**: Turbopack disabled in development mode. Frontend runs with standard webpack dev server:
```json
{
  "scripts": {
    "dev": "next dev --port 6061"
  }
}
```

**Attempted Solutions**:
- ✅ Clean dependency installation (deleted pnpm-lock.yaml, node_modules, reinstalled)
- ✅ Updated Next.js config from `experimental.turbo` to `turbopack` (Next.js 15 stable format)
- ❌ Issue persists despite proper configuration

**Performance Impact**: 
- ⚠️ Slower compilation compared to Turbopack
- ⚠️ Slower hot module replacement
- ✅ Stable development experience

**Tracking**: Multiple GitHub issues confirm this is an ongoing problem:
- [vercel/next.js#55987](https://github.com/vercel/next.js/discussions/55987)
- [vercel/next.js#56887](https://github.com/vercel/next.js/issues/56887)
- [vercel/next.js#74731](https://github.com/vercel/next.js/issues/74731)

**Future Action**: Monitor Next.js releases for Turbopack monorepo fixes. Re-enable with `--turbopack` flag when resolved.

### Node.js Type Stripping Warning (Backend)

**Issue**: Backend shows experimental warning during startup:
```
(node:79903) ExperimentalWarning: Type Stripping is an experimental feature
```

**Impact**: No functional impact, development works normally.

**Status**: Informational warning only, does not affect functionality.

### tRPC + Fastify Architecture

**Key Benefits**:
- End-to-end type safety between frontend and backend
- No code generation required - types are inferred automatically
- Better performance than REST with automatic batching
- Built-in error handling and validation with Zod

**Development Workflow**:
1. Define procedures in `apps/backend/src/routers/`
2. Export router types through `AppRouter`
3. Frontend imports types via workspace dependency
4. Full IntelliSense and type checking in frontend

**Common Patterns**:
```typescript
// Backend: Define a procedure
export const productsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.product.findMany({
        take: input.limit,
      });
    }),
});

// Frontend: Use with full type safety
const { data } = trpc.products.list.useQuery({ limit: 10 });
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port (backend)
   lsof -i :6060
   # Find process using port (frontend)
   lsof -i :6061
   # Kill process
   kill -9 <PID>
   ```

2. **Database connection issues**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps
   # Restart PostgreSQL
   docker-compose restart postgres
   ```

3. **Dependency issues**
   ```bash
   # Clean and reinstall
   pnpm clean
   pnpm install
   ```

4. **TypeScript errors**
   ```bash
   # Rebuild TypeScript references
   pnpm typecheck --build --force
   ```

## Contributing

1. Create a feature branch from `main`
2. Make your changes following our coding standards
3. Write/update tests as needed
4. Ensure all checks pass: `pnpm lint && pnpm typecheck && pnpm test`
5. Submit a pull request

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or modifications
- `chore:` Maintenance tasks

Example: `feat(backend): add stock advisor agent endpoint`

## Resources

- [tRPC Documentation](https://trpc.io/docs)
- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Documentation](https://pnpm.io/)
- [Vitest Documentation](https://vitest.dev/guide/)