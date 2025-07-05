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

# Or start specific apps
pnpm --filter @ventry/backend dev
pnpm --filter @ventry/web dev
```

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all development servers |
| `pnpm build` | Build all packages for production |
| `pnpm test` | Run unit tests with Jest (excludes integration tests) |
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
| `pnpm db:push` | Push schema changes to database |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed database with test data |
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
│   ├── backend/         # NestJS API server
│   ├── web/            # Next.js frontend
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

### Backend (NestJS)

1. Start the backend in debug mode:
   ```bash
   pnpm --filter @ventry/backend dev:debug
   ```

2. Attach your debugger to port 9229

### Frontend (Next.js)

1. Start the frontend in debug mode:
   ```bash
   pnpm --filter @ventry/web dev:debug
   ```

2. Use Chrome DevTools or VS Code debugger

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

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port
   lsof -i :3000
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

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Documentation](https://pnpm.io/)