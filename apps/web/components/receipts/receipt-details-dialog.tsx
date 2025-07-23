'use client';

import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Alert,
  AlertDescription,
  Badge,
} from '@ventry/ui';
import { 
  FileText, 
  Calendar, 
  User, 
  AlertCircle,
  CheckCircle2,
  Warehouse,
  Hash
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatDateTime } from '@/lib/utils';
import { ReceiptStatusBadge } from './receipt-status-badge';

interface ReceiptDetailsDialogProps {
  receiptId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptDetailsDialog({ 
  receiptId, 
  open, 
  onOpenChange 
}: ReceiptDetailsDialogProps) {
  // Fetch receipt details
  const { data: receipt, isLoading } = trpc.receipts.get.useQuery(
    { id: receiptId },
    { enabled: open && !!receiptId }
  );

  if (!open) return null;

  const hasDiscrepancy = receipt?.items.some(
    item => {
      // Find the corresponding PO item to check quantities
      const poItem = receipt.purchaseOrder?.items.find(
        poi => poi.itemId === item.itemId
      );
      return poItem && item.qtyReceived !== poItem.qtyOrdered;
    }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt Details</DialogTitle>
          <DialogDescription>
            View receipt information and items received
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : receipt ? (
          <div className="space-y-6">
            {/* Receipt Header */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Receipt ID</p>
                  <p className="font-medium flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    {receipt.id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Order</p>
                  <p className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {receipt.purchaseOrder?.poNumber || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{receipt.purchaseOrder?.supplier?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Received Date</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDateTime(receipt.receivedDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Received By</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {receipt.receivedBy.firstName} {receipt.receivedBy.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <ReceiptStatusBadge 
                    poStatus={receipt.purchaseOrder?.status || 'PENDING'}
                    hasDiscrepancy={hasDiscrepancy}
                  />
                </div>
              </div>
            </div>

            {/* Discrepancy Alert */}
            {hasDiscrepancy && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  This receipt has quantity discrepancies. Some items were received in different quantities than ordered.
                </AlertDescription>
              </Alert>
            )}

            {/* Receipt Notes */}
            {receipt.notes && (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-1">Receipt Notes</p>
                <p className="text-sm text-muted-foreground">{receipt.notes}</p>
              </div>
            )}

            {/* Items Table */}
            <div>
              <h3 className="font-medium mb-2">Items Received</h3>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipt.items.map((item) => {
                      // Find the corresponding PO item to get ordered quantity
                      const poItem = receipt.purchaseOrder?.items.find(
                        poi => poi.itemId === item.itemId
                      );
                      const qtyOrdered = poItem?.qtyOrdered || 0;
                      const difference = item.qtyReceived - qtyOrdered;
                      const hasItemDiscrepancy = difference !== 0;
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.item.name}
                          </TableCell>
                          <TableCell>{item.item.sku}</TableCell>
                          <TableCell className="text-right">{qtyOrdered}</TableCell>
                          <TableCell className="text-right font-medium">
                            {item.qtyReceived}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasItemDiscrepancy ? (
                              <span className={difference > 0 ? 'text-blue-600' : 'text-orange-600'}>
                                {difference > 0 ? '+' : ''}{difference}
                              </span>
                            ) : (
                              <span className="text-green-600">✓</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {hasItemDiscrepancy ? (
                              <Badge variant="outline" className="bg-orange-100 text-orange-800">
                                Discrepancy
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-100 text-green-800">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Match
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.location ? (
                              <div className="flex items-center gap-1">
                                <Warehouse className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">
                                  {item.location.warehouse.name} - {item.location.code}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.serialNumber ? (
                              <span className="text-sm text-muted-foreground">SN: {item.serialNumber}</span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="font-medium">{receipt.items.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Quantity Received</p>
                  <p className="font-medium">
                    {receipt.items.reduce((sum, item) => sum + item.qtyReceived, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PO Status</p>
                  <p className="font-medium">{receipt.purchaseOrder?.status || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Receipt not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}