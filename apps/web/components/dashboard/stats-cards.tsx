'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@ventry/ui';
import { BarChart3, Box, Building, Package, TrendingDown, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { API_ENDPOINTS, type InventoryStatsResponse } from '@ventry/shared';

export function StatsCards() {
  const [stats, setStats] = useState<InventoryStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.INVENTORY.STATS);
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load statistics</p>
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      description: 'Active products in catalog',
      color: 'text-blue-600',
    },
    {
      title: 'Total Locations',
      value: stats.totalLocations,
      icon: Building,
      description: 'Storage locations',
      color: 'text-green-600',
    },
    {
      title: 'Inventory Items',
      value: stats.totalItems,
      icon: Box,
      description: 'Total stock items',
      color: 'text-purple-600',
    },
    {
      title: 'Total Quantity',
      value: stats.totalValue,
      icon: BarChart3,
      description: 'Items in stock',
      color: 'text-orange-600',
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockItems,
      icon: TrendingDown,
      description: 'Below reorder point',
      color: 'text-red-600',
    },
    {
      title: 'Recent Movements',
      value: stats.recentMovements,
      icon: TrendingUp,
      description: 'Last 24 hours',
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
              <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}