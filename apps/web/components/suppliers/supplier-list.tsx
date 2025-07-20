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
} from '@ventry/ui';
import { Badge } from '@ventry/ui';
import { Button } from '@ventry/ui';
import { Skeleton } from '@ventry/ui';
import {
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
  Building2,
  AlertTriangle,
  MoreHorizontal,
  Edit,
  Archive,
  BarChart,
  Phone,
  Mail,
  Clock,
  DollarSign,
} from 'lucide-react';
import { EditSupplierDialog } from './edit-supplier-dialog';
import { toast } from 'sonner';

import type { Supplier } from '@ventry/database';

interface SupplierListProps {
  searchTerm: string;
}

// Type for supplier with additional fields from the query
type SupplierWithRelations = Supplier & {
  _count?: {
    purchaseOrders: number;
  };
};

export function SupplierList({ searchTerm }: SupplierListProps) {
  const [page, setPage] = useState(1);
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithRelations | null>(null);
  const limit = 20;

  const utils = trpc.useUtils();

  // Fetch suppliers
  const { data, isLoading, error } = trpc.suppliers.list.useQuery({
    search: searchTerm,
    page,
    limit,
  });

  // Mutations
  const archiveMutation = trpc.suppliers.archive.useMutation({
    onSuccess: () => {
      toast.success('Supplier archived successfully');
      utils.suppliers.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  if (error) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Error loading suppliers</p>
          <p className="text-gray-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getRatingColor = (rating: number | null) => {
    if (!rating) return 'text-gray-400';
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-center">Lead Time</TableHead>
              <TableHead className="text-right">Open POs</TableHead>
              <TableHead className="text-right">Total Business</TableHead>
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
            ) : data?.suppliers.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No suppliers found</p>
                  <p className="text-gray-600 text-sm mt-1">
                    {searchTerm ? 'Try adjusting your search' : 'Start by adding your first supplier'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              // Supplier rows
              data?.suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{supplier.name}</p>
                      <p className="text-sm text-gray-600">{supplier.supplierCode}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {supplier.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">{supplier.phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{supplier.city}, {supplier.country}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {supplier.leadTimeDays ? (
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-sm">{supplier.leadTimeDays} days</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {supplier._count.purchaseOrders || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-3 w-3 text-gray-400" />
                      <span className="font-medium">
                        ${((supplier as any).totalOrderValue12Months || 0).toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">
                      Active
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
                        <DropdownMenuItem onClick={() => setEditingSupplier(supplier)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <BarChart className="mr-2 h-4 w-4" />
                          View Performance
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            archiveMutation.mutate({
                              id: supplier.id,
                            })
                          }
                          className="text-red-600"
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
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
              {Math.min(page * limit, data.pagination.total)} of {data.pagination.total} suppliers
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
      </div>

      {/* Edit Supplier Dialog */}
      <EditSupplierDialog
        supplier={editingSupplier}
        open={!!editingSupplier}
        onOpenChange={(open) => !open && setEditingSupplier(null)}
      />
    </>
  );
}