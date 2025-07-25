'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { trpc } from '@/lib/trpc';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, isHydrated, isAuthenticated } = useAuthStore();

  // Only run auth check after hydration is complete and add delay to prevent race condition
  const {
    data: user,
    error,
    isLoading,
  } = trpc.auth.me.useQuery(undefined, {
    enabled: isHydrated, // Only enable after hydration
    retry: false, // Don't retry on auth failures
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  useEffect(() => {
    if (!isHydrated) return;

    if (isLoading) {
      setLoading(true);
      return;
    }

    setLoading(false);

    if (error) {
      // Only logout if we're not already authenticated (prevents race condition)
      // This prevents clearing auth state immediately after login
      if (!isAuthenticated) {
        useAuthStore.getState().logout();
      }
      return;
    }

    if (user) {
      // Authentication successful - set user
      setUser(user);
    }
  }, [user, error, isLoading, isHydrated, setUser, setLoading, isAuthenticated]);

  return <>{children}</>;
}
