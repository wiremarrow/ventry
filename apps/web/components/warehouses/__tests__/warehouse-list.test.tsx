import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WarehouseList } from '../warehouse-list';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
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
}));

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
    (trpc.warehouses.delete.useMutation as unknown).mockReturnValue({
      mutate: mockDeleteMutation,
      isPending: false,
    });
  });

  it('renders loading state correctly', () => {
    (trpc.warehouses.list.useQuery as unknown).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<WarehouseList searchTerm="" />);

    // The skeleton elements don't have testids, so check for the skeleton class
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(5);
  });

  it('renders empty state when no warehouses exist', () => {
    (trpc.warehouses.list.useQuery as unknown).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<WarehouseList searchTerm="" />);

    expect(screen.getByText('No warehouses found')).toBeInTheDocument();
    expect(screen.getByText('Start by adding your first warehouse')).toBeInTheDocument();
  });

  it('renders warehouse list correctly', () => {
    (trpc.warehouses.list.useQuery as unknown).mockReturnValue({
      data: mockWarehouses,
      isLoading: false,
      error: null,
    });

    render(<WarehouseList searchTerm="" />);

    expect(screen.getByText('WH-001')).toBeInTheDocument();
    expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    expect(screen.getByText('New York, NY')).toBeInTheDocument();
    expect(screen.getByText('+1-555-0123')).toBeInTheDocument();

    expect(screen.getByText('WH-002')).toBeInTheDocument();
    expect(screen.getByText('Secondary Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Los Angeles, CA')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument(); // No phone
  });

  it('filters warehouses based on search term', () => {
    (trpc.warehouses.list.useQuery as unknown).mockReturnValue({
      data: mockWarehouses,
      isLoading: false,
      error: null,
    });

    render(<WarehouseList searchTerm="main" />);

    expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    expect(screen.queryByText('Secondary Warehouse')).not.toBeInTheDocument();
  });

  it('opens edit dialog when edit is clicked', async () => {
    const user = userEvent.setup();
    (trpc.warehouses.list.useQuery as unknown).mockReturnValue({
      data: mockWarehouses,
      isLoading: false,
      error: null,
    });

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
    (trpc.warehouses.list.useQuery as unknown).mockReturnValue({
      data: mockWarehouses,
      isLoading: false,
      error: null,
    });

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
    (trpc.warehouses.list.useQuery as unknown).mockReturnValue({
      data: mockWarehouses,
      isLoading: false,
      error: null,
    });

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

  it('displays utilization colors correctly', () => {
    const warehousesWithDifferentUtilization = [
      {
        ...mockWarehouses[0],
        stats: { ...mockWarehouses[0].stats, utilizationRate: 95 }, // Red
      },
      {
        ...mockWarehouses[1],
        stats: { ...mockWarehouses[1].stats, utilizationRate: 80 }, // Yellow
      },
    ];

    (trpc.warehouses.list.useQuery as unknown).mockReturnValue({
      data: warehousesWithDifferentUtilization,
      isLoading: false,
      error: null,
    });

    render(<WarehouseList searchTerm="" />);

    const utilizationElements = screen.getAllByText(/%$/);
    expect(utilizationElements[0]).toHaveClass('text-red-600');
    expect(utilizationElements[1]).toHaveClass('text-yellow-600');
  });

  it('handles error state correctly', () => {
    (trpc.warehouses.list.useQuery as unknown).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to load warehouses' },
    });

    render(<WarehouseList searchTerm="" />);

    expect(screen.getByText('Error loading warehouses')).toBeInTheDocument();
    expect(screen.getByText('Failed to load warehouses')).toBeInTheDocument();
  });
});