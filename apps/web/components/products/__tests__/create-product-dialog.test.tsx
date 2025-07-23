import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateProductDialog } from '../create-product-dialog';
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
      create: {
        useMutation: vi.fn(),
      },
    },
    useUtils: vi.fn(() => ({
      items: {
        list: {
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

describe('CreateProductDialog', () => {
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

  const defaultProps = {
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

    // Default mock for create mutation
    vi.mocked(trpc.items.create.useMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
  });

  it('renders dialog when open', () => {
    render(<CreateProductDialog {...defaultProps} />);

    expect(screen.getByText('Add New Product')).toBeInTheDocument();
    expect(screen.getByText('Create a new product in your inventory catalog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<CreateProductDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Add New Product')).not.toBeInTheDocument();
  });

  it('renders all form sections', () => {
    render(<CreateProductDialog {...defaultProps} />);

    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Pricing & Supplier')).toBeInTheDocument();
    expect(screen.getByText('Inventory Management')).toBeInTheDocument();
    expect(screen.getByText('Physical Dimensions (Optional)')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    render(<CreateProductDialog {...defaultProps} />);

    // Basic fields
    expect(screen.getByLabelText('SKU *')).toBeInTheDocument();
    expect(screen.getByLabelText('Product Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Category *')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit of Measure *')).toBeInTheDocument();

    // Pricing fields
    expect(screen.getByLabelText('Default Cost')).toBeInTheDocument();
    expect(screen.getByLabelText('Default Price')).toBeInTheDocument();
    expect(screen.getByLabelText('Default Supplier')).toBeInTheDocument();

    // Inventory fields
    expect(screen.getByLabelText('Reorder Point')).toBeInTheDocument();
    expect(screen.getByLabelText('Reorder Quantity')).toBeInTheDocument();

    // Physical dimensions
    expect(screen.getByLabelText('Weight (kg)')).toBeInTheDocument();
    expect(screen.getByLabelText('L (cm)')).toBeInTheDocument();
    expect(screen.getByLabelText('W (cm)')).toBeInTheDocument();
    expect(screen.getByLabelText('H (cm)')).toBeInTheDocument();
  });

  it('loads categories, units, and suppliers', () => {
    render(<CreateProductDialog {...defaultProps} />);

    // Open category dropdown
    fireEvent.click(screen.getByText('Select category'));
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Clothing')).toBeInTheDocument();

    // Open unit dropdown
    fireEvent.click(screen.getByText('Select unit'));
    expect(screen.getByText('Each (EA)')).toBeInTheDocument();
    expect(screen.getByText('Box (BX)')).toBeInTheDocument();

    // Open supplier dropdown
    fireEvent.click(screen.getByText('Select supplier (optional)'));
    expect(screen.getByText('Supplier A')).toBeInTheDocument();
    expect(screen.getByText('Supplier B')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<CreateProductDialog {...defaultProps} />);

    // Try to submit without filling required fields
    fireEvent.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(screen.getByText('SKU is required')).toBeInTheDocument();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Category is required')).toBeInTheDocument();
      expect(screen.getByText('Unit of measure is required')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockCreate = vi.fn();
    vi.mocked(trpc.items.create.useMutation).mockReturnValue({
      mutate: mockCreate,
      isPending: false,
    } as any);

    const user = userEvent.setup();
    render(<CreateProductDialog {...defaultProps} />);

    // Fill required fields
    await user.type(screen.getByLabelText('SKU *'), 'TEST-001');
    await user.type(screen.getByLabelText('Product Name *'), 'Test Product');
    
    // Select category
    await user.click(screen.getByText('Select category'));
    await user.click(screen.getByText('Electronics'));

    // Select unit
    await user.click(screen.getByText('Select unit'));
    await user.click(screen.getByText('Each (EA)'));

    // Submit form
    await user.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        sku: 'TEST-001',
        name: 'Test Product',
        description: '',
        categoryId: '1',
        uomId: '1',
        defaultSupplierId: null,
        defaultCost: null,
        defaultPrice: null,
        weightKg: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        reorderPoint: 0,
        reorderQty: 1,
        isActive: true,
      });
    });
  });

  it('submits form with all fields filled', async () => {
    const mockCreate = vi.fn();
    vi.mocked(trpc.items.create.useMutation).mockReturnValue({
      mutate: mockCreate,
      isPending: false,
    } as any);

    const user = userEvent.setup();
    render(<CreateProductDialog {...defaultProps} />);

    // Fill all fields
    await user.type(screen.getByLabelText('SKU *'), 'TEST-002');
    await user.type(screen.getByLabelText('Product Name *'), 'Full Test Product');
    await user.type(screen.getByLabelText('Description'), 'This is a test description');
    
    // Select category
    await user.click(screen.getByText('Select category'));
    await user.click(screen.getByText('Electronics'));

    // Select unit
    await user.click(screen.getByText('Select unit'));
    await user.click(screen.getByText('Box (BX)'));

    // Fill pricing
    await user.type(screen.getByLabelText('Default Cost'), '50.00');
    await user.type(screen.getByLabelText('Default Price'), '100.00');

    // Select supplier
    await user.click(screen.getByText('Select supplier (optional)'));
    await user.click(screen.getByText('Supplier B'));

    // Fill inventory
    await user.clear(screen.getByLabelText('Reorder Point'));
    await user.type(screen.getByLabelText('Reorder Point'), '25');
    await user.clear(screen.getByLabelText('Reorder Quantity'));
    await user.type(screen.getByLabelText('Reorder Quantity'), '50');

    // Fill dimensions
    await user.type(screen.getByLabelText('Weight (kg)'), '2.5');
    await user.type(screen.getByLabelText('L (cm)'), '30');
    await user.type(screen.getByLabelText('W (cm)'), '20');
    await user.type(screen.getByLabelText('H (cm)'), '15');

    // Toggle active status
    await user.click(screen.getByRole('switch'));

    // Submit form
    await user.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        sku: 'TEST-002',
        name: 'Full Test Product',
        description: 'This is a test description',
        categoryId: '1',
        uomId: '2',
        defaultSupplierId: '2',
        defaultCost: 50,
        defaultPrice: 100,
        weightKg: 2.5,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15,
        reorderPoint: 25,
        reorderQty: 50,
        isActive: false,
      });
    });
  });

  it('disables submit button while pending', () => {
    vi.mocked(trpc.items.create.useMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as any);

    render(<CreateProductDialog {...defaultProps} />);

    const submitButton = screen.getByText('Creating...');
    expect(submitButton).toBeDisabled();
  });

  it('calls onOpenChange when cancel is clicked', () => {
    render(<CreateProductDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('handles mutation success', async () => {
    const mockInvalidate = vi.fn();
    const mockReset = vi.fn();
    
    vi.mocked(trpc.useUtils).mockReturnValue({
      items: {
        list: {
          invalidate: mockInvalidate,
        },
      },
    } as any);

    let onSuccess: (() => void) | undefined;
    vi.mocked(trpc.items.create.useMutation).mockImplementation((options) => {
      onSuccess = options?.onSuccess;
      return {
        mutate: vi.fn(() => {
          onSuccess?.();
        }),
        isPending: false,
      } as any;
    });

    const user = userEvent.setup();
    render(<CreateProductDialog {...defaultProps} />);

    // Mock form reset
    const form = { reset: mockReset };
    Object.defineProperty(screen.getByLabelText('SKU *'), 'form', { value: form });

    // Fill minimum required fields
    await user.type(screen.getByLabelText('SKU *'), 'TEST-001');
    await user.type(screen.getByLabelText('Product Name *'), 'Test Product');
    await user.click(screen.getByText('Select category'));
    await user.click(screen.getByText('Electronics'));
    await user.click(screen.getByText('Select unit'));
    await user.click(screen.getByText('Each (EA)'));

    // Submit
    await user.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(mockInvalidate).toHaveBeenCalled();
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('handles mutation error', async () => {
    let onError: ((error: any) => void) | undefined;
    vi.mocked(trpc.items.create.useMutation).mockImplementation((options) => {
      onError = options?.onError;
      return {
        mutate: vi.fn(() => {
          onError?.({ message: 'Failed to create product' });
        }),
        isPending: false,
      } as any;
    });

    const user = userEvent.setup();
    render(<CreateProductDialog {...defaultProps} />);

    // Fill minimum required fields
    await user.type(screen.getByLabelText('SKU *'), 'TEST-001');
    await user.type(screen.getByLabelText('Product Name *'), 'Test Product');
    await user.click(screen.getByText('Select category'));
    await user.click(screen.getByText('Electronics'));
    await user.click(screen.getByText('Select unit'));
    await user.click(screen.getByText('Each (EA)'));

    // Submit
    await user.click(screen.getByText('Create Product'));

    // Error handling is done in the mutation callback
  });

  it('validates SKU max length', async () => {
    const user = userEvent.setup();
    render(<CreateProductDialog {...defaultProps} />);

    const skuInput = screen.getByLabelText('SKU *');
    const longSku = 'A'.repeat(51);
    
    await user.type(skuInput, longSku);
    fireEvent.blur(skuInput);

    // Submit to trigger validation
    fireEvent.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(screen.getByText(/String must contain at most 50 character/)).toBeInTheDocument();
    });
  });

  it('validates numeric fields', async () => {
    const user = userEvent.setup();
    render(<CreateProductDialog {...defaultProps} />);

    // Type invalid number in cost field
    const costInput = screen.getByLabelText('Default Cost');
    await user.type(costInput, '-10');
    
    // Fill required fields
    await user.type(screen.getByLabelText('SKU *'), 'TEST-001');
    await user.type(screen.getByLabelText('Product Name *'), 'Test Product');
    await user.click(screen.getByText('Select category'));
    await user.click(screen.getByText('Electronics'));
    await user.click(screen.getByText('Select unit'));
    await user.click(screen.getByText('Each (EA)'));

    // Submit to trigger validation
    fireEvent.click(screen.getByText('Create Product'));

    await waitFor(() => {
      expect(screen.getByText(/Number must be greater than or equal to 0/)).toBeInTheDocument();
    });
  });
});