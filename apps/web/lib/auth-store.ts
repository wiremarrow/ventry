import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@ventry/shared';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  login: (user: UserProfile, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setUser: (user: UserProfile) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: () => void;
  token: string | null; // Alias for accessToken for compatibility
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,
      get token() {
        return get().accessToken;
      },
      login: (user, accessToken, refreshToken) => {
        console.log('[Auth Store] Login called with user:', user.email);
        
        // Also set cookie for middleware
        const cookieString = `auth-token=${accessToken}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
        document.cookie = cookieString;
        console.log('[Auth Store] Set auth-token cookie');
        
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
        
        console.log('[Auth Store] Auth state updated - isAuthenticated: true');
      },
      logout: () => {
        // Clear cookie
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ isLoading: loading }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
        
        // Restore cookie from persisted token on hydration
        if (state?.accessToken) {
          document.cookie = `auth-token=${state.accessToken}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
          console.log('[Auth Store] Restored auth-token cookie from persisted state');
        }
      },
    }
  )
);