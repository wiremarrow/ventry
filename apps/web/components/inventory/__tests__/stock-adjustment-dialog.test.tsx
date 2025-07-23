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
    expect(screen.getByText('Adjust Stock')).toBeInTheDocument();
    expect(screen.getByText('Test Product (SKU001)')).toBeInTheDocument();
    expect(screen.getByText('Current Stock: 100')).toBeInTheDocument();
    expect(screen.getByText('Location: A-1-1 (Main Warehouse)')).toBeInTheDocument();
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
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={null}
        onSuccess={mockOnSuccess}
      />
    );

    // Should still show dialog but with default/empty values
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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

    // Check default type
    expect(screen.getByLabelText('Adjustment Type')).toHaveTextContent('Add Stock');

    // Open dropdown and select different type
    await user.click(screen.getByLabelText('Adjustment Type'));
    await user.click(screen.getByText('Remove Stock'));

    expect(screen.getByLabelText('Adjustment Type')).toHaveTextContent('Remove Stock');
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
    const reasonSelect = screen.getByLabelText('Reason');

    await user.clear(quantityInput);
    await user.type(quantityInput, '50');
    expect(quantityInput).toHaveValue(50);

    await user.click(reasonSelect);
    await user.click(screen.getByText('Physical Count'));
    expect(reasonSelect).toHaveTextContent('Physical Count');
  });

  it('shows preview of stock change', async () => {
    const user = userEvent.setup();
    render(
      <StockAdjustmentDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        inventory={mockInventoryItem}
        onSuccess={mockOnSuccess}
      />
    );

    // Add stock
    const quantityInput = screen.getByLabelText('Quantity');
    await user.clear(quantityInput);
    await user.type(quantityInput, '25');

    expect(screen.getByText('New Stock: 125')).toBeInTheDocument();

    // Change to remove stock
    await user.click(screen.getByLabelText('Adjustment Type'));
    await user.click(screen.getByText('Remove Stock'));

    expect(screen.getByText('New Stock: 75')).toBeInTheDocument();
  });

  it('submits adjustment with correct data', async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation(({ onSuccess }) => {
      onSuccess?.();
    });

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

    await user.click(screen.getByLabelText('Reason'));
    await user.click(screen.getByText('Physical Count'));

    const notesInput = screen.getByLabelText('Notes (optional)');
    await user.type(notesInput, 'Monthly inventory count');

    // Submit
    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    expect(mockMutate).toHaveBeenCalledWith({
      inventoryId: 'inv1',
      type: 'ADD',
      quantity: 30,
      adjustmentType: 'COUNT',
      reason: expect.any(String),
      notes: 'Monthly inventory count',
      onSuccess: expect.any(Function),
      onError: expect.any(Function),
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
    await user.clear(quantityInput);
    await user.type(quantityInput, '-10');

    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    // Should show validation error
    expect(screen.getByText(/quantity must be positive/i)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('prevents removing more stock than available', async () => {
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
    await user.click(screen.getByLabelText('Adjustment Type'));
    await user.click(screen.getByText('Remove Stock'));

    const quantityInput = screen.getByLabelText('Quantity');
    await user.clear(quantityInput);
    await user.type(quantityInput, '150'); // More than current stock

    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    // Should be prevented
    expect(screen.getByText(/cannot remove more than available stock/i)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('requires reason selection', async () => {
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

    // Try to submit without selecting reason
    await user.click(screen.getByRole('button', { name: 'Adjust Stock' }));

    // Should show validation error
    expect(screen.getByText(/please provide a reason/i)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('disables form during submission', () => {
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

    const quantityInput = screen.getByLabelText('Quantity');
    const submitButton = screen.getByRole('button', { name: 'Adjusting...' });

    expect(quantityInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('closes dialog on successful submission', async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation(({ onSuccess }) => {
      onSuccess?.();
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

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
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