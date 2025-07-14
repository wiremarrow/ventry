'use client';

import { Input } from '@ventry/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ventry/ui';
import { Switch } from '@ventry/ui';
import { Search } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface InventoryFiltersProps {
  selectedWarehouse: string;
  onWarehouseChange: (value: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  showLowStock: boolean;
  onLowStockChange: (value: boolean) => void;
}

export function InventoryFilters({
  selectedWarehouse,
  onWarehouseChange,
  searchTerm,
  onSearchChange,
  showLowStock,
  onLowStockChange,
}: InventoryFiltersProps) {
  // Fetch warehouses
  const { data: warehouses } = trpc.warehouses.list.useQuery({
    page: 1,
    limit: 100,
  });

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by SKU, name, or barcode..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Warehouse Filter */}
        <Select value={selectedWarehouse} onValueChange={onWarehouseChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses?.warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Low Stock Toggle */}
        <div className="flex items-center space-x-2">
          <Switch
            id="low-stock"
            checked={showLowStock}
            onCheckedChange={onLowStockChange}
          />
          <label
            htmlFor="low-stock"
            className="text-sm font-medium text-gray-700 cursor-pointer"
          >
            Show low stock only
          </label>
        </div>
      </div>
    </div>
  );
}