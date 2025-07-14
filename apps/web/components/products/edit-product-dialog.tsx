'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ventry/ui';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@ventry/ui';
import { Input } from '@ventry/ui';
import { Button } from '@ventry/ui';
import { Textarea } from '@ventry/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ventry/ui';
import { Switch } from '@ventry/ui';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required'),
  defaultPrice: z.number().min(0).optional(),
  barcode: z.string().optional(),
  minQuantity: z.number().int().min(0).optional(),
  maxQuantity: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
});

type UpdateProductFormData = z.infer<typeof updateProductSchema>;

interface EditProductDialogProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const utils = trpc.useUtils();
  
  // Fetch categories
  const { data: categories } = trpc.categories.list.useQuery({
    page: 1,
    limit: 100,
  });

  const updateMutation = trpc.items.update.useMutation({
    onSuccess: () => {
      toast.success('Product updated successfully');
      utils.items.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<UpdateProductFormData>({
    resolver: zodResolver(updateProductSchema),
  });

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description || '',
        categoryId: product.categoryId,
        unitOfMeasure: product.unitOfMeasure,
        defaultPrice: product.defaultPrice || 0,
        barcode: product.barcode || '',
        minQuantity: product.minQuantity || 0,
        maxQuantity: product.maxQuantity || 0,
        reorderPoint: product.reorderPoint || 0,
        reorderQuantity: product.reorderQuantity || 0,
        isActive: product.status === 'ACTIVE',
      });
    }
  }, [product, form]);

  const onSubmit = (data: UpdateProductFormData) => {
    if (!product) return;

    updateMutation.mutate({
      id: product.id,
      ...data,
      status: data.isActive ? 'ACTIVE' : 'INACTIVE',
    });
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update product information and settings
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">SKU</p>
                <p className="text-sm text-gray-600">{product.sku}</p>
              </div>
              
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="1234567890123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter product description..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No category</SelectItem>
                        {categories?.categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitOfMeasure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EACH">Each</SelectItem>
                        <SelectItem value="CASE">Case</SelectItem>
                        <SelectItem value="BOX">Box</SelectItem>
                        <SelectItem value="PALLET">Pallet</SelectItem>
                        <SelectItem value="KG">Kilogram</SelectItem>
                        <SelectItem value="LB">Pound</SelectItem>
                        <SelectItem value="L">Liter</SelectItem>
                        <SelectItem value="GAL">Gallon</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="defaultPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Default selling price for this product
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium">Inventory Settings</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum stock level
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum stock level
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reorderPoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Point</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Stock level to trigger reorder
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reorderQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Default quantity to reorder
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Product is available for transactions
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Product'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}