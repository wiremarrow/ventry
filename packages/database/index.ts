export * from '@prisma/client';
export { PrismaClient, Role, InventoryMovementType, AuditAction } from '@prisma/client';

// Export the prisma client instance
export { prisma } from './client.js';

// Re-export types for easier imports
export type {
  User,
  Category,
  Product,
  Location,
  InventoryItem,
  InventoryMovement,
  AuditLog,
} from '@prisma/client';