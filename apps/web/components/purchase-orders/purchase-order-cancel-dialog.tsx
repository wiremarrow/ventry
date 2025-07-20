'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ban } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ventry/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@ventry/ui/form';
import { Textarea } from '@ventry/ui/textarea';
import { Button } from '@ventry/ui/button';
import { toast } from 'sonner';

import { trpc } from '@/lib/trpc';

const formSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PurchaseOrderCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
}

export function PurchaseOrderCancelDialog({
  open,
  onOpenChange,
  purchaseOrderId,
}: PurchaseOrderCancelDialogProps) {
  const utils = trpc.useUtils();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
      notes: '',
    },
  });

  const cancelMutation = trpc.purchaseOrders.cancel.useMutation({
    onSuccess: () => {
      toast.success('Purchase order cancelled');
      utils.purchaseOrders.get.invalidate({ id: purchaseOrderId });
      utils.purchaseOrders.list.invalidate();
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: FormData) => {
    cancelMutation.mutate({
      id: purchaseOrderId,
      reason: data.reason,
      notes: data.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Purchase Order</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The purchase order will be permanently cancelled.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cancellation Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a reason for cancellation..."
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
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Keep Order
              </Button>
              <Button
                type="submit"
                disabled={cancelMutation.isPending}
                variant="destructive"
              >
                <Ban className="mr-2 h-4 w-4" />
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}