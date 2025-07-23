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
  Package,
  AlertTriangle,
  MoreHorizontal,
  Edit,
  Copy,
  Archive,
  BarChart,
} from 'lucide-react';
import { EditProductDialog } from './edit-product-dialog';
import { toast } from 'sonner';

interface ProductListProps {
  searchTerm: string;
  categoryId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export function ProductList({ searchTerm, categoryId, status }: ProductListProps) {
  const [page, setPage] = useState(1);
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    sku: string;
    name: string;
    description?: string | null;
    categoryId?: string | null;
    category?: { id: string; name: string } | null;
    uomId?: string | null;
    unitOfMeasure?: { id: string; description: string; code: string } | null;
    defaultSupplierId?: string | null;
    defaultSupplier?: { id: string; name: string } | null;
    defaultCost?: number | null;
    defaultPrice?: number | null;
    weightKg?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    reorderPoint?: number | null;
    reorderQty?: number | null;
    isActive?: boolean;
  } | null>(null);
  const limit = 20;

  const utils = trpc.useUtils();

  // Fetch products
  const { data, isLoading, error } = trpc.items.list.useQuery({
    search: searchTerm,
    categoryId,
    isActive: status === undefined ? undefined : status === 'ACTIVE',
    page,
    limit,
  });

  // Mutations
  const duplicateMutation = trpc.items.duplicate.useMutation({
    onSuccess: () => {
      toast.success('Product duplicated successfully');
      utils.items.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const archiveMutation = trpc.items.archive.useMutation({
    onSuccess: () => {
      toast.success('Product archived successfully');
      utils.items.list.invalidate();
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
          <p className="text-gray-900 font-medium">Error loading products</p>
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

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit of Measure</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Reorder Point</TableHead>
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
            ) : data?.items.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No products found</p>
                  <p className="text-gray-600 text-sm mt-1">
                    {searchTerm ? 'Try adjusting your filters' : 'Start by adding your first product'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              // Product rows
              data?.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-gray-600 line-clamp-1">{item.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm">{item.sku}</code>
                  </TableCell>
                  <TableCell>
                    {item.category ? (
                      <span className="text-sm">{item.category.name}</span>
                    ) : (
                      <span className="text-sm text-gray-400">Uncategorized</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{item.unitOfMeasure?.description || 'Each'}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.defaultPrice ? formatCurrency(Number(item.defaultPrice)) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.reorderPoint || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? 'success' : 'secondary'}>
                      {item.isActive ? 'ACTIVE' : 'INACTIVE'}
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
                        <DropdownMenuItem onClick={() => setEditingProduct({
                          ...item,
                          defaultCost: item.defaultCost ? Number(item.defaultCost) : null,
                          defaultPrice: item.defaultPrice ? Number(item.defaultPrice) : null,
                          weightKg: item.weightKg ? Number(item.weightKg) : null,
                          lengthCm: item.lengthCm ? Number(item.lengthCm) : null,
                          widthCm: item.widthCm ? Number(item.widthCm) : null,
                          heightCm: item.heightCm ? Number(item.heightCm) : null,
                        })}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicateMutation.mutate({ 
                            itemId: item.id, 
                            newSku: `${item.sku}-COPY`,
                            newName: `${item.name} (Copy)`
                          })}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <BarChart className="mr-2 h-4 w-4" />
                          View History
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            archiveMutation.mutate({
                              itemIds: [item.id],
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
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {(page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, data.pagination.total)} of {data.pagination.total} products
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

      {/* Edit Product Dialog */}
      <EditProductDialog
        product={editingProduct}
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
      />
    </>
  );
}