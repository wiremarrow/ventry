'use client';

import { useState } from 'react';
import { Button, Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ventry/ui';
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreHorizontal, Edit, Trash, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';

type Category = {
  id: string;
  name: string;
  description?: string | null;
  children?: Category[];
  _count?: { items: number };
};

interface CategoryTreeItemProps {
  category: Category;
  level: number;
  expandedCategories: Set<string>;
  onToggleExpand: (categoryId: string) => void;
  onEdit: (categoryId: string) => void;
  onRefresh: () => void;
}

export function CategoryTreeItem({
  category,
  level,
  expandedCategories,
  onToggleExpand,
  onEdit,
  onRefresh,
}: CategoryTreeItemProps) {
  const isExpanded = expandedCategories.has(category.id);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      });
      onRefresh();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete category',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  const handleDelete = () => {
    if ((category._count?.items ?? 0) > 0) {
      toast({
        title: 'Cannot delete',
        description: 'This category contains items and cannot be deleted',
        variant: 'destructive',
      });
      return;
    }

    if (category.children?.length > 0) {
      toast({
        title: 'Cannot delete',
        description: 'This category has subcategories and cannot be deleted',
        variant: 'destructive',
      });
      return;
    }

    if (confirm('Are you sure you want to delete this category?')) {
      setIsDeleting(true);
      deleteMutation.mutate({ id: category.id });
    }
  };

  const hasChildren = category.children && category.children.length > 0;
  const Icon = isExpanded ? FolderOpen : Folder;

  return (
    <>
      <div
        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        <button
          onClick={() => hasChildren && onToggleExpand(category.id)}
          className="p-0.5 hover:bg-muted rounded"
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
        </button>
        
        <Icon className="h-4 w-4 text-muted-foreground" />
        
        <div className="flex-1 flex items-center gap-2">
          <span className="font-medium">{category.name}</span>
          {category.description && (
            <span className="text-sm text-muted-foreground">- {category.description}</span>
          )}
          <Badge variant="secondary" className="ml-auto">
            {category._count?.items || 0} items
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100"
              disabled={isDeleting}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(category.id)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive"
              disabled={category._count?.items > 0 || category.children?.length > 0}
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete
              {(category._count?.items > 0 || category.children?.length > 0) && (
                <AlertCircle className="ml-auto h-4 w-4" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              level={level + 1}
              expandedCategories={expandedCategories}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </>
  );
}