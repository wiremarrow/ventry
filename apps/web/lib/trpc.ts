import { createTRPCReact } from '@trpc/react-query';
import { httpLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@ventry/backend';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    // Temporarily disable batching to test if cookies work with individual requests
    httpLink({
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060/trpc',
      transformer: superjson,
      // Include credentials for httpOnly cookies
      fetch: (url, options) => {
        return fetch(url, { 
          ...options, 
          credentials: 'include',
        });
      },
    }),
    // httpBatchLink({
    //   url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060/trpc',
    //   transformer: superjson,
    //   // Include credentials for httpOnly cookies
    //   fetchOptions: {
    //     credentials: 'include',
    //   },
    // }),
  ],
});