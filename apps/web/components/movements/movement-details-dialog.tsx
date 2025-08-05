'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Badge,
  Skeleton,
  Alert,
  AlertDescription,
} from '@ventry/ui';
import {
  Package,
  MapPin,
  User,
  Calendar,
  AlertCircle,
  RotateCcw,
  Building2,
  Hash,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { MovementTypeBadge } from './movement-type-badge';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatDateTime } from '@/lib/utils';

interface MovementDetailsDialogProps {
  movementId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReversed?: () => void;
}

export function MovementDetailsDialog({
  movementId,
  open,
  onOpenChange,
  onReversed,
}: MovementDetailsDialogProps) {
  const utils = trpc.useUtils();

  const { data: movement, isLoading } = trpc.stockMovements.get.useQuery(
    { id: movementId! },
    { enabled: !!movementId }
  );

  const { data: userData } = trpc.auth.me.useQuery();
  const canReverse = userData?.role === 'ADMIN' || userData?.role === 'MANAGER';

  const reverseMutation = trpc.stockMovements.reverse.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Movement reversed successfully',
      });
      utils.stockMovements.invalidate();
      utils.inventory.invalidate();
      onOpenChange(false);
      onReversed?.();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reverse movement',
        variant: 'destructive',
      });
    },
  });

  const handleReverse = () => {
    if (!movementId) return;

    const reason = prompt('Please provide a reason for reversing this movement:');
    if (!reason) return;

    reverseMutation.mutate({
      movementId,
      reason,
    });
  };

  const formatLocation = (location: any) => {
    if (!location) return 'N/A';
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{location.warehouse.name}</span>
        <span className="text-muted-foreground">→</span>
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span>{location.code}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Movement Details</DialogTitle>
          <DialogDescription>Complete information about this stock movement</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : movement ? (
          <div className="space-y-6">
            {/* Movement Type and Status */}
            <div className="flex items-center justify-between">
              <MovementTypeBadge type={movement.movementType} showIcon />
              <div className="text-sm text-muted-foreground">ID: {movement.id}</div>
            </div>

            {/* Item Information */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Item Details
              </h3>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">SKU</span>
                  <span className="font-medium">{movement.item.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="font-medium">{movement.item.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Category</span>
                  <span>{movement.item.category?.name || 'Uncategorized'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Quantity</span>
                  <span className="font-bold text-lg">
                    {movement.qty} {movement.item.unitOfMeasure?.code}
                  </span>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Locations
              </h3>
              <div className="bg-muted p-4 rounded-lg space-y-3">
                {movement.fromLocation && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">From</p>
                    {formatLocation(movement.fromLocation)}
                  </div>
                )}
                {movement.toLocation && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">To</p>
                    {formatLocation(movement.toLocation)}
                  </div>
                )}
                {!movement.fromLocation && !movement.toLocation && (
                  <p className="text-muted-foreground">No location information</p>
                )}
              </div>
            </div>

            {/* Lot Information */}
            {movement.lot && (
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Lot Information
                </h3>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Lot Number</span>
                    <span className="font-medium">{movement.lot.lotNumber}</span>
                  </div>
                  {movement.lot.expirationDate && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Expiration Date</span>
                      <span>{formatDate(movement.lot.expirationDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Movement Information */}
            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Movement Information
              </h3>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date & Time</span>
                  <span>{formatDateTime(movement.movedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Moved By</span>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>
                      {movement.movedBy.firstName} {movement.movedBy.lastName}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {movement.movedBy.role}
                    </Badge>
                  </div>
                </div>
                {movement.refType && movement.refId && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Reference</span>
                    <Badge variant="outline">
                      {movement.refType}: {movement.refId}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {movement.notes && (
              <div className="space-y-2">
                <h3 className="font-medium">Notes</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm">{movement.notes}</p>
                </div>
              </div>
            )}

            {/* Related Movements */}
            {movement.relatedMovements && movement.relatedMovements.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Related Movements</h3>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This movement is part of a batch with {movement.relatedMovements.length} other
                    movements.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              {canReverse && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleReverse}
                  disabled={reverseMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {reverseMutation.isPending ? 'Reversing...' : 'Reverse Movement'}
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-900 font-medium">Movement not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
