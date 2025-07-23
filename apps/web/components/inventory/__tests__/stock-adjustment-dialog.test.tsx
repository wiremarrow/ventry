import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test-utils/render';
import { StockAdjustmentDialog } from '../stock-adjustment-dialog';
import { trpc } from '@/lib/trpc';

// Mock the tRPC hooks
vi.mock('@/lib/trpc', () => ({
  trpc: {
    inventory: {
      adjust: {
        useMutation: vi.fn(),
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

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('StockAdjustmentDialog', () => {
  const mockInventoryItem = {
    // Base Inventory fields
    id: 'inv1',
    organizationId: 'org1',
    itemId: 'item1',
    locationId: 'loc1',
    lotId: null,
    serialId: null,
    qtyOnHand: 100,
    qtyReserved: 20,
    qtyInTransit: 0,
    lastCountedAt: null,
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    // Relations
    item: {
      id: 'item1',
      organizationId: 'org1',
      name: 'Test Product',
      sku: 'SKU001',
      description: null,
      upc: null,
      categoryId: 'cat1',
      uomId: 'uom1',
      defaultSupplierId: null,
      defaultCost: null,
      defaultPrice: null,
      weightKg: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      reorderPoint: 50,
      reorderQty: 100,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
    location: {
      id: 'loc1',
      organizationId: 'org1',
      warehouseId: 'wh1',
      zone: 'A',
      aisle: '1',
      shelf: '1',
      bin: null,
      code: 'A-1-1',
      description: null,
      maxCapacity: null,
      isTempControlled: false,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      warehouse: {
        id: 'wh1',
        organizationId: 'org1',
        name: 'Main Warehouse',
        code: 'MAIN',
        line1: '123 Main St',
        line2: null,
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345',
        country: 'US',
        phone: null,
        notes: null,
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      },
    },
    lot: null,
    // Computed fields
    qtyAvailable: 80,
    lowStock: false,
    expiring: false,
  };

  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mutation mock
    vi.mocked(trpc.inventory.adjust.useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
    } as any);
  });

  it('renders dialog content when open', () => {
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Adjust Stock' })).toBeInTheDocument();
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('SKU: SKU001')).toBeInTheDocument();
    expect(screen.getByText('Main Warehouse - A-1-1')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <StockAdjustmentDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('handles null inventory item gracefully', () => {
    const { container } = render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={null}
        onSuccess={mockOnSuccess}
      />
    );

    // Should not render anything when inventory is null
    expect(container.firstChild).toBeNull();
  });

  it('allows selecting adjustment type', async () => {
    const user = userEvent.setup();
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    // Check default radio selection
    const addRadio = screen.getByLabelText('Add');
    expect(addRadio).toBeChecked();

    // Select remove type
    const removeRadio = screen.getByLabelText('Remove');
    await user.click(removeRadio);
    expect(removeRadio).toBeChecked();
  });

  it('allows entering quantity and reason', async () => {
    const user = userEvent.setup();
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    const quantityInput = screen.getByLabelText('Quantity');
    const reasonInput = screen.getByLabelText('Reason');

    await user.clear(quantityInput);
    await user.type(quantityInput, '50');
    expect(quantityInput).toHaveValue(50);

    await user.clear(reasonInput);
    await user.type(reasonInput, 'Physical inventory count');
    expect(reasonInput).toHaveValue('Physical inventory count');
  });

  it('shows adjustment type descriptions', async () => {
    const user = userEvent.setup();
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    // Check default description
    expect(screen.getByText('Amount to add to current stock')).toBeInTheDocument();

    // Change to remove
    const removeRadio = screen.getByLabelText('Remove');
    await user.click(removeRadio);
    expect(screen.getByText('Amount to remove from current stock')).toBeInTheDocument();

    // Change to set
    const setRadio = screen.getByLabelText('Set to');
    await user.click(setRadio);
    expect(screen.getByText('New total quantity')).toBeInTheDocument();
  });

  it('submits adjustment with correct data', async () => {
    const user = userEvent.setup();
    
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill form
    const quantityInput = screen.getByLabelText('Quantity');
    await user.clear(quantityInput);
    await user.type(quantityInput, '30');

    // Select adjustment type from dropdown
    const adjustmentTypeButton = screen.getAllByRole('combobox')[0];
    await user.click(adjustmentTypeButton);
    const options = screen.getAllByText('Physical Count');
    await user.click(options[options.length - 1]); // Click the last one which is in the dropdown

    const reasonInput = screen.getByLabelText('Reason');
    await user.clear(reasonInput);
    await user.type(reasonInput, 'Monthly count');

    const notesInput = screen.getByLabelText('Notes');
    await user.type(notesInput, 'Monthly inventory count');

    // Submit
    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    expect(mockMutate).toHaveBeenCalledWith({
      inventoryId: 'inv1',
      qty: 30,
      adjustmentType: 'COUNT',
      reason: 'Monthly count',
      notes: 'Monthly inventory count',
    });
  });

  it('validates quantity is positive', async () => {
    const user = userEvent.setup();
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    const quantityInput = screen.getByLabelText('Quantity');
    const reasonInput = screen.getByLabelText('Reason');
    
    // Enter 0 as quantity and fill reason
    await user.clear(quantityInput);
    await user.type(quantityInput, '0');
    await user.type(reasonInput, 'Test reason');

    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/Quantity must be positive/i)).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('submits remove adjustment correctly', async () => {
    const user = userEvent.setup();
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    // Switch to remove type
    const removeRadio = screen.getByLabelText('Remove');
    await user.click(removeRadio);

    const quantityInput = screen.getByLabelText('Quantity');
    await user.clear(quantityInput);
    await user.type(quantityInput, '20');

    const reasonInput = screen.getByLabelText('Reason');
    await user.type(reasonInput, 'Damaged goods');

    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    // Should submit with negative quantity for removal
    expect(mockMutate).toHaveBeenCalledWith({
      inventoryId: 'inv1',
      qty: -20,
      adjustmentType: 'CORRECTION',
      reason: 'Damaged goods',
      notes: '',
    });
  });

  it('requires reason to be filled', async () => {
    const user = userEvent.setup();
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    const quantityInput = screen.getByLabelText('Quantity');
    await user.clear(quantityInput);
    await user.type(quantityInput, '10');

    // Try to submit without entering reason (field is empty by default)
    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    // Should show validation error
    expect(screen.getByText(/Please provide a reason for this adjustment/i)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('disables submit button during submission', () => {
    vi.mocked(trpc.inventory.adjust.useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      error: null,
    } as any);

    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Adjusting...' });
    expect(submitButton).toBeDisabled();
  });

  it('closes dialog on successful submission', async () => {
    const user = userEvent.setup();
    
    // Set up the mutation to call onSuccess callback
    let capturedOnSuccess: (() => void) | undefined;
    vi.mocked(trpc.inventory.adjust.useMutation).mockImplementation((options) => {
      capturedOnSuccess = options?.onSuccess;
      return {
        mutate: mockMutate,
        isPending: false,
        error: null,
      } as any;
    });

    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill and submit form
    await user.type(screen.getByLabelText('Quantity'), '10');
    await user.type(screen.getByLabelText('Reason'), 'Test adjustment');
    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    // Simulate successful mutation
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
    });
    
    // Call the onSuccess callback
    capturedOnSuccess?.();

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('handles error during submission', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Failed to adjust stock';
    mockMutate.mockImplementation(({ onError }) => {
      onError?.(new Error(errorMessage));
    });

    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill and submit form
    await user.type(screen.getByLabelText('Quantity'), '10');
    await user.click(screen.getByLabelText('Reason'));
    await user.click(screen.getByText('Physical Count'));
    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    // Dialog should remain open on error
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
  });
});