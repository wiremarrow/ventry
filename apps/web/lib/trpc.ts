import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@ventry/backend';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060/trpc',
      transformer: superjson,
      headers: () => {
        // Get auth token from auth store
        if (typeof window !== 'undefined') {
          // Import dynamically to avoid SSR issues
          const { useAuthStore } = require('@/lib/auth-store');
          const token = useAuthStore.getState().accessToken;
          if (token) {
            return {
              Authorization: `Bearer ${token}`,
            };
          }
        }
        return {};
      },
    }),
  ],
});