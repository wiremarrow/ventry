'use client';

import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Skeleton } from '@ventry/ui';
import { 
  CreditCard, 
  AlertCircle,
  Check,
  ArrowRight,
  Download,
  FileText,
  TrendingUp
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/use-organization';
import { ProtectedRoute } from '@/components/auth/protected-route';

const plans = [
  {
    name: 'Free',
    price: 0,
    features: [
      '1 warehouse',
      'Up to 100 products',
      '3 team members',
      'Basic reporting',
      'Email support',
    ],
    limits: {
      warehouses: 1,
      items: 100,
      members: 3,
      orders: 500,
    },
  },
  {
    name: 'Professional',
    price: 49,
    features: [
      '5 warehouses',
      'Up to 1,000 products',
      '10 team members',
      'Advanced reporting',
      'Priority support',
      'API access',
      'Custom integrations',
    ],
    limits: {
      warehouses: 5,
      items: 1000,
      members: 10,
      orders: 5000,
    },
  },
  {
    name: 'Enterprise',
    price: 199,
    features: [
      'Unlimited warehouses',
      'Unlimited products',
      'Unlimited team members',
      'Enterprise reporting',
      'Dedicated support',
      'Full API access',
      'Custom integrations',
      'SLA guarantee',
      'Advanced security',
    ],
    limits: {
      warehouses: -1,
      items: -1,
      members: -1,
      orders: -1,
    },
  },
];

export default function OrganizationBillingPage() {
  const _router = useRouter();
  const { currentOrganization } = useOrganization();

  const { data: organization, isLoading } = trpc.organizations.get.useQuery(
    { id: currentOrganization?.id || '' },
    { enabled: !!currentOrganization?.id }
  );

  const { data: usage } = trpc.organizations.getUsage.useQuery(
    { organizationId: currentOrganization?.id || '' },
    { enabled: !!currentOrganization?.id }
  );

  const handleUpgrade = (planName: string) => {
    toast({
      title: 'Upgrade to ' + planName,
      description: 'Billing integration coming soon. Contact sales for enterprise pricing.',
    });
  };

  const handleManageSubscription = () => {
    toast({
      title: 'Manage Subscription',
      description: 'Billing portal integration coming soon.',
    });
  };

  const handleDownloadInvoice = () => {
    toast({
      title: 'Download Invoice',
      description: 'Invoice download functionality coming soon.',
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

  const currentPlan = plans.find(p => p.name.toLowerCase() === organization.subscriptionTier) || plans[0];
  const isOwner = organization.role === 'OWNER';

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing information
          </p>
        </div>

        {/* Current Plan */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Current Plan</h2>
              <p className="text-muted-foreground">Your organization's subscription details</p>
            </div>
            {isOwner && (
              <Button onClick={handleManageSubscription}>
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium capitalize">{organization.subscriptionTier} Plan</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={organization.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                  {organization.subscriptionStatus}
                </Badge>
              </div>
              {organization.billingEmail && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Billing Email</span>
                  <span className="font-medium text-sm">{organization.billingEmail}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">${currentPlan.price}/month</span>
              </div>
              {organization.trialEndsAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trial Ends</span>
                  <span className="font-medium">
                    {new Date(organization.trialEndsAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next Billing</span>
                <span className="font-medium">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="font-medium">•••• 4242</span>
              </div>
            </div>
          </div>

          {organization.trialEndsAt && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm">
                  Your trial ends in {Math.ceil((new Date(organization.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))} days.
                  Upgrade now to continue using all features.
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Usage Overview */}
        {usage && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Current Usage</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Members</span>
                </div>
                <p className="text-2xl font-semibold">
                  {usage.members}
                  {usage.limits.members > 0 && (
                    <span className="text-sm text-muted-foreground ml-1">/ {usage.limits.members}</span>
                  )}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Products</span>
                </div>
                <p className="text-2xl font-semibold">
                  {usage.items}
                  {usage.limits.items > 0 && (
                    <span className="text-sm text-muted-foreground ml-1">/ {usage.limits.items}</span>
                  )}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Warehouses</span>
                </div>
                <p className="text-2xl font-semibold">
                  {usage.warehouses}
                  {usage.limits.warehouses > 0 && (
                    <span className="text-sm text-muted-foreground ml-1">/ {usage.limits.warehouses}</span>
                  )}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Orders</span>
                </div>
                <p className="text-2xl font-semibold">
                  {usage.orders}
                  {usage.limits.orders > 0 && (
                    <span className="text-sm text-muted-foreground ml-1">/ {usage.limits.orders}</span>
                  )}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Available Plans */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrent = plan.name.toLowerCase() === organization.subscriptionTier;
              return (
                <Card 
                  key={plan.name} 
                  className={`p-6 ${isCurrent ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      <p className="text-3xl font-bold mt-2">
                        ${plan.price}
                        <span className="text-sm text-muted-foreground font-normal">/month</span>
                      </p>
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isOwner && (
                      <Button 
                        variant={isCurrent ? 'secondary' : 'default'}
                        className="w-full"
                        disabled={isCurrent}
                        onClick={() => handleUpgrade(plan.name)}
                      >
                        {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Billing History */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Billing History</h2>
            <Button variant="outline" size="sm" onClick={handleDownloadInvoice}>
              <Download className="h-4 w-4 mr-2" />
              Download All
            </Button>
          </div>
          
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Invoice #{2024000 + i}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">${currentPlan.price}</span>
                  <Button variant="ghost" size="sm" onClick={handleDownloadInvoice}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Contact Sales */}
        <Card className="p-6 bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Need a custom plan?</h3>
              <p className="text-muted-foreground">
                Contact our sales team for enterprise pricing and custom features
              </p>
            </div>
            <Button variant="outline">
              Contact Sales
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    </ProtectedRoute>
  );
}