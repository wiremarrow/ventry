'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Plus, Trash2 } from 'lucide-react';

const orderItemSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  discount: z.number().min(0).max(100).default(0),
});

const createOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  orderDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  status: z.enum(['DRAFT', 'PENDING']).default('PENDING'),
  shippingAddress: z.string().min(1, 'Shipping address is required'),
  billingAddress: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
});

type CreateOrderFormData = z.infer<typeof createOrderSchema>;

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrderDialog({ open, onOpenChange }: CreateOrderDialogProps) {
  const utils = trpc.useUtils();
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);

  // Fetch data for dropdowns
  const { data: customers } = trpc.customers.list.useQuery({
    page: 1,
    limit: 100,
    status: 'ACTIVE',
  });

  const { data: items } = trpc.items.list.useQuery({
    page: 1,
    limit: 100,
    status: 'ACTIVE',
  });

  const { data: warehouses } = trpc.warehouses.list.useQuery({
    page: 1,
    limit: 100,
    status: 'ACTIVE',
  });

  const createMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success('Order created successfully');
      utils.orders.list.invalidate();
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerId: '',
      orderDate: new Date().toISOString().split('T')[0],
      status: 'PENDING',
      shippingAddress: '',
      billingAddress: '',
      notes: '',
      items: [{ itemId: '', warehouseId: '', quantity: 1, unitPrice: 0, discount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const onSubmit = (data: CreateOrderFormData) => {
    createMutation.mutate({
      ...data,
      billingAddress: billingSameAsShipping ? data.shippingAddress : data.billingAddress,
    });
  };

  const handleItemChange = (index: number, itemId: string) => {
    const item = items?.items.find(i => i.id === itemId);
    if (item && item.defaultPrice) {
      form.setValue(`items.${index}.unitPrice`, item.defaultPrice);
    }
  };

  const calculateSubtotal = () => {
    const items = form.watch('items');
    return items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const discount = lineTotal * (item.discount / 100);
      return sum + (lineTotal - discount);
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
          <DialogDescription>
            Create a new sales order for a customer
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} ({customer.email})
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
                name="orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="billingSame"
                  checked={billingSameAsShipping}
                  onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="billingSame" className="text-sm">
                  Billing address same as shipping
                </label>
              </div>

              {!billingSameAsShipping && (
                <FormField
                  control={form.control}
                  name="billingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Address</FormLabel>
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
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Order Items</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ itemId: '', warehouseId: '', quantity: 1, unitPrice: 0, discount: 0 })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemId`}
                      render={({ field }) => (
                        <FormItem>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleItemChange(index, value);
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {items?.items.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} ({item.sku})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.warehouseId`}
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Warehouse" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {warehouses?.warehouses.map((warehouse) => (
                                <SelectItem key={warehouse.id} value={warehouse.id}>
                                  {warehouse.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-1">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Price"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-1">
                    <FormField
                      control={form.control}
                      name={`items.${index}.discount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="%"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end pt-4 border-t">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Subtotal</p>
                  <p className="text-xl font-bold">
                    ${calculateSubtotal().toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

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

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Draft orders can be edited freely, pending orders will be processed
                  </FormDescription>
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Order'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}