'use client';

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';

import {
  Badge,
  Button,
  Calendar,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ventry/ui';
import { format } from 'date-fns';

import { trpc } from '@/lib/trpc';
import { usePurchaseOrderFilters } from '@/hooks/use-purchase-order-filters';

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PARTIAL', label: 'Partially Received' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

export function PurchaseOrderFilters() {
  const { filters, setFilters, resetFilters, activeFilterCount } = usePurchaseOrderFilters();
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: filters.dateFrom,
    to: filters.dateTo,
  });

  // Fetch suppliers for filter
  const { data: suppliers } = trpc.suppliers.list.useQuery({
    limit: 100,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ search: e.target.value });
  };

  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      setFilters({ status: undefined });
    } else {
      setFilters({
        status: value as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED',
      });
    }
  };

  const handleSupplierChange = (value: string) => {
    if (value === 'all') {
      setFilters({ supplierId: undefined });
    } else {
      setFilters({ supplierId: value });
    }
  };

  const handleDateRangeChange = () => {
    setFilters({
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
    });
  };

  const handleOverdueToggle = () => {
    setFilters({ isOverdue: !filters.isOverdue });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by PO number, supplier, or notes..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>

        <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.supplierId || 'all'} onValueChange={handleSupplierChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers?.suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Advanced
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="grid gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal">
                        {dateRange.from ? format(dateRange.from, 'PPP') : <span>From date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange((prev) => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal">
                        {dateRange.to ? format(dateRange.to, 'PPP') : <span>To date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange((prev) => ({ ...prev, to: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Other Filters</Label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.isOverdue || false}
                      onChange={handleOverdueToggle}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Show only overdue orders</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    handleDateRangeChange();
                  }}
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDateRange({ from: undefined, to: undefined });
                    resetFilters();
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {activeFilterCount > 0 && (
          <Button size="sm" variant="ghost" onClick={resetFilters} className="gap-1">
            <X className="h-3 w-3" />
            Clear filters
          </Button>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <Badge variant="secondary">
              Status: {statusOptions.find((s) => s.value === filters.status)?.label}
            </Badge>
          )}
          {filters.supplierId && suppliers && (
            <Badge variant="secondary">
              Supplier: {suppliers.suppliers.find((s) => s.id === filters.supplierId)?.name}
            </Badge>
          )}
          {filters.isOverdue && <Badge variant="secondary">Overdue orders only</Badge>}
          {(filters.dateFrom || filters.dateTo) && (
            <Badge variant="secondary">
              Date: {filters.dateFrom && format(filters.dateFrom, 'PP')}
              {filters.dateFrom && filters.dateTo && ' - '}
              {filters.dateTo && format(filters.dateTo, 'PP')}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
