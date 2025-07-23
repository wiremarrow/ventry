import { vi } from 'vitest';

export const createMockTRPC = () => {
  const mockUtils = {
    invalidate: vi.fn(),
    items: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    inventory: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    warehouses: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    suppliers: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    orders: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    purchaseOrders: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    customers: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    categories: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    stockMovements: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    receipts: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    shipments: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    returns: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    locations: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    organizations: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    unitsOfMeasure: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
    itemCategories: {
      list: { invalidate: vi.fn() },
      get: { invalidate: vi.fn() },
    },
  };

  return {
    trpc: {
      useUtils: vi.fn(() => mockUtils),
    },
    mockUtils,
  };
};