'use client';

import { useState } from 'react';
import { Card, Input, Button, Badge, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Progress } from '@ventry/ui';
import { Plus, Search, MapPin, Thermometer, MoreHorizontal, Edit } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { Location } from '@ventry/database';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { LocationDialog } from '@/components/locations/location-dialog';

export default function LocationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [tempControlledFilter, setTempControlledFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // Fetch all warehouses for filter
  const { data: warehousesData } = trpc.warehouses.list.useQuery({});

  // Fetch locations from all warehouses
  const { data: locationsData, isLoading, refetch } = trpc.warehouses.listAllLocations.useQuery({
    search: searchTerm || undefined,
    warehouseId: warehouseFilter === 'all' ? undefined : warehouseFilter,
  });

  // Filter locations by temp controlled status
  const filteredLocations = locationsData?.locations?.filter(location => {
    if (tempControlledFilter === 'yes') return location.isTempControlled;
    if (tempControlledFilter === 'no') return !location.isTempControlled;
    return true;
  }) || [];

  // Calculate stats
  const stats = {
    total: locationsData?.locations?.length || 0,
    active: locationsData?.locations?.filter(l => l._count?.inventory > 0).length || 0,
    totalCapacity: locationsData?.locations?.reduce((sum, l) => sum + (l.maxCapacity || 0), 0) || 0,
    tempControlled: locationsData?.locations?.filter(l => l.isTempControlled).length || 0,
  };

  const handleEdit = (locationId: string) => {
    setSelectedLocation(locationId);
    setIsDialogOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedLocation(null);
    setIsDialogOpen(true);
  };

  type LocationWithCount = Location & { _count?: { inventory: number } };
  
  const formatLocationHierarchy = (location: LocationWithCount) => {
    const parts = [];
    if (location.zone) parts.push(`Zone ${location.zone}`);
    if (location.aisle) parts.push(`Aisle ${location.aisle}`);
    if (location.shelf) parts.push(`Shelf ${location.shelf}`);
    if (location.bin) parts.push(`Bin ${location.bin}`);
    return parts.join(' / ') || '-';
  };

  const calculateUtilization = (location: LocationWithCount) => {
    if (!location.maxCapacity || location.maxCapacity === 0) return 0;
    const currentItems = location._count?.inventory || 0;
    return (currentItems / location.maxCapacity) * 100;
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Locations</h1>
              <p className="text-muted-foreground">
                Manage storage locations across all warehouses
              </p>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Locations</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Active Locations</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Capacity</p>
                <p className="text-2xl font-bold">{stats.totalCapacity.toLocaleString()}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Temp Controlled</p>
                <p className="text-2xl font-bold">{stats.tempControlled}</p>
              </div>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehousesData?.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tempControlledFilter} onValueChange={(value) => setTempControlledFilter(value as 'all' | 'yes' | 'no')}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Temperature Control" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="yes">Temp Controlled Only</SelectItem>
                  <SelectItem value="no">Non-Temp Controlled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Locations Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        {searchTerm || warehouseFilter !== 'all' || tempControlledFilter !== 'all' 
                          ? 'No locations found matching your filters' 
                          : 'No locations created yet'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map((location) => {
                    const utilization = calculateUtilization(location);
                    return (
                      <TableRow key={location.id}>
                        <TableCell className="font-medium">{location.code}</TableCell>
                        <TableCell>{location.warehouse.name}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatLocationHierarchy(location)}</p>
                            {location.description && (
                              <p className="text-sm text-muted-foreground">{location.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {location.maxCapacity ? (
                            <div>
                              <p className="font-medium">{location.maxCapacity.toLocaleString()}</p>
                              <p className="text-sm text-muted-foreground">
                                {location._count?.inventory || 0} items
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unlimited</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {location.maxCapacity ? (
                            <div className="space-y-1">
                              <Progress value={utilization} className="h-2" />
                              <p className="text-xs text-muted-foreground">{utilization.toFixed(0)}%</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {location.isTempControlled && (
                            <Badge variant="secondary" className="gap-1">
                              <Thermometer className="h-3 w-3" />
                              Temp Controlled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(location.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Location Dialog */}
          <LocationDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            locationId={selectedLocation}
            onSuccess={() => {
              setIsDialogOpen(false);
              refetch();
            }}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}