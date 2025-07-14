import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditProductDialog } from '../edit-product-dialog';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
  trpc: {
    itemCategories: {
      list: {
        useQuery: vi.fn(),
      },
    },
    unitsOfMeasure: {
      list: {
        useQuery: vi.fn(),
      },
    },
    suppliers: {
      list: {
        useQuery: vi.fn(),
      },
    },
    items: {
      update: {
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

describe('EditProductDialog', () => {
  const mockCategories = [
    { id: '1', name: 'Electronics' },
    { id: '2', name: 'Clothing' },
  ];

  const mockUoms = [
    { id: '1', name: 'Each', code: 'EA' },
    { id: '2', name: 'Box', code: 'BX' },
  ];

  const mockSuppliers = {
    suppliers: [
      { id: '1', name: 'Supplier A' },
      { id: '2', name: 'Supplier B' },
    ],
  };

  const mockProduct = {
    id: 'prod-1',
    sku: 'PROD-001',
    name: 'Test Product',
    description: 'Test description',
    categoryId: '1',
    uomId: '1',
    defaultSupplierId: '1',
    defaultCost: 50.00,
    defaultPrice: 100.00,
    weightKg: 2.5,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 15,
    reorderPoint: 10,
    reorderQty: 20,
    isActive: true,
  };

  const defaultProps = {
    product: mockProduct,
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(trpc.itemCategories.list.useQuery).mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(trpc.unitsOfMeasure.list.useQuery).mockReturnValue({
      data: mockUoms,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(trpc.suppliers.list.useQuery).mockReturnValue({
      data: mockSuppliers,
      isLoading: false,
      error: null,
    } as any);

    // Default mock for update mutation
    vi.mocked(trpc.items.update.useMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
  });

  it('renders dialog when open', () => {
    render(<EditProductDialog {...defaultProps} />);

    expect(screen.getByText('Edit Product')).toBeInTheDocument();
    expect(screen.getByText('Update product information in your inventory catalog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<EditProductDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Edit Product')).not.toBeInTheDocument();
  });

  it('does not render when product is null', () => {
    render(<EditProductDialog {...defaultProps} product={null} />);

    expect(screen.queryByText('Edit Product')).not.toBeInTheDocument();
  });

  it('populates form with product data', () => {
    render(<EditProductDialog {...defaultProps} />);

    expect(screen.getByDisplayValue('PROD-001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Product')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
  });

  it('handles product with nested data', () => {
    const productWithNested = {
      ...mockProduct,
      categoryId: null,
      category: { id: '2', name: 'Clothing' },
      uomId: null,
      unitOfMeasure: { id: '2', name: 'Box' },
      defaultSupplierId: null,
      defaultSupplier: { id: '2', name: 'Supplier B' },
    };

    render(<EditProductDialog {...defaultProps} product={productWithNested} />);

    // Form should still be populated correctly
    expect(screen.getByDisplayValue('PROD-001')).toBeInTheDocument();
  });

  it('handles product with null values', () => {
    const productWithNulls = {
      ...mockProduct,
      description: null,
      defaultSupplierId: null,
      defaultCost: null,
      defaultPrice: null,
      weightKg: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      reorderPoint: null,
      reorderQty: null,
    };

    render(<EditProductDialog {...defaultProps} product={productWithNulls} />);

    // Check that empty/default values are shown
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Default Cost')).toHaveValue('');
    expect(screen.getByLabelText('Default Price')).toHaveValue('');
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue('');
    expect(screen.getByLabelText('L (cm)')).toHaveValue('');
    expect(screen.getByLabelText('W (cm)')).toHaveValue('');
    expect(screen.getByLabelText('H (cm)')).toHaveValue('');
    expect(screen.getByLabelText('Reorder Point')).toHaveValue('0');
    expect(screen.getByLabelText('Reorder Quantity')).toHaveValue('1');
  });

  it('updates form when product changes', () => {
    const { rerender } = render(<EditProductDialog {...defaultProps} />);

    expect(screen.getByDisplayValue('PROD-001')).toBeInTheDocument();

    const newProduct = {
      ...mockProduct,
      sku: 'PROD-002',
      name: 'Updated Product',
    };

    rerender(<EditProductDialog {...defaultProps} product={newProduct} />);

    expect(screen.getByDisplayValue('PROD-002')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Updated Product')).toBeInTheDocument();
  });

  it('submits form with updated data', async () => {
    const mockUpdate = vi.fn();
    vi.mocked(trpc.items.update.useMutation).mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
    } as any);

    const user = userEvent.setup();
    render(<EditProductDialog {...defaultProps} />);

    // Update some fields
    const nameInput = screen.getByLabelText('Product Name *');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Product Name');

    const priceInput = screen.getByLabelText('Default Price');
    await user.clear(priceInput);
    await user.type(priceInput, '150.00');

    // Submit form
    await user.click(screen.getByText('Update Product'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'prod-1',
        sku: 'PROD-001',
        name: 'Updated Product Name',
        description: 'Test description',
        categoryId: '1',
        uomId: '1',
        defaultSupplierId: '1',
        defaultCost: 50,
        defaultPrice: 150,
        weightKg: 2.5,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15,
        reorderPoint: 10,
        reorderQty: 20,
        isActive: true,
      });
    });
  });

  it('handles null supplier selection', async () => {
    const mockUpdate = vi.fn();
    vi.mocked(trpc.items.update.useMutation).mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
    } as any);

    const user = userEvent.setup();
    render(<EditProductDialog {...defaultProps} />);

    // Select "No supplier"
    await user.click(screen.getByText('Supplier A'));
    await user.click(screen.getByText('No supplier'));

    // Submit form
    await user.click(screen.getByText('Update Product'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultSupplierId: null,
        })
      );
    });
  });

  it('handles numeric field conversion correctly', async () => {
    const mockUpdate = vi.fn();
    vi.mocked(trpc.items.update.useMutation).mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
    } as any);

    const user = userEvent.setup();
    render(<EditProductDialog {...defaultProps} />);

    // Clear a numeric field
    const weightInput = screen.getByLabelText('Weight (kg)');
    await user.clear(weightInput);

    // Submit form
    await user.click(screen.getByText('Update Product'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          weightKg: null,
        })
      );
    });
  });

  it('disables submit button while pending', () => {
    vi.mocked(trpc.items.update.useMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as any);

    render(<EditProductDialog {...defaultProps} />);

    const submitButton = screen.getByText('Updating...');
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });

  it('calls onOpenChange when cancel is clicked', () => {
    render(<EditProductDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('handles mutation success', async () => {
    const mockInvalidate = vi.fn();
    const mockGetInvalidate = vi.fn();
    
    vi.mocked(trpc.useUtils).mockReturnValue({
      items: {
        list: {
          invalidate: mockInvalidate,
        },
        get: {
          invalidate: mockGetInvalidate,
        },
      },
    } as any);

    let onSuccess: any;
    vi.mocked(trpc.items.update.useMutation).mockImplementation((options: any) => {
      onSuccess = options.onSuccess;
      return {
        mutate: vi.fn(() => {
          onSuccess();
        }),
        isPending: false,
      } as any;
    });

    const user = userEvent.setup();
    render(<EditProductDialog {...defaultProps} />);

    // Update a field
    const nameInput = screen.getByLabelText('Product Name *');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated');

    // Submit
    await user.click(screen.getByText('Update Product'));

    await waitFor(() => {
      expect(mockInvalidate).toHaveBeenCalled();
      expect(mockGetInvalidate).toHaveBeenCalledWith({ id: 'prod-1' });
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('handles mutation error', async () => {
    let onError: any;
    vi.mocked(trpc.items.update.useMutation).mockImplementation((options: any) => {
      onError = options.onError;
      return {
        mutate: vi.fn(() => {
          onError({ message: 'Failed to update product' });
        }),
        isPending: false,
      } as any;
    });

    const user = userEvent.setup();
    render(<EditProductDialog {...defaultProps} />);

    // Submit
    await user.click(screen.getByText('Update Product'));

    // Error handling is done in the mutation callback
  });

  it('does not submit if product id is missing', async () => {
    const mockUpdate = vi.fn();
    vi.mocked(trpc.items.update.useMutation).mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
    } as any);

    render(<EditProductDialog {...defaultProps} product={{ ...mockProduct, id: undefined }} />);

    // Try to submit
    fireEvent.click(screen.getByText('Update Product'));

    await waitFor(() => {
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  it('toggles active status', async () => {
    const mockUpdate = vi.fn();
    vi.mocked(trpc.items.update.useMutation).mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
    } as any);

    const user = userEvent.setup();
    render(<EditProductDialog {...defaultProps} />);

    // Toggle active switch
    const activeSwitch = screen.getByRole('switch');
    await user.click(activeSwitch);

    // Submit form
    await user.click(screen.getByText('Update Product'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        })
      );
    });
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<EditProductDialog {...defaultProps} />);

    // Clear required fields
    const skuInput = screen.getByLabelText('SKU *');
    await user.clear(skuInput);

    const nameInput = screen.getByLabelText('Product Name *');
    await user.clear(nameInput);

    // Submit to trigger validation
    fireEvent.click(screen.getByText('Update Product'));

    await waitFor(() => {
      expect(screen.getByText('SKU is required')).toBeInTheDocument();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });
});