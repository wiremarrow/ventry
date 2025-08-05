import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, fireEvent } from '@/test-utils/render';
import { InventoryFilters } from '../inventory-filters';
import { trpc } from '@/lib/trpc';

// Mock the tRPC hooks
vi.mock('@/lib/trpc', () => ({
  trpc: {
    warehouses: {
      list: {
        useQuery: vi.fn(),
      },
    },
  },
}));

describe('InventoryFilters', () => {
  const mockOnWarehouseChange = vi.fn();
  const mockOnSearchChange = vi.fn();
  const mockOnLowStockChange = vi.fn();

  const defaultProps = {
    selectedWarehouse: 'all',
    onWarehouseChange: mockOnWarehouseChange,
    searchTerm: '',
    onSearchChange: mockOnSearchChange,
    showLowStock: false,
    onLowStockChange: mockOnLowStockChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for warehouses query
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue({
      data: [
        { id: 'wh1', name: 'Main Warehouse' },
        { id: 'wh2', name: 'Secondary Warehouse' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isSuccess: true,
      isError: false,
      status: 'success',
    } as ReturnType<typeof trpc.warehouses.list.useQuery>);
  });

  it('renders all filter components', () => {
    render(<InventoryFilters {...defaultProps} />);

    // Check search input
    expect(screen.getByPlaceholderText('Search by SKU, name, or barcode...')).toBeInTheDocument();

    // Check warehouse select
    expect(screen.getByText('All Warehouses')).toBeInTheDocument();

    // Check low stock switch
    expect(screen.getByLabelText('Show low stock only')).toBeInTheDocument();
  });

  it('handles search input changes', () => {
    render(<InventoryFilters {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search by SKU, name, or barcode...');

    // Simulate typing by directly firing change event with final value
    fireEvent.change(searchInput, { target: { value: 'test product' } });

    // Verify onChange was called with the correct value
    expect(mockOnSearchChange).toHaveBeenCalledWith('test product');
  });

  it('displays warehouses in dropdown', async () => {
    const user = userEvent.setup();
    render(<InventoryFilters {...defaultProps} />);

    // Click on the select to open dropdown
    const selectTrigger = screen.getByRole('combobox');
    await user.click(selectTrigger);

    // Check if warehouses are displayed
    expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Secondary Warehouse')).toBeInTheDocument();
  });

  it('handles warehouse selection', async () => {
    const user = userEvent.setup();
    render(<InventoryFilters {...defaultProps} />);

    // Open dropdown
    const selectTrigger = screen.getByRole('combobox');
    await user.click(selectTrigger);

    // Select a warehouse
    await user.click(screen.getByText('Main Warehouse'));

    expect(mockOnWarehouseChange).toHaveBeenCalledWith('wh1');
  });

  it('handles low stock toggle', async () => {
    const user = userEvent.setup();
    render(<InventoryFilters {...defaultProps} />);

    const lowStockSwitch = screen.getByRole('switch', { name: 'Show low stock only' });
    await user.click(lowStockSwitch);

    expect(mockOnLowStockChange).toHaveBeenCalledWith(true);
  });

  it('displays loading state when fetching warehouses', () => {
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isSuccess: false,
      isError: false,
      status: 'loading',
    } as ReturnType<typeof trpc.warehouses.list.useQuery>);

    render(<InventoryFilters {...defaultProps} />);

    // The select should still render but without warehouse options
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('handles error state when fetching warehouses fails', () => {
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch warehouses'),
      refetch: vi.fn(),
      isSuccess: false,
      isError: true,
      status: 'error',
    } as ReturnType<typeof trpc.warehouses.list.useQuery>);

    render(<InventoryFilters {...defaultProps} />);

    // The component should still render and be functional
    expect(screen.getByPlaceholderText('Search by SKU, name, or barcode...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
