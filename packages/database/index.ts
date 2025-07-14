export * from '@prisma/client';
export { PrismaClient, Role, MovementType, AuditAction } from '@prisma/client';

// Export the prisma client instance
export { prisma } from './client.js';

// Re-export types for easier imports
export type {
  User,
  Item,
  ItemCategory,
  Location,
  Inventory,
  StockMovement,
  AuditLog,
  Warehouse,
  Supplier,
  Customer,
  Order,
  PurchaseOrder,
  Organization,
  OrganizationMember,
} from '@prisma/client';