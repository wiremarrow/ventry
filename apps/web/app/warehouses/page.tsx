'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { WarehouseList } from '@/components/warehouses/warehouse-list';
import { CreateWarehouseDialog } from '@/components/warehouses/create-warehouse-dialog';
import { Button } from '@ventry/ui';
import { Input } from '@ventry/ui';
import { Plus, Download, Upload, Search, Warehouse, Building2, MapPin } from 'lucide-react';
import { trpc } from '@/lib/trpc';

// Type for warehouse with stats
type WarehouseWithStats = {
  id: string;
  code: string;
  name: string;
  _count?: { locations: number };
  stats?: {
    locationCount: number;
    totalCapacity: number;
    occupiedLocations: number;
    inventoryCount: number;
    totalStock: number;
    reservedStock: number;
    utilizationRate: number;
  };
};

export default function WarehousesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch warehouses with stats for overview
  const { data: warehousesData } = trpc.warehouses.list.useQuery({
    includeStats: true,
  });

  const totalWarehouses = warehousesData?.length || 0;
  const totalLocations = warehousesData?.reduce((sum, warehouse) => sum + (warehouse._count?.locations || 0), 0) || 0;
  const totalCapacity = warehousesData?.reduce((sum, warehouse: WarehouseWithStats) => sum + (warehouse.stats?.totalCapacity || 0), 0) || 0;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Warehouses</h1>
              <p className="text-gray-600">Manage warehouse locations and storage capacity</p>
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
                Add Warehouse
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Warehouses</p>
                  <p className="text-2xl font-bold">{totalWarehouses}</p>
                </div>
                <Warehouse className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Locations</p>
                  <p className="text-2xl font-bold">{totalLocations}</p>
                </div>
                <MapPin className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Capacity</p>
                  <p className="text-2xl font-bold">{totalCapacity > 0 ? totalCapacity.toLocaleString() : 'Unlimited'}</p>
                </div>
                <Building2 className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Search warehouses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Warehouse List */}
          <WarehouseList searchTerm={searchTerm} />

          {/* Create Warehouse Dialog */}
          <CreateWarehouseDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}