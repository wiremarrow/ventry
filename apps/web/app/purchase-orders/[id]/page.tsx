'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Badge,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ventry/ui';
import {
  ArrowLeft,
  Edit,
  Copy,
  CheckCircle,
  XCircle,
  Package,
  FileText,
  Building,
  Calendar,
  User,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseOrderId = params.id as string;

  const {
    data: order,
    isLoading,
    refetch,
  } = trpc.purchaseOrders.get.useQuery({ id: purchaseOrderId }, { enabled: !!purchaseOrderId });

  // Status mutations
  const approveMutation = trpc.purchaseOrders.approve.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Purchase order approved successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve purchase order',
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = trpc.purchaseOrders.reject.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Purchase order rejected',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject purchase order',
        variant: 'destructive',
      });
    },
  });

  const cancelMutation = trpc.purchaseOrders.cancel.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Purchase order cancelled',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel purchase order',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!order) {
    return (
      <ProtectedRoute>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Purchase order not found</p>
          <Button variant="link" onClick={() => router.push('/purchase-orders')} className="mt-4">
            Back to Purchase Orders
          </Button>
        </div>
      </ProtectedRoute>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { variant: 'outline' | 'secondary' | 'default' | 'destructive'; icon: typeof FileText | null }
    > = {
      DRAFT: { variant: 'outline' as const, icon: FileText },
      SUBMITTED: { variant: 'secondary' as const, icon: null },
      APPROVED: { variant: 'default' as const, icon: CheckCircle },
      PARTIAL: { variant: 'secondary' as const, icon: Package },
      RECEIVED: { variant: 'default' as const, icon: Package },
      CANCELLED: { variant: 'destructive' as const, icon: XCircle },
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

  const handleReject = () => {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason) {
      rejectMutation.mutate({ id: order.id, reason });
    }
  };

  const handleCancel = () => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (reason) {
      cancelMutation.mutate({ id: order.id, reason });
    }
  };

  // Calculate received percentage
  const totalOrdered = order.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
  const totalReceived = order.items.reduce((sum, item) => sum + item.qtyReceived, 0);
  const receivedPercentage = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/purchase-orders')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{order.poNumber}</h1>
                  {getStatusBadge(order.status)}
                </div>
                <p className="text-muted-foreground">Created on {formatDate(order.createdAt)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {order.status === 'DRAFT' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/purchase-orders/${order.id}/edit`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/purchase-orders/create?duplicate=${order.id}`)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </Button>
                </>
              )}
              {order.status === 'SUBMITTED' && (
                <>
                  <Button
                    onClick={() => approveMutation.mutate({ poId: order.id, action: 'APPROVE' })}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button variant="destructive" onClick={handleReject}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              {order.status === 'APPROVED' && (
                <Button onClick={() => router.push(`/purchase-orders/${order.id}/receive`)}>
                  <Package className="h-4 w-4 mr-2" />
                  Receive Items
                </Button>
              )}
              {['DRAFT', 'SUBMITTED', 'APPROVED'].includes(order.status) && (
                <Button variant="outline" onClick={handleCancel}>
                  Cancel PO
                </Button>
              )}
            </div>
          </div>

          {/* Order Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Supplier Information */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Supplier Information</h3>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">{order.supplier.name}</p>
                  <p className="text-sm text-muted-foreground">{order.supplier.supplierCode}</p>
                  {order.supplier.email && <p className="text-sm">{order.supplier.email}</p>}
                  {order.supplier.phone && <p className="text-sm">{order.supplier.phone}</p>}
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
                  {order.expectedDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Expected Delivery</p>
                      <p className="font-medium">{formatDate(order.expectedDate)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Created By</p>
                    <p className="font-medium">
                      {order.createdBy.firstName} {order.createdBy.lastName}
                    </p>
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
                    <span className="font-medium">
                      {formatCurrency(parseFloat(order.subtotal.toString()))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tax</span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(order.tax.toString()))}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold">
                      {formatCurrency(parseFloat(order.total.toString()))}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Progress Indicator */}
          {['APPROVED', 'PARTIAL', 'RECEIVED'].includes(order.status) && (
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Receiving Progress</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Items Received</span>
                    <span>
                      {totalReceived} / {totalOrdered}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${receivedPercentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {receivedPercentage.toFixed(0)}% Complete
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
                  <TableHead>Received</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.item.sku}</TableCell>
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
                        {item.qtyReceived}
                        {item.qtyReceived < item.qtyOrdered && (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(parseFloat(item.unitCost.toString()))}</TableCell>
                    <TableCell>{parseFloat(item.taxRate.toString())}%</TableCell>
                    <TableCell>{formatCurrency(parseFloat(item.totalCost.toString()))}</TableCell>
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

          {/* Receipts */}
          {order.receipts.length > 0 && (
            <Card>
              <div className="p-6 border-b">
                <h3 className="font-semibold">Receipts</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt Date</TableHead>
                    <TableHead>Received By</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell>{formatDateTime(receipt.receivedDate)}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{receipt.reference || '-'}</TableCell>
                      <TableCell>{receipt.items.length} items</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/receipts/${receipt.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Approval Info */}
          {order.approvedBy && (
            <Card className="p-6">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Approved by</span>
                <span className="font-medium">
                  {order.approvedBy.firstName} {order.approvedBy.lastName}
                </span>
                <span className="text-muted-foreground">on</span>
                <span className="font-medium">{formatDateTime(order.updatedAt)}</span>
              </div>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
