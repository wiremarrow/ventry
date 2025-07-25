'use client';

import { useState } from 'react';
import { Card, Input, Button, Skeleton } from '@ventry/ui';
import { Plus, Search, FolderTree, Folder } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { ItemCategory } from '@ventry/database';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryDialog } from '@/components/categories/category-dialog';
import { CategoryTreeItem } from '@/components/categories/category-tree-item';

export default function CategoriesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Fetch category tree
  const { data: categoryTree, isLoading, refetch } = trpc.categories.tree.useQuery();

  // Fetch flat list for stats
  const {
    data: categoriesData,
    isLoading: isLoadingStats,
    error: statsError,
  } = trpc.categories.list.useQuery({
    limit: 100,
  });

  // Calculate stats - handle both loading states
  const stats = {
    total: categoriesData?.pagination?.total || categoriesData?.categories?.length || 0,
    rootCategories: categoryTree?.length || 0,
    totalItems:
      categoriesData?.categories?.reduce((sum, cat) => sum + (cat._count?.items || 0), 0) || 0,
    mostUsed: categoriesData?.categories?.reduce(
      (max, cat) => (!max || (cat._count?.items || 0) > (max._count?.items || 0) ? cat : max),
      null as (typeof categoriesData.categories)[0] | null
    ),
  };

  // Log error if there is one
  if (statsError) {
    console.error('Error loading categories:', statsError);
  }

  const handleEdit = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setIsDialogOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedCategory(null);
    setIsDialogOpen(true);
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  type CategoryWithChildren = ItemCategory & {
    _count?: { items: number };
    children?: CategoryWithChildren[];
  };

  const filterCategories = (
    categories: CategoryWithChildren[],
    search: string
  ): CategoryWithChildren[] => {
    if (!search) return categories;

    return categories.reduce((acc: CategoryWithChildren[], category) => {
      const matchesSearch =
        category.name.toLowerCase().includes(search.toLowerCase()) ||
        category.description?.toLowerCase().includes(search.toLowerCase());
      const filteredChildren = filterCategories(category.children || [], search);

      if (matchesSearch || filteredChildren.length > 0) {
        acc.push({
          ...category,
          children: filteredChildren,
        });
      }

      return acc;
    }, []);
  };

  const filteredTree = searchTerm ? filterCategories(categoryTree || [], searchTerm) : categoryTree;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Categories</h1>
              <p className="text-muted-foreground">
                Organize your inventory with hierarchical categories
              </p>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Categories</p>
                {isLoadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats.total}</p>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Root Categories</p>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats.rootCategories}</p>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Items</p>
                {isLoadingStats ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats.totalItems}</p>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Most Used</p>
                {isLoadingStats ? (
                  <>
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium truncate">{stats.mostUsed?.name || '-'}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.mostUsed ? `${stats.mostUsed._count?.items || 0} items` : ''}
                    </p>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Search */}
          <Card className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>

          {/* Category Tree */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FolderTree className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Category Hierarchy</h3>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !filteredTree || filteredTree.length === 0 ? (
              <div className="text-center py-8">
                <Folder className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-muted-foreground">
                  {searchTerm
                    ? 'No categories found matching your search'
                    : 'No categories created yet'}
                </p>
                {!searchTerm && (
                  <Button size="sm" className="mt-2" onClick={handleCreateNew}>
                    Create your first category
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTree.map((category) => (
                  <CategoryTreeItem
                    key={category.id}
                    category={category}
                    level={0}
                    expandedCategories={expandedCategories}
                    onToggleExpand={toggleExpanded}
                    onEdit={handleEdit}
                    onRefresh={refetch}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Category Dialog */}
          <CategoryDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            categoryId={selectedCategory}
            onSuccess={() => {
              setIsDialogOpen(false);
              refetch();
            }}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
