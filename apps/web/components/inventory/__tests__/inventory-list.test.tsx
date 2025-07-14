import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test-utils/render';
import { InventoryList } from '../inventory-list';
import { trpc } from '@/lib/trpc';
import { useOrganization } from '@/hooks/use-organization';

// Mock the tRPC hooks
vi.mock('@/lib/trpc', () => ({
  trpc: {
    inventory: {
      list: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock the organization hook
vi.mock('@/hooks/use-organization', () => ({
  useOrganization: vi.fn(),
}));

describe('InventoryList', () => {
  const mockInventoryData = {
    inventoryItems: [
      {
        id: 'inv1',
        item: {
          id: 'item1',
          name: 'Test Product 1',
          sku: 'SKU001',
          category: { name: 'Electronics' },
        },
        location: {
          id: 'loc1',
          name: 'A-1-1',
          warehouse: { id: 'wh1', name: 'Main Warehouse' },
        },
        qtyOnHand: 100,
        qtyReserved: 20,
        qtyAvailable: 80,
        reorderPoint: 50,
        lastCountedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'inv2',
        item: {
          id: 'item2',
          name: 'Test Product 2',
          sku: 'SKU002',
          category: { name: 'Office Supplies' },
        },
        location: {
          id: 'loc2',
          name: 'B-2-3',
          warehouse: { id: 'wh2', name: 'Secondary Warehouse' },
        },
        qtyOnHand: 30,
        qtyReserved: 5,
        qtyAvailable: 25,
        reorderPoint: 40,
        lastCountedAt: '2024-01-02T00:00:00Z',
      },
    ],
    totalCount: 2,
    page: 1,
    totalPages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock organization context
    vi.mocked(useOrganization).mockReturnValue({
      currentOrganization: { id: 'org1', name: 'Test Org', slug: 'test-org', role: 'OWNER' },
      setOrganization: vi.fn(),
      clearOrganization: vi.fn(),
      isLoading: false,
    });
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

    expect(screen.getByText('Loading inventory...')).toBeInTheDocument();
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

  it('shows no organization selected message', () => {
    vi.mocked(useOrganization).mockReturnValue({
      currentOrganization: null,
      setOrganization: vi.fn(),
      clearOrganization: vi.fn(),
      isLoading: false,
    });

    render(<InventoryList warehouseId="all" searchTerm="" showLowStock={false} />);

    expect(screen.getByText(/No organization selected/)).toBeInTheDocument();
  });

  it('highlights low stock items', () => {
    const lowStockData = {
      ...mockInventoryData,
      inventoryItems: [
        {
          ...mockInventoryData.inventoryItems[0],
          qtyOnHand: 40, // Below reorder point of 50
          qtyAvailable: 20,
        },
      ],
    };

    vi.mocked(trpc.inventory.list.useQuery).mockReturnValue({
      data: lowStockData,
      isLoading: false,
      error: null,
    } as any);

    render(<InventoryList warehouseId="all" searchTerm="" showLowStock={false} />);

    // Check for low stock indicator (you might need to adjust this based on your actual implementation)
    const lowStockRow = screen.getByText('40').closest('tr');
    expect(lowStockRow).toHaveClass('bg-red-50'); // Assuming you add this class for low stock
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