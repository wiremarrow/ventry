'use client';

import { useState } from 'react';
import { Card, Input, Button, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ventry/ui';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Package,
  XCircle,
  Send
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CreateShipmentDialog } from '@/components/shipments/create-shipment-dialog';
import { ShipmentDetailsDialog } from '@/components/shipments/shipment-details-dialog';
import { ShipmentStatusBadge } from '@/components/shipments/shipment-status-badge';

export default function ShipmentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: 30, to: 0 }); // Last 30 days
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Calculate date filter
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - dateRange.from);
  const dateTo = new Date();
  dateTo.setDate(dateTo.getDate() - dateRange.to);

  // Fetch shipments with filtering
  const { data, isLoading, refetch } = trpc.shipments.list.useQuery({
    search: searchTerm || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter as any,
    dateFrom,
    dateTo,
    limit: 100,
  });

  // Ship mutation
  const shipMutation = trpc.shipments.ship.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Shipment marked as shipped',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to ship',
        variant: 'destructive',
      });
    },
  });

  // Cancel mutation
  const cancelMutation = trpc.shipments.cancel.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Shipment cancelled',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel shipment',
        variant: 'destructive',
      });
    },
  });

  const handleShip = (shipmentId: string) => {
    const trackingNumber = prompt('Enter tracking number (optional):');
    shipMutation.mutate({ 
      id: shipmentId, 
      trackingNumber: trackingNumber || undefined 
    });
  };

  const handleCancel = (shipmentId: string) => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (reason) {
      cancelMutation.mutate({ id: shipmentId, reason });
    }
  };

  const handleViewDetails = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setDetailsDialogOpen(true);
  };

  // Stats from the response
  const stats = data?.stats || {
    total: 0,
    pending: 0,
    shipped: 0,
    delivered: 0,
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Shipments</h1>
              <p className="text-muted-foreground">
                Manage order shipments and track deliveries
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Shipment
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Shipments</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
                {stats.pending > 0 && (
                  <p className="text-xs text-orange-600">Ready to ship</p>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Shipped</p>
                <p className="text-2xl font-bold">{stats.shipped}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold">{stats.delivered}</p>
              </div>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by shipment number, tracking number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PACKED">Packed</SelectItem>
                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="RETURNED">Returned</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={`${dateRange.from}`} 
                onValueChange={(value) => setDateRange({ from: parseInt(value), to: 0 })}
              >
                <SelectTrigger className="w-40">
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
          </Card>

          {/* Shipments Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment #</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Ship Date</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.shipments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">No shipments found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.shipments?.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-medium">
                        {shipment.shipmentNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {shipment.order.orderNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        {shipment.order?.customer?.firstName || ''} {shipment.order?.customer?.lastName || ''}
                      </TableCell>
                      <TableCell>
                        {shipment.shipDate ? formatDate(shipment.shipDate) : '-'}
                      </TableCell>
                      <TableCell>
                        {shipment.carrier ? (
                          <div>
                            <p className="font-medium">{shipment.carrier.name}</p>
                            {shipment.carrierService && (
                              <p className="text-sm text-muted-foreground">{shipment.carrierService}</p>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {shipment.trackingNumber ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {shipment.trackingNumber}
                          </code>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <ShipmentStatusBadge status={shipment.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(shipment.id)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {['PENDING', 'PACKED'].includes(shipment.status) && (
                              <DropdownMenuItem
                                onClick={() => handleShip(shipment.id)}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Mark as Shipped
                              </DropdownMenuItem>
                            )}
                            {['PENDING', 'PACKED'].includes(shipment.status) && (
                              <DropdownMenuItem
                                onClick={() => handleCancel(shipment.id)}
                                className="text-destructive"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel Shipment
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Dialogs */}
        <CreateShipmentDialog 
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            setCreateDialogOpen(false);
            refetch();
          }}
        />

        {selectedShipmentId && (
          <ShipmentDetailsDialog
            shipmentId={selectedShipmentId}
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}