'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ventry/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ventry/ui';
import { Button } from '@ventry/ui';
import { Badge } from '@ventry/ui';
import { Skeleton } from '@ventry/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ventry/ui';
import {
  MapPin,
  Building2,
  Package,
  MoreHorizontal,
  Edit,
  Plus,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { CreateLocationDialog } from './create-location-dialog';
import { EditLocationDialog } from './edit-location-dialog';

interface WarehouseDetailsDialogProps {
  warehouseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WarehouseDetailsDialog({ 
  warehouseId, 
  open, 
  onOpenChange 
}: WarehouseDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<unknown>(null);

  const utils = trpc.useUtils();

  // Fetch warehouse details
  const { data: warehouse, isLoading } = trpc.warehouses.get.useQuery(
    { id: warehouseId!, includeLocations: true },
    { enabled: !!warehouseId }
  );

  // Fetch warehouse stats
  const { data: stats } = trpc.warehouses.getStats.useQuery(
    { warehouseId: warehouseId! },
    { enabled: !!warehouseId }
  );

  // Delete location mutation
  const deleteLocationMutation = trpc.warehouses.locations.delete.useMutation({
    onSuccess: () => {
      toast.success('Location deleted successfully');
      utils.warehouses.get.invalidate();
      utils.warehouses.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!warehouseId) return null;

  const formatCapacity = (capacity: number | null) => {
    if (!capacity) return 'Unlimited';
    return capacity.toLocaleString();
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const groupLocationsByZone = (locations: unknown[]) => {
    return locations.reduce((groups: Record<string, unknown[]>, location: unknown) => {
      const zone = location.zone || 'No Zone';
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(location);
      return groups;
    }, {});
  };

  const renderOverview = () => (
    <div className="space-y-4">
      {/* Warehouse Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Warehouse Information</h3>
          <div className="space-y-2 text-sm">
            <div><strong>Code:</strong> {warehouse?.code}</div>
            <div><strong>Name:</strong> {warehouse?.name}</div>
            <div><strong>Address:</strong> {warehouse?.line1}</div>
            {warehouse?.line2 && <div>{warehouse.line2}</div>}
            <div>{warehouse?.city}, {warehouse?.state} {warehouse?.postalCode}</div>
            <div>{warehouse?.country}</div>
            {warehouse?.phone && <div><strong>Phone:</strong> {warehouse.phone}</div>}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {warehouse?.stats?.locationCount || 0}
              </div>
              <div className="text-sm text-gray-600">Locations</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {warehouse?.stats?.inventoryCount || 0}
              </div>
              <div className="text-sm text-gray-600">Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {warehouse?.stats?.totalStock || 0}
              </div>
              <div className="text-sm text-gray-600">Total Stock</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {warehouse?.stats?.utilizationRate || 0}%
              </div>
              <div className="text-sm text-gray-600">Utilized</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Preview */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
        </h3>
        <p className="text-sm text-gray-600">
          View detailed activity in the Analytics tab
        </p>
      </div>
    </div>
  );

  const renderLocations = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Location Management</h3>
        <Button onClick={() => setCreateLocationOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {warehouse?.locations && warehouse.locations.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupLocationsByZone(warehouse.locations)).map(([zone, locations]) => (
            <div key={zone} className="space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {zone} ({locations.length} locations)
              </h4>
              
              <div className="bg-white rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead className="text-right">Inventory</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                      <TableHead>Temp Control</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.map((location: unknown) => {
                      const inventoryCount = location._count?.inventory || 0;
                      const utilization = location.maxCapacity && inventoryCount > 0
                        ? Math.round((inventoryCount / location.maxCapacity) * 100)
                        : 0;

                      return (
                        <TableRow key={location.id}>
                          <TableCell>
                            <code className="text-sm">{location.code}</code>
                          </TableCell>
                          <TableCell>
                            {location.description || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {[location.aisle, location.shelf, location.bin]
                                .filter(Boolean)
                                .join(' - ') || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCapacity(location.maxCapacity)}
                          </TableCell>
                          <TableCell className="text-right">
                            {inventoryCount}
                          </TableCell>
                          <TableCell className="text-right">
                            {location.maxCapacity ? (
                              <span className={`text-sm font-medium px-2 py-1 rounded ${getUtilizationColor(utilization)}`}>
                                {utilization}%
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={location.isTempControlled ? 'default' : 'secondary'}>
                              {location.isTempControlled ? 'Yes' : 'No'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setEditingLocation(location)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => deleteLocationMutation.mutate({ id: location.id })}
                                  className="text-red-600"
                                  disabled={inventoryCount > 0}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">No locations found</p>
          <p className="text-gray-600 text-sm mt-1">Start by adding your first location</p>
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-4">
      {stats ? (
        <div className="space-y-6">
          {/* Location Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Locations</p>
                  <p className="text-2xl font-bold">{stats.locations.total}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Occupied</p>
                  <p className="text-2xl font-bold">{stats.locations.occupied}</p>
                </div>
                <Package className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Utilization</p>
                  <p className="text-2xl font-bold">{stats.locations.utilizationRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Inventory Statistics */}
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="font-medium mb-4">Inventory Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-lg font-semibold">{stats.inventory.totalItems}</div>
                <div className="text-sm text-gray-600">Unique Items</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{stats.inventory.totalQuantity}</div>
                <div className="text-sm text-gray-600">Total Quantity</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{stats.inventory.availableQuantity}</div>
                <div className="text-sm text-gray-600">Available</div>
              </div>
              <div>
                <div className="text-lg font-semibold">${stats.inventory.totalValue.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Total Value</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">No analytics available</p>
          <p className="text-gray-600 text-sm mt-1">Statistics will appear once you have inventory data</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {warehouse?.name || 'Warehouse Details'}
            </DialogTitle>
            <DialogDescription>
              Manage warehouse locations and view performance statistics
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : warehouse ? (
            <div className="space-y-4">
              {/* Navigation */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('locations')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'locations'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Locations
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Analytics
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'locations' && renderLocations()}
              {activeTab === 'analytics' && renderAnalytics()}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-900 font-medium">Warehouse not found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Location Dialog */}
      <CreateLocationDialog
        warehouseId={warehouseId}
        open={createLocationOpen}
        onOpenChange={setCreateLocationOpen}
      />

      {/* Edit Location Dialog */}
      <EditLocationDialog
        location={editingLocation}
        open={!!editingLocation}
        onOpenChange={(open) => !open && setEditingLocation(null)}
      />
    </>
  );
}