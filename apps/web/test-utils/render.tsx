import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { TRPCMockProvider } from './trpc-mock';
import { AuthProvider } from '@/components/providers/auth-provider';
import { OrganizationProvider } from '@/hooks/use-organization';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add any custom options here
}

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return (
    <TRPCMockProvider>
      <AuthProvider>
        <OrganizationProvider>{children}</OrganizationProvider>
      </AuthProvider>
    </TRPCMockProvider>
  );
}

export function render(ui: React.ReactElement, options?: CustomRenderOptions) {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
