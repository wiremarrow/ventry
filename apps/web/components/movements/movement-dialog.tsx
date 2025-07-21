'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
} from '@ventry/ui';
import { AlertCircle, ArrowRight, Package } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { MovementTypeBadge, type MovementType } from './movement-type-badge';

const movementSchema = z.object({
  movementType: z.enum(['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'LOSS']),
  itemId: z.string().min(1, 'Item is required'),
  qty: z.number().int().positive('Quantity must be positive'),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.movementType === 'INBOUND' && !data.toLocationId) {
    return false;
  }
  if (data.movementType === 'OUTBOUND' && !data.fromLocationId) {
    return false;
  }
  if (data.movementType === 'TRANSFER' && (!data.fromLocationId || !data.toLocationId)) {
    return false;
  }
  return true;
}, {
  message: 'Location requirements not met for movement type',
});

type MovementFormData = z.infer<typeof movementSchema>;

interface MovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MovementDialog({ open, onOpenChange, onSuccess }: MovementDialogProps) {
  const utils = trpc.useUtils();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      movementType: 'TRANSFER',
      qty: 1,
    },
  });

  const movementType = watch('movementType');
  const fromLocationId = watch('fromLocationId');
  const itemId = watch('itemId');

  // Fetch items
  const { data: itemsData } = trpc.items.list.useQuery({
    limit: 100,
  });

  // Fetch locations
  const { data: locationsData } = trpc.warehouses.listAllLocations.useQuery({
    limit: 1000,
  });

  // Check inventory availability when source location and item are selected
  useEffect(() => {
    if (fromLocationId && itemId && (movementType === 'OUTBOUND' || movementType === 'TRANSFER')) {
      // For now, just show that validation will happen on submit
      // The backend will validate availability
      setAvailableQty(null);
    } else {
      setAvailableQty(null);
    }
  }, [fromLocationId, itemId, movementType]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        movementType: 'TRANSFER',
        itemId: '',
        qty: 1,
        fromLocationId: '',
        toLocationId: '',
        notes: '',
      });
      setSelectedItem(null);
      setAvailableQty(null);
    }
  }, [open, reset]);

  const createMutation = trpc.stockMovements.create.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Stock movement created successfully',
      });
      utils.stockMovements.invalidate();
      utils.inventory.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create movement',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: MovementFormData) => {
    createMutation.mutate(data);
  };

  const isLoading = createMutation.isPending;

  const getLocationRequirements = (type: MovementType) => {
    switch (type) {
      case 'INBOUND':
        return { from: false, to: true, message: 'Select destination location' };
      case 'OUTBOUND':
        return { from: true, to: false, message: 'Select source location' };
      case 'TRANSFER':
        return { from: true, to: true, message: 'Select both source and destination' };
      default:
        return { from: false, to: false, message: 'Locations optional for this type' };
    }
  };

  const requirements = getLocationRequirements(movementType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create Stock Movement</DialogTitle>
            <DialogDescription>
              Record inventory movement between locations
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Movement Type */}
            <div className="space-y-2">
              <Label htmlFor="movementType">Movement Type *</Label>
              <Select
                value={movementType}
                onValueChange={(value) => setValue('movementType', value as MovementType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INBOUND">
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type="INBOUND" />
                      <span className="text-sm text-muted-foreground">Receive into inventory</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="OUTBOUND">
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type="OUTBOUND" />
                      <span className="text-sm text-muted-foreground">Ship from inventory</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="TRANSFER">
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type="TRANSFER" />
                      <span className="text-sm text-muted-foreground">Move between locations</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ADJUSTMENT">
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type="ADJUSTMENT" />
                      <span className="text-sm text-muted-foreground">Adjust inventory count</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="RETURN">
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type="RETURN" />
                      <span className="text-sm text-muted-foreground">Return to inventory</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="DAMAGE">
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type="DAMAGE" />
                      <span className="text-sm text-muted-foreground">Record damaged items</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LOSS">
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type="LOSS" />
                      <span className="text-sm text-muted-foreground">Record lost items</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location Requirements Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {requirements.message}
              </AlertDescription>
            </Alert>

            {/* Item Selection */}
            <div className="space-y-2">
              <Label htmlFor="itemId">Item *</Label>
              <Select
                value={itemId}
                onValueChange={(value) => {
                  setValue('itemId', value);
                  const item = itemsData?.items.find(i => i.id === value);
                  setSelectedItem(item);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an item">
                    {selectedItem && (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span>{selectedItem.sku} - {selectedItem.name}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {itemsData?.items?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span>{item.sku} - {item.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.itemId && (
                <p className="text-sm text-destructive">{errors.itemId.message}</p>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity *</Label>
              <Input
                id="qty"
                type="number"
                {...register('qty', { 
                  setValueAs: (v) => v === '' ? 0 : parseInt(v, 10) 
                })}
                min={1}
              />
              {availableQty !== null && (
                <p className="text-sm text-muted-foreground">
                  Available at source: {availableQty} units
                </p>
              )}
              {errors.qty && (
                <p className="text-sm text-destructive">{errors.qty.message}</p>
              )}
            </div>

            {/* Location Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* From Location */}
              <div className="space-y-2">
                <Label htmlFor="fromLocationId">
                  From Location {requirements.from && '*'}
                </Label>
                <Select
                  value={fromLocationId}
                  onValueChange={(value) => setValue('fromLocationId', value)}
                  disabled={!requirements.from}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationsData?.locations?.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.warehouse.name} → {location.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To Location */}
              <div className="space-y-2">
                <Label htmlFor="toLocationId">
                  To Location {requirements.to && '*'}
                </Label>
                <Select
                  value={watch('toLocationId')}
                  onValueChange={(value) => setValue('toLocationId', value)}
                  disabled={!requirements.to}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationsData?.locations?.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.warehouse.name} → {location.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Transfer visualization */}
            {movementType === 'TRANSFER' && fromLocationId && watch('toLocationId') && (
              <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg">
                <span className="text-sm font-medium">
                  {locationsData?.locations.find(l => l.id === fromLocationId)?.code}
                </span>
                <ArrowRight className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {locationsData?.locations.find(l => l.id === watch('toLocationId'))?.code}
                </span>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Optional notes about this movement"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Movement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}