'use client';

import { useEffect, useState } from 'react';
import { 
  Package, 
  Clock,
  AlertCircle,
  DollarSign 
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@ventry/ui';

import { trpc } from '@/lib/trpc';

interface Stats {
  totalOrders: number;
  totalValue: number;
  pendingOrders: number;
  overdueOrders: number;
  monthlyChange: {
    orders: number;
    value: number;
  };
}

export function PurchaseOrderStats() {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    totalValue: 0,
    pendingOrders: 0,
    overdueOrders: 0,
    monthlyChange: {
      orders: 0,
      value: 0,
    },
  });

  // Get current month stats
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  
  const currentMonthEnd = new Date();
  currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1);
  currentMonthEnd.setDate(0);
  currentMonthEnd.setHours(23, 59, 59, 999);

  // Get previous month stats for comparison
  const prevMonthStart = new Date(currentMonthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  
  const prevMonthEnd = new Date(currentMonthStart);
  prevMonthEnd.setDate(0);
  prevMonthEnd.setHours(23, 59, 59, 999);

  const { data: currentMonthData } = trpc.purchaseOrders.list.useQuery({
    dateFrom: currentMonthStart,
    dateTo: currentMonthEnd,
    limit: 1000, // Get all for stats
  });

  const { data: prevMonthData } = trpc.purchaseOrders.list.useQuery({
    dateFrom: prevMonthStart,
    dateTo: prevMonthEnd,
    limit: 1000,
  });

  const { data: pendingData } = trpc.purchaseOrders.list.useQuery({
    status: 'SUBMITTED',
    limit: 1000,
  });

  const { data: overdueData } = trpc.purchaseOrders.list.useQuery({
    isOverdue: true,
    limit: 1000,
  });

  useEffect(() => {
    if (currentMonthData && prevMonthData && pendingData && overdueData) {
      const currentTotal = currentMonthData.purchaseOrders.reduce(
        (sum, po) => sum + po.total,
        0
      );
      const prevTotal = prevMonthData.purchaseOrders.reduce(
        (sum, po) => sum + po.total,
        0
      );

      const orderChange = prevMonthData.pagination.total > 0
        ? ((currentMonthData.pagination.total - prevMonthData.pagination.total) / prevMonthData.pagination.total) * 100
        : 0;

      const valueChange = prevTotal > 0
        ? ((currentTotal - prevTotal) / prevTotal) * 100
        : 0;

      setStats({
        totalOrders: currentMonthData.pagination.total,
        totalValue: currentTotal,
        pendingOrders: pendingData.pagination.total,
        overdueOrders: overdueData.pagination.total,
        monthlyChange: {
          orders: orderChange,
          value: valueChange,
        },
      });
    }
  }, [currentMonthData, prevMonthData, pendingData, overdueData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Orders (This Month)
          </CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalOrders}</div>
          <p className="text-xs text-muted-foreground">
            <span className={stats.monthlyChange.orders >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatPercentage(stats.monthlyChange.orders)}
            </span>
            {' '}from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Value (This Month)
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(stats.totalValue)}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className={stats.monthlyChange.value >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatPercentage(stats.monthlyChange.value)}
            </span>
            {' '}from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pending Approval
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingOrders}</div>
          <p className="text-xs text-muted-foreground">
            Awaiting approval
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Overdue Orders
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {stats.overdueOrders}
          </div>
          <p className="text-xs text-muted-foreground">
            Past expected date
          </p>
        </CardContent>
      </Card>
    </div>
  );
}