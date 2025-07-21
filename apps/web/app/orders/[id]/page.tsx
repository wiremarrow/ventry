'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ventry/ui';
import { 
  ArrowLeft,
  CheckCircle,
  Package,
  Truck,
  X,
  FileText,
  User,
  Calendar,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { data: order, isLoading, refetch } = trpc.orders.get.useQuery(
    { id: orderId },
    { enabled: !!orderId }
  );

  // Status mutations
  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Order status updated successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update order status',
        variant: 'destructive',
      });
    },
  });

  const cancelMutation = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Order cancelled',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel order',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="space-y-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!order) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Order not found</p>
            <Button 
              variant="link" 
              onClick={() => router.push('/orders')}
              className="mt-4"
            >
              Back to Orders
            </Button>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'outline' | 'secondary' | 'default' | 'destructive'; icon: typeof FileText | null }> = {
      PENDING: { variant: 'secondary' as const, icon: null },
      CONFIRMED: { variant: 'default' as const, icon: CheckCircle },
      PICKING: { variant: 'secondary' as const, icon: Package },
      PACKED: { variant: 'secondary' as const, icon: Package },
      SHIPPED: { variant: 'default' as const, icon: Truck },
      DELIVERED: { variant: 'default' as const, icon: CheckCircle },
      CANCELLED: { variant: 'destructive' as const, icon: X },
    };

    const config = variants[status] || { variant: 'outline' as const };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {status}
      </Badge>
    );
  };

  const handleCancel = () => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (reason) {
      cancelMutation.mutate({ id: order.id, reason });
    }
  };

  // Calculate fulfillment percentage
  const totalOrdered = order.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
  const totalShipped = order.items.reduce((sum, item) => sum + item.qtyShipped, 0);
  const fulfillmentPercentage = totalOrdered > 0 ? (totalShipped / totalOrdered) * 100 : 0;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/orders')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
                  {getStatusBadge(order.status)}
                </div>
                <p className="text-muted-foreground">
                  Ordered on {formatDate(order.orderDate)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {order.status === 'PENDING' && (
                <Button 
                  onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'CONFIRMED' })}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Order
                </Button>
              )}
              {order.status === 'CONFIRMED' && (
                <Button 
                  onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'PICKING' })}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Start Picking
                </Button>
              )}
              {order.status === 'PICKING' && (
                <Button 
                  onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'PACKED' })}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Mark as Packed
                </Button>
              )}
              {order.status === 'PACKED' && (
                <Button 
                  onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'SHIPPED' })}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Mark as Shipped
                </Button>
              )}
              {['PENDING', 'CONFIRMED', 'PICKING', 'PACKED'].includes(order.status) && (
                <Button 
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel Order
                </Button>
              )}
            </div>
          </div>

          {/* Order Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Customer Information */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Customer Information</h3>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">
                    {order.customer.companyName || `${order.customer.firstName} ${order.customer.lastName}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.customer.customerCode}
                  </p>
                  {order.customer.email && (
                    <p className="text-sm">{order.customer.email}</p>
                  )}
                  {order.customer.phone && (
                    <p className="text-sm">{order.customer.phone}</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Order Details */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Order Details</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Order Date</p>
                    <p className="font-medium">{formatDate(order.orderDate)}</p>
                  </div>
                  {order.requestedShipDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Requested Ship Date</p>
                      <p className="font-medium">{formatDate(order.requestedShipDate)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Financial Summary */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Financial Summary</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(parseFloat(order.subtotal.toString()))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tax</span>
                    <span className="font-medium">{formatCurrency(parseFloat(order.taxTotal.toString()))}</span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold">{formatCurrency(parseFloat(order.grandTotal.toString()))}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Fulfillment Progress */}
          {['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(order.status) && (
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Fulfillment Progress</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Items Shipped</span>
                    <span>{totalShipped} / {totalOrdered}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${fulfillmentPercentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {fulfillmentPercentage.toFixed(0)}% Complete
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Line Items */}
          <Card>
            <div className="p-6 border-b">
              <h3 className="font-semibold">Line Items</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead>Shipped</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.item.sku}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{item.item.name}</p>
                        {item.description && item.description !== item.item.name && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.qtyOrdered}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.qtyShipped}
                        {item.qtyShipped < item.qtyOrdered && (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(parseFloat(item.unitPrice.toString()))}</TableCell>
                    <TableCell>{parseFloat(item.discountPct.toString())}%</TableCell>
                    <TableCell>{parseFloat(item.taxRate.toString())}%</TableCell>
                    <TableCell>{formatCurrency(parseFloat(item.totalPrice.toString()))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Notes</h3>
                <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
              </div>
            </Card>
          )}

          {/* Shipments */}
          {order.shipments && order.shipments.length > 0 && (
            <Card>
              <div className="p-6 border-b">
                <h3 className="font-semibold">Shipments</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ship Date</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Tracking Number</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.shipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell>{shipment.shipDate ? formatDate(shipment.shipDate) : '-'}</TableCell>
                      <TableCell>{shipment.carrier?.name || '-'}</TableCell>
                      <TableCell>{shipment.trackingNumber || '-'}</TableCell>
                      <TableCell>{shipment.items?.length || 0} items</TableCell>
                      <TableCell>{shipment.shippingCost ? formatCurrency(parseFloat(shipment.shippingCost.toString())) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}