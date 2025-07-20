'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Printer, 
  Copy, 
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Package,
  Send,
  Ban,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@ventry/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ventry/ui/card';
import { Badge } from '@ventry/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ventry/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ventry/ui/table';
import { Skeleton } from '@ventry/ui/skeleton';
import { Progress } from '@ventry/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ventry/ui/tabs';
import { toast } from 'sonner';

import { trpc } from '@/lib/trpc';
import { PurchaseOrderApprovalDialog } from '@/components/purchase-orders/purchase-order-approval-dialog';
import { PurchaseOrderReceiveDialog } from '@/components/purchase-orders/purchase-order-receive-dialog';
import { PurchaseOrderCancelDialog } from '@/components/purchase-orders/purchase-order-cancel-dialog';

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: null },
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-800', icon: Send },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  PARTIAL: { label: 'Partial', color: 'bg-yellow-100 text-yellow-800', icon: Package },
  RECEIVED: { label: 'Received', color: 'bg-purple-100 text-purple-800', icon: Package },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: Ban },
} as const;

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');

  const utils = trpc.useUtils();
  
  const { data: purchaseOrder, isLoading } = trpc.purchaseOrders.get.useQuery({ id });

  const submitMutation = trpc.purchaseOrders.submit.useMutation({
    onSuccess: () => {
      toast.success('Purchase order submitted for approval');
      utils.purchaseOrders.get.invalidate({ id });
      utils.purchaseOrders.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const duplicateMutation = trpc.purchaseOrders.duplicate.useMutation({
    onSuccess: (newPO) => {
      toast.success('Purchase order duplicated');
      router.push(`/purchase-orders/${newPO.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'approve' && purchaseOrder?.status === 'SUBMITTED') {
      setApprovalAction('approve');
      setShowApprovalDialog(true);
    } else if (action === 'reject' && purchaseOrder?.status === 'SUBMITTED') {
      setApprovalAction('reject');
      setShowApprovalDialog(true);
    } else if (action === 'receive' && purchaseOrder?.status === 'APPROVED') {
      setShowReceiveDialog(true);
    }
  }, [searchParams, purchaseOrder]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleSubmit = () => {
    submitMutation.mutate({ id });
  };

  const handleDuplicate = () => {
    duplicateMutation.mutate({ id, includeItems: true });
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          Purchase order not found
        </h3>
        <Button className="mt-4" onClick={() => router.push('/purchase-orders')}>
          Back to Purchase Orders
        </Button>
      </div>
    );
  }

  const StatusIcon = statusConfig[purchaseOrder.status].icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/purchase-orders')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {purchaseOrder.poNumber}
            </h1>
            <p className="text-gray-500">
              Created on {format(new Date(purchaseOrder.orderDate), 'PPP')}
            </p>
          </div>
          <Badge className={statusConfig[purchaseOrder.status].color}>
            {StatusIcon && <StatusIcon className="mr-1 h-3 w-3" />}
            {statusConfig[purchaseOrder.status].label}
          </Badge>
          {purchaseOrder.metrics && purchaseOrder.isOverdue && (
            <Badge variant="destructive">
              <AlertCircle className="mr-1 h-3 w-3" />
              Overdue
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {purchaseOrder.status === 'DRAFT' && (
            <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Submit for Approval
            </Button>
          )}
          
          {purchaseOrder.status === 'SUBMITTED' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setApprovalAction('reject');
                  setShowApprovalDialog(true);
                }}
                className="text-red-600"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={() => {
                  setApprovalAction('approve');
                  setShowApprovalDialog(true);
                }}
                className="text-green-600"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </>
          )}
          
          {purchaseOrder.status === 'APPROVED' && (
            <Button onClick={() => setShowReceiveDialog(true)}>
              <Package className="mr-2 h-4 w-4" />
              Receive Items
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              {!['RECEIVED', 'CANCELLED'].includes(purchaseOrder.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowCancelDialog(true)}
                    className="text-red-600"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Cancel Order
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {purchaseOrder.metrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{purchaseOrder.metrics.itemCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{purchaseOrder.metrics.totalQuantity}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {purchaseOrder.metrics.receivedQuantity} / {purchaseOrder.metrics.totalQuantity}
              </div>
              <Progress 
                value={purchaseOrder.metrics.receivedPercentage} 
                className="mt-2 h-2" 
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(purchaseOrder.total)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">PO Number:</span>
                  <span className="font-medium">{purchaseOrder.poNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Order Date:</span>
                  <span className="font-medium">
                    {format(new Date(purchaseOrder.orderDate), 'PP')}
                  </span>
                </div>
                {purchaseOrder.expectedDate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Expected Date:</span>
                    <span className="font-medium">
                      {format(new Date(purchaseOrder.expectedDate), 'PP')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Created By:</span>
                  <span className="font-medium">{purchaseOrder.createdBy?.email}</span>
                </div>
                {purchaseOrder.approvedBy && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Approved By:</span>
                    <span className="font-medium">{purchaseOrder.approvedBy.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supplier Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Name:</span>
                  <span className="font-medium">{purchaseOrder.supplier.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Code:</span>
                  <span className="font-medium">{purchaseOrder.supplier.supplierCode}</span>
                </div>
                {purchaseOrder.supplier.email && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Email:</span>
                    <span className="font-medium">{purchaseOrder.supplier.email}</span>
                  </div>
                )}
                {purchaseOrder.supplier.phone && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Phone:</span>
                    <span className="font-medium">{purchaseOrder.supplier.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {purchaseOrder.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{purchaseOrder.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrder.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item.sku}</TableCell>
                      <TableCell>{item.item.name}</TableCell>
                      <TableCell>{item.item.category?.name}</TableCell>
                      <TableCell className="text-right">{item.qtyOrdered}</TableCell>
                      <TableCell className="text-right">
                        {item.qtyReceived}
                        {item.qtyReceived < item.qtyOrdered && (
                          <span className="ml-1 text-yellow-600">
                            ({item.qtyOrdered - item.qtyReceived} pending)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.taxRate}%
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.totalCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(purchaseOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span>{formatCurrency(purchaseOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total:</span>
                    <span>{formatCurrency(purchaseOrder.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          {purchaseOrder.receipts && purchaseOrder.receipts.length > 0 ? (
            purchaseOrder.receipts.map((receipt) => (
              <Card key={receipt.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Receipt {receipt.reference || receipt.id}
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Received on {format(new Date(receipt.receivedDate), 'PPP')} by{' '}
                    {receipt.receivedBy?.email}
                  </p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Qty Received</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead>Lot #</TableHead>
                        <TableHead>Expiration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipt.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.item.name}</TableCell>
                          <TableCell>{item.locationId}</TableCell>
                          <TableCell className="text-right">{item.qtyReceived}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unitCost)}
                          </TableCell>
                          <TableCell>{item.lot?.lotNumber || '-'}</TableCell>
                          <TableCell>
                            {item.expirationDate
                              ? format(new Date(item.expirationDate), 'PP')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No receipts yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Activity tracking will be implemented in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showApprovalDialog && (
        <PurchaseOrderApprovalDialog
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          purchaseOrderId={id}
          action={approvalAction}
        />
      )}

      {showReceiveDialog && (
        <PurchaseOrderReceiveDialog
          open={showReceiveDialog}
          onOpenChange={setShowReceiveDialog}
          purchaseOrder={purchaseOrder}
        />
      )}

      {showCancelDialog && (
        <PurchaseOrderCancelDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          purchaseOrderId={id}
        />
      )}
    </div>
  );
}