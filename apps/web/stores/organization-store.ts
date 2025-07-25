import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

interface OrganizationState {
  organizations: OrganizationMembership[];
  activeOrganization: OrganizationMembership | null;
  isLoading: boolean;
  setOrganizations: (organizations: OrganizationMembership[]) => void;
  setActiveOrganization: (organization: OrganizationMembership) => void;
  clearActiveOrganization: () => void;
  setLoading: (loading: boolean) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      organizations: [],
      activeOrganization: null,
      isLoading: false,
      setOrganizations: (organizations) => set({ organizations }),
      setActiveOrganization: (organization) => set({ activeOrganization: organization }),
      clearActiveOrganization: () => set({ activeOrganization: null }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'organization-storage',
      partialize: (state) => ({
        activeOrganization: state.activeOrganization,
      }),
    }
  )
);

// Convenience selectors
export const useActiveOrganization = () => useOrganizationStore((state) => state.activeOrganization);
export const useSetActiveOrganization = () => useOrganizationStore((state) => state.setActiveOrganization);