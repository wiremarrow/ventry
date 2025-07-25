import type { User, Item, ItemCategory } from '@ventry/database';
import { Decimal } from '@prisma/client/runtime/library';
import type { AuthenticatedUser } from '../trpc/context.js';

export const mockUser: Omit<User, 'password'> = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  lastLoginAt: null,
};

export const mockAdminUser: Omit<User, 'password'> = {
  ...mockUser,
  id: 'test-admin-id',
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMIN',
};

// AuthenticatedUser mocks for tRPC context (with string dates)
export const mockAuthenticatedUser: AuthenticatedUser = {
  id: mockUser.id,
  email: mockUser.email,
  username: mockUser.username,
  firstName: mockUser.firstName,
  lastName: mockUser.lastName,
  role: mockUser.role,
  isActive: mockUser.isActive,
  createdAt: mockUser.createdAt.toISOString(),
  organizationId: 'test-org-id',
  organizationRole: 'ADMIN',
};

export const mockAuthenticatedAdminUser: AuthenticatedUser = {
  id: mockAdminUser.id,
  email: mockAdminUser.email,
  username: mockAdminUser.username,
  firstName: mockAdminUser.firstName,
  lastName: mockAdminUser.lastName,
  role: mockAdminUser.role,
  isActive: mockAdminUser.isActive,
  createdAt: mockAdminUser.createdAt.toISOString(),
  organizationId: 'test-org-id',
  organizationRole: 'OWNER',
};

export const mockCategory: ItemCategory = {
  id: 'test-category-id',
  organizationId: 'test-org-id',
  name: 'Test Category',
  description: 'A test category',
  parentId: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const mockItem: Item = {
  id: 'test-item-id',
  organizationId: 'test-org-id',
  sku: 'TEST-001',
  upc: null,
  name: 'Test Item',
  description: 'A test item',
  categoryId: mockCategory.id,
  uomId: 'test-uom-id',
  defaultSupplierId: null,
  defaultCost: new Decimal('10.00'),
  defaultPrice: new Decimal('19.99'),
  weightKg: new Decimal('1.5'),
  lengthCm: new Decimal('10'),
  widthCm: new Decimal('10'),
  heightCm: new Decimal('10'),
  reorderPoint: 10,
  reorderQty: 50,
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const createMockUser = (overrides: Partial<User> = {}): Omit<User, 'password'> => ({
  ...mockUser,
  ...overrides,
  id: overrides.id || `user-${Date.now()}-${Math.random()}`,
});

export const createMockItem = (overrides: Partial<Item> = {}): Item => ({
  ...mockItem,
  ...overrides,
  id: overrides.id || `product-${Date.now()}-${Math.random()}`,
  sku: overrides.sku || `SKU-${Date.now()}`,
});
