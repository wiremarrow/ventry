'use client';

import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { 
  useOrganizationStore,
  useActiveOrganizationId,
  useActiveOrganization,
  useSetActiveOrganization,
  type OrganizationMembership
} from '@/src/stores/organization-store';

interface OrganizationContextType {
  currentOrganization: OrganizationMembership | undefined;
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

  const { data: organizations, isLoading: isLoadingOrgs } = trpc.organizations.list.useQuery();

  useEffect(() => {
    setLoading(isLoadingOrgs);
  }, [isLoadingOrgs, setLoading]);

  useEffect(() => {
    if (organizations) {
      // Transform the data to match our store format
      const orgMemberships: OrganizationMembership[] = organizations.map(org => ({
        organizationId: org.id,
        userId: '', // Will be filled by the actual user data
        role: org.role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER',
        joinedAt: new Date().toISOString(), // Placeholder
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          createdAt: new Date().toISOString(), // Placeholder
          updatedAt: new Date().toISOString(), // Placeholder
        }
      }));
      
      setOrganizations(orgMemberships);
    }
  }, [organizations, setOrganizations]);

  const switchOrgMutation = trpc.organizations.switchOrganization.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries after switching
      utils.invalidate();
    },
    onError: (error) => {
      console.error('Failed to switch organization:', error);
      // Revert the local change if server update failed
      const prevOrg = activeOrganization?.organizationId;
      if (prevOrg) {
        setActiveOrganization(prevOrg);
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
      // Update local state immediately for responsiveness
      setActiveOrganization(orgId);
      
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