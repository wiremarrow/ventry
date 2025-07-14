'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, Input, Label, Button, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ventry/ui';
import { 
  ArrowLeft, 
  Plus, 
  Trash,
  Save,
  Send,
  Calendar
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>;

interface OrderItem {
  itemId: string;
  description: string;
  qtyOrdered: number;
  unitCost: number;
  taxRate: number;
  totalCost: number;
}

export default function CreatePurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get('duplicate');

  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
  });

  // Fetch suppliers
  const { data: suppliers } = trpc.suppliers.list.useQuery({ limit: 100 });
  
  // Fetch items
  const { data: itemsList } = trpc.items.list.useQuery({ limit: 500 });

  // Fetch PO to duplicate if duplicateId is provided
  const { data: duplicatePO } = trpc.purchaseOrders.get.useQuery(
    { id: duplicateId! },
    { enabled: !!duplicateId }
  );

  // Load duplicate data
  useEffect(() => {
    if (duplicatePO) {
      setValue('supplierId', duplicatePO.supplierId);
      setValue('notes', duplicatePO.notes || '');
      
      const duplicateItems: OrderItem[] = duplicatePO.items.map(item => ({
        itemId: item.itemId,
        description: item.description || item.item.name,
        qtyOrdered: item.qtyOrdered,
        unitCost: parseFloat(item.unitCost.toString()),
        taxRate: parseFloat(item.taxRate.toString()),
        totalCost: parseFloat(item.totalCost.toString()),
      }));
      setItems(duplicateItems);
    }
  }, [duplicatePO, setValue]);

  // Create purchase order mutation
  const createMutation = trpc.purchaseOrders.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: 'Purchase order created successfully',
      });
      router.push(`/purchase-orders/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create purchase order',
        variant: 'destructive',
      });
    },
  });

  // Submit for approval mutation
  const submitMutation = trpc.purchaseOrders.submit.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: 'Purchase order submitted for approval',
      });
      router.push(`/purchase-orders/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit purchase order',
        variant: 'destructive',
      });
    },
  });

  const addItem = () => {
    const item = itemsList?.find(i => i.id === selectedItemId);
    if (!item) return;

    const unitCost = parseFloat(item.defaultCost?.toString() || '0');
    const qtyOrdered = 1;
    const taxRate = 0;
    const totalCost = unitCost * qtyOrdered * (1 + taxRate / 100);

    const newItem: OrderItem = {
      itemId: item.id,
      description: item.name,
      qtyOrdered,
      unitCost,
      taxRate,
      totalCost,
    };

    setItems([...items, newItem]);
    setSelectedItemId('');
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate total cost
    if (field === 'qtyOrdered' || field === 'unitCost' || field === 'taxRate') {
      const item = updated[index];
      item.totalCost = item.qtyOrdered * item.unitCost * (1 + item.taxRate / 100);
    }

    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.unitCost * item.qtyOrdered), 0);
    const tax = items.reduce((sum, item) => sum + (item.unitCost * item.qtyOrdered * item.taxRate / 100), 0);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const onSubmit = async (data: PurchaseOrderFormData, submitForApproval = false) => {
    if (items.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one item',
        variant: 'destructive',
      });
      return;
    }

    const totals = calculateTotals();
    const purchaseOrderData = {
      ...data,
      items: items.map(item => ({
        itemId: item.itemId,
        description: item.description,
        qtyOrdered: item.qtyOrdered,
        unitCost: item.unitCost,
        taxRate: item.taxRate,
        totalCost: item.totalCost,
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
    };

    if (submitForApproval) {
      // Create and immediately submit
      const result = await createMutation.mutateAsync(purchaseOrderData);
      if (result) {
        submitMutation.mutate({ id: result.id });
      }
    } else {
      createMutation.mutate(purchaseOrderData);
    }
  };

  const totals = calculateTotals();
  const isLoading = createMutation.isLoading || submitMutation.isLoading;

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/purchase-orders')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {duplicateId ? 'Duplicate Purchase Order' : 'Create Purchase Order'}
              </h1>
              <p className="text-muted-foreground">
                Create a new order for supplier deliveries
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit((data) => onSubmit(data, false))}>
          {/* Order Details */}
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Order Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplierId">Supplier *</Label>
                <Select
                  value={watch('supplierId')}
                  onValueChange={(value) => setValue('supplierId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name} ({supplier.supplierCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.supplierId && (
                  <p className="text-sm text-destructive mt-1">{errors.supplierId.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="expectedDate">Expected Delivery Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="expectedDate"
                    type="date"
                    {...register('expectedDate')}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  {...register('notes')}
                  rows={3}
                  placeholder="Additional notes or instructions..."
                />
              </div>
            </div>
          </Card>

          {/* Line Items */}
          <Card className="p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Line Items</h2>
              <div className="flex items-center gap-2">
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select an item to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {itemsList?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.sku} - {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  type="button" 
                  onClick={addItem}
                  disabled={!selectedItemId}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Tax %</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-muted-foreground">
                        No items added yet. Select an item above to add it to the order.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {itemsList?.find(i => i.id === item.itemId)?.sku}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="min-w-[200px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.qtyOrdered}
                          onChange={(e) => updateItem(index, 'qtyOrdered', parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.taxRate}
                          onChange={(e) => updateItem(index, 'taxRate', parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>{formatCurrency(item.totalCost)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Totals */}
          <Card className="p-6 mb-6">
            <div className="flex justify-end">
              <div className="space-y-2 w-64">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span className="font-medium">{formatCurrency(totals.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="submit"
              variant="outline"
              disabled={isLoading}
            >
              <Save className="h-4 w-4 mr-2" />
              Save as Draft
            </Button>
            <Button
              type="button"
              onClick={handleSubmit((data) => onSubmit(data, true))}
              disabled={isLoading}
            >
              <Send className="h-4 w-4 mr-2" />
              Submit for Approval
            </Button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
}