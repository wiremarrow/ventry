'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Building2, Check, ChevronDown, CreditCard, Plus, Settings, Users } from 'lucide-react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton
} from '@ventry/ui';

import { useOrganization } from '@/hooks/use-organization';
import { toast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';

export default function OrganizationSwitcher() {
  const router = useRouter();
  const { currentOrganization, setOrganization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = trpc.organizations.list.useQuery();

  const handleSelectOrganization = async (org: NonNullable<typeof data>['organizations'][0]) => {
    // Don't switch if already in this organization
    if (currentOrganization?.organizationId === org.id) {
      setIsOpen(false);
      return;
    }
    
    try {
      await setOrganization(org.id);
      setIsOpen(false);
      toast({
        title: 'Organization switched',
        description: `Now working in ${org.name}`,
      });
      // Refresh the page to update all data
      router.refresh();
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to switch organization',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-10 w-48" />;
  }

  const currentOrg = data?.organizations?.find(org => org.id === currentOrganization?.organizationId) || data?.organizations?.[0];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">
              {currentOrg?.name || 'Select Organization'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {data?.organizations?.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSelectOrganization(org)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="text-sm">{org.name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {org.role.toLowerCase()}
                </span>
              </div>
            </div>
            {org.id === currentOrganization?.organizationId && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => router.push('/organizations/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Organization
        </DropdownMenuItem>
        
        {currentOrg && ['OWNER', 'ADMIN'].includes(currentOrg.role) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/organizations/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/organizations/members')}>
              <Users className="mr-2 h-4 w-4" />
              Members
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/organizations/billing')}>
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}