'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Button,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  Badge,
  Alert,
  AlertDescription,
} from '@ventry/ui';
import { FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

const receiptItemSchema = z.object({
  poItemId: z.string(),
  quantityReceived: z.number().min(0, 'Quantity must be positive'),
  notes: z.string().optional(),
});

const createReceiptSchema = z.object({
  poId: z.string().min(1, 'Purchase order is required'),
  notes: z.string().optional(),
  items: z.array(receiptItemSchema).min(1, 'At least one item must be received'),
});

type CreateReceiptFormData = z.infer<typeof createReceiptSchema>;

interface CreateReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateReceiptDialog({ open, onOpenChange, onSuccess }: CreateReceiptDialogProps) {
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  const form = useForm<CreateReceiptFormData>({
    resolver: zodResolver(createReceiptSchema),
    defaultValues: {
      poId: '',
      notes: '',
      items: [],
    },
  });

  // Fetch approved POs that can receive items
  const { data: purchaseOrders, isLoading: posLoading } = trpc.purchaseOrders.list.useQuery({
    status: 'APPROVED',
    limit: 100,
  });

  // Fetch selected PO details
  const { data: selectedPo } = trpc.purchaseOrders.get.useQuery(
    { id: selectedPoId! },
    { enabled: !!selectedPoId }
  );

  // Create receipt mutation
  const createMutation = trpc.receipts.create.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Receipt created successfully',
      });
      onSuccess?.();
      form.reset();
      setSelectedPoId(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create receipt',
        variant: 'destructive',
      });
    },
  });

  // Update form items when PO is selected
  useEffect(() => {
    if (selectedPo) {
      const items = selectedPo.items.map((item) => ({
        poItemId: item.id,
        quantityReceived: item.qtyOrdered - item.qtyReceived,
        notes: '',
      }));
      form.setValue('items', items);
    }
  }, [selectedPo, form]);

  const onSubmit = (data: CreateReceiptFormData) => {
    // Filter out items with 0 quantity
    const itemsToReceive = data.items
      .filter((item) => item.quantityReceived > 0)
      .map((item) => ({
        poItemId: item.poItemId,
        itemId: selectedPo?.items.find((i) => i.id === item.poItemId)?.itemId || '',
        qtyReceived: item.quantityReceived,
        locationId: '', // TODO: Add location selection
        notes: item.notes,
      }));

    if (itemsToReceive.length === 0) {
      toast({
        title: 'Error',
        description: 'Please enter quantity for at least one item',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({
      purchaseOrderId: data.poId,
      notes: data.notes,
      items: itemsToReceive,
    });
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const items = form.getValues('items');
    items[index].quantityReceived = quantity;
    form.setValue('items', items);
  };

  const updateItemNotes = (index: number, notes: string) => {
    const items = form.getValues('items');
    items[index].notes = notes;
    form.setValue('items', items);
  };

  const availablePOs =
    purchaseOrders?.purchaseOrders?.filter(
      (po) => po.status === 'APPROVED' || po.status === 'PARTIAL'
    ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Receipt</DialogTitle>
          <DialogDescription>Receive items from an approved purchase order</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* PO Selection */}
            <FormField
              control={form.control}
              name="poId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Order</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedPoId(value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a purchase order to receive" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {posLoading ? (
                        <div className="p-2">
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : availablePOs.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No approved purchase orders available
                        </div>
                      ) : (
                        availablePOs.map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span>{po.poNumber}</span>
                                <span className="text-muted-foreground">-</span>
                                <span>{po.supplier.name}</span>
                              </div>
                              <Badge variant={po.status === 'PARTIAL' ? 'secondary' : 'default'}>
                                {po.status}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select an approved or partially received purchase order
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Selected PO Details */}
            {selectedPo && (
              <>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedPo.supplier.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Order Date: {formatDate(selectedPo.orderDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Expected Date</p>
                      <p className="font-medium">
                        {selectedPo.expectedDate
                          ? formatDate(selectedPo.expectedDate)
                          : 'Not specified'}
                      </p>
                    </div>
                  </div>
                  {selectedPo.notes && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>PO Notes: {selectedPo.notes}</AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Items to Receive */}
                <div className="space-y-2">
                  <FormLabel>Items to Receive</FormLabel>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Already Received</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                          <TableHead className="text-right">Receive Qty</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPo.items.map((poItem, index) => {
                          const remaining = poItem.qtyOrdered - poItem.qtyReceived;
                          const formItem = form.watch(`items.${index}`);

                          return (
                            <TableRow key={poItem.id}>
                              <TableCell className="font-medium">{poItem.item.name}</TableCell>
                              <TableCell>{poItem.item.sku}</TableCell>
                              <TableCell className="text-right">{poItem.qtyOrdered}</TableCell>
                              <TableCell className="text-right">
                                {poItem.qtyReceived > 0 && (
                                  <span className="text-green-600">{poItem.qtyReceived}</span>
                                )}
                                {poItem.qtyReceived === 0 && '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">{remaining}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  value={formItem?.quantityReceived || 0}
                                  onChange={(e) =>
                                    updateItemQuantity(index, parseInt(e.target.value) || 0)
                                  }
                                  className="w-24 text-right"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  placeholder="Optional notes"
                                  value={formItem?.notes || ''}
                                  onChange={(e) => updateItemNotes(index, e.target.value)}
                                  className="w-40"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {/* Receipt Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add any notes about this receipt..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                  setSelectedPoId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !selectedPoId}>
                {createMutation.isPending ? (
                  'Creating...'
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create Receipt
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
