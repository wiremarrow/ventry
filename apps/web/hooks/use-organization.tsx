'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setCookie, getCookie } from 'cookies-next';
import { trpc } from '@/lib/trpc/client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  setOrganization: (orgId: string) => Promise<void>;
  clearOrganization: () => void;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { data: organizations } = trpc.organizations.list.useQuery();

  useEffect(() => {
    // Load organization from cookie on mount
    const storedOrgId = getCookie('active-organization');
    if (storedOrgId && organizations) {
      const org = organizations.find(o => o.id === storedOrgId);
      if (org) {
        setCurrentOrganization(org);
      } else if (organizations.length > 0) {
        // If stored org not found, use first available
        setCurrentOrganization(organizations[0]);
        setCookie('active-organization', organizations[0].id);
      }
    } else if (organizations && organizations.length > 0) {
      // No stored org, use first available
      setCurrentOrganization(organizations[0]);
      setCookie('active-organization', organizations[0].id);
    }
    setIsLoading(false);
  }, [organizations]);

  const setOrganization = async (orgId: string) => {
    const org = organizations?.find(o => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
      setCookie('active-organization', orgId);
      
      // Also set header for API calls
      if (typeof window !== 'undefined') {
        (window as any).__organizationId = orgId;
      }
    }
  };

  const clearOrganization = () => {
    setCurrentOrganization(null);
    setCookie('active-organization', '', { maxAge: 0 });
    if (typeof window !== 'undefined') {
      delete (window as any).__organizationId;
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
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