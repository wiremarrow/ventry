'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  Settings,
  Users,
  CreditCard,
  Check
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/use-organization';

export default function OrganizationSwitcher() {
  const router = useRouter();
  const { currentOrganization, setOrganization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  const { data: organizations, isLoading } = trpc.organizations.list.useQuery();

  const handleSelectOrganization = async (org: any) => {
    try {
      await setOrganization(org.id);
      setIsOpen(false);
      toast({
        title: 'Organization switched',
        description: `Now working in ${org.name}`,
      });
      // Refresh the page to update all data
      router.refresh();
    } catch (error) {
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

  const currentOrg = organizations?.find(org => org.id === currentOrganization?.id) || organizations?.[0];

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
        
        {organizations?.map((org) => (
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
            {org.id === currentOrg?.id && (
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