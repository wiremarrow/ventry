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
  Warehouse,
  AlertTriangle,
  MoreHorizontal,
  Edit,
  BarChart,
  Archive,
  MapPin,
} from 'lucide-react';
import { EditWarehouseDialog } from './edit-warehouse-dialog';
import { toast } from 'sonner';

interface WarehouseListProps {
  searchTerm: string;
}

export function WarehouseList({ searchTerm }: WarehouseListProps) {
  const [page, setPage] = useState(1);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const limit = 20;

  const utils = trpc.useUtils();

  // Fetch warehouses
  const { data, isLoading, error } = trpc.warehouses.list.useQuery({
    search: searchTerm,
    page,
    limit,
  });

  // Mutations
  const archiveMutation = trpc.warehouses.archive.useMutation({
    onSuccess: () => {
      toast.success('Warehouse archived successfully');
      utils.warehouses.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (error) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Error loading warehouses</p>
          <p className="text-gray-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  const formatCapacity = (capacity: number | null) => {
    if (!capacity) return 'Unlimited';
    return capacity.toLocaleString();
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Warehouse</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Utilization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data?.warehouses.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Warehouse className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No warehouses found</p>
                  <p className="text-gray-600 text-sm mt-1">
                    {searchTerm ? 'Try adjusting your search' : 'Start by adding your first warehouse'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              // Warehouse rows
              data?.warehouses.map((warehouse) => {
                const utilization = warehouse.capacity 
                  ? Math.round((warehouse._count.inventory / warehouse.capacity) * 100)
                  : 0;
                
                return (
                  <TableRow key={warehouse.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{warehouse.name}</p>
                        {warehouse.description && (
                          <p className="text-sm text-gray-600 line-clamp-1">{warehouse.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{warehouse.code}</code>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">{warehouse.type.toLowerCase()}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span className="text-sm">
                          {warehouse.city}, {warehouse.state}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{warehouse.manager || '-'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCapacity(warehouse.capacity)}
                    </TableCell>
                    <TableCell className="text-right">
                      {warehouse.capacity ? (
                        <span className={`text-sm font-medium px-2 py-1 rounded ${getUtilizationColor(utilization)}`}>
                          {utilization}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={warehouse.status === 'ACTIVE' ? 'success' : 'secondary'}>
                        {warehouse.status}
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
                          <DropdownMenuItem onClick={() => setEditingWarehouse(warehouse)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <BarChart className="mr-2 h-4 w-4" />
                            View Analytics
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              archiveMutation.mutate({
                                id: warehouse.id,
                                reason: 'Archived from UI',
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
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {(page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, data.pagination.total)} of {data.pagination.total} warehouses
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

      {/* Edit Warehouse Dialog */}
      <EditWarehouseDialog
        warehouse={editingWarehouse}
        open={!!editingWarehouse}
        onOpenChange={(open) => !open && setEditingWarehouse(null)}
      />
    </>
  );
}