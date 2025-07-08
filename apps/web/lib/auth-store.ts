import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@ventry/shared';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  login: (user: UserProfile) => void;
  logout: () => void;
  setUser: (user: UserProfile) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,
      login: (user) => {
        // No token management - handled by httpOnly cookies
        set({
          user,
          isAuthenticated: true,
        });
      },
      logout: () => {
        // No cookie clearing - handled by backend logout endpoint
        set({
          user: null,
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
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);