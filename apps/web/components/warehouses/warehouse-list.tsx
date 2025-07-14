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
  Warehouse,
  AlertTriangle,
  MoreHorizontal,
  Edit,
  BarChart,
  Archive,
  MapPin,
} from 'lucide-react';
import { EditWarehouseDialog } from './edit-warehouse-dialog';
import { WarehouseDetailsDialog } from './warehouse-details-dialog';
import { toast } from 'sonner';

interface WarehouseListProps {
  searchTerm: string;
}

export function WarehouseList({ searchTerm }: WarehouseListProps) {
  const [editingWarehouse, setEditingWarehouse] = useState<unknown>(null);
  const [detailsWarehouseId, setDetailsWarehouseId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Fetch warehouses
  const { data: warehouses, isLoading, error } = trpc.warehouses.list.useQuery({
    includeStats: true,
  });

  // Mutations
  const deleteMutation = trpc.warehouses.delete.useMutation({
    onSuccess: () => {
      toast.success('Warehouse deleted successfully');
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

  // Filter warehouses based on search term
  const filteredWarehouses = warehouses?.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.city.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Warehouse</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Locations</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Utilization</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredWarehouses.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Warehouse className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No warehouses found</p>
                  <p className="text-gray-600 text-sm mt-1">
                    {searchTerm ? 'Try adjusting your search' : 'Start by adding your first warehouse'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              // Warehouse rows
              filteredWarehouses.map((warehouse) => {
                const locationCount = warehouse._count?.locations || 0;
                const totalCapacity = warehouse.stats?.totalCapacity || 0;
                const utilization = warehouse.stats?.utilizationRate || 0;
                
                return (
                  <TableRow key={warehouse.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{warehouse.name}</p>
                        {warehouse.notes && (
                          <p className="text-sm text-gray-600 line-clamp-1">{warehouse.notes}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{warehouse.code}</code>
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
                      <span className="text-sm">{warehouse.phone || '-'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium">{locationCount}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm">{totalCapacity > 0 ? totalCapacity.toLocaleString() : '-'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {totalCapacity > 0 ? (
                        <span className={`text-sm font-medium px-2 py-1 rounded ${
                          utilization >= 90 ? 'text-red-600 bg-red-100' :
                          utilization >= 75 ? 'text-yellow-600 bg-yellow-100' :
                          'text-green-600 bg-green-100'
                        }`}>
                          {utilization}%
                        </span>
                      ) : (
                        '-'
                      )}
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
                          <DropdownMenuItem onClick={() => setDetailsWarehouseId(warehouse.id)}>
                            <BarChart className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              deleteMutation.mutate({
                                id: warehouse.id,
                              })
                            }
                            className="text-red-600"
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Delete
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

      </div>

      {/* Edit Warehouse Dialog */}
      <EditWarehouseDialog
        warehouse={editingWarehouse}
        open={!!editingWarehouse}
        onOpenChange={(open) => !open && setEditingWarehouse(null)}
      />

      {/* Warehouse Details Dialog */}
      <WarehouseDetailsDialog
        warehouseId={detailsWarehouseId}
        open={!!detailsWarehouseId}
        onOpenChange={(open) => !open && setDetailsWarehouseId(null)}
      />
    </>
  );
}