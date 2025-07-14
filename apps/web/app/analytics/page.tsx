'use client';

import { useState } from 'react';
import { Card, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Badge } from '@ventry/ui';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  Activity,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';

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
          <div className={`flex items-center gap-1 mt-2 text-sm ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
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
  const { data: dashboardData, isLoading: dashboardLoading } = trpc.analytics.dashboard.useQuery({
    days: parseInt(dateRange),
  });

  const { data: trendsData, isLoading: trendsLoading } = trpc.analytics.trends.useQuery({
    days: parseInt(dateRange),
    metric: 'sales',
  });

  const { data: kpisData, isLoading: kpisLoading } = trpc.analytics.kpis.useQuery();

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
  const salesTrendData = trendsData?.daily.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sales: item.value,
  })) || [];

  const categoryData = dashboardData?.categoryBreakdown.map(cat => ({
    name: cat.name,
    value: cat.value,
  })) || [];

  const topProductsData = dashboardData?.topProducts.slice(0, 10).map(product => ({
    name: product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name,
    quantity: product.quantity,
    revenue: product.revenue,
  })) || [];

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor your business performance and trends
            </p>
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
            value={formatCurrency(dashboardData?.revenue || 0)}
            change={dashboardData?.revenueChange || 0}
            icon={DollarSign}
            loading={dashboardLoading}
          />
          <MetricCard
            title="Orders"
            value={dashboardData?.orderCount || 0}
            change={dashboardData?.orderChange || 0}
            icon={ShoppingCart}
            loading={dashboardLoading}
          />
          <MetricCard
            title="Active Customers"
            value={dashboardData?.activeCustomers || 0}
            change={dashboardData?.customerChange || 0}
            icon={Users}
            loading={dashboardLoading}
          />
          <MetricCard
            title="Inventory Value"
            value={formatCurrency(dashboardData?.inventoryValue || 0)}
            change={dashboardData?.inventoryChange || 0}
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
                  <p className="text-xl font-semibold">{kpisData.inventoryTurnover.toFixed(2)}x</p>
                  {kpisData.inventoryTurnover > 4 ? (
                    <Badge variant="default" className="text-xs">Good</Badge>
                  ) : kpisData.inventoryTurnover > 2 ? (
                    <Badge variant="secondary" className="text-xs">Average</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Low</Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-xl font-semibold mt-1">
                  {formatCurrency(kpisData.averageOrderValue)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fulfillment Rate</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-xl font-semibold">{kpisData.fulfillmentRate.toFixed(1)}%</p>
                  {kpisData.fulfillmentRate > 95 ? (
                    <Badge variant="default" className="text-xs">Excellent</Badge>
                  ) : kpisData.fulfillmentRate > 90 ? (
                    <Badge variant="secondary" className="text-xs">Good</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">Needs Improvement</Badge>
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
              {dashboardData?.lowStockItems && dashboardData.lowStockItems > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Low Stock Alert</p>
                    <p className="text-sm text-muted-foreground">
                      {dashboardData.lowStockItems} items are below reorder point
                    </p>
                  </div>
                </div>
              )}
              
              {dashboardData?.expiringItems && dashboardData.expiringItems > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <Activity className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Expiring Items</p>
                    <p className="text-sm text-muted-foreground">
                      {dashboardData.expiringItems} items expiring within 30 days
                    </p>
                  </div>
                </div>
              )}

              {trendsData?.trend === 'up' && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Positive Trend</p>
                    <p className="text-sm text-muted-foreground">
                      Sales are up {trendsData.percentageChange.toFixed(1)}% compared to previous period
                    </p>
                  </div>
                </div>
              )}

              {trendsData?.trend === 'down' && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Declining Trend</p>
                    <p className="text-sm text-muted-foreground">
                      Sales are down {Math.abs(trendsData.percentageChange).toFixed(1)}% compared to previous period
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Warehouse Performance */}
        {dashboardData?.warehousePerformance && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Warehouse Performance</h3>
            <div className="space-y-4">
              {dashboardData.warehousePerformance.map((warehouse) => (
                <div key={warehouse.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{warehouse.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {warehouse.utilizationPercentage.toFixed(0)}% utilized
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${warehouse.utilizationPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{warehouse.itemCount} items</span>
                    <span>{warehouse.movementCount} movements today</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}