'use client';

import { useState } from 'react';

import { RefreshCw, Settings } from 'lucide-react';

import { Button } from '@ventry/ui';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { trpc } from '@/lib/trpc';

export default function DashboardPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshInterval = 30000; // 30 seconds

  // Fetch health status for system status panel with auto-refresh
  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = trpc.health.check.useQuery(undefined, {
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: true,
  });

  const handleManualRefresh = () => {
    refetchHealth();
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Overview of your inventory management system</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={healthLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                onClick={toggleAutoRefresh}
              >
                <Settings className="h-4 w-4 mr-2" />
                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </Button>
            </div>
          </div>

          <StatsCards refreshInterval={autoRefresh ? refreshInterval : undefined} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <a
                  href="/inventory"
                  className="block p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <div className="font-medium text-blue-900">View Inventory</div>
                  <div className="text-sm text-blue-700">Check current stock levels</div>
                </a>
                <a
                  href="/products"
                  className="block p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <div className="font-medium text-green-900">Manage Products</div>
                  <div className="text-sm text-green-700">Add or edit product catalog</div>
                </a>
                <a
                  href="/movements"
                  className="block p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                >
                  <div className="font-medium text-purple-900">Recent Movements</div>
                  <div className="text-sm text-purple-700">Track inventory changes</div>
                </a>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
              {healthLoading ? (
                <div className="space-y-3">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">API Status</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        health?.services.api === 'healthy'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {health?.services.api === 'healthy' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Database</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        health?.services.database.status === 'connected'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {health?.services.database.status === 'connected'
                        ? 'Connected'
                        : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Last Sync</span>
                    <span className="text-xs text-gray-500">
                      {health?.timestamp
                        ? new Date(health.timestamp).toLocaleTimeString()
                        : 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Environment</span>
                    <span className="text-xs text-gray-500 capitalize">
                      {health?.environment || 'Unknown'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
