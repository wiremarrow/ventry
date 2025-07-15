'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button, Skeleton, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ventry/ui';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Edit,
  Copy,
  CheckCircle,
  XCircle,
  Package,
  FileText
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED' | ''>('');

  // Fetch purchase orders with filtering
  const { data: orders, isLoading, refetch } = trpc.purchaseOrders.list.useQuery({
    search: searchTerm || undefined,
    status: statusFilter || undefined,
    limit: 100,
  });

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

  // Calculate stats
  const stats = {
    total: orders?.purchaseOrders?.length || 0,
    draft: orders?.purchaseOrders?.filter(o => o.status === 'DRAFT').length || 0,
    pending: orders?.purchaseOrders?.filter(o => o.status === 'SUBMITTED').length || 0,
    approved: orders?.purchaseOrders?.filter(o => o.status === 'APPROVED').length || 0,
    totalValue: orders?.purchaseOrders?.reduce((sum, o) => sum + parseFloat(o.total.toString()), 0) || 0,
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'outline' | 'secondary' | 'default' | 'destructive'; icon: typeof FileText | null }> = {
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

  return (
    <ProtectedRoute>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Purchase Orders</h1>
            <p className="text-muted-foreground">
              Manage supplier orders and track deliveries
            </p>
          </div>
          <Button onClick={() => router.push('/purchase-orders/create')}>
            <Plus className="mr-2 h-4 w-4" />
            Create PO
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total POs</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </Card>
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Draft</p>
              <p className="text-2xl font-bold">{stats.draft}</p>
            </div>
          </Card>
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pending Approval</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
          </Card>
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold">{stats.approved}</p>
            </div>
          </Card>
          <Card className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number, supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED' | '')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PARTIAL">Partially Received</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Purchase Orders Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : orders?.purchaseOrders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">No purchase orders found</p>
                  </TableCell>
                </TableRow>
              ) : (
                orders?.purchaseOrders?.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.poNumber}
                    </TableCell>
                    <TableCell>{order.supplier.name}</TableCell>
                    <TableCell>{formatDate(order.orderDate)}</TableCell>
                    <TableCell>
                      {order.expectedDate ? formatDate(order.expectedDate) : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {order.items.length} items
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(order.total)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/purchase-orders/${order.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {order.status === 'DRAFT' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => router.push(`/purchase-orders/${order.id}/edit`)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/purchase-orders/create?duplicate=${order.id}`)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                            </>
                          )}
                          {order.status === 'SUBMITTED' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => approveMutation.mutate({ poId: order.id, action: 'APPROVE' })}
                                className="text-green-600"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  const reason = prompt('Rejection reason:');
                                  if (reason) {
                                    rejectMutation.mutate({ id: order.id, reason });
                                  }
                                }}
                                className="text-red-600"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {order.status === 'APPROVED' && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/purchase-orders/${order.id}/receive`)}
                            >
                              <Package className="mr-2 h-4 w-4" />
                              Receive Items
                            </DropdownMenuItem>
                          )}
                          {['DRAFT', 'SUBMITTED', 'APPROVED'].includes(order.status) && (
                            <DropdownMenuItem
                              onClick={() => {
                                const reason = prompt('Please provide a reason for cancellation:');
                                if (reason) {
                                  cancelMutation.mutate({ id: order.id, reason });
                                }
                              }}
                              className="text-destructive"
                            >
                              Cancel PO
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
        </Card>
      </div>
    </ProtectedRoute>
  );
}