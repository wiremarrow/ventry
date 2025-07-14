'use client';

import { useState } from 'react';
import { Input } from '@ventry/ui';
import { Button } from '@ventry/ui';
import { Plus, Search, Building2, TrendingUp, Clock } from 'lucide-react';
import { SupplierList } from '@/components/suppliers/supplier-list';
import { CreateSupplierDialog } from '@/components/suppliers/create-supplier-dialog';

export default function SuppliersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Suppliers</h1>
        <p className="text-gray-600">Manage your suppliers and track performance</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Suppliers</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <Building2 className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
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
              <p className="text-sm text-gray-600">Avg Lead Time</p>
              <p className="text-2xl font-bold">-- days</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Month</p>
              <p className="text-2xl font-bold">$--</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search suppliers by name, contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Supplier List */}
      <SupplierList searchTerm={searchTerm} />

      {/* Create Supplier Dialog */}
      <CreateSupplierDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}