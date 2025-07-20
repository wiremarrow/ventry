'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MoreHorizontal, 
  FileText, 
  Eye, 
  Copy, 
  Printer,
  CheckCircle,
  XCircle,
  Package,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ventry/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ventry/ui/dropdown-menu';
import { Button } from '@ventry/ui/button';
import { Badge } from '@ventry/ui/badge';
import { Skeleton } from '@ventry/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@ventry/ui/pagination';
import { Progress } from '@ventry/ui/progress';
import { toast } from 'sonner';

import { trpc } from '@/lib/trpc';
import { usePurchaseOrderFilters } from '@/hooks/use-purchase-order-filters';

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-800' },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  PARTIAL: { label: 'Partial', color: 'bg-yellow-100 text-yellow-800' },
  RECEIVED: { label: 'Received', color: 'bg-purple-100 text-purple-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
} as const;

export function PurchaseOrderList() {
  const router = useRouter();
  const { filters, setFilters } = usePurchaseOrderFilters();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.purchaseOrders.list.useQuery(filters);

  const duplicateMutation = trpc.purchaseOrders.duplicate.useMutation({
    onSuccess: (newPO) => {
      toast.success('Purchase order duplicated');
      utils.purchaseOrders.list.invalidate();
      router.push(`/purchase-orders/${newPO.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleSort = (column: typeof filters.sortBy) => {
    if (filters.sortBy === column) {
      setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      setFilters({ sortBy: column, sortOrder: 'asc' });
    }
  };

  const handlePageChange = (page: number) => {
    setFilters({ page });
  };

  const handleDuplicate = (id: string) => {
    duplicateMutation.mutate({ id, includeItems: true });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  const { purchaseOrders, pagination } = data;

  if (purchaseOrders.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No purchase orders
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new purchase order.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort('poNumber')}
              >
                PO Number
                {filters.sortBy === 'poNumber' && (
                  <span className="ml-1">
                    {filters.sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort('orderDate')}
              >
                Order Date
                {filters.sortBy === 'orderDate' && (
                  <span className="ml-1">
                    {filters.sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort('supplier')}
              >
                Supplier
                {filters.sortBy === 'supplier' && (
                  <span className="ml-1">
                    {filters.sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort('status')}
              >
                Status
                {filters.sortBy === 'status' && (
                  <span className="ml-1">
                    {filters.sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </TableHead>
              <TableHead 
                className="cursor-pointer text-right"
                onClick={() => handleSort('total')}
              >
                Total
                {filters.sortBy === 'total' && (
                  <span className="ml-1">
                    {filters.sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((po) => (
              <TableRow 
                key={po.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => router.push(`/purchase-orders/${po.id}`)}
              >
                <TableCell className="font-medium">
                  {po.poNumber}
                  {po.isOverdue && (
                    <AlertCircle className="ml-1 inline h-4 w-4 text-red-500" />
                  )}
                </TableCell>
                <TableCell>
                  {format(new Date(po.orderDate), 'PP')}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{po.supplier.name}</div>
                    <div className="text-sm text-gray-500">
                      {po.supplier.supplierCode}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{po.itemCount}</span>
                    {po.receiptCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {po.receiptCount} receipts
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="w-24">
                    <Progress value={po.receivedPercentage} className="h-2" />
                    <span className="text-xs text-gray-500">
                      {po.receivedPercentage.toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={statusConfig[po.status].color}>
                    {statusConfig[po.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(po.total)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/purchase-orders/${po.id}`);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(po.id);
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          window.print();
                        }}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {po.status === 'SUBMITTED' && (
                        <>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/purchase-orders/${po.id}?action=approve`);
                            }}
                            className="text-green-600"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/purchase-orders/${po.id}?action=reject`);
                            }}
                            className="text-red-600"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                        </>
                      )}
                      {po.status === 'APPROVED' && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/purchase-orders/${po.id}?action=receive`);
                          }}
                        >
                          <Package className="mr-2 h-4 w-4" />
                          Receive Items
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                className={
                  pagination.page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                }
              />
            </PaginationItem>
            
            {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
              const pageNumber = i + 1;
              return (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    onClick={() => handlePageChange(pageNumber)}
                    isActive={pagination.page === pageNumber}
                    className="cursor-pointer"
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            
            {pagination.totalPages > 5 && (
              <PaginationItem>
                <span className="px-2">...</span>
              </PaginationItem>
            )}
            
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))
                }
                className={
                  pagination.page === pagination.totalPages
                    ? 'pointer-events-none opacity-50'
                    : 'cursor-pointer'
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}