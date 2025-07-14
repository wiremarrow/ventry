import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductList } from '../product-list';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
  trpc: {
    items: {
      list: {
        useQuery: vi.fn(),
      },
      duplicate: {
        useMutation: vi.fn(),
      },
      archive: {
        useMutation: vi.fn(),
      },
    },
    useUtils: vi.fn(() => ({
      items: {
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

// Mock the edit dialog
vi.mock('../edit-product-dialog', () => ({
  EditProductDialog: ({ product, open, onOpenChange }: any) => 
    open ? <div data-testid="edit-dialog">Edit Dialog</div> : null,
}));

describe('ProductList', () => {
  const mockProducts = {
    items: [
      {
        id: '1',
        sku: 'PRD-001',
        name: 'Test Product 1',
        description: 'Test description 1',
        category: { id: '1', name: 'Electronics' },
        unitOfMeasure: { id: '1', name: 'Each' },
        defaultPrice: 99.99,
        reorderPoint: 10,
        isActive: true,
      },
      {
        id: '2',
        sku: 'PRD-002',
        name: 'Test Product 2',
        description: null,
        category: null,
        unitOfMeasure: { id: '2', name: 'Box' },
        defaultPrice: null,
        reorderPoint: 0,
        isActive: false,
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

  it('renders loading state', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    expect(screen.getAllByTestId(/skeleton/i)).toHaveLength(5);
  });

  it('renders error state', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to load products' },
    } as any);

    render(<ProductList searchTerm="" />);

    expect(screen.getByText('Error loading products')).toBeInTheDocument();
    expect(screen.getByText('Failed to load products')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    expect(screen.getByText('No products found')).toBeInTheDocument();
    expect(screen.getByText('Start by adding your first product')).toBeInTheDocument();
  });

  it('renders empty state with search term', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="test search" />);

    expect(screen.getByText('No products found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('renders product list correctly', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: mockProducts,
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    // Check product 1
    expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    expect(screen.getByText('Test description 1')).toBeInTheDocument();
    expect(screen.getByText('PRD-001')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Each')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();

    // Check product 2
    expect(screen.getByText('Test Product 2')).toBeInTheDocument();
    expect(screen.getByText('PRD-002')).toBeInTheDocument();
    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    expect(screen.getByText('Box')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
  });

  it('calls query with correct parameters', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: mockProducts,
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="test" categoryId="cat1" status="ACTIVE" />);

    expect(trpc.items.list.useQuery).toHaveBeenCalledWith({
      search: 'test',
      categoryId: 'cat1',
      isActive: true,
      page: 1,
      limit: 20,
    });
  });

  it('handles duplicate action', async () => {
    const mockDuplicate = vi.fn();
    vi.mocked(trpc.items.duplicate.useMutation).mockReturnValue({
      mutate: mockDuplicate,
    } as any);

    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: mockProducts,
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    // Open dropdown and click duplicate
    const dropdownButtons = screen.getAllByLabelText('Open menu');
    fireEvent.click(dropdownButtons[0]);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Duplicate'));
    });

    expect(mockDuplicate).toHaveBeenCalledWith({ id: '1' });
  });

  it('handles archive action', async () => {
    const mockArchive = vi.fn();
    vi.mocked(trpc.items.archive.useMutation).mockReturnValue({
      mutate: mockArchive,
    } as any);

    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: mockProducts,
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    // Open dropdown and click archive
    const dropdownButtons = screen.getAllByLabelText('Open menu');
    fireEvent.click(dropdownButtons[0]);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Archive'));
    });

    expect(mockArchive).toHaveBeenCalledWith({
      itemIds: ['1'],
      reason: 'Archived from UI',
    });
  });

  it('opens edit dialog when edit is clicked', async () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: mockProducts,
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    // Open dropdown and click edit
    const dropdownButtons = screen.getAllByLabelText('Open menu');
    fireEvent.click(dropdownButtons[0]);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Edit'));
    });

    expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
  });

  it('handles pagination correctly', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: {
        ...mockProducts,
        pagination: {
          page: 2,
          limit: 20,
          total: 50,
          totalPages: 3,
        },
      },
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    expect(screen.getByText('Showing 21 to 40 of 50 products')).toBeInTheDocument();

    // Previous button should be enabled
    const prevButton = screen.getByText('Previous').closest('button');
    expect(prevButton).not.toBeDisabled();

    // Next button should be enabled
    const nextButton = screen.getByText('Next').closest('button');
    expect(nextButton).not.toBeDisabled();
  });

  it('disables pagination buttons appropriately', () => {
    // First page
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: {
        ...mockProducts,
        pagination: {
          page: 1,
          limit: 20,
          total: 50,
          totalPages: 3,
        },
      },
      isLoading: false,
      error: null,
    } as any);

    const { rerender } = render(<ProductList searchTerm="" />);

    // Previous should be disabled on first page
    expect(screen.getByText('Previous').closest('button')).toBeDisabled();
    expect(screen.getByText('Next').closest('button')).not.toBeDisabled();

    // Last page
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: {
        ...mockProducts,
        pagination: {
          page: 3,
          limit: 20,
          total: 50,
          totalPages: 3,
        },
      },
      isLoading: false,
      error: null,
    } as any);

    rerender(<ProductList searchTerm="" />);

    // Next should be disabled on last page
    expect(screen.getByText('Previous').closest('button')).not.toBeDisabled();
    expect(screen.getByText('Next').closest('button')).toBeDisabled();
  });

  it('formats currency correctly', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: {
        items: [
          {
            ...mockProducts.items[0],
            defaultPrice: 1234.56,
          },
        ],
        pagination: mockProducts.pagination,
      },
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
  });

  it('handles null values correctly', () => {
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: {
        items: [
          {
            id: '3',
            sku: 'PRD-003',
            name: 'Test Product 3',
            description: null,
            category: null,
            unitOfMeasure: null,
            defaultPrice: null,
            reorderPoint: null,
            isActive: true,
          },
        ],
        pagination: mockProducts.pagination,
      },
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    expect(screen.getByText('Each')).toBeInTheDocument(); // Default when no UOM
    expect(screen.getAllByText('-')).toHaveLength(2); // Price and reorder point
  });
});