'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
  Button,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
  Calendar,
} from '@ventry/ui';
import { toast } from 'sonner';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  expectedDate: z.date().optional(),
  paymentTerms: z.string().optional(),
  shippingTerms: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        qtyOrdered: z.number().int().positive('Quantity must be positive'),
        unitCost: z.number().min(0, 'Unit cost must be non-negative'),
        taxRate: z.number().min(0).max(100).default(0),
        notes: z.string().optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

type FormData = z.infer<typeof formSchema>;

interface CreatePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SelectedItem {
  itemId: string;
  sku: string;
  name: string;
  qtyOrdered: number;
  unitCost: number;
  taxRate: number;
  notes?: string;
}

export function CreatePurchaseOrderDialog({
  open,
  onOpenChange,
}: CreatePurchaseOrderDialogProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemSearch, setShowItemSearch] = useState(false);
  
  const utils = trpc.useUtils();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplierId: '',
      items: [],
    },
  });

  // Fetch suppliers
  const { data: suppliers } = trpc.suppliers.list.useQuery({
    limit: 100,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  // Fetch items for search
  const { data: items } = trpc.items.list.useQuery({
    search: itemSearch,
    limit: 20,
    isActive: true,
  });

  const createMutation = trpc.purchaseOrders.create.useMutation({
    onSuccess: () => {
      toast.success('Purchase order created');
      utils.purchaseOrders.list.invalidate();
      onOpenChange(false);
      form.reset();
      setSelectedItems([]);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: FormData) => {
    const itemsData = selectedItems.map((item) => ({
      itemId: item.itemId,
      qtyOrdered: item.qtyOrdered,
      unitCost: item.unitCost,
      taxRate: item.taxRate,
      notes: item.notes,
    }));

    createMutation.mutate({
      ...data,
      items: itemsData,
    });
  };

  type ItemType = { id: string; sku: string; name: string; unitCost?: number };
  const handleAddItem = (item: ItemType) => {
    const exists = selectedItems.find((i) => i.itemId === item.id);
    if (!exists) {
      setSelectedItems([
        ...selectedItems,
        {
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          qtyOrdered: 1,
          unitCost: item.unitCost || 0,
          taxRate: 0,
          notes: '',
        },
      ]);
    }
    setShowItemSearch(false);
    setItemSearch('');
  };

  const handleUpdateItem = (index: number, field: keyof SelectedItem, value: string | number) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;

    selectedItems.forEach((item) => {
      const lineTotal = item.qtyOrdered * item.unitCost;
      const taxAmount = lineTotal * (item.taxRate / 100);
      subtotal += lineTotal;
      totalTax += taxAmount;
    });

    return {
      subtotal,
      tax: totalTax,
      total: subtotal + totalTax,
    };
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers?.suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name} ({supplier.supplierCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expectedDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expected Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date()
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Input placeholder="Net 30" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shippingTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Terms</FormLabel>
                    <FormControl>
                      <Input placeholder="FOB Origin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowItemSearch(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {showItemSearch && (
                <div className="rounded-lg border p-4">
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {items && items.items.length > 0 && (
                      <div className="max-h-48 overflow-y-auto">
                        {items.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleAddItem(item)}
                          >
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-gray-500">
                                {item.sku} • {item.category?.name}
                              </div>
                            </div>
                            <Button type="button" size="sm">
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedItems.length > 0 ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-[100px]">Qty</TableHead>
                        <TableHead className="w-[120px]">Unit Cost</TableHead>
                        <TableHead className="w-[100px]">Tax %</TableHead>
                        <TableHead className="w-[120px] text-right">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item, index) => {
                        const lineTotal = item.qtyOrdered * item.unitCost;
                        const taxAmount = lineTotal * (item.taxRate / 100);
                        const total = lineTotal + taxAmount;

                        return (
                          <TableRow key={item.itemId}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-gray-500">
                                  {item.sku}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.qtyOrdered}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    index,
                                    'qtyOrdered',
                                    parseInt(e.target.value) || 1
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitCost}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    index,
                                    'unitCost',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.taxRate}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    index,
                                    'taxRate',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${total.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-gray-500">
                    No items added. Click "Add Item" to start.
                  </p>
                </div>
              )}

              {selectedItems.length > 0 && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span className="font-medium">${totals.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-medium">
                      <span>Total:</span>
                      <span>${totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || selectedItems.length === 0}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Purchase Order'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}