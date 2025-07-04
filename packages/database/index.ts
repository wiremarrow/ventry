export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';

// Re-export types for easier imports
export type {
  User,
  Category,
  Product,
  Location,
  InventoryItem,
  InventoryMovement,
  AuditLog,
  Role,
  InventoryMovementType,
  AuditAction,
} from '@prisma/client';