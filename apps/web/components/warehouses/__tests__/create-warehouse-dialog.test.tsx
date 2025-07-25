import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateWarehouseDialog } from '../create-warehouse-dialog';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
  trpc: {
    warehouses: {
      create: {
        useMutation: vi.fn(),
      },
    },
    useUtils: vi.fn(() => ({
      warehouses: {
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

describe('CreateWarehouseDialog', () => {
  const mockCreateMutation = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (trpc.warehouses.create.useMutation as any).mockReturnValue({
      mutate: mockCreateMutation,
      isPending: false,
    });
  });

  it('renders dialog when open', () => {
    render(<CreateWarehouseDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByText('Add New Warehouse')).toBeInTheDocument();
    expect(
      screen.getByText('Create a new warehouse location for inventory storage')
    ).toBeInTheDocument();
  });

  it('does not render dialog when closed', () => {
    render(<CreateWarehouseDialog open={false} onOpenChange={mockOnOpenChange} />);

    expect(screen.queryByText('Add New Warehouse')).not.toBeInTheDocument();
  });

  it('has all required form fields', () => {
    render(<CreateWarehouseDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByLabelText(/warehouse code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/warehouse name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address line 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address line 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();

    render(<CreateWarehouseDialog open={true} onOpenChange={mockOnOpenChange} />);

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /create warehouse/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Code is required')).toBeInTheDocument();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Address is required')).toBeInTheDocument();
    });

    expect(mockCreateMutation).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();

    render(<CreateWarehouseDialog open={true} onOpenChange={mockOnOpenChange} />);

    // Fill in required fields
    await user.type(screen.getByLabelText(/warehouse code/i), 'WH-001');
    await user.type(screen.getByLabelText(/warehouse name/i), 'Test Warehouse');
    await user.type(screen.getByLabelText(/address line 1/i), '123 Main St');
    await user.type(screen.getByLabelText(/city/i), 'New York');
    await user.type(screen.getByLabelText(/state/i), 'NY');
    await user.type(screen.getByLabelText(/postal code/i), '10001');

    // Optional fields
    await user.type(screen.getByLabelText(/phone/i), '+1-555-0123');
    await user.type(screen.getByLabelText(/notes/i), 'Test notes');

    const submitButton = screen.getByRole('button', { name: /create warehouse/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateMutation).toHaveBeenCalledWith({
        code: 'WH-001',
        name: 'Test Warehouse',
        line1: '123 Main St',
        line2: '',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        postalCode: '10001',
        phone: '+1-555-0123',
        notes: 'Test notes',
      });
    });
  });

  it('calls onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup();

    render(<CreateWarehouseDialog open={true} onOpenChange={mockOnOpenChange} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows loading state during submission', () => {
    (trpc.warehouses.create.useMutation as any).mockReturnValue({
      mutate: mockCreateMutation,
      isPending: true,
    });

    render(<CreateWarehouseDialog open={true} onOpenChange={mockOnOpenChange} />);

    const submitButton = screen.getByRole('button', { name: /creating/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });

  it('validates postal code format', async () => {
    const user = userEvent.setup();

    render(<CreateWarehouseDialog open={true} onOpenChange={mockOnOpenChange} />);

    // Fill in all required fields except postal code
    await user.type(screen.getByLabelText(/warehouse code/i), 'WH-001');
    await user.type(screen.getByLabelText(/warehouse name/i), 'Test Warehouse');
    await user.type(screen.getByLabelText(/address line 1/i), '123 Main St');
    await user.type(screen.getByLabelText(/city/i), 'New York');
    await user.type(screen.getByLabelText(/state/i), 'NY');
    // Leave postal code empty

    const submitButton = screen.getByRole('button', { name: /create warehouse/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Postal code is required')).toBeInTheDocument();
    });

    expect(mockCreateMutation).not.toHaveBeenCalled();
  });

  it('has default country value', () => {
    render(<CreateWarehouseDialog open={true} onOpenChange={mockOnOpenChange} />);

    const countryInput = screen.getByLabelText(/country/i) as HTMLInputElement;
    expect(countryInput.value).toBe('USA');
  });
});
