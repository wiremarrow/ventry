import { create } from 'zustand';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  organizationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
  organization: Organization;
}

interface OrganizationStore {
  // State
  activeOrganizationId: string | null;
  organizations: OrganizationMembership[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setActiveOrganization: (organizationId: string) => void;
  setOrganizations: (organizations: OrganizationMembership[]) => void;
  clearActiveOrganization: () => void;
  reset: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getActiveOrganization: () => OrganizationMembership | undefined;
  getOrganizationById: (id: string) => OrganizationMembership | undefined;
}

const initialState = {
  activeOrganizationId: null,
  organizations: [],
  isLoading: false,
  error: null,
};

export const useOrganizationStore = create<OrganizationStore>()((set, get) => ({
  ...initialState,

  // Actions
  setActiveOrganization: (organizationId: string) => {
    set({ activeOrganizationId: organizationId, error: null });
  },

  setOrganizations: (organizations: OrganizationMembership[]) => {
    set({ organizations, error: null });
    
    // If no active organization is set and we have organizations, set the first one
    const state = get();
    if (!state.activeOrganizationId && organizations.length > 0) {
      set({ activeOrganizationId: organizations[0].organizationId });
    }
  },

  clearActiveOrganization: () => {
    set({ activeOrganizationId: null });
  },

  reset: () => {
    set(initialState);
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  // Computed
  getActiveOrganization: () => {
    const state = get();
    if (!state.activeOrganizationId) return undefined;
    return state.organizations.find(
      (org) => org.organizationId === state.activeOrganizationId
    );
  },

  getOrganizationById: (id: string) => {
    const state = get();
    return state.organizations.find((org) => org.organizationId === id);
  },
}));

// Selector hooks for common use cases
export const useActiveOrganizationId = () => 
  useOrganizationStore((state) => state.activeOrganizationId);

export const useActiveOrganization = () =>
  useOrganizationStore((state) => state.getActiveOrganization());

export const useOrganizations = () =>
  useOrganizationStore((state) => state.organizations);

export const useSetActiveOrganization = () =>
  useOrganizationStore((state) => state.setActiveOrganization);

export const useOrganizationLoading = () =>
  useOrganizationStore((state) => state.isLoading);

export const useOrganizationError = () =>
  useOrganizationStore((state) => state.error);