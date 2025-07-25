'use client';

import { useState } from 'react';

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Badge,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@ventry/ui';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';

// Chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ElementType;
  loading?: boolean;
}

function MetricCard({ title, value, change, icon: Icon, loading }: MetricCardProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  const isPositive = change >= 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          <div
            className={`flex items-center gap-1 mt-2 text-sm ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            <span>{Math.abs(change)}%</span>
            <span className="text-muted-foreground">vs last month</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg bg-primary/10`}>
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30');

  // Fetch analytics data
  const period =
    dateRange === '1'
      ? 'today'
      : dateRange === '7'
        ? 'last7days'
        : dateRange === '30'
          ? 'last30days'
          : dateRange === '90'
            ? 'last90days'
            : 'last30days';

  const { data: dashboardData, isLoading: dashboardLoading } = trpc.analytics.dashboard.useQuery({
    period,
  });

  const { data: trendsData, isLoading: trendsLoading } = trpc.analytics.trends.useQuery({
    period,
    metric: 'revenue',
    groupBy: 'day',
  });

  const { data: kpisData, isLoading: kpisLoading } = trpc.analytics.kpis.useQuery({
    period,
  });

  // Loading state
  if (dashboardLoading || trendsLoading || kpisLoading) {
    return (
      <ProtectedRoute>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </ProtectedRoute>
    );
  }

  // Prepare chart data
  const salesTrendData =
    trendsData?.data.map((item) => ({
      date: new Date(item.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales: item.value,
    })) || [];

  // TODO: Add categoryBreakdown to analytics API
  const categoryData = [] as { name: string; value: number }[];

  // TODO: Add topProducts to analytics API
  const topProductsData = [] as { name: string; quantity: number; revenue: number }[];

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Monitor your business performance and trends</p>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(dashboardData?.sales.totalRevenue || 0)}
            change={dashboardData?.sales.change || 0}
            icon={DollarSign}
            loading={dashboardLoading}
          />
          <MetricCard
            title="Orders"
            value={dashboardData?.sales.orderCount || 0}
            change={dashboardData?.sales.change || 0}
            icon={ShoppingCart}
            loading={dashboardLoading}
          />
          <MetricCard
            title="Active Customers"
            value={dashboardData?.entities.activeCustomers || 0}
            change={0}
            icon={Users}
            loading={dashboardLoading}
          />
          <MetricCard
            title="Inventory Value"
            value={formatCurrency(dashboardData?.inventory.totalValue || 0)}
            change={0}
            icon={Package}
            loading={dashboardLoading}
          />
        </div>

        {/* Performance Indicators */}
        {kpisData && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Key Performance Indicators</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Inventory Turnover</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-xl font-semibold">
                    {(kpisData.kpis.inventoryTurnover?.value || 0).toFixed(2)}x
                  </p>
                  {(kpisData.kpis.inventoryTurnover?.value || 0) > 4 ? (
                    <Badge variant="default" className="text-xs">
                      Good
                    </Badge>
                  ) : (kpisData.kpis.inventoryTurnover?.value || 0) > 2 ? (
                    <Badge variant="secondary" className="text-xs">
                      Average
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      Low
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-xl font-semibold mt-1">
                  {formatCurrency(kpisData.kpis.averageOrderValue?.value || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fulfillment Rate</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-xl font-semibold">
                    {(kpisData.kpis.orderFulfillmentRate?.value || 0).toFixed(1)}%
                  </p>
                  {(kpisData.kpis.orderFulfillmentRate?.value || 0) > 95 ? (
                    <Badge variant="default" className="text-xs">
                      Excellent
                    </Badge>
                  ) : (kpisData.kpis.orderFulfillmentRate?.value || 0) > 90 ? (
                    <Badge variant="secondary" className="text-xs">
                      Good
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      Needs Improvement
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Sales Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#0088FE"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Category Breakdown */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Sales by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Top Products</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProductsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantity" fill="#00C49F" name="Quantity Sold" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Alerts & Insights */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Alerts & Insights</h3>
            <div className="space-y-4">
              {dashboardData?.inventory.lowStockItems &&
                dashboardData.inventory.lowStockItems > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Low Stock Alert</p>
                      <p className="text-sm text-muted-foreground">
                        {dashboardData.inventory.lowStockItems} items are below reorder point
                      </p>
                    </div>
                  </div>
                )}

              {dashboardData?.inventory.expiringItems &&
                dashboardData.inventory.expiringItems > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <Activity className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Expiring Items</p>
                      <p className="text-sm text-muted-foreground">
                        {dashboardData.inventory.expiringItems} items expiring within 30 days
                      </p>
                    </div>
                  </div>
                )}

              {trendsData?.summary?.trend && trendsData.summary.trend > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Positive Trend</p>
                    <p className="text-sm text-muted-foreground">
                      Sales are up {Math.abs(trendsData.summary.trend || 0).toFixed(1)}% compared to
                      previous period
                    </p>
                  </div>
                </div>
              )}

              {trendsData?.summary?.trend && trendsData.summary.trend < 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Declining Trend</p>
                    <p className="text-sm text-muted-foreground">
                      Sales are down {Math.abs(trendsData.summary.trend || 0).toFixed(1)}% compared
                      to previous period
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Warehouse Performance - TODO: Add topWarehouses to analytics API */}
        {/* {dashboardData?.entities.topWarehouses && Array.isArray(dashboardData.entities.topWarehouses) && dashboardData.entities.topWarehouses.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Warehouse Performance</h3>
            <div className="space-y-4">
              {dashboardData.entities.topWarehouses.map((warehouse) => (
                <div key={warehouse.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{warehouse.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {((warehouse.qtyOnHand / warehouse.locationCount) * 10).toFixed(0)}% utilized
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(warehouse.qtyOnHand / warehouse.locationCount) * 10}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{warehouse.qtyOnHand} items</span>
                    <span>{warehouse.locationCount} locations</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )} */}
      </div>
    </ProtectedRoute>
  );
}
