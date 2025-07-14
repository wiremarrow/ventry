'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ventry/ui';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@ventry/ui';
import { Input } from '@ventry/ui';
import { Button } from '@ventry/ui';
import { Textarea } from '@ventry/ui';
import { Switch } from '@ventry/ui';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const updateLocationSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  description: z.string().optional(),
  zone: z.string().optional(),
  aisle: z.string().optional(),
  shelf: z.string().optional(),
  bin: z.string().optional(),
  maxCapacity: z.number().int().min(0).optional(),
  isTempControlled: z.boolean().default(false),
});

type UpdateLocationFormData = z.infer<typeof updateLocationSchema>;

interface LocationData {
  id: string;
  code: string;
  description?: string | null;
  zone?: string | null;
  aisle?: string | null;
  shelf?: string | null;
  bin?: string | null;
  maxCapacity?: number | null;
  isTempControlled: boolean;
}

interface EditLocationDialogProps {
  location: LocationData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLocationDialog({ 
  location, 
  open, 
  onOpenChange 
}: EditLocationDialogProps) {
  const utils = trpc.useUtils();

  const updateMutation = trpc.warehouses.locations.update.useMutation({
    onSuccess: () => {
      toast.success('Location updated successfully');
      utils.warehouses.get.invalidate();
      utils.warehouses.getStats.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<UpdateLocationFormData>({
    resolver: zodResolver(updateLocationSchema),
  });

  // Reset form when location changes
  useEffect(() => {
    if (location) {
      form.reset({
        code: location.code,
        description: location.description || '',
        zone: location.zone || '',
        aisle: location.aisle || '',
        shelf: location.shelf || '',
        bin: location.bin || '',
        maxCapacity: location.maxCapacity || undefined,
        isTempControlled: location.isTempControlled,
      });
    }
  }, [location, form]);

  const onSubmit = (data: UpdateLocationFormData) => {
    if (!location) return;

    updateMutation.mutate({
      id: location.id,
      ...data,
    });
  };

  if (!location) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription>
            Update location information and settings
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Code *</FormLabel>
                  <FormControl>
                    <Input placeholder="A1-01-001" {...field} />
                  </FormControl>
                  <FormDescription>
                    Unique identifier for this location
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter location description..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zone</FormLabel>
                    <FormControl>
                      <Input placeholder="A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aisle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aisle</FormLabel>
                    <FormControl>
                      <Input placeholder="01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shelf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shelf</FormLabel>
                    <FormControl>
                      <Input placeholder="A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bin</FormLabel>
                    <FormControl>
                      <Input placeholder="001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="maxCapacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum Capacity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="100"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum number of items this location can hold
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isTempControlled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Temperature Controlled</FormLabel>
                    <FormDescription>
                      Location requires specific temperature conditions
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Location'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}