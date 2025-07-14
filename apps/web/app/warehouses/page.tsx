'use client';

import { useState } from 'react';
import { Input } from '@ventry/ui';
import { Button } from '@ventry/ui';
import { Plus, Warehouse, Search } from 'lucide-react';
import { WarehouseList } from '@/components/warehouses/warehouse-list';
import { CreateWarehouseDialog } from '@/components/warehouses/create-warehouse-dialog';

export default function WarehousesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Warehouses</h1>
        <p className="text-gray-600">Manage your warehouse locations and capacity</p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Warehouse
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Warehouses</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <Warehouse className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Locations</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <div className="text-blue-500">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse List */}
      <WarehouseList searchTerm={searchTerm} />

      {/* Create Warehouse Dialog */}
      <CreateWarehouseDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}