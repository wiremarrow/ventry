'use client';

import { useState, useMemo } from 'react';
import { Card, Input, Button, Badge, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ventry/ui';
import { Plus, Search, TrendingUp, TrendingDown, MoreHorizontal, Eye, RotateCcw, Calendar } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { MovementDialog } from '@/components/movements/movement-dialog';
import { MovementDetailsDialog } from '@/components/movements/movement-details-dialog';
import { MovementTypeBadge, type MovementType } from '@/components/movements/movement-type-badge';
import { formatDate } from '@/lib/utils';

export default function MovementsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: 7, to: 0 }); // Last 7 days
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Calculate date filters - memoized to prevent re-renders
  const { dateFrom, dateTo } = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - dateRange.from);
    const to = new Date();
    to.setDate(to.getDate() - dateRange.to);
    return { dateFrom: from, dateTo: to };
  }, [dateRange.from, dateRange.to]);

  // Fetch movements
  const { data: movementsData, isLoading, refetch } = trpc.stockMovements.list.useQuery({
    movementType: movementTypeFilter === 'all' ? undefined : movementTypeFilter as MovementType,
    dateFrom,
    dateTo,
    page,
    limit: 50,
    sortBy: 'movedAt',
    sortOrder: 'desc',
  });

  // Filter movements by search term
  const filteredMovements = movementsData?.movements?.filter(movement => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      movement.item.sku.toLowerCase().includes(search) ||
      movement.item.name.toLowerCase().includes(search) ||
      movement.notes?.toLowerCase().includes(search) ||
      movement.refId?.toLowerCase().includes(search)
    );
  }) || [];

  // Calculate stats
  const stats = {
    total: movementsData?.pagination.total || 0,
    inbound: movementsData?.movements?.filter(m => m.movementType === 'INBOUND').reduce((sum, m) => sum + m.qty, 0) || 0,
    outbound: movementsData?.movements?.filter(m => m.movementType === 'OUTBOUND').reduce((sum, m) => sum + m.qty, 0) || 0,
    netChange: 0,
  };
  stats.netChange = stats.inbound - stats.outbound;


  const formatLocation = (location: any) => {
    if (!location) return '-';
    return `${location.warehouse.name} > ${location.code}`;
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Stock Movements</h1>
              <p className="text-muted-foreground">
                Track inventory movements across all warehouses
              </p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Movement
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Movements</p>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Last {dateRange.from} days</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Inbound Qty</p>
                <p className="text-2xl font-bold text-green-600">+{stats.inbound.toLocaleString()}</p>
                <Badge variant="default" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Received
                </Badge>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Outbound Qty</p>
                <p className="text-2xl font-bold text-red-600">-{stats.outbound.toLocaleString()}</p>
                <Badge variant="destructive" className="text-xs">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Shipped
                </Badge>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Net Change</p>
                <p className={`text-2xl font-bold ${stats.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.netChange >= 0 ? '+' : ''}{stats.netChange.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Period balance</p>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by SKU, item name, or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="INBOUND">Inbound</SelectItem>
                  <SelectItem value="OUTBOUND">Outbound</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                  <SelectItem value="DAMAGE">Damage</SelectItem>
                  <SelectItem value="LOSS">Loss</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange.from.toString()} onValueChange={(value) => setDateRange({ ...dateRange, from: parseInt(value) })}>
                <SelectTrigger className="w-48">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Movements Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Moved By</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <p className="text-muted-foreground">
                        {searchTerm || movementTypeFilter !== 'all' 
                          ? 'No movements found matching your filters' 
                          : 'No stock movements recorded yet'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{formatDate(movement.movedAt)}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(movement.movedAt).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit', 
                              hour12: true 
                            })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell><MovementTypeBadge type={movement.movementType} /></TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{movement.item.sku}</p>
                          <p className="text-sm text-muted-foreground">{movement.item.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{movement.qty.toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{formatLocation(movement.fromLocation)}</TableCell>
                      <TableCell className="text-sm">{formatLocation(movement.toLocation)}</TableCell>
                      <TableCell className="text-sm">
                        {movement.movedBy.firstName} {movement.movedBy.lastName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {movement.refType && movement.refId ? (
                          <Badge variant="outline" className="text-xs">
                            {movement.refType}: {movement.refId}
                          </Badge>
                        ) : (
                          '-'
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
                            <DropdownMenuItem onClick={() => {
                              setSelectedMovement(movement.id);
                              setDetailsOpen(true);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reverse
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {movementsData && movementsData.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm">
                Page {page} of {movementsData.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === movementsData.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}

          {/* Movement Dialog */}
          <MovementDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onSuccess={() => {
              setIsDialogOpen(false);
              refetch();
            }}
          />

          {/* Movement Details Dialog */}
          <MovementDetailsDialog
            movementId={selectedMovement}
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            onReversed={() => {
              refetch();
            }}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}