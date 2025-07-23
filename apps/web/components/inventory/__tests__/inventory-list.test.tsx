import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test-utils/render';
import { InventoryList } from '../inventory-list';
import { trpc } from '@/lib/trpc';

// Mock the tRPC hooks
vi.mock('@/lib/trpc', () => ({
  trpc: {
    inventory: {
      list: {
        useQuery: vi.fn(),
      },
      adjust: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
        })),
      },
    },
    useUtils: vi.fn(() => ({
      inventory: {
        list: {
          invalidate: vi.fn(),
        },
      },
    })),
  },
}));

describe('InventoryList', () => {
  const mockInventoryData = {
    inventory: [
      {
        id: 'inv1',
        item: {
          id: 'item1',
          name: 'Test Product 1',
          sku: 'SKU001',
          category: { name: 'Electronics' },
          reorderPoint: 50,
        },
        location: {
          id: 'loc1',
          code: 'A-1-1',
          warehouse: { id: 'wh1', name: 'Main Warehouse' },
        },
        qtyOnHand: 100,
        qtyReserved: 20,
        qtyAvailable: 80,
        lowStock: false,
        expiring: false,
        lastCountedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'inv2',
        item: {
          id: 'item2',
          name: 'Test Product 2',
          sku: 'SKU002',
          category: { name: 'Office Supplies' },
          reorderPoint: 40,
        },
        location: {
          id: 'loc2',
          code: 'B-2-3',
          warehouse: { id: 'wh2', name: 'Secondary Warehouse' },
        },
        qtyOnHand: 30,
        qtyReserved: 5,
        qtyAvailable: 25,
        lowStock: false,
        expiring: false,
        lastCountedAt: '2024-01-02T00:00:00Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inventory items correctly', () => {
    vi.mocked(trpc.inventory.list.useQuery).mockReturnValue({
      data: mockInventoryData,
      isLoading: false,
      error: null,
    } as any);

    render(<InventoryList warehouseId="all" searchTerm="" showLowStock={false} />);

    // Check if items are displayed
    expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    expect(screen.getByText('SKU001')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument(); // qty on hand
    expect(screen.getByText('80')).toBeInTheDocument(); // available

    expect(screen.getByText('Test Product 2')).toBeInTheDocument();
    expect(screen.getByText('SKU002')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(trpc.inventory.list.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<InventoryList warehouseId="all" searchTerm="" showLowStock={false} />);

    // Check for skeleton loaders
    expect(screen.getAllByRole('row')).toHaveLength(6); // 1 header + 5 skeleton rows
  });

  it('shows error state', () => {
    vi.mocked(trpc.inventory.list.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch inventory'),
    } as any);

    render(<InventoryList warehouseId="all" searchTerm="" showLowStock={false} />);

    expect(screen.getByText(/Error loading inventory/)).toBeInTheDocument();
  });


  it('highlights low stock items', () => {
    const lowStockData = {
      ...mockInventoryData,
      inventory: [
        {
          ...mockInventoryData.inventory[0],
          qtyOnHand: 40, // Below reorder point of 50
          qtyAvailable: 20,
          lowStock: true,
        },
      ],
    };

    vi.mocked(trpc.inventory.list.useQuery).mockReturnValue({
      data: lowStockData,
      isLoading: false,
      error: null,
    } as any);

    render(<InventoryList warehouseId="all" searchTerm="" showLowStock={false} />);

    // Verify low stock item is rendered
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('filters by warehouse', () => {
    vi.mocked(trpc.inventory.list.useQuery).mockReturnValue({
      data: mockInventoryData,
      isLoading: false,
      error: null,
    } as any);

    const { rerender } = render(
      <InventoryList warehouseId="wh1" searchTerm="" showLowStock={false} />
    );

    // Verify the query was called with the correct warehouse filter
    expect(trpc.inventory.list.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouseId: 'wh1',
      })
    );

    // Change warehouse
    rerender(<InventoryList warehouseId="wh2" searchTerm="" showLowStock={false} />);

    expect(trpc.inventory.list.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouseId: 'wh2',
      })
    );
  });

  it('applies search filter', () => {
    vi.mocked(trpc.inventory.list.useQuery).mockReturnValue({
      data: mockInventoryData,
      isLoading: false,
      error: null,
    } as any);

    render(<InventoryList warehouseId="all" searchTerm="Product 1" showLowStock={false} />);

    expect(trpc.inventory.list.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Product 1',
      })
    );
  });

  it('opens stock adjustment dialog when clicking adjust button', async () => {
    const user = userEvent.setup();
    vi.mocked(trpc.inventory.list.useQuery).mockReturnValue({
      data: mockInventoryData,
      isLoading: false,
      error: null,
    } as any);

    render(<InventoryList warehouseId="all" searchTerm="" showLowStock={false} />);

    // Click the adjust button for the first item
    const adjustButtons = screen.getAllByText('Adjust');
    await user.click(adjustButtons[0]);

    // Check if the dialog opens (you might need to adjust based on your dialog implementation)
    await waitFor(() => {
      expect(screen.getByText('Adjust Stock')).toBeInTheDocument();
    });
  });
});