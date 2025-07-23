import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, userEvent } from '@/test-utils/render';
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
  EditProductDialog: ({ open }: { open: boolean }) => 
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
        unitOfMeasure: { id: '1', description: 'Each', code: 'EA' },
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
        unitOfMeasure: { id: '2', description: 'Box', code: 'BX' },
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

    // Check for skeleton loaders - they are rendered as divs with specific classes
    const skeletons = screen.getAllByRole('row').slice(1); // Skip header row
    expect(skeletons).toHaveLength(5);
    // Each skeleton row should have a cell with skeleton content
    expect(skeletons[0]).toHaveTextContent('');
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
    const user = userEvent.setup();
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
    const dropdownButtons = screen.getAllByText('Open menu');
    await user.click(dropdownButtons[0]);
    
    await waitFor(async () => {
      const duplicateOption = screen.getByText('Duplicate');
      await user.click(duplicateOption);
    });

    expect(mockDuplicate).toHaveBeenCalledWith({ 
      itemId: '1',
      newSku: 'PRD-001-COPY',
      newName: 'Test Product 1 (Copy)'
    });
  });

  it('handles archive action', async () => {
    const user = userEvent.setup();
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
    const dropdownButtons = screen.getAllByText('Open menu');
    await user.click(dropdownButtons[0]);
    
    await waitFor(async () => {
      const archiveOption = screen.getByText('Archive');
      await user.click(archiveOption);
    });

    expect(mockArchive).toHaveBeenCalledWith({
      itemIds: ['1'],
      reason: 'Archived from UI',
    });
  });

  it('opens edit dialog when edit is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(trpc.items.list.useQuery).mockReturnValue({
      data: mockProducts,
      isLoading: false,
      error: null,
    } as any);

    render(<ProductList searchTerm="" />);

    // Open dropdown and click edit
    const dropdownButtons = screen.getAllByText('Open menu');
    await user.click(dropdownButtons[0]);
    
    await waitFor(async () => {
      const editOption = screen.getByText('Edit');
      await user.click(editOption);
    });

    expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
  });

  it('handles pagination correctly', async () => {
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

    render(<ProductList searchTerm="" />);

    // Check pagination text for page 1
    const paginationText = screen.getByText((content, _element) => {
      return content.includes('Showing') && content.includes('1') && content.includes('20') && content.includes('50');
    });
    expect(paginationText).toBeInTheDocument();

    // Previous button should be disabled on page 1
    const prevButton = screen.getByText('Previous').closest('button');
    expect(prevButton).toBeDisabled();

    // Next button should be enabled
    const nextButton = screen.getByText('Next').closest('button');
    expect(nextButton).not.toBeDisabled();
  });

  it('disables pagination buttons appropriately', async () => {
    // Test first page
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

    render(<ProductList searchTerm="" />);

    // Previous should be disabled on first page
    const prevButton = screen.getByText('Previous').closest('button');
    const nextButton = screen.getByText('Next').closest('button');
    
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();
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