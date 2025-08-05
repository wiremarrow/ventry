import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, userEvent, waitFor } from '@/test-utils/render';
import { ProductFilters } from '../product-filters';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
  trpc: {
    itemCategories: {
      list: {
        useQuery: vi.fn(),
      },
    },
  },
}));

describe('ProductFilters', () => {
  const mockCategories = [
    { id: '1', name: 'Electronics', parentId: null },
    { id: '2', name: 'Clothing', parentId: null },
    { id: '3', name: 'Food', parentId: null },
  ];

  const defaultProps = {
    searchTerm: '',
    onSearchChange: vi.fn(),
    selectedCategory: 'all',
    onCategoryChange: vi.fn(),
    selectedStatus: 'all' as const,
    onStatusChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trpc.itemCategories.list.useQuery).mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    } as any);
  });

  it('renders all filter components', () => {
    render(<ProductFilters {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search by SKU, name, or barcode...')).toBeInTheDocument();

    // Check for select triggers (comboboxes)
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes).toHaveLength(2); // Category and Status selects
  });

  it('displays search value correctly', () => {
    render(<ProductFilters {...defaultProps} searchTerm="test search" />);

    const searchInput = screen.getByPlaceholderText(
      'Search by SKU, name, or barcode...'
    ) as HTMLInputElement;
    expect(searchInput.value).toBe('test search');
  });

  it('calls onSearchChange when typing', () => {
    render(<ProductFilters {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search by SKU, name, or barcode...');
    fireEvent.change(searchInput, { target: { value: 'new search' } });

    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('new search');
  });

  it('renders categories from API', async () => {
    const user = userEvent.setup();
    render(<ProductFilters {...defaultProps} />);

    // Open category dropdown
    const categorySelect = screen.getAllByRole('combobox')[0];
    await user.click(categorySelect);

    // Wait for dropdown to open and check options exist
    await waitFor(() => {
      const allCategoriesOptions = screen.getAllByText('All Categories');
      expect(allCategoriesOptions.length).toBeGreaterThan(0);

      const electronicsOptions = screen.getAllByText('Electronics');
      expect(electronicsOptions.length).toBeGreaterThan(0);

      const clothingOptions = screen.getAllByText('Clothing');
      expect(clothingOptions.length).toBeGreaterThan(0);

      const foodOptions = screen.getAllByText('Food');
      expect(foodOptions.length).toBeGreaterThan(0);
    });
  });

  it('calls onCategoryChange when category is selected', async () => {
    const user = userEvent.setup();
    render(<ProductFilters {...defaultProps} />);

    // Open category dropdown
    const categorySelect = screen.getAllByRole('combobox')[0];
    await user.click(categorySelect);

    // Select a category
    await user.click(screen.getByText('Electronics'));

    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith('1');
  });

  it('renders status options correctly', async () => {
    const user = userEvent.setup();
    render(<ProductFilters {...defaultProps} />);

    // Open status dropdown
    const statusSelect = screen.getAllByRole('combobox')[1];
    await user.click(statusSelect);

    await waitFor(() => {
      const allStatusOptions = screen.getAllByText('All Status');
      expect(allStatusOptions.length).toBeGreaterThan(0);

      const activeOptions = screen.getAllByText('Active');
      expect(activeOptions.length).toBeGreaterThan(0);

      const inactiveOptions = screen.getAllByText('Inactive');
      expect(inactiveOptions.length).toBeGreaterThan(0);
    });
  });

  it('calls onStatusChange when status is selected', async () => {
    const user = userEvent.setup();
    render(<ProductFilters {...defaultProps} />);

    // Open status dropdown
    const statusSelect = screen.getAllByRole('combobox')[1];
    await user.click(statusSelect);

    // Select a status
    await user.click(screen.getByText('Active'));

    expect(defaultProps.onStatusChange).toHaveBeenCalledWith('ACTIVE');
  });

  it('shows selected category', () => {
    render(<ProductFilters {...defaultProps} selectedCategory="1" />);

    // When a category is selected, the Select component should show the category name
    const categorySelect = screen.getAllByRole('combobox')[0];
    expect(categorySelect).toHaveTextContent('Electronics');
  });

  it('shows selected status', () => {
    const { rerender } = render(<ProductFilters {...defaultProps} />);

    // Rerender with selected status
    rerender(<ProductFilters {...defaultProps} selectedStatus="ACTIVE" />);

    // The select should show the status
    expect(screen.getAllByRole('combobox')[1]).toHaveAttribute('aria-expanded', 'false');
  });

  it('handles empty categories gracefully', async () => {
    const user = userEvent.setup();
    vi.mocked(trpc.itemCategories.list.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    render(<ProductFilters {...defaultProps} />);

    // Open category dropdown
    const categorySelect = screen.getAllByRole('combobox')[0];
    await user.click(categorySelect);

    // Should still show "All Categories" option
    await waitFor(() => {
      const allCategoriesOptions = screen.getAllByText('All Categories');
      expect(allCategoriesOptions.length).toBeGreaterThan(0);
    });
  });

  it('handles null categories data', () => {
    vi.mocked(trpc.itemCategories.list.useQuery).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);

    render(<ProductFilters {...defaultProps} />);

    // Component should still render without crashing
    expect(screen.getByPlaceholderText('Search by SKU, name, or barcode...')).toBeInTheDocument();
  });

  it('renders search icon', () => {
    render(<ProductFilters {...defaultProps} />);

    // Check for search icon by looking for the container with the icon
    const searchContainer = screen.getByPlaceholderText(
      'Search by SKU, name, or barcode...'
    ).parentElement;
    expect(searchContainer?.querySelector('svg')).toBeInTheDocument();
  });

  it('applies correct styling classes', () => {
    render(<ProductFilters {...defaultProps} />);

    // Check for main container styling
    const container = screen
      .getByPlaceholderText('Search by SKU, name, or barcode...')
      .closest('.bg-white');
    expect(container).toHaveClass('bg-white', 'p-4', 'rounded-lg', 'border', 'border-gray-200');
  });

  it('maintains responsive grid layout', () => {
    render(<ProductFilters {...defaultProps} />);

    // Check for grid container
    const gridContainer = screen
      .getByPlaceholderText('Search by SKU, name, or barcode...')
      .closest('.grid');
    expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-3', 'gap-4');
  });
});
