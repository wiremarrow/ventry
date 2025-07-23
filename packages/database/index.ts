export * from './generated/client/client.js';
export { PrismaClient, Role, OrganizationRole, MovementType, AuditAction, AddressType, OrderStatus, POStatus } from './generated/client/client.js';

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
  Address,
  Order,
  PurchaseOrder,
  Organization,
  OrganizationMember,
} from './generated/client/client.js';