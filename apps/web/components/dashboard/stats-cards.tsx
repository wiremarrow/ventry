'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@ventry/ui';
import { BarChart3, Box, Building, Package, TrendingDown, TrendingUp } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface StatsCardsProps {
  refreshInterval?: number; // in milliseconds
}

export function StatsCards({ refreshInterval = 30000 }: StatsCardsProps = {}) {
  // Fetch live dashboard analytics data with auto-refresh
  const {
    data: analytics,
    isLoading: loading,
    error,
  } = trpc.analytics.dashboard.useQuery(
    {
      period: 'last30days',
      includeAllWarehouses: true,
    },
    {
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: true,
    }
  );

  // Fetch additional data for locations count with auto-refresh
  const { data: warehouses } = trpc.warehouses.list.useQuery(
    {
      includeInactive: false,
      includeStats: false,
    },
    {
      refetchInterval: refreshInterval,
      refetchIntervalInBackground: true,
    }
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load statistics</p>
        <p className="text-sm text-red-600 mt-2">{error.message}</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  // Calculate total locations across all warehouses
  const totalLocations =
    warehouses?.reduce((sum, warehouse) => sum + (warehouse._count?.locations || 0), 0) || 0;

  // Calculate recent movements (last 30 days)
  const recentMovements =
    (analytics.operations?.receipts || 0) +
    (analytics.operations?.shipments || 0) +
    (analytics.operations?.transfers || 0);

  const cards = [
    {
      title: 'Total Products',
      value: analytics.entities?.activeItems || 0,
      icon: Package,
      description: 'Active products in catalog',
      color: 'text-blue-600',
    },
    {
      title: 'Total Locations',
      value: totalLocations,
      icon: Building,
      description: 'Storage locations',
      color: 'text-green-600',
    },
    {
      title: 'Total Inventory',
      value: analytics.inventory?.totalOnHand || 0,
      icon: Box,
      description: 'Items on hand',
      color: 'text-purple-600',
    },
    {
      title: 'Inventory Value',
      value: `$${(analytics.inventory?.totalValue || 0).toLocaleString()}`,
      icon: BarChart3,
      description: 'Total stock value',
      color: 'text-orange-600',
    },
    {
      title: 'Low Stock Items',
      value: analytics.inventory?.lowStockItems || 0,
      icon: TrendingDown,
      description: 'Below reorder point',
      color: 'text-red-600',
    },
    {
      title: 'Recent Movements',
      value: recentMovements,
      icon: TrendingUp,
      description: 'Last 30 days',
      color: 'text-teal-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
