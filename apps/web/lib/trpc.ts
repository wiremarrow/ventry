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
      // Include credentials for httpOnly cookies and organization header
      fetch: (url, options) => {
        const headers = {
          ...(options?.headers || {}),
        };
        
        // Add organization ID from global if available
        if (typeof window !== 'undefined' && (window as Window & { __organizationId?: string }).__organizationId) {
          headers['x-organization-id'] = (window as Window & { __organizationId?: string }).__organizationId;
        }
        
        return fetch(url, { 
          ...options, 
          credentials: 'include',
          headers,
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