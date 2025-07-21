'use client';

import { useState } from 'react';
import { Button } from '@ventry/ui';
import { Card } from '@ventry/ui';
import { Badge } from '@ventry/ui';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Package,
  AlertTriangle,
  DollarSign,
  Users,
  Truck,
  BarChart3,
  PieChart,
  Activity,
} from 'lucide-react';

const reports = [
  {
    id: 'inventory-valuation',
    name: 'Inventory Valuation',
    description: 'Current stock value by warehouse and category',
    icon: DollarSign,
    category: 'Financial',
    frequency: 'Daily',
    lastRun: '2 hours ago',
  },
  {
    id: 'stock-movement',
    name: 'Stock Movement Report',
    description: 'Detailed movement history with reasons and users',
    icon: Package,
    category: 'Operations',
    frequency: 'Weekly',
    lastRun: '1 day ago',
  },
  {
    id: 'low-stock-alert',
    name: 'Low Stock Alert',
    description: 'Items below reorder point across all locations',
    icon: AlertTriangle,
    category: 'Alerts',
    frequency: 'Real-time',
    lastRun: 'Live',
  },
  {
    id: 'sales-analysis',
    name: 'Sales Analysis',
    description: 'Revenue trends, top products, and customer insights',
    icon: TrendingUp,
    category: 'Sales',
    frequency: 'Monthly',
    lastRun: '3 days ago',
  },
  {
    id: 'supplier-performance',
    name: 'Supplier Performance',
    description: 'Lead times, quality metrics, and cost analysis',
    icon: Users,
    category: 'Procurement',
    frequency: 'Monthly',
    lastRun: '5 days ago',
  },
  {
    id: 'order-fulfillment',
    name: 'Order Fulfillment',
    description: 'Fill rates, delivery times, and backorder analysis',
    icon: Truck,
    category: 'Operations',
    frequency: 'Weekly',
    lastRun: '2 days ago',
  },
  {
    id: 'inventory-turnover',
    name: 'Inventory Turnover',
    description: 'Stock rotation analysis by product and category',
    icon: Activity,
    category: 'Financial',
    frequency: 'Monthly',
    lastRun: '1 week ago',
  },
  {
    id: 'profitability-analysis',
    name: 'Profitability Analysis',
    description: 'Margin analysis by product, customer, and channel',
    icon: PieChart,
    category: 'Financial',
    frequency: 'Monthly',
    lastRun: '4 days ago',
  },
  {
    id: 'demand-forecast',
    name: 'Demand Forecast',
    description: 'Predictive analysis for future inventory needs',
    icon: BarChart3,
    category: 'Analytics',
    frequency: 'Weekly',
    lastRun: '6 hours ago',
  },
];

const categories = ['All', 'Financial', 'Operations', 'Sales', 'Procurement', 'Analytics', 'Alerts'];

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const filteredReports = selectedCategory === 'All' 
    ? reports 
    : reports.filter(report => report.category === selectedCategory);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Financial: 'bg-blue-100 text-blue-800',
      Operations: 'bg-green-100 text-green-800',
      Sales: 'bg-purple-100 text-purple-800',
      Procurement: 'bg-orange-100 text-orange-800',
      Analytics: 'bg-indigo-100 text-indigo-800',
      Alerts: 'bg-red-100 text-red-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getFrequencyBadge = (frequency: string): 'destructive' | 'success' | 'warning' | 'secondary' => {
    if (frequency === 'Real-time') return 'destructive';
    if (frequency === 'Daily') return 'success';
    if (frequency === 'Weekly') return 'warning';
    return 'secondary';
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Reports</h1>
              <p className="text-muted-foreground">Generate insights and analytics from your inventory data</p>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => {
              const Icon = report.icon;
              return (
                <Card key={report.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>
                    <Badge variant={getFrequencyBadge(report.frequency)}>
                      {report.frequency}
                    </Badge>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-2">{report.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(report.category)}`}>
                      {report.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Last run: {report.lastRun}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button className="flex-1" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm">
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Reports Run Today</p>
                  <p className="text-2xl font-bold">23</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled Reports</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <Calendar className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Alerts</p>
                  <p className="text-2xl font-bold">3</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Report Templates</p>
                  <p className="text-2xl font-bold">15</p>
                </div>
                <FileText className="h-8 w-8 text-purple-500" />
              </div>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}