'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, accessToken } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      // Check if we have a token
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Verify token is still valid by fetching user profile
        const response = await api.get('/auth/profile');
        if (response.data) {
          setUser(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        // Token is invalid, clear auth state
        useAuthStore.getState().logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [accessToken, setUser, setLoading]);

  return <>{children}</>;
}