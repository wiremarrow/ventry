'use client';

import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Alert,
  AlertDescription,
  Button,
} from '@ventry/ui';
import { 
  Truck, 
  Calendar, 
  User, 
  MapPin,
  DollarSign,
  Hash,
  FileText,
  Send
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';
import { ShipmentStatusBadge } from './shipment-status-badge';

interface ShipmentDetailsDialogProps {
  shipmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShipmentDetailsDialog({ 
  shipmentId, 
  open, 
  onOpenChange 
}: ShipmentDetailsDialogProps) {
  const utils = trpc.useUtils();
  
  // Fetch shipment details
  const { data: shipment, isLoading } = trpc.shipments.get.useQuery(
    { id: shipmentId },
    { enabled: open && !!shipmentId }
  );

  // Ship mutation
  const shipMutation = trpc.shipments.ship.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Shipment marked as shipped',
      });
      utils.shipments.get.invalidate({ id: shipmentId });
      utils.shipments.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to ship',
        variant: 'destructive',
      });
    },
  });

  const handleShip = () => {
    const trackingNumber = prompt('Enter tracking number (optional):');
    const shippingCostStr = prompt('Enter shipping cost (optional):');
    const shippingCost = shippingCostStr ? parseFloat(shippingCostStr) : undefined;
    
    shipMutation.mutate({ 
      id: shipmentId, 
      trackingNumber: trackingNumber || undefined,
      shippingCost: shippingCost || undefined
    });
  };

  if (!open) return null;

  const totalQuantity = shipment?.items.reduce((sum, item) => sum + item.qtyShipped, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Shipment Details</DialogTitle>
          <DialogDescription>
            View shipment information and tracking details
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : shipment ? (
          <div className="space-y-6">
            {/* Shipment Header */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Shipment Number</p>
                  <p className="font-medium flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    {shipment.shipmentNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order</p>
                  <p className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {shipment.order.orderNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{shipment.order.customer.companyName || shipment.order.customer.email || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">Order #{shipment.order.orderNumber}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    <ShipmentStatusBadge status={shipment.status} />
                    {['PENDING', 'PACKED'].includes(shipment.status) && (
                      <Button size="sm" onClick={handleShip} disabled={shipMutation.isPending}>
                        <Send className="mr-1 h-3 w-3" />
                        Ship Now
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ship Date</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {shipment.shipDate ? formatDateTime(shipment.shipDate) : 'Not shipped yet'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Shipped By</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {shipment.shippedBy.firstName} {shipment.shippedBy.lastName}
                  </p>
                </div>
              </div>
            </div>

            {/* Carrier Information */}
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Carrier Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Carrier</p>
                  <p className="font-medium">
                    {shipment.carrier ? shipment.carrier.name : 'No carrier assigned'}
                  </p>
                  {shipment.carrierService && (
                    <p className="text-sm text-muted-foreground">{shipment.carrierService}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tracking Number</p>
                  {shipment.trackingNumber ? (
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {shipment.trackingNumber}
                    </code>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not provided</p>
                  )}
                </div>
                {shipment.shippingCost && (
                  <div>
                    <p className="text-sm text-muted-foreground">Shipping Cost</p>
                    <p className="font-medium flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {formatCurrency(Number(shipment.shippingCost))}
                    </p>
                  </div>
                )}
                {shipment.expectedDelivery && (
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Delivery</p>
                    <p className="font-medium">{formatDate(shipment.expectedDelivery)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Ship From Location */}
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Ship From Location
              </h3>
              <p className="font-medium">{shipment.shippedFromLocation.warehouse.name}</p>
              <p className="text-sm text-muted-foreground">{shipment.shippedFromLocation.code}</p>
            </div>

            {/* Notes */}
            {shipment.notes && (
              <Alert>
                <AlertDescription>
                  <strong>Notes:</strong> {shipment.notes}
                </AlertDescription>
              </Alert>
            )}

            {/* Items Table */}
            <div>
              <h3 className="font-medium mb-2">Shipped Items</h3>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Shipped</TableHead>
                      <TableHead>Lot #</TableHead>
                      <TableHead>Serial #</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipment.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.item.name}
                        </TableCell>
                        <TableCell>{item.item.sku}</TableCell>
                        <TableCell>
                          {item.item.category?.name || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.orderItem?.qtyOrdered || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.qtyShipped}
                        </TableCell>
                        <TableCell>
                          {item.lot?.lotNumber || '-'}
                        </TableCell>
                        <TableCell>
                          {item.serialNumber?.serialNumber || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="font-medium">{shipment.items.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Quantity</p>
                  <p className="font-medium">{totalQuantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDateTime(shipment.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Shipment not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}