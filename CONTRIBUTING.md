# Contributing to Ventry

Thank you for your interest in contributing to Ventry! We're excited to have you join our community. This guide will help you get started with contributing to our AI-native inventory management system.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- **Be Respectful**: Treat everyone with respect. No harassment, discrimination, or inappropriate behavior will be tolerated.
- **Be Collaborative**: Work together constructively. Disagreements are fine, but keep discussions professional and focused on the code.
- **Be Inclusive**: Welcome newcomers and help them get started. Everyone was a beginner once.
- **Be Patient**: Not everyone has the same experience level or background. Be patient with questions and mistakes.

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20 LTS** (required for all development)
- **pnpm 9.14+** (our package manager)
- **Docker Desktop** (for PostgreSQL development)
- **Git** (version control)

### First Time Setup

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ventry.git
   cd ventry
   ```

3. **Run the development setup script**:
   ```bash
   # Complete setup including PostgreSQL with Docker
   ./tools/scripts/dev-setup.sh
   ```

4. **Start the development environment**:
   ```bash
   pnpm dev
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - tRPC Panel: http://localhost:4000/panel

## 📋 Development Workflow

### 1. Before You Start

- **Check existing issues**: Look for issues tagged with `good first issue` or `help wanted`
- **Check existing PRs**: Avoid duplicate work by checking open pull requests
- **Open an issue first**: For significant changes, discuss your proposal in an issue before starting work
- **Join our Discord**: Get help and discuss ideas with the community

### 2. Branching Strategy

We follow a simple but strict branching strategy:

```bash
# Feature branches
git checkout -b feature/your-feature-name

# Bug fix branches
git checkout -b fix/bug-description

# Documentation updates
git checkout -b docs/what-you-are-documenting

# Maintenance tasks
git checkout -b chore/task-description
```

**Important**: Always branch from `main` and keep your branch up to date.

### 3. Making Changes

#### Development Commands

```bash
# Start all services in development mode
pnpm dev

# Run linting (must pass before commit)
pnpm lint

# Format code automatically
pnpm format

# Type checking (must pass before commit)
pnpm typecheck

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific package tests
pnpm --filter @ventry/backend test
pnpm --filter @ventry/web test

# Run integration tests (requires PostgreSQL)
pnpm test:integration

# Run E2E tests (all browsers)
pnpm test:e2e

# Build for production
pnpm build
```

#### Database Management

```bash
# Check database status
./tools/scripts/switch-db.sh status

# Start PostgreSQL with Docker
./tools/scripts/switch-db.sh start

# Stop PostgreSQL
./tools/scripts/switch-db.sh stop

# Apply database migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate
```

## 📝 Code Standards

### Import Ordering

All files must follow this exact import order with blank lines between groups:

```typescript
// 1. React/Next.js built-ins
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. External packages (alphabetical)
import { format } from 'date-fns';
import { toast } from 'sonner';
import { z } from 'zod';

// 3. Workspace packages
import { Button, Card, Input } from '@ventry/ui';
import type { Order, Customer } from '@ventry/database';

// 4. Absolute imports (@/...)
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';

// 5. Relative imports
import { OrderList } from './order-list';
import { utils } from './utils';

// 6. Type imports (if not already imported above)
import type { LocalType } from './types';
```

### File Naming Conventions

| File Type | Pattern | Example |
|-----------|---------|---------|
| **Components** | kebab-case.tsx | `stock-adjustment-dialog.tsx` |
| **Pages** | page.tsx | `app/inventory/page.tsx` |
| **tRPC Routers** | camelCase.ts | `purchaseOrders.ts` |
| **Unit Tests** | *.test.ts(x) | `order-list.test.tsx` |
| **Integration Tests** | *.integration.test.ts | `auth.integration.test.ts` |
| **E2E Tests** | *.spec.ts | `login.spec.ts` |

### TypeScript Guidelines

1. **Always use TypeScript strict mode**
2. **Never use `any` type** - use `unknown` for truly unknown types
3. **Use interfaces for component props**:
   ```typescript
   interface OrderListProps {
     orders: Order[];
     onEdit: (id: string) => void;
   }
   ```
4. **Use `import type` for type-only imports**
5. **Avoid type annotations on tRPC routers** - let TypeScript infer

### Component Structure

```typescript
'use client'; // Only if client component

// Imports (following import order rules)

// Type definitions
interface ComponentProps {
  // props
}

// Component
export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // Hooks first
  const router = useRouter();
  const [state, setState] = useState();
  
  // tRPC queries
  const { data, isLoading } = trpc.items.list.useQuery();
  
  // tRPC mutations
  const createMutation = trpc.items.create.useMutation({
    onSuccess: () => {
      toast.success('Item created');
    },
  });
  
  // Event handlers
  const handleSubmit = () => { ... };
  
  // Early returns
  if (isLoading) return <Skeleton />;
  if (!data) return null;
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

## 🧪 Testing Requirements

### Test Types and When to Use Them

1. **Unit Tests** (`*.test.ts`):
   - Test individual functions, utilities, and components
   - Mock external dependencies
   - Fast and focused

2. **Integration Tests** (`*.integration.test.ts`):
   - Test tRPC procedures with real database
   - Test API endpoints end-to-end
   - Use isolated test database

3. **E2E Tests** (`*.spec.ts`):
   - Test complete user workflows
   - Run in real browsers (Chromium, Firefox, WebKit)
   - Test critical paths like login, checkout

### Writing Tests

```typescript
// Unit Test Example
import { describe, it, expect, vi } from 'vitest';

describe('OrderList', () => {
  it('should render orders', () => {
    // Test implementation
  });
});

// Integration Test Example
import { createIntegrationContext } from '../test-utils/trpc-test-client.js';

describe('Orders Router', () => {
  it('should create order', async () => {
    const ctx = await createIntegrationContext();
    const caller = appRouter.createCaller(ctx);
    // Test implementation
  });
});
```

### Test Coverage Requirements

- **Aim for >80% code coverage**
- **All new features must include tests**
- **All bug fixes must include regression tests**
- **Critical paths must have E2E tests**

## 💬 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
# Feature
feat(backend): add bulk import for inventory items

- Implement CSV parsing with validation
- Add progress tracking for large imports
- Include error reporting with line numbers

Closes #123

# Bug Fix
fix(web): correct stock level display for multiple warehouses

Previously showed total across all warehouses instead of per-location

# Documentation
docs: update API documentation for v2 endpoints

# Performance
perf(backend): optimize inventory queries with proper indexes

Reduces query time from 2s to 50ms for large datasets
```

## 🔄 Pull Request Process

### Pre-submission Checklist

Before submitting your PR, ensure:

- [ ] All tests pass: `pnpm test`
- [ ] Linting passes: `pnpm lint`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Code is formatted: `pnpm format`
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow conventions
- [ ] Branch is up to date with `main`

### Creating a Pull Request

1. **Push your branch** to your fork
2. **Create a PR** from your fork to our `main` branch
3. **Fill out the PR template** completely
4. **Link related issues** using keywords like "Closes #123"
5. **Wait for CI checks** to complete

### PR Description Template

```markdown
## Description
Brief description of what this PR does and why

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] My code follows the project style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

## 👀 Code Review Process

### What to Expect

1. **Automated Checks**: CI will run automatically and must pass
2. **Code Review**: At least one maintainer will review your code
3. **Feedback**: Reviewers may request changes or ask questions
4. **Iteration**: Make requested changes and push new commits
5. **Approval**: Once approved, a maintainer will merge your PR

### Review Guidelines for Reviewers

- **Be constructive**: Suggest improvements, don't just criticize
- **Be specific**: Point to exact lines and suggest alternatives
- **Be timely**: Try to review within 48 hours
- **Be thorough**: Check for bugs, performance, security, and style

## 🤖 Working with AI Features

When contributing to AI-powered features:

### Prompt Engineering
- Use clear, structured prompts
- Include examples for consistency
- Version control prompt templates
- Test with edge cases

### Testing AI Features
```typescript
// Mock LLM responses in tests
vi.mock('@/lib/ai-client', () => ({
  generateResponse: vi.fn().mockResolvedValue({
    recommendation: 'Reorder 100 units'
  })
}));
```

### Best Practices
- Log all AI interactions for debugging
- Handle failures gracefully with fallbacks
- Monitor token usage and costs
- Provide user feedback during processing

## 🛠️ Project-Specific Guidelines

### Backend (tRPC + Fastify)
- Use organization-scoped procedures for multi-tenant data
- Implement proper error handling with TRPCError
- Add input validation with Zod schemas
- Follow RESTful conventions for tRPC procedure names

### Frontend (Next.js + React)
- Use App Router patterns
- Implement proper loading and error states
- Ensure mobile responsiveness
- Use shadcn/ui components consistently

### Database (Prisma + PostgreSQL)
- Always create migrations for schema changes
- Use appropriate indexes for query optimization
- Maintain referential integrity
- Document complex queries

## 🆘 Getting Help

### Resources

- **Documentation**: Check our [docs](./docs) folder
- **Discord**: Join our community for real-time help
- **GitHub Issues**: Open an issue for bugs or feature requests
- **GitHub Discussions**: For general questions and ideas

### Common Issues

1. **Database connection errors**: Ensure PostgreSQL is running with `./tools/scripts/switch-db.sh status`
2. **Type errors**: Run `pnpm db:generate` after schema changes
3. **Test failures**: Check if you need to run migrations or seed data
4. **Build errors**: Try `pnpm clean` and rebuild

## 🏆 Recognition

We value all contributions! Contributors will be:

- Listed in our CONTRIBUTORS file
- Mentioned in release notes for significant contributions
- Eligible for special contributor badges
- Invited to our contributor-only Discord channel

## 📜 License

By contributing to Ventry, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

## 🎯 What to Work On

### Good First Issues
Look for issues labeled with `good first issue` - these are specifically chosen for newcomers.

### Priority Areas
- **Test Coverage**: We need more tests, especially integration tests
- **Documentation**: Help improve our docs and examples
- **Performance**: Optimize queries and reduce bundle size
- **Accessibility**: Improve keyboard navigation and screen reader support
- **Internationalization**: Help translate the UI

### Feature Requests
Check our [TODO.md](./TODO.md) for the roadmap and upcoming features.

---

Thank you for contributing to Ventry! Your efforts help make inventory management more intelligent and efficient for businesses worldwide. We're excited to see what you'll build! 🚀