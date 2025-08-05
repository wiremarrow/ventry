'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, XCircle } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Textarea,
} from '@ventry/ui';
import { toast } from 'sonner';

import { trpc } from '@/lib/trpc';

const approveSchema = z.object({
  notes: z.string().optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

type ApproveFormData = z.infer<typeof approveSchema>;
type RejectFormData = z.infer<typeof rejectSchema>;

interface PurchaseOrderApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  action: 'approve' | 'reject';
}

export function PurchaseOrderApprovalDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  action,
}: PurchaseOrderApprovalDialogProps) {
  const utils = trpc.useUtils();

  const approveForm = useForm<ApproveFormData>({
    resolver: zodResolver(approveSchema),
    defaultValues: {
      notes: '',
    },
  });

  const rejectForm = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
    defaultValues: {
      reason: '',
      notes: '',
    },
  });

  const approveMutation = trpc.purchaseOrders.approve.useMutation({
    onSuccess: () => {
      toast.success('Purchase order approved');
      utils.purchaseOrders.get.invalidate({ id: purchaseOrderId });
      utils.purchaseOrders.list.invalidate();
      onOpenChange(false);
      approveForm.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = trpc.purchaseOrders.reject.useMutation({
    onSuccess: () => {
      toast.success('Purchase order rejected');
      utils.purchaseOrders.get.invalidate({ id: purchaseOrderId });
      utils.purchaseOrders.list.invalidate();
      onOpenChange(false);
      rejectForm.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleApprove = (data: ApproveFormData) => {
    approveMutation.mutate({
      poId: purchaseOrderId,
      action: 'APPROVE',
      notes: data.notes,
    });
  };

  const handleReject = (data: RejectFormData) => {
    rejectMutation.mutate({
      id: purchaseOrderId,
      reason: data.reason,
      notes: data.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action === 'approve' ? 'Approve' : 'Reject'} Purchase Order</DialogTitle>
          <DialogDescription>
            {action === 'approve'
              ? 'Approve this purchase order to allow receiving items.'
              : 'Reject this purchase order and return it to draft status.'}
          </DialogDescription>
        </DialogHeader>

        {action === 'approve' ? (
          <Form {...approveForm}>
            <form onSubmit={approveForm.handleSubmit(handleApprove)} className="space-y-4">
              <FormField
                control={approveForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add any approval notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={approveMutation.isPending}
                  className="text-green-600"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {approveMutation.isPending ? 'Approving...' : 'Approve Order'}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Form {...rejectForm}>
            <form onSubmit={rejectForm.handleSubmit(handleReject)} className="space-y-4">
              <FormField
                control={rejectForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Rejection</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Provide a reason for rejection..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={rejectForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add any additional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={rejectMutation.isPending} variant="destructive">
                  <XCircle className="mr-2 h-4 w-4" />
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject Order'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
