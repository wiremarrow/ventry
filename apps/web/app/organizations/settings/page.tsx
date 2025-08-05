'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  Input,
  Label,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Badge,
  Skeleton,
} from '@ventry/ui';
import { Building2, Calendar, CreditCard, AlertCircle, Save } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/use-organization';
import { ProtectedRoute } from '@/components/auth/protected-route';

const organizationSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().url().optional().or(z.literal('')),
  billingEmail: z.string().email().optional().or(z.literal('')),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

export default function OrganizationSettingsPage() {
  const _router = useRouter();
  const { currentOrganization } = useOrganization();

  const {
    data: organization,
    isLoading,
    refetch,
  } = trpc.organizations.get.useQuery(
    { id: currentOrganization?.organizationId || '' },
    { enabled: !!currentOrganization?.organizationId }
  );

  const { data: usage } = trpc.organizations.getUsage.useQuery(
    { organizationId: currentOrganization?.organizationId || '' },
    { enabled: !!currentOrganization?.organizationId }
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: organization?.name || '',
      domain: organization?.domain || '',
      logoUrl: organization?.logoUrl || '',
      billingEmail: organization?.billingEmail || '',
    },
  });

  const updateMutation = trpc.organizations.update.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Organization settings updated successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update organization',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: OrganizationFormData) => {
    if (!currentOrganization?.organizationId) return;

    updateMutation.mutate({
      id: currentOrganization.organizationId,
      ...data,
      domain: data.domain || null,
      logoUrl: data.logoUrl || null,
    });
  };

  if (isLoading || !organization) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </ProtectedRoute>
    );
  }

  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(organization.role);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Organization Settings</h1>
          <p className="text-muted-foreground">Manage your organization details and preferences</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="usage">Usage & Limits</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Organization Name</Label>
                    <Input
                      id="name"
                      {...register('name')}
                      disabled={!isOwnerOrAdmin}
                      className="mt-1"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="slug">Organization Slug</Label>
                    <Input id="slug" value={organization.slug} disabled className="mt-1" />
                    <p className="text-sm text-muted-foreground mt-1">
                      This cannot be changed after creation
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="domain">Custom Domain</Label>
                    <Input
                      id="domain"
                      {...register('domain')}
                      placeholder="https://your-domain.com"
                      disabled={!isOwnerOrAdmin}
                      className="mt-1"
                    />
                    {errors.domain && (
                      <p className="text-sm text-destructive mt-1">{errors.domain.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input
                      id="logoUrl"
                      {...register('logoUrl')}
                      placeholder="https://your-logo.com/logo.png"
                      disabled={!isOwnerOrAdmin}
                      className="mt-1"
                    />
                    {errors.logoUrl && (
                      <p className="text-sm text-destructive mt-1">{errors.logoUrl.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="billingEmail">Billing Email</Label>
                    <Input
                      id="billingEmail"
                      {...register('billingEmail')}
                      placeholder="billing@company.com"
                      disabled={!isOwnerOrAdmin}
                      className="mt-1"
                    />
                    {errors.billingEmail && (
                      <p className="text-sm text-destructive mt-1">{errors.billingEmail.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Created {new Date(organization.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>ID: {organization.id}</span>
                  </div>
                </div>

                {isOwnerOrAdmin && (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={updateMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                )}
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="usage">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Usage & Limits</h3>

              {usage && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Team Members</span>
                        <span className="text-sm font-medium">
                          {usage.members} / {usage.limits.members}
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${(usage.members / usage.limits.members) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Products</span>
                        <span className="text-sm font-medium">
                          {usage.items} / {usage.limits.items}
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${(usage.items / usage.limits.items) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Warehouses</span>
                        <span className="text-sm font-medium">
                          {usage.warehouses} / {usage.limits.warehouses}
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${(usage.warehouses / usage.limits.warehouses) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Orders</span>
                        <span className="text-sm font-medium">
                          {usage.orders} / {usage.limits.orders}
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${(usage.orders / usage.limits.orders) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Usage limits are based on your current subscription plan
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Billing Information</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Current Plan</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {organization.subscriptionTier} Plan
                    </p>
                  </div>
                  <Badge
                    variant={organization.subscriptionStatus === 'active' ? 'default' : 'secondary'}
                  >
                    {organization.subscriptionStatus}
                  </Badge>
                </div>

                {organization.trialEndsAt && (
                  <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium text-sm">Trial Period</p>
                      <p className="text-sm text-muted-foreground">
                        Your trial ends on {new Date(organization.trialEndsAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button variant="outline" className="w-full">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Manage Subscription
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}
