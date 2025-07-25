'use client';

import { useEffect } from 'react';
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
  Switch,
} from '@ventry/ui';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';

const locationSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  zone: z.string().optional(),
  aisle: z.string().optional(),
  shelf: z.string().optional(),
  bin: z.string().optional(),
  maxCapacity: z.number().int().positive().optional().nullable(),
  isTempControlled: z.boolean().default(false),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  onSuccess: () => void;
}

export function LocationDialog({ open, onOpenChange, locationId, onSuccess }: LocationDialogProps) {
  const utils = trpc.useUtils();

  // Fetch location data if editing
  const { data: location } = trpc.warehouses.getLocation.useQuery(
    { locationId: locationId! },
    { enabled: !!locationId }
  );

  // Fetch all warehouses
  const { data: warehousesData } = trpc.warehouses.list.useQuery({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
  });

  // Load location data when editing
  useEffect(() => {
    if (location) {
      reset({
        warehouseId: location.warehouseId,
        code: location.code,
        description: location.description || '',
        zone: location.zone || '',
        aisle: location.aisle || '',
        shelf: location.shelf || '',
        bin: location.bin || '',
        maxCapacity: location.maxCapacity,
        isTempControlled: location.isTempControlled,
      });
    } else {
      reset({
        warehouseId: '',
        code: '',
        description: '',
        zone: '',
        aisle: '',
        shelf: '',
        bin: '',
        maxCapacity: null,
        isTempControlled: false,
      });
    }
  }, [location, reset]);

  const createMutation = trpc.warehouses.createLocation.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Location created successfully',
      });
      utils.warehouses.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create location',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = trpc.warehouses.updateLocation.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Location updated successfully',
      });
      utils.warehouses.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update location',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LocationFormData) => {
    if (locationId) {
      updateMutation.mutate({
        locationId,
        ...data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{locationId ? 'Edit Location' : 'Create Location'}</DialogTitle>
            <DialogDescription>
              {locationId ? 'Update location information' : 'Add a new storage location'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warehouseId">Warehouse *</Label>
                <Select
                  value={watch('warehouseId')}
                  onValueChange={(value) => setValue('warehouseId', value)}
                  disabled={!!locationId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehousesData?.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.warehouseId && (
                  <p className="text-sm text-destructive">{errors.warehouseId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input id="code" {...register('code')} placeholder="e.g., A1B2C3" />
                {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Optional description for this location"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zone">Zone</Label>
                <Input id="zone" {...register('zone')} placeholder="e.g., A, B, C" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aisle">Aisle</Label>
                <Input id="aisle" {...register('aisle')} placeholder="e.g., 1, 2, 3" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shelf">Shelf</Label>
                <Input id="shelf" {...register('shelf')} placeholder="e.g., A, B, C" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bin">Bin</Label>
                <Input id="bin" {...register('bin')} placeholder="e.g., 1, 2, 3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxCapacity">Max Capacity</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  {...register('maxCapacity', {
                    setValueAs: (v) => (v === '' ? null : parseInt(v, 10)),
                  })}
                  placeholder="Leave blank for unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of items this location can hold
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isTempControlled">Temperature Controlled</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Switch
                    id="isTempControlled"
                    checked={watch('isTempControlled')}
                    onCheckedChange={(checked) => setValue('isTempControlled', checked)}
                  />
                  <Label htmlFor="isTempControlled" className="text-sm font-normal">
                    This location is temperature controlled
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : locationId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
