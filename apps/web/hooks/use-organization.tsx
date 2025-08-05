'use client';

import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  useOrganizationStore,
  useActiveOrganization,
  useSetActiveOrganization,
  type OrganizationMembership,
} from '@/stores/organization-store';

interface OrganizationContextType {
  currentOrganization: OrganizationMembership | null;
  setOrganization: (orgId: string) => Promise<void>;
  clearOrganization: () => void;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const activeOrganization = useActiveOrganization();
  const setActiveOrganization = useSetActiveOrganization();
  const { setOrganizations, clearActiveOrganization, setLoading } = useOrganizationStore();
  const isLoading = useOrganizationStore((state) => state.isLoading);
  const utils = trpc.useUtils();
  const [isSwitching, setIsSwitching] = useState(false);

  const { data: orgData, isLoading: isLoadingOrgs } = trpc.organizations.list.useQuery();

  useEffect(() => {
    setLoading(isLoadingOrgs);
  }, [isLoadingOrgs, setLoading]);

  useEffect(() => {
    if (orgData) {
      // Transform the data to match our store format
      const orgMemberships: OrganizationMembership[] = orgData.organizations.map((org) => ({
        id: `membership-${org.id}`, // Generate a unique ID for the membership
        organizationId: org.id,
        userId: '', // Will be filled by the actual user data
        role: org.role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER',
        createdAt: new Date(org.joinedAt),
        updatedAt: new Date(org.joinedAt),
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
        },
      }));

      setOrganizations(orgMemberships);

      // Set active organization from server (cookie)
      if (orgData.activeOrganizationId) {
        const activeMembership = orgMemberships.find(
          (m) => m.organizationId === orgData.activeOrganizationId
        );
        if (activeMembership) {
          setActiveOrganization(activeMembership);
        }
      }
    }
  }, [orgData, setOrganizations, setActiveOrganization]);

  const switchOrgMutation = trpc.organizations.switchOrganization.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries after switching
      utils.invalidate();
    },
    onError: (error) => {
      console.error('Failed to switch organization:', error);
      // Revert the local change if server update failed
      if (activeOrganization) {
        setActiveOrganization(activeOrganization);
      }
    },
  });

  const setOrganization = async (orgId: string) => {
    // Prevent concurrent switches
    if (isSwitching) {
      console.warn('Organization switch already in progress');
      return;
    }

    // Don't switch if already in this organization
    if (activeOrganization?.organizationId === orgId) {
      return;
    }

    setIsSwitching(true);

    try {
      // Find the membership for this organization
      const organizations = useOrganizationStore.getState().organizations;
      const targetMembership = organizations.find((m) => m.organizationId === orgId);
      
      if (!targetMembership) {
        throw new Error('Organization not found');
      }

      // Update local state immediately for responsiveness
      setActiveOrganization(targetMembership);

      // Send organization change to server
      await switchOrgMutation.mutateAsync({ organizationId: orgId });
    } finally {
      setIsSwitching(false);
    }
  };

  const clearOrganization = () => {
    clearActiveOrganization();
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization: activeOrganization,
        setOrganization,
        clearOrganization,
        isLoading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
