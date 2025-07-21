'use client';

import { useState } from 'react';
import { Card, Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ventry/ui';
import { Plus, Search } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { OrderList } from '@/components/orders/order-list';
import { CreateOrderDialog } from '@/components/orders/create-order-dialog';

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'CONFIRMED' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'all'>('all');

  // Fetch orders for stats
  const { data: ordersData } = trpc.orders.list.useQuery({
    limit: 100,
  });

  // Calculate stats
  const stats = {
    total: ordersData?.orders?.length || 0,
    pending: ordersData?.orders?.filter(o => o.status === 'PENDING').length || 0,
    processing: ordersData?.orders?.filter(o => ['CONFIRMED', 'PICKING', 'PACKED'].includes(o.status)).length || 0,
    totalRevenue: ordersData?.orders?.reduce((sum, o) => sum + parseFloat(o.total.toString()), 0) || 0,
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Sales Orders</h1>
              <p className="text-muted-foreground">
                Manage customer orders and track fulfillment
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold">{stats.processing}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders by number, customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'PENDING' | 'CONFIRMED' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'all')}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="PICKING">Picking</SelectItem>
                  <SelectItem value="PACKED">Packed</SelectItem>
                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Order List */}
          <OrderList searchTerm={searchTerm} status={statusFilter === 'all' ? undefined : statusFilter} />

          {/* Create Order Dialog */}
          <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}