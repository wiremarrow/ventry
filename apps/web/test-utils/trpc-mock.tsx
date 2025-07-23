import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@ventry/backend';

// Create a mock tRPC instance
export const mockTrpc = createTRPCReact<AppRouter>();

// Create a test query client with defaults suitable for testing
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface TRPCMockProviderProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

// Test wrapper that provides tRPC context
export function TRPCMockProvider({ 
  children, 
  queryClient = createTestQueryClient() 
}: TRPCMockProviderProps) {
  const trpcClient = mockTrpc.createClient({
    links: [],
  });

  return (
    <mockTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </mockTrpc.Provider>
  );
}