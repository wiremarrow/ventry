'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { InventoryList } from '@/components/inventory/inventory-list';
import { InventoryFilters } from '@/components/inventory/inventory-filters';
import { Button } from '@ventry/ui';
import { Plus, Download, Upload } from 'lucide-react';

export default function InventoryPage() {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
              <p className="text-gray-600">Manage stock levels across all warehouses</p>
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
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adjust Stock
              </Button>
            </div>
          </div>

          {/* Filters */}
          <InventoryFilters
            selectedWarehouse={selectedWarehouse}
            onWarehouseChange={setSelectedWarehouse}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            showLowStock={showLowStock}
            onLowStockChange={setShowLowStock}
          />

          {/* Inventory List */}
          <InventoryList
            warehouseId={selectedWarehouse}
            searchTerm={searchTerm}
            showLowStock={showLowStock}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}