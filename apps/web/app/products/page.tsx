'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { ProductList } from '@/components/products/product-list';
import { ProductFilters } from '@/components/products/product-filters';
import { CreateProductDialog } from '@/components/products/create-product-dialog';
import { Button } from '@ventry/ui';
import { Plus, Download, Upload } from 'lucide-react';

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'ACTIVE' | 'INACTIVE'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Products</h1>
              <p className="text-gray-600">Manage your product catalog</p>
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Filters */}
          <ProductFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
          />

          {/* Product List */}
          <ProductList
            searchTerm={searchTerm}
            categoryId={selectedCategory === 'all' ? undefined : selectedCategory}
            status={selectedStatus === 'all' ? undefined : selectedStatus}
          />

          {/* Create Product Dialog */}
          <CreateProductDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}