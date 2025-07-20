'use client';

import { useState } from 'react';
import { Plus, Search, Building2, TrendingUp, Clock } from 'lucide-react';

import { Button, Input } from '@ventry/ui';

import { SupplierList } from '@/components/suppliers/supplier-list';
import { CreateSupplierDialog } from '@/components/suppliers/create-supplier-dialog';
import { trpc } from '@/lib/trpc';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function SuppliersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  
  // Fetch supplier stats
  const { data: statsData } = trpc.suppliers.getStats.useQuery();
  
  // Calculate stats
  const totalSuppliers = statsData?.total || 0;
  const activeSuppliers = statsData?.active || 0;
  const avgLeadTime = statsData?.avgLeadTimeDays || 0;
  const monthlyPurchaseValue = statsData?.monthlyPurchaseValue || 0;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Suppliers</h1>
              <p className="text-gray-600">Manage your suppliers and track performance</p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Suppliers</p>
                  <p className="text-2xl font-bold">{totalSuppliers}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold">{activeSuppliers}</p>
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
                  <p className="text-2xl font-bold">{avgLeadTime.toFixed(1)} days</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">This Month</p>
                  <p className="text-2xl font-bold">${monthlyPurchaseValue.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
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
      </DashboardLayout>
    </ProtectedRoute>
  );
}