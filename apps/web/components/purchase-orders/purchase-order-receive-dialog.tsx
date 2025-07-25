'use client';

import { useState } from 'react';
import { Package, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

import {
  Alert,
  AlertDescription,
  Button,
  Calendar,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ventry/ui';
import { toast } from 'sonner';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface ReceiveItem {
  poItemId: string;
  itemId: string;
  itemName: string;
  sku: string;
  qtyOrdered: number;
  qtyReceived: number;
  qtyPending: number;
  qtyToReceive: number;
  qtyRejected: number;
  locationId: string;
  lotNumber?: string;
  expirationDate?: Date;
  serialNumbers?: string[];
  notes?: string;
}

interface PurchaseOrderReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: {
    id: string;
    poNumber: string;
    items: Array<{
      id: string;
      itemId: string;
      qtyOrdered: number;
      qtyReceived: number;
      item: {
        name: string;
        sku: string;
      };
    }>;
  };
}

export function PurchaseOrderReceiveDialog({
  open,
  onOpenChange,
  purchaseOrder,
}: PurchaseOrderReceiveDialogProps) {
  const [receivedDate, setReceivedDate] = useState<Date>(new Date());
  const [createReceipt, setCreateReceipt] = useState(true);
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>(() =>
    purchaseOrder.items.map((item) => ({
      poItemId: item.id,
      itemId: item.itemId,
      itemName: item.item.name,
      sku: item.item.sku,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      qtyPending: item.qtyOrdered - item.qtyReceived,
      qtyToReceive: item.qtyOrdered - item.qtyReceived,
      qtyRejected: 0,
      locationId: '',
      lotNumber: '',
      expirationDate: undefined,
      serialNumbers: [],
      notes: '',
    }))
  );

  const utils = trpc.useUtils();

  // Fetch warehouses with locations
  const { data: warehouses } = trpc.warehouses.list.useQuery({});

  const receiveMutation = trpc.purchaseOrders.receive.useMutation({
    onSuccess: (result) => {
      const message = result.fullyReceived
        ? 'Purchase order fully received'
        : `${result.itemsReceived} items received`;

      if (result.hasDiscrepancies) {
        toast.warning(`${message} with discrepancies`);
      } else {
        toast.success(message);
      }

      utils.purchaseOrders.get.invalidate({ id: purchaseOrder.id });
      utils.purchaseOrders.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpdateItem = (
    index: number,
    field: keyof ReceiveItem,
    value: string | number | Date | string[] | undefined
  ) => {
    const updated = [...receiveItems];
    updated[index] = { ...updated[index], [field]: value };
    setReceiveItems(updated);
  };

  const handleSubmit = () => {
    // Validate all items have locations
    const missingLocations = receiveItems.filter(
      (item) => item.qtyToReceive > 0 && !item.locationId
    );

    if (missingLocations.length > 0) {
      toast.error('Please select a location for all items being received');
      return;
    }

    // Filter out items with 0 quantity to receive
    const itemsToReceive = receiveItems
      .filter((item) => item.qtyToReceive > 0)
      .map((item) => ({
        poItemId: item.poItemId,
        qtyReceived: item.qtyToReceive,
        qtyRejected: item.qtyRejected,
        locationId: item.locationId,
        lotNumber: item.lotNumber || undefined,
        expirationDate: item.expirationDate || undefined,
        serialNumbers:
          item.serialNumbers && item.serialNumbers.length > 0 ? item.serialNumbers : undefined,
        notes: item.notes || undefined,
      }));

    if (itemsToReceive.length === 0) {
      toast.error('Please enter quantities to receive');
      return;
    }

    receiveMutation.mutate({
      poId: purchaseOrder.id,
      receivedDate,
      items: itemsToReceive,
      createReceipt,
    });
  };

  const totalToReceive = receiveItems.reduce((sum, item) => sum + item.qtyToReceive, 0);
  const hasDiscrepancies = receiveItems.some(
    (item) => item.qtyToReceive !== item.qtyPending || item.qtyRejected > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Items - {purchaseOrder.poNumber}</DialogTitle>
          <DialogDescription>Record receipt of items from this purchase order</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Received Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !receivedDate && 'text-muted-foreground'
                    )}
                  >
                    {receivedDate ? format(receivedDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={receivedDate}
                    onSelect={(date) => date && setReceivedDate(date)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="createReceipt"
                checked={createReceipt}
                onChange={(e) => setCreateReceipt(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="createReceipt" className="text-sm">
                Create receipt record
              </label>
            </div>
          </div>

          {hasDiscrepancies && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The quantities being received don't match the ordered quantities. This will be
                recorded as a discrepancy.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Ordered</TableHead>
                  <TableHead className="text-center">Already Received</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="w-[100px]">To Receive</TableHead>
                  <TableHead className="w-[100px]">Rejected</TableHead>
                  <TableHead className="w-[180px]">Location</TableHead>
                  <TableHead className="w-[120px]">Lot #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiveItems.map((item, index) => (
                  <TableRow key={item.poItemId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.itemName}</div>
                        <div className="text-sm text-gray-500">{item.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.qtyOrdered}</TableCell>
                    <TableCell className="text-center">{item.qtyReceived}</TableCell>
                    <TableCell className="text-center font-medium">{item.qtyPending}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max={item.qtyPending}
                        value={item.qtyToReceive}
                        onChange={(e) =>
                          handleUpdateItem(index, 'qtyToReceive', parseInt(e.target.value) || 0)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max={item.qtyToReceive}
                        value={item.qtyRejected}
                        onChange={(e) =>
                          handleUpdateItem(index, 'qtyRejected', parseInt(e.target.value) || 0)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.locationId}
                        onValueChange={(value) => handleUpdateItem(index, 'locationId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses?.map((warehouse) => (
                            <SelectItem
                              key={warehouse.id}
                              value={warehouse.id}
                              className="font-medium"
                            >
                              {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Optional"
                        value={item.lotNumber || ''}
                        onChange={(e) => handleUpdateItem(index, 'lotNumber', e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm">
              <span className="font-medium">Total items to receive:</span> {totalToReceive}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={receiveMutation.isPending || totalToReceive === 0}
            >
              <Package className="mr-2 h-4 w-4" />
              {receiveMutation.isPending ? 'Receiving...' : 'Receive Items'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
