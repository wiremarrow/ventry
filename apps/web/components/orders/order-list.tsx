'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  Skeleton,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ventry/ui';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Edit,
  FileText,
  Package,
  Truck,
  X,
  CheckCircle,
} from 'lucide-react';
import { ViewOrderDialog } from './view-order-dialog';
import { EditOrderDialog } from './edit-order-dialog';
import { toast } from 'sonner';

interface OrderListProps {
  searchTerm: string;
  status?: 'PENDING' | 'CONFIRMED' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
}

export function OrderList({ searchTerm, status }: OrderListProps) {
  const [page, setPage] = useState(1);
  type OrderWithRelations = NonNullable<NonNullable<typeof data>['orders']>[0];
  const [viewingOrder, setViewingOrder] = useState<OrderWithRelations | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderWithRelations | null>(null);
  const limit = 20;

  const utils = trpc.useUtils();

  // Fetch orders
  const { data, isLoading, error } = trpc.orders.list.useQuery({
    search: searchTerm,
    status: status || undefined,
    page,
    limit,
  });

  // Mutations
  const cancelMutation = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      toast.success('Order cancelled successfully');
      utils.orders.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Order status updated successfully');
      utils.orders.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Error loading orders</p>
          <p className="text-gray-600 text-sm mt-1">{error.message}</p>
        </div>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getStatusColor = (status: string): 'secondary' | 'warning' | 'info' | 'success' | 'destructive' => {
    const colors: Record<string, 'secondary' | 'warning' | 'info' | 'success' | 'destructive'> = {
      DRAFT: 'secondary',
      PENDING: 'warning',
      CONFIRMED: 'info',
      PROCESSING: 'info',
      PACKED: 'info',
      SHIPPED: 'success',
      DELIVERED: 'success',
      CANCELLED: 'destructive',
      REFUNDED: 'destructive',
    };
    return colors[status] || 'secondary';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SHIPPED':
      case 'DELIVERED':
        return <Truck className="h-3 w-3" />;
      case 'PACKED':
      case 'PROCESSING':
        return <Package className="h-3 w-3" />;
      case 'CANCELLED':
      case 'REFUNDED':
        return <X className="h-3 w-3" />;
      case 'CONFIRMED':
        return <CheckCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data?.orders.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No orders found</p>
                  <p className="text-gray-600 text-sm mt-1">
                    {searchTerm || status ? 'Try adjusting your filters' : 'Start by creating your first order'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              // Order rows
              data?.orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{order.orderNumber}</p>
                      <p className="text-xs text-gray-500">ID: {order.id.slice(0, 8)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{order.customer.companyName || `${order.customer.firstName} ${order.customer.lastName}`}</p>
                      <p className="text-sm text-gray-600">{order.customer.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{formatDate(order.orderDate)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {order._count.items}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(order.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setViewingOrder(order)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingOrder(order)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {order.status === 'PENDING' && (
                          <DropdownMenuItem
                            onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'CONFIRMED' })}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Confirm Order
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>
                          <FileText className="mr-2 h-4 w-4" />
                          Generate Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Package className="mr-2 h-4 w-4" />
                          Create Shipment
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {['DRAFT', 'PENDING', 'CONFIRMED'].includes(order.status) && (
                          <DropdownMenuItem
                            onClick={() =>
                              cancelMutation.mutate({
                                id: order.id,
                                reason: 'Cancelled from UI',
                              })
                            }
                            className="text-red-600"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel Order
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {(page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, data.pagination.total)} of {data.pagination.total} orders
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= data.pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* View Order Dialog */}
      <ViewOrderDialog
        order={viewingOrder}
        open={!!viewingOrder}
        onOpenChange={(open) => !open && setViewingOrder(null)}
      />

      {/* Edit Order Dialog */}
      <EditOrderDialog
        order={editingOrder}
        open={!!editingOrder}
        onOpenChange={(open) => !open && setEditingOrder(null)}
      />
    </>
  );
}