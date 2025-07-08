import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../routers/app.js';
import { createContext } from '../trpc/context.js';

// Create a test client that bypasses HTTP
export function createTestTRPCClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'http://localhost:6060/trpc',
        transformer: superjson,
        headers: async () => {
          return {};
        },
      }),
    ],
  });
}

// Create a direct caller for unit tests (bypasses HTTP)
export async function createDirectCaller(contextOverride?: Partial<Awaited<ReturnType<typeof createContext>>>) {
  const { appRouter } = await import('../routers/app.js');
  
  const defaultContext = {
    req: {} as any,
    res: {} as any,
    user: null,
    prisma: (await import('@ventry/database')).prisma,
  };

  const ctx = { ...defaultContext, ...contextOverride };
  
  return appRouter.createCaller(ctx);
}

// Helper to create authenticated context
export function createAuthenticatedContext(user: { id: string; email: string; role: string }) {
  return {
    user,
    prisma: require('@ventry/database').prisma,
    req: {} as any,
    res: {} as any,
  };
}