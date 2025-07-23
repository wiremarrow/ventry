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
} from '@ventry/ui';
import { Package, Truck, CheckCircle2, MapPin } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';

const shipmentItemSchema = z.object({
  orderItemId: z.string(),
  itemId: z.string(),
  qtyShipped: z.number().min(0, 'Quantity must be positive'),
});

const createShipmentSchema = z.object({
  orderId: z.string().min(1, 'Order is required'),
  locationId: z.string().min(1, 'Ship from location is required'),
  carrierId: z.string().optional(),
  carrierService: z.string().optional(),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(shipmentItemSchema).min(1, 'At least one item must be shipped'),
});

type CreateShipmentFormData = z.infer<typeof createShipmentSchema>;

interface CreateShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateShipmentDialog({ 
  open, 
  onOpenChange,
  onSuccess 
}: CreateShipmentDialogProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  
  const form = useForm<CreateShipmentFormData>({
    resolver: zodResolver(createShipmentSchema),
    defaultValues: {
      orderId: '',
      locationId: '',
      carrierId: '',
      carrierService: '',
      trackingNumber: '',
      notes: '',
      items: [],
    },
  });

  // Fetch orders ready to ship
  const { data: orders, isLoading: ordersLoading } = trpc.orders.list.useQuery({
    status: 'CONFIRMED',
    limit: 100,
  });

  // Fetch selected order details
  const { data: selectedOrder } = trpc.orders.get.useQuery(
    { id: selectedOrderId! },
    { enabled: !!selectedOrderId }
  );

  // Fetch warehouses
  const { data: warehousesData, isLoading: warehousesLoading } = trpc.warehouses.list.useQuery({});

  // Fetch carriers (using suppliers as carriers for now)
  const { data: carriers } = trpc.suppliers.list.useQuery({
    limit: 100,
  });

  // Create shipment mutation
  const createMutation = trpc.shipments.create.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Shipment created successfully',
      });
      onSuccess?.();
      form.reset();
      setSelectedOrderId(null);
      setSelectedLocationId(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create shipment',
        variant: 'destructive',
      });
    },
  });

  // Update form items when order is selected
  useEffect(() => {
    if (selectedOrder) {
      const items = selectedOrder.items.map(item => ({
        orderItemId: item.id,
        itemId: item.itemId,
        qtyShipped: item.qtyOrdered - item.qtyShipped,
      }));
      form.setValue('items', items);
    }
  }, [selectedOrder, form]);

  const onSubmit = (data: CreateShipmentFormData) => {
    // Filter out items with 0 quantity
    const itemsToShip = data.items.filter(item => item.qtyShipped > 0);
    
    if (itemsToShip.length === 0) {
      toast({
        title: 'Error',
        description: 'Please enter quantity for at least one item',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({
      orderId: data.orderId,
      locationId: data.locationId,
      carrierId: data.carrierId || undefined,
      carrierService: data.carrierService || undefined,
      trackingNumber: data.trackingNumber || undefined,
      notes: data.notes || undefined,
      items: itemsToShip,
    });
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const items = form.getValues('items');
    items[index].qtyShipped = quantity;
    form.setValue('items', items);
  };

  const availableOrders = orders?.orders?.filter(
    order => ['CONFIRMED', 'PICKING', 'PACKED'].includes(order.status)
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Shipment</DialogTitle>
          <DialogDescription>
            Ship items from a confirmed order
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Order Selection */}
            <FormField
              control={form.control}
              name="orderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order</FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedOrderId(value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an order to ship" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ordersLoading ? (
                        <div className="p-2">
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : availableOrders.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No orders ready to ship
                        </div>
                      ) : (
                        availableOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span>{order.orderNumber}</span>
                                <span className="text-muted-foreground">-</span>
                                <span>{order.customer.companyName || order.customer.email || 'Unknown'}</span>
                              </div>
                              <Badge>{order.status}</Badge>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select a confirmed order that is ready to ship
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location Selection */}
            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ship From Location</FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedLocationId(value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shipping location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehousesLoading ? (
                        <div className="p-2">
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : !warehousesData?.length ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No warehouses available
                        </div>
                      ) : (
                        warehousesData.map(warehouse => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{warehouse.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the warehouse location to ship from
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Carrier Selection */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="carrierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier (Optional)</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No carrier</SelectItem>
                        {carriers?.suppliers?.map((carrier) => (
                          <SelectItem key={carrier.id} value={carrier.id}>
                            {carrier.name}
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
                name="carrierService"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Express, Standard" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tracking Number */}
            <FormField
              control={form.control}
              name="trackingNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tracking Number (Optional)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Truck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input {...field} className="pl-10" placeholder="Enter tracking number" />
                    </div>
                  </FormControl>
                  <FormDescription>
                    You can add this later when marking as shipped
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Selected Order Details */}
            {selectedOrder && (
              <>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedOrder.customer.companyName || selectedOrder.customer.email || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">
                        Order #{selectedOrder.orderNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Order Total</p>
                      <p className="font-medium">${Number(selectedOrder.grandTotal).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Items to Ship */}
                <div className="space-y-2">
                  <FormLabel>Items to Ship</FormLabel>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                          <TableHead className="text-right">Already Shipped</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                          <TableHead className="text-right">Ship Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.items.map((orderItem, index) => {
                          const remaining = orderItem.qtyOrdered - orderItem.qtyShipped;
                          const formItem = form.watch(`items.${index}`);
                          
                          return (
                            <TableRow key={orderItem.id}>
                              <TableCell className="font-medium">
                                {orderItem.item.name}
                              </TableCell>
                              <TableCell>{orderItem.item.sku}</TableCell>
                              <TableCell className="text-right">{orderItem.qtyOrdered}</TableCell>
                              <TableCell className="text-right">
                                {orderItem.qtyShipped > 0 && (
                                  <span className="text-green-600">{orderItem.qtyShipped}</span>
                                )}
                                {orderItem.qtyShipped === 0 && '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">{remaining}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  value={formItem?.qtyShipped || 0}
                                  onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                                  className="w-24 text-right"
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

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field}
                      placeholder="Add any notes about this shipment..."
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
                  setSelectedOrderId(null);
                  setSelectedLocationId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !selectedOrderId || !selectedLocationId}
              >
                {createMutation.isPending ? (
                  'Creating...'
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create Shipment
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