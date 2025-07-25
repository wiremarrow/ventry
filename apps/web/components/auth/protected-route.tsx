'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import * as Sentry from '@sentry/nextjs';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Use a timeout to prevent infinite loading if hydration fails
    const checkAuth = async () => {
      // Give Zustand time to hydrate from localStorage
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check authentication status
      const authState = useAuthStore.getState();
      if (!authState.isAuthenticated || !authState.user) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'User not authenticated, redirecting to login',
          level: 'info',
          data: {
            hasUser: !!authState.user,
            isAuthenticated: authState.isAuthenticated,
          },
        });
        router.push('/login');
      }
      setIsChecking(false);
    };

    checkAuth();
  }, [router]);

  // Show loading state while checking auth
  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show loading state while redirecting
  if (!isAuthenticated || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}
