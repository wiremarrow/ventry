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
import { ChevronLeft, ChevronRight, Package, AlertTriangle } from 'lucide-react';
import { StockAdjustmentDialog } from './stock-adjustment-dialog';
import { cn } from '@ventry/ui';

interface InventoryListProps {
  warehouseId: string;
  searchTerm: string;
  showLowStock: boolean;
}

export function InventoryList({ warehouseId, searchTerm, showLowStock }: InventoryListProps) {
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const limit = 20;

  // Fetch inventory data
  const { data, isLoading, error } = trpc.inventory.list.useQuery({
    search: searchTerm || undefined,
    warehouseId: warehouseId === 'all' ? undefined : warehouseId,
    lowStock: showLowStock,
    page,
    limit,
  });

  if (error) {
    return (
      <div className="bg-white p-8 rounded-lg border border-gray-200">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Error loading inventory</p>
          <p className="text-gray-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  const getStockStatus = (available: number, reorderPoint: number | null) => {
    if (available === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (reorderPoint && available <= reorderPoint) return { label: 'Low Stock', variant: 'warning' as const };
    return { label: 'In Stock', variant: 'success' as const };
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
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
            ) : data?.inventory.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No inventory found</p>
                  <p className="text-gray-600 text-sm mt-1">
                    {searchTerm || showLowStock
                      ? 'Try adjusting your filters'
                      : 'Start by adding items to your inventory'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              // Inventory rows
              data?.inventory.map((inv) => {
                const status = getStockStatus(inv.qtyAvailable, inv.item.reorderPoint);
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{inv.item.name}</p>
                        {inv.item.category && (
                          <p className="text-sm text-gray-600">{inv.item.category.name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{inv.item.sku}</code>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{inv.location.warehouse.name}</p>
                        <p className="text-gray-600">{inv.location.code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {inv.qtyOnHand}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {inv.qtyAvailable}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {inv.qtyReserved}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedItem(inv);
                          setAdjustmentDialogOpen(true);
                        }}
                      >
                        Adjust
                      </Button>
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
              {Math.min(page * limit, data.pagination.total)} of {data.pagination.total} items
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

      {/* Stock Adjustment Dialog */}
      <StockAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        inventory={selectedItem}
        onSuccess={() => {
          setSelectedItem(null);
          setAdjustmentDialogOpen(false);
        }}
      />
    </>
  );
}