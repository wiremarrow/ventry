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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ventry/ui';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const updateOrderSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  shippingAddress: z.string().min(1, 'Shipping address is required'),
  billingAddress: z.string().min(1, 'Billing address is required'),
  notes: z.string().optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'PARTIAL', 'REFUNDED']),
  paymentMethod: z.string().optional(),
});

type UpdateOrderFormData = z.infer<typeof updateOrderSchema>;

interface EditOrderDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditOrderDialog({ order, open, onOpenChange }: EditOrderDialogProps) {
  const utils = trpc.useUtils();

  const updateMutation = trpc.orders.update.useMutation({
    onSuccess: () => {
      toast.success('Order updated successfully');
      utils.orders.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<UpdateOrderFormData>({
    resolver: zodResolver(updateOrderSchema),
  });

  // Reset form when order changes
  useEffect(() => {
    if (order) {
      form.reset({
        status: order.status,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        notes: order.notes || '',
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod || '',
      });
    }
  }, [order, form]);

  const onSubmit = (data: UpdateOrderFormData) => {
    if (!order) return;

    updateMutation.mutate({
      id: order.id,
      ...data,
    });
  };

  if (!order) return null;

  const canEditStatus = ['DRAFT', 'PENDING', 'CONFIRMED'].includes(order.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Update order information and status
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!canEditStatus}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                        <SelectItem value="PROCESSING">Processing</SelectItem>
                        <SelectItem value="PACKED">Packed</SelectItem>
                        <SelectItem value="SHIPPED">Shipped</SelectItem>
                        <SelectItem value="DELIVERED">Delivered</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        <SelectItem value="REFUNDED">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                    {!canEditStatus && (
                      <FormDescription>
                        Status can only be changed for Draft, Pending, or Confirmed orders
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="PAID">Paid</SelectItem>
                        <SelectItem value="PARTIAL">Partial</SelectItem>
                        <SelectItem value="REFUNDED">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Not specified</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                      <SelectItem value="DEBIT_CARD">Debit Card</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="CHECK">Check</SelectItem>
                      <SelectItem value="PAYPAL">PayPal</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shippingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shipping Address *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter shipping address..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Address *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter billing address..."
                      {...field}
                    />
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
                      placeholder="Add any order notes..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> You cannot edit order items after creation. 
                To modify items, cancel this order and create a new one.
              </p>
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
                {updateMutation.isPending ? 'Updating...' : 'Update Order'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}