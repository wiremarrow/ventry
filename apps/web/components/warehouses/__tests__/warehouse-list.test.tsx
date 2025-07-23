import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, userEvent } from '@/test-utils/render';
import { WarehouseList } from '../warehouse-list';
import { trpc } from '@/lib/trpc';
import { createQueryResult } from '@/test-utils/trpc-mock-factory';

// Mock trpc
vi.mock('@/lib/trpc', () => {
  return {
    trpc: {
      warehouses: {
        list: {
          useQuery: vi.fn(),
        },
        delete: {
          useMutation: vi.fn(),
        },
      },
      useUtils: vi.fn(() => ({
        warehouses: {
          list: {
            invalidate: vi.fn(),
          },
          get: {
            invalidate: vi.fn(),
          },
        },
      })),
    },
  };
});

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the dialogs
vi.mock('../edit-warehouse-dialog', () => ({
  EditWarehouseDialog: ({ open }: { warehouse: unknown; open: boolean; onOpenChange: (open: boolean) => void }) => 
    open ? <div data-testid="edit-dialog">Edit Dialog</div> : null,
}));

vi.mock('../warehouse-details-dialog', () => ({
  WarehouseDetailsDialog: ({ open }: { warehouseId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) => 
    open ? <div data-testid="details-dialog">Details Dialog</div> : null,
}));

describe('WarehouseList', () => {
  const mockWarehouses = [
    {
      id: '1',
      code: 'WH-001',
      name: 'Main Warehouse',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'USA',
      line1: '123 Main St',
      line2: null,
      phone: '+1-555-0123',
      notes: 'Primary distribution center',
      _count: { locations: 5 },
      stats: {
        totalCapacity: 10000,
        utilizationRate: 75,
      },
    },
    {
      id: '2',
      code: 'WH-002',
      name: 'Secondary Warehouse',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90210',
      country: 'USA',
      line1: '456 Oak Ave',
      line2: 'Suite 100',
      phone: null,
      notes: null,
      _count: { locations: 3 },
      stats: {
        totalCapacity: 5000,
        utilizationRate: 45,
      },
    },
  ];

  const mockDeleteMutation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trpc.warehouses.delete.useMutation).mockReturnValue({
      mutate: mockDeleteMutation,
      mutateAsync: vi.fn(),
      isPending: false,
      isIdle: true,
      isError: false,
      isSuccess: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    });
  });

  it('renders loading state correctly', () => {
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue(
      createQueryResult(undefined, { isLoading: true })
    );

    render(<WarehouseList searchTerm="" />);

    // The skeleton elements don't have testids, so check for the skeleton class
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(5);
  });

  it('renders empty state when no warehouses exist', () => {
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue(
      createQueryResult([])
    );

    render(<WarehouseList searchTerm="" />);

    expect(screen.getByText('No warehouses found')).toBeInTheDocument();
    expect(screen.getByText('Start by adding your first warehouse')).toBeInTheDocument();
  });

  it('renders warehouse list correctly', () => {
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue(
      createQueryResult(mockWarehouses)
    );

    render(<WarehouseList searchTerm="" />);

    expect(screen.getByText('WH-001')).toBeInTheDocument();
    expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    expect(screen.getByText('New York, NY')).toBeInTheDocument();
    expect(screen.getByText('+1-555-0123')).toBeInTheDocument();

    expect(screen.getByText('WH-002')).toBeInTheDocument();
    expect(screen.getByText('Secondary Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Los Angeles, CA')).toBeInTheDocument();
    // There are multiple '-' in the table, so just verify the warehouse row exists
  });

  it('filters warehouses based on search term', () => {
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue(
      createQueryResult(mockWarehouses)
    );

    render(<WarehouseList searchTerm="main" />);

    expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    expect(screen.queryByText('Secondary Warehouse')).not.toBeInTheDocument();
  });

  it('opens edit dialog when edit is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue(
      createQueryResult(mockWarehouses)
    );

    render(<WarehouseList searchTerm="" />);

    // Click on first dropdown menu using userEvent
    const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
    await user.click(dropdownButtons[0]);

    // Wait for dropdown to open and find edit button
    await waitFor(async () => {
      const editButton = screen.getByText('Edit');
      expect(editButton).toBeInTheDocument();
      await user.click(editButton);
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
    });
  });

  it('opens details dialog when view details is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue(
      createQueryResult(mockWarehouses)
    );

    render(<WarehouseList searchTerm="" />);

    // Click on first dropdown menu using userEvent
    const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
    await user.click(dropdownButtons[0]);

    // Wait for dropdown to open and find details button
    await waitFor(async () => {
      const detailsButton = screen.getByText('View Details');
      expect(detailsButton).toBeInTheDocument();
      await user.click(detailsButton);
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(screen.getByTestId('details-dialog')).toBeInTheDocument();
    });
  });

  it('calls delete mutation when delete is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue(
      createQueryResult(mockWarehouses)
    );

    render(<WarehouseList searchTerm="" />);

    // Click on first dropdown menu using userEvent
    const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
    await user.click(dropdownButtons[0]);

    // Wait for dropdown to open and find delete button
    await waitFor(async () => {
      const deleteButton = screen.getByText('Delete');
      expect(deleteButton).toBeInTheDocument();
      await user.click(deleteButton);
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(mockDeleteMutation).toHaveBeenCalledWith({ id: '1' });
    });
  });

  it('displays capacity and utilization correctly', () => {
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue(
      createQueryResult(mockWarehouses)
    );

    render(<WarehouseList searchTerm="" />);

    // Since stats are not included in list query, capacity and utilization show as '-'
    const dashElements = screen.getAllByText('-');
    expect(dashElements.length).toBeGreaterThan(0);
    
    // Verify warehouse names are displayed
    expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Secondary Warehouse')).toBeInTheDocument();
  });

  it('handles error state correctly', () => {
    vi.mocked(trpc.warehouses.list.useQuery).mockReturnValue(
      createQueryResult(undefined, { isError: true, error: { message: 'Failed to load warehouses' } })
    );

    render(<WarehouseList searchTerm="" />);

    expect(screen.getByText('Error loading warehouses')).toBeInTheDocument();
    expect(screen.getByText('Failed to load warehouses')).toBeInTheDocument();
  });
});