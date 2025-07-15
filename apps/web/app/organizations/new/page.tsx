'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Input, Label, Button } from '@ventry/ui';
import { 
  Building2, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/use-organization';
import { ProtectedRoute } from '@/components/auth/protected-route';

const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
});

type CreateOrganizationData = z.infer<typeof createOrganizationSchema>;

export default function NewOrganizationPage() {
  const router = useRouter();
  const { setOrganization } = useOrganization();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateOrganizationData>({
    resolver: zodResolver(createOrganizationSchema),
  });

  const createMutation = trpc.organizations.create.useMutation({
    onSuccess: async (data) => {
      toast({
        title: 'Success',
        description: 'Organization created successfully',
      });
      // Set the new organization as active
      await setOrganization(data.id);
      // Redirect to dashboard
      router.push('/dashboard');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create organization',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CreateOrganizationData) => {
    createMutation.mutate(data);
  };

  // Auto-generate slug from name
  const _name = watch('name');
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    register('name').onChange(e);
    
    // Generate slug from name
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    setValue('slug', slug);
  };

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Create New Organization</h1>
          <p className="text-muted-foreground">
            Set up a new organization to manage your inventory
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  placeholder="Acme Corporation"
                  {...register('name')}
                  onChange={handleNameChange}
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="slug">Organization Slug</Label>
                <Input
                  id="slug"
                  placeholder="acme-corp"
                  {...register('slug')}
                  className="mt-1"
                />
                {errors.slug && (
                  <p className="text-sm text-destructive mt-1">{errors.slug.message}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  This will be used in URLs and cannot be changed later
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-medium">What's included</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Multi-warehouse inventory management
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Purchase orders and sales tracking
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Real-time stock updates and alerts
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Team collaboration with role-based access
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Comprehensive reporting and analytics
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                <Building2 className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </ProtectedRoute>
  );
}