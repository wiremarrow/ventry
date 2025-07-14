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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@ventry/ui';
import { Input } from '@ventry/ui';
import { Button } from '@ventry/ui';
import { Textarea } from '@ventry/ui';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const updateWarehouseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  line1: z.string().min(1, 'Address is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type UpdateWarehouseFormData = z.infer<typeof updateWarehouseSchema>;

interface WarehouseData {
  id: string;
  code: string;
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone?: string | null;
  notes?: string | null;
}

interface EditWarehouseDialogProps {
  warehouse: WarehouseData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditWarehouseDialog({ warehouse, open, onOpenChange }: EditWarehouseDialogProps) {
  const utils = trpc.useUtils();

  const updateMutation = trpc.warehouses.update.useMutation({
    onSuccess: () => {
      toast.success('Warehouse updated successfully');
      utils.warehouses.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<UpdateWarehouseFormData>({
    resolver: zodResolver(updateWarehouseSchema),
  });

  // Reset form when warehouse changes
  useEffect(() => {
    if (warehouse) {
      form.reset({
        name: warehouse.name,
        line1: warehouse.line1,
        line2: warehouse.line2 || '',
        city: warehouse.city,
        state: warehouse.state,
        country: warehouse.country,
        postalCode: warehouse.postalCode,
        phone: warehouse.phone || '',
        notes: warehouse.notes || '',
      });
    }
  }, [warehouse, form]);

  const onSubmit = (data: UpdateWarehouseFormData) => {
    if (!warehouse) return;

    updateMutation.mutate({
      id: warehouse.id,
      ...data,
    });
  };

  if (!warehouse) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Warehouse</DialogTitle>
          <DialogDescription>
            Update warehouse information and settings
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Warehouse Code</p>
              <p className="text-sm text-gray-600">{warehouse.code}</p>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Main Distribution Center" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter warehouse notes..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium">Location Details</h4>
              
              <FormField
                control={form.control}
                name="line1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1 *</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="line2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Suite 100, Floor 2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State/Province *</FormLabel>
                      <FormControl>
                        <Input placeholder="NY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country *</FormLabel>
                      <FormControl>
                        <Input placeholder="USA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium">Contact Information</h4>
              
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Warehouse'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}