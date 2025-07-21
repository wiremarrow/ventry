'use client';

import { useState } from 'react';
import { Card, Input, Button, Skeleton, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ventry/ui';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Package,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatDateTime } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CreateReceiptDialog } from '@/components/receipts/create-receipt-dialog';
import { ReceiptDetailsDialog } from '@/components/receipts/receipt-details-dialog';
import { ReceiptStatusBadge } from '@/components/receipts/receipt-status-badge';

export default function ReceiptsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: 30, to: 0 }); // Last 30 days
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Calculate date filter
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - dateRange.from);
  const dateTo = new Date();
  dateTo.setDate(dateTo.getDate() - dateRange.to);

  // Fetch receipts with filtering
  const { data: receipts, isLoading, refetch } = trpc.receipts.list.useQuery({
    search: searchTerm || undefined,
    dateFrom,
    dateTo,
  });

  // Filter by PO status locally
  const filteredReceipts = receipts?.filter(receipt => {
    if (poStatusFilter === 'all') return true;
    return receipt.purchaseOrder.status === poStatusFilter;
  }) || [];

  // Calculate stats
  const stats = {
    total: filteredReceipts.length,
    totalItems: filteredReceipts.reduce((sum, r) => sum + r.items.length, 0),
    withDiscrepancies: filteredReceipts.filter(r => 
      r.items.some(item => item.quantityReceived !== item.quantityOrdered)
    ).length,
    recentWeek: filteredReceipts.filter(r => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(r.receivedDate) >= weekAgo;
    }).length,
  };

  const handleViewDetails = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setDetailsDialogOpen(true);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Receipts</h1>
              <p className="text-muted-foreground">
                Manage purchase order receipts and track deliveries
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Receipt
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Receipts</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Items Received</p>
                <p className="text-2xl font-bold">{stats.totalItems}</p>
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">With Discrepancies</p>
                <p className="text-2xl font-bold">{stats.withDiscrepancies}</p>
                {stats.withDiscrepancies > 0 && (
                  <p className="text-xs text-orange-600">Requires attention</p>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{stats.recentWeek}</p>
              </div>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by receipt number, PO number, supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={poStatusFilter} onValueChange={setPoStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All PO Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All PO Statuses</SelectItem>
                  <SelectItem value="APPROVED">Approved POs</SelectItem>
                  <SelectItem value="PARTIAL">Partially Received</SelectItem>
                  <SelectItem value="RECEIVED">Fully Received</SelectItem>
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

          {/* Receipts Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Received By</TableHead>
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
                ) : filteredReceipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <p className="text-muted-foreground">No receipts found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReceipts.map((receipt) => {
                    const hasDiscrepancy = receipt.items.some(
                      item => item.quantityReceived !== item.quantityOrdered
                    );
                    
                    return (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-medium">
                          {receipt.receiptNumber}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {receipt.purchaseOrder.poNumber}
                          </div>
                        </TableCell>
                        <TableCell>{receipt.purchaseOrder.supplier.name}</TableCell>
                        <TableCell>{formatDate(receipt.receivedDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{receipt.items.length} items</span>
                            {hasDiscrepancy && (
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {receipt.receivedBy.firstName} {receipt.receivedBy.lastName}
                        </TableCell>
                        <TableCell>
                          <ReceiptStatusBadge 
                            poStatus={receipt.purchaseOrder.status}
                            hasDiscrepancy={hasDiscrepancy}
                          />
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
                                onClick={() => handleViewDetails(receipt.id)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
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
        </div>

        {/* Dialogs */}
        <CreateReceiptDialog 
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            setCreateDialogOpen(false);
            refetch();
          }}
        />

        {selectedReceiptId && (
          <ReceiptDetailsDialog
            receiptId={selectedReceiptId}
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}