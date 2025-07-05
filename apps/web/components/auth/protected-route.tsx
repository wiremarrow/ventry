'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import * as Sentry from '@sentry/nextjs';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, token, isHydrated } = useAuthStore();

  useEffect(() => {
    // Wait for hydration to complete before checking auth
    if (!isHydrated) return;

    // If no user or token, redirect to login
    if (!user || !token) {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User not authenticated, redirecting to login',
        level: 'info',
        data: {
          hasUser: !!user,
          hasToken: !!token,
          isHydrated,
        },
      });
      router.push('/login');
    }
  }, [user, token, isHydrated, router]);

  // Show loading state while hydrating
  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show loading state while redirecting
  if (!user || !token) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}