import { create } from 'zustand';

interface PurchaseOrderFilters {
  search?: string;
  supplierId?: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  dateFrom?: Date;
  dateTo?: Date;
  isOverdue?: boolean;
  page: number;
  limit: number;
  sortBy: 'poNumber' | 'orderDate' | 'supplier' | 'status' | 'total';
  sortOrder: 'asc' | 'desc';
}

interface PurchaseOrderFiltersStore {
  filters: PurchaseOrderFilters;
  setFilters: (filters: Partial<PurchaseOrderFilters>) => void;
  resetFilters: () => void;
  activeFilterCount: number;
}

const defaultFilters: PurchaseOrderFilters = {
  page: 1,
  limit: 20,
  sortBy: 'orderDate',
  sortOrder: 'desc',
};

export const usePurchaseOrderFilters = create<PurchaseOrderFiltersStore>((set) => ({
  filters: defaultFilters,
  
  setFilters: (newFilters) =>
    set((state) => {
      const filters = { ...state.filters, ...newFilters };
      
      // Reset to page 1 when filters change (except page itself)
      if (!('page' in newFilters)) {
        filters.page = 1;
      }
      
      // Calculate active filter count
      let count = 0;
      if (filters.search) count++;
      if (filters.supplierId) count++;
      if (filters.status) count++;
      if (filters.dateFrom || filters.dateTo) count++;
      if (filters.isOverdue) count++;
      
      return { filters, activeFilterCount: count };
    }),
    
  resetFilters: () =>
    set({
      filters: defaultFilters,
      activeFilterCount: 0,
    }),
    
  activeFilterCount: 0,
}));