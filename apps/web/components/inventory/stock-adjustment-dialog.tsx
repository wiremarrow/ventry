'use client';

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@ventry/ui';

import { trpc } from '@/lib/trpc';

import type { Inventory, Item, Location, Lot, Warehouse } from '@ventry/database';

const adjustmentSchema = z.object({
  type: z.enum(['ADD', 'REMOVE', 'SET']),
  quantity: z.number().positive('Quantity must be positive'),
  adjustmentType: z.enum(['COUNT', 'DAMAGE', 'LOSS', 'FOUND', 'CORRECTION']),
  reason: z.string().min(1, 'Please provide a reason for this adjustment'),
  notes: z.string().optional(),
});

type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

type InventoryWithRelations = Inventory & {
  item: Item;
  location: Location & {
    warehouse: Warehouse;
  };
  lot: Lot | null;
  qtyAvailable: number;
  lowStock: boolean;
  expiring: boolean;
};

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: InventoryWithRelations | null;
  onSuccess: () => void;
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  inventory,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const utils = trpc.useUtils();
  const adjustMutation = trpc.inventory.adjust.useMutation({
    onSuccess: () => {
      toast.success('Stock adjusted successfully');
      utils.inventory.list.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      type: 'ADD',
      quantity: 0,
      adjustmentType: 'CORRECTION',
      reason: '',
      notes: '',
    },
  });

  const onSubmit = (data: AdjustmentFormData) => {
    if (!inventory) return;

    let adjustedQuantity = data.quantity;
    
    if (data.type === 'REMOVE') {
      adjustedQuantity = -data.quantity;
    } else if (data.type === 'SET') {
      adjustedQuantity = data.quantity - inventory.qtyOnHand;
    }

    adjustMutation.mutate({
      inventoryId: inventory.id,
      qty: adjustedQuantity,
      adjustmentType: data.adjustmentType,
      reason: data.reason,
      notes: data.notes,
    });
  };

  if (!inventory) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Make adjustments to inventory levels for this item
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start gap-3">
            <Package className="h-10 w-10 text-gray-400 mt-1" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">{inventory.item.name}</p>
              <p className="text-sm text-gray-600">SKU: {inventory.item.sku}</p>
              <div className="mt-2 flex gap-4 text-sm">
                <span>
                  <span className="text-gray-600">Location:</span>{' '}
                  <span className="font-medium">
                    {inventory.location.warehouse.name} - {inventory.location.code}
                  </span>
                </span>
                <span>
                  <span className="text-gray-600">Current:</span>{' '}
                  <span className="font-medium">{inventory.qtyOnHand}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adjustment Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ADD" id="add" />
                        <Label htmlFor="add">Add</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="REMOVE" id="remove" />
                        <Label htmlFor="remove">Remove</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="SET" id="set" />
                        <Label htmlFor="set">Set to</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    {form.watch('type') === 'ADD' && 'Amount to add to current stock'}
                    {form.watch('type') === 'REMOVE' && 'Amount to remove from current stock'}
                    {form.watch('type') === 'SET' && 'New total quantity'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adjustmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adjustment Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select adjustment type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="COUNT">Physical Count</SelectItem>
                      <SelectItem value="DAMAGE">Damage</SelectItem>
                      <SelectItem value="LOSS">Loss</SelectItem>
                      <SelectItem value="FOUND">Found</SelectItem>
                      <SelectItem value="CORRECTION">Correction</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Provide a reason for this adjustment..."
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
                      placeholder="Provide details about this adjustment..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
              <Button type="submit" disabled={adjustMutation.isPending}>
                {adjustMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}