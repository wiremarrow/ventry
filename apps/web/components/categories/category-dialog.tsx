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
} from '@ventry/ui';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string | null;
  onSuccess: () => void;
}

export function CategoryDialog({ open, onOpenChange, categoryId, onSuccess }: CategoryDialogProps) {
  const utils = trpc.useUtils();
  
  // Fetch category data if editing
  const { data: category } = trpc.categories.getById.useQuery(
    { id: categoryId! },
    { enabled: !!categoryId }
  );

  // Fetch all categories for parent selection
  const { data: categoriesData } = trpc.categories.list.useQuery({
    limit: 100,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  });

  // Load category data when editing
  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        description: category.description || '',
        parentId: category.parentId || undefined,
      });
    } else {
      reset({
        name: '',
        description: '',
        parentId: undefined,
      });
    }
  }, [category, reset]);

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Category created successfully',
      });
      utils.categories.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create category',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Category updated successfully',
      });
      utils.categories.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update category',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CategoryFormData) => {
    if (categoryId) {
      updateMutation.mutate({
        id: categoryId,
        ...data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Filter out current category and its descendants from parent options
  const getAvailableParents = () => {
    if (!categoriesData?.categories) return [];
    if (!categoryId) return categoriesData.categories;

    const currentCategory = categoriesData.categories.find(c => c.id === categoryId);
    if (!currentCategory) return categoriesData.categories;

    // Get all descendant IDs
    type CategoryWithChildren = { id: string; children?: CategoryWithChildren[] };
    const getDescendantIds = (cat: CategoryWithChildren): string[] => {
      const ids = [cat.id];
      if (cat.children) {
        cat.children.forEach((child) => {
          ids.push(...getDescendantIds(child));
        });
      }
      return ids;
    };

    const excludeIds = getDescendantIds(currentCategory);
    return categoriesData.categories.filter(c => !excludeIds.includes(c.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{categoryId ? 'Edit Category' : 'Create Category'}</DialogTitle>
            <DialogDescription>
              {categoryId ? 'Update category information' : 'Add a new category to organize your inventory'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="e.g., Electronics, Office Supplies"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Optional description for this category"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentId">Parent Category</Label>
              <Select
                value={watch('parentId') || 'none'}
                onValueChange={(value) => setValue('parentId', value === 'none' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a parent category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (root category)</SelectItem>
                  {getAvailableParents().map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.parent && '— '}{cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : categoryId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}