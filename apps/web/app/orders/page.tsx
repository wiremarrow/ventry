'use client';

import { useState } from 'react';
import { Input, Button } from '@ventry/ui';
import { Plus, Search, ShoppingCart, Package, TrendingUp } from 'lucide-react';
import { OrderList } from '@/components/orders/order-list';
import { CreateOrderDialog } from '@/components/orders/create-order-dialog';

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Sales Orders</h1>
        <p className="text-gray-600">Manage customer orders and track fulfillment</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Processing</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <Package className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Revenue</p>
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
            placeholder="Search orders by number, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Status Filter */}
        <div className="flex gap-2">
          <Button
            variant={statusFilter === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('PENDING')}
          >
            Pending
          </Button>
          <Button
            variant={statusFilter === 'CONFIRMED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('CONFIRMED')}
          >
            Confirmed
          </Button>
          <Button
            variant={statusFilter === 'PROCESSING' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('PROCESSING')}
          >
            Processing
          </Button>
          <Button
            variant={statusFilter === 'SHIPPED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('SHIPPED')}
          >
            Shipped
          </Button>
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Order List */}
      <OrderList searchTerm={searchTerm} status={statusFilter} />

      {/* Create Order Dialog */}
      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}