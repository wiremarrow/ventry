# Ventry Coding Standards

This document contains the comprehensive coding standards and patterns that all developers must follow when working on the Ventry codebase.

## Table of Contents

- [Import Ordering](#import-ordering)
- [File Naming Conventions](#file-naming-conventions)
- [TypeScript Patterns](#typescript-patterns)
- [Component Structure](#component-structure)
- [tRPC Router Structure](#trpc-router-structure)
- [Form Handling](#form-handling)
- [Error Handling](#error-handling)
- [Naming Conventions](#naming-conventions)
- [Common UI Patterns](#common-ui-patterns)
- [Testing Patterns](#testing-patterns)
- [Git Commit Messages](#git-commit-messages)
- [Security Patterns](#security-patterns)
- [Authentication & Cookies](#authentication--cookies)

## Import Ordering

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

### Import Rules

- Each group separated by exactly one blank line
- Within each group: alphabetical order
- Use `import type` for type-only imports
- Group imports from same package on one line when possible
- Multi-line imports when more than 3 items

## File Naming Conventions

| File Type | Pattern | Example |
|-----------|---------|---------|
| **Components** | kebab-case.tsx | `stock-adjustment-dialog.tsx` |
| **Pages** | page.tsx | `app/inventory/page.tsx` |
| **Layouts** | layout.tsx | `app/inventory/layout.tsx` |
| **API Routes** | route.ts | `app/api/health/route.ts` |
| **tRPC Routers** | camelCase.ts | `purchaseOrders.ts` |
| **Unit Tests** | *.test.ts(x) | `order-list.test.tsx` |
| **Integration Tests** | *.integration.test.ts | `auth.integration.test.ts` |
| **E2E Tests** | *.spec.ts | `login.spec.ts` (in e2e dir) |
| **Utilities** | camelCase.ts | `formatDate.ts` |
| **Constants** | camelCase.ts | `constants.ts` |
| **Types** | types.ts or camelCase.ts | `types.ts` or `orderTypes.ts` |

## TypeScript Patterns

### Component Props

```typescript
// ✅ ALWAYS use interface for component props
interface OrderListProps {
  orders: Order[];
  onEdit: (id: string) => void;
}

// ❌ NEVER use type for component props
type OrderListProps = { ... }
```

### Type Imports

```typescript
// ✅ Use import type for type-only imports
import type { Order, Customer } from '@ventry/database';

// ❌ Don't mix if only importing types
import { Order, Customer } from '@ventry/database';
```

### tRPC Router Exports

```typescript
// ✅ No type annotation needed
export const ordersRouter = createTRPCRouter({...});

// ❌ Don't add explicit type
export const ordersRouter: ReturnType<typeof createTRPCRouter> = createTRPCRouter({...});
```

### Avoid any

```typescript
// ✅ Use unknown for truly unknown types
function processData(data: unknown) { ... }

// ✅ Use proper type inference
const [selectedItem, setSelectedItem] = useState<typeof items[0] | null>(null);

// ❌ Never use any
function processData(data: any) { ... }
```

## Component Structure

```typescript
'use client'; // Only if client component

// Imports (following import order rules)

// Type definitions
interface ComponentProps {
  // props
}

// Zod schemas (if needed)
const formSchema = z.object({
  // schema
});

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
      utils.items.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
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

## tRPC Router Structure

```typescript
// 1. External imports (alphabetical)
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// 2. Local imports
import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

// 3. Type imports
import type { Prisma } from '@ventry/database';

// Input validation schemas (in order: create, update, filter, others)
const itemCreateSchema = z.object({...});
const itemUpdateSchema = z.object({...});
const itemFilterSchema = z.object({...});

// Router export (no type annotation)
export const itemsRouter = createTRPCRouter({
  // List/filter procedures first
  list: organizationProcedure
    .input(itemFilterSchema)
    .query(async ({ ctx, input }) => {...}),
    
  // Get by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {...}),
    
  // Create
  create: organizationProcedure
    .input(itemCreateSchema)
    .mutation(async ({ ctx, input }) => {...}),
    
  // Update
  update: organizationProcedure
    .input(itemUpdateSchema)
    .mutation(async ({ ctx, input }) => {...}),
    
  // Delete
  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {...}),
});
```

## Form Handling

```typescript
const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    name: '',
    email: '',
  },
});

const onSubmit = (data: FormData) => {
  createMutation.mutate(data);
};

// In JSX
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    {/* form fields */}
  </form>
</Form>
```

## Error Handling

### Frontend Error Display

```typescript
// ✅ Use toast for user feedback
toast.error(error.message);
toast.success('Operation completed');

// ✅ Form validation errors
<FormMessage /> // Shows field-specific errors

// ❌ Don't use console.error in production
console.error(error); // Only in development
```

### Backend Error Handling

```typescript
// ✅ Use TRPCError with appropriate codes
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Item not found',
});

// Common codes:
// - UNAUTHORIZED: No valid auth
// - FORBIDDEN: No permission
// - NOT_FOUND: Resource missing
// - BAD_REQUEST: Invalid input
// - CONFLICT: Duplicate/conflict
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| **Variables/Functions** | camelCase | `userId`, `calculateTotal()` |
| **React Components** | PascalCase | `OrderList`, `StockDialog` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_TIMEOUT` |
| **Types/Interfaces** | PascalCase | `Order`, `CustomerData` |
| **Enums** | PascalCase | `OrderStatus` |
| **Enum Values** | UPPER_SNAKE_CASE | `PENDING`, `COMPLETED` |
| **Boolean Variables** | is/has/should prefix | `isLoading`, `hasError` |
| **Event Handlers** | handle prefix | `handleClick`, `handleSubmit` |

## Common UI Patterns

### Loading States

```typescript
if (isLoading) {
  return <Skeleton className="h-10 w-full" />;
}
```

### Empty States

```typescript
if (!data || data.length === 0) {
  return (
    <div className="text-center py-8">
      <p className="text-gray-500">No items found</p>
    </div>
  );
}
```

### Error States

```typescript
if (error) {
  return (
    <div className="text-center py-8">
      <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <p className="text-red-600">{error.message}</p>
    </div>
  );
}
```

### Pagination

```typescript
// Consistent pagination pattern
const { data } = trpc.items.list.useQuery({
  page: currentPage,
  limit: pageSize,
  search: searchTerm,
  sortBy: 'name',
  sortOrder: 'asc',
});

// Response structure
{
  items: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
  }
}
```

## Testing Patterns

### Component Tests

```typescript
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock tRPC
vi.mock('@/lib/trpc');

describe('OrderList', () => {
  it('should render orders', () => {
    // test implementation
  });
});
```

### Integration Tests

```typescript
import { createIntegrationContext } from '../test-utils/trpc-test-client.js';

describe('Orders Router', () => {
  it('should create order', async () => {
    const ctx = await createIntegrationContext();
    const caller = appRouter.createCaller(ctx);
    // test implementation
  });
});
```

### Test Type Guidelines

- **Unit Tests** (`*.test.ts`): Test individual tRPC procedures, utilities, business logic
- **Integration Tests** (`*.integration.test.ts`): Test procedures with real database operations
- **E2E Tests** (`e2e/*.spec.ts`): Test complete user workflows via browser automation

## Git Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting, missing semicolons, etc)
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Performance improvement
- `test:` Adding missing tests
- `chore:` Changes to build process or auxiliary tools

## Security Patterns

### Environment Validation

```typescript
// Environment validation (required)
import { env } from './config/env.js';
```

### Structured Logging

```typescript
// Structured logging (required)
import { createLogger } from './lib/logger.js';
const logger = createLogger('module-name');
```

### Secure Cookies

```typescript
// Secure cookies (required)
import { setCookie, COOKIE_NAMES } from './lib/cookies.js';
setCookie(ctx.res, COOKIE_NAMES.AUTH_TOKEN, token);
```

## Authentication & Cookies

### Signed Cookie Implementation

The system uses **signed cookies** for authentication security. **NEVER** read cookies directly.

#### Correct Cookie Handling

```typescript
// ✅ CORRECT - Always unsign cookies before use
const authCookie = request.cookies['auth-token'];
const token = authCookie ? request.unsignCookie(authCookie)?.value : undefined;

// ❌ WRONG - Never read signed cookies directly
const token = request.cookies['auth-token']; // This will include signature!
```

#### Common Authentication Errors

1. **"Signed cookie string must be provided"** - Cookie doesn't exist, handle null case
2. **"UNAUTHORIZED"** - Usually means cookie reading failed, not actual auth failure
3. **JWT verification errors** - Often caused by reading signed cookie directly

#### Cookie Security Settings

- **httpOnly**: true (prevents XSS)
- **signed**: true (prevents tampering)
- **sameSite**: 'lax' (CSRF protection)
- **secure**: true in production (HTTPS only)
- **maxAge**: 7 days

#### Debugging Authentication

1. Check if cookie exists: `request.cookies['auth-token']`
2. Verify it's being unsigned: `request.unsignCookie()`
3. Check JWT payload after unsigning
4. Verify organization context is set

## Field Naming Convention

- **Database Layer**: snake_case (e.g., `qty_ordered`, `created_at`)
- **Prisma Models**: camelCase with `@@map` directives
- **Application Code**: camelCase to match Prisma types
- **Translation**: Prisma handles snake_case ↔ camelCase conversion

## Key Principles

1. **Consistency**: Follow existing patterns in the codebase
2. **Type Safety**: Always use TypeScript strict mode, avoid `any`
3. **Error Handling**: Provide meaningful error messages to users
4. **Testing**: Write tests for all business logic
5. **Documentation**: Keep code self-documenting with clear names
6. **Security**: Never expose sensitive data, always validate inputs