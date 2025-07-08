import type { User, Product, Category } from '@ventry/database';
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
};

export const mockCategory: Category = {
  id: 'test-category-id',
  name: 'Test Category',
  description: 'A test category',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

export const mockProduct: Product = {
  id: 'test-product-id',
  name: 'Test Product',
  description: 'A test product',
  sku: 'TEST-001',
  unitPrice: new Decimal('19.99'),
  cost: new Decimal('10.00'),
  categoryId: mockCategory.id,
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  createdById: mockUser.id,
  updatedById: mockUser.id,
};

export const createMockUser = (overrides: Partial<User> = {}): Omit<User, 'password'> => ({
  ...mockUser,
  ...overrides,
  id: overrides.id || `user-${Date.now()}-${Math.random()}`,
});

export const createMockProduct = (overrides: Partial<Product> = {}): Product => ({
  ...mockProduct,
  ...overrides,
  id: overrides.id || `product-${Date.now()}-${Math.random()}`,
  sku: overrides.sku || `SKU-${Date.now()}`,
});