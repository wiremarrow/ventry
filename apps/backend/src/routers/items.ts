import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

import type { Prisma } from '@ventry/database';

// Input validation schemas
const itemCreateSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  categoryId: z.string().cuid(),
  uomId: z.string().cuid(),
  defaultSupplierId: z.string().cuid().optional().nullable(),
  defaultCost: z.number().min(0).optional().nullable(),
  defaultPrice: z.number().min(0).optional().nullable(),
  weightKg: z.number().min(0).optional().nullable(),
  lengthCm: z.number().min(0).optional().nullable(),
  widthCm: z.number().min(0).optional().nullable(),
  heightCm: z.number().min(0).optional().nullable(),
  reorderPoint: z.number().int().min(0).default(0),
  reorderQty: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const itemUpdateSchema = itemCreateSchema.partial().extend({
  id: z.string().cuid(),
});

const itemFilterSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().cuid().optional(),
  supplierId: z.string().cuid().optional(),
  isActive: z.boolean().optional(),
  lowStock: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['sku', 'name', 'category', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

const bulkImportSchema = z.object({
  items: z.array(itemCreateSchema),
  validateOnly: z.boolean().default(false),
});

export const itemsRouter = createTRPCRouter({
  // List items with advanced filtering
  list: organizationProcedure
    .input(itemFilterSchema)
    .query(async ({ ctx, input }) => {
      const { 
        search, 
        categoryId, 
        supplierId, 
        isActive, 
        lowStock,
        page, 
        limit, 
        sortBy, 
        sortOrder 
      } = input;

      const where: Prisma.ItemWhereInput = {
        organizationId: ctx.user.organizationId,
      };

      // Search filter
      if (search) {
        where.OR = [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Category filter
      if (categoryId) {
        where.categoryId = categoryId;
      }

      // Supplier filter
      if (supplierId) {
        where.defaultSupplierId = supplierId;
      }

      // Active filter
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Low stock filter
      if (lowStock) {
        where.inventory = {
          some: {
            qtyOnHand: {
              // Low stock check would need a custom query
              // as we can't reference item reorderPoint in this context
            },
          },
        };
      }

      // Execute queries
      const [items, total] = await Promise.all([
        ctx.prisma.item.findMany({
          where,
          include: {
            category: true,
            unitOfMeasure: true,
            defaultSupplier: true,
            _count: {
              select: {
                inventory: true,
                images: true,
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        ctx.prisma.item.count({ where }),
      ]);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get single item with all related data
  get: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findFirst({
        where: { 
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          category: true,
          unitOfMeasure: true,
          defaultSupplier: {
            include: {
              contacts: true,
            },
          },
          images: {
            orderBy: { isPrimary: 'desc' },
          },
          inventory: {
            include: {
              location: {
                include: {
                  warehouse: true,
                },
              },
            },
            orderBy: { qtyOnHand: 'desc' },
          },
          priceHistory: {
            orderBy: { startDate: 'desc' },
            take: 10,
          },
          lots: {
            where: { status: 'AVAILABLE' },
            orderBy: { expirationDate: 'asc' },
            take: 5,
          },
        },
      });

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      // Calculate total stock across all locations
      const totalStock = item.inventory.reduce(
        (acc, inv) => ({
          onHand: acc.onHand + inv.qtyOnHand,
          reserved: acc.reserved + inv.qtyReserved,
          available: acc.available + (inv.qtyOnHand - inv.qtyReserved),
        }),
        { onHand: 0, reserved: 0, available: 0 }
      );

      return {
        ...item,
        stockSummary: totalStock,
      };
    }),

  // Create new item
  create: organizationProcedure
    .input(itemCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for role permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators and managers can create items',
        });
      }

      // Check for duplicate SKU
      const existingItem = await ctx.prisma.item.findFirst({
        where: { 
          sku: input.sku,
          organizationId: ctx.user.organizationId,
        },
      });

      if (existingItem) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An item with this SKU already exists',
        });
      }

      // Create item with audit log
      const item = await ctx.prisma.$transaction(async (tx) => {
        const newItem = await tx.item.create({
          data: {
            ...input,
            organizationId: ctx.user.organizationId,
          },
          include: {
            category: true,
            unitOfMeasure: true,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'items',
            recordPk: newItem.id,
            action: 'CREATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            afterData: newItem,
          },
        });

        // Create initial price history if default price is set
        if (input.defaultPrice) {
          await tx.priceHistory.create({
            data: {
              itemId: newItem.id,
              priceType: 'RETAIL',
              price: input.defaultPrice,
              startDate: new Date(),
              organizationId: ctx.user.organizationId!,
            },
          });
        }

        return newItem;
      });

      return item;
    }),

  // Update item
  update: organizationProcedure
    .input(itemUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for role permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators and managers can update items',
        });
      }

      const { id, ...data } = input;

      // Get current item for audit
      const currentItem = await ctx.prisma.item.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!currentItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      // Check for SKU uniqueness if updating SKU
      if (data.sku && data.sku !== currentItem.sku) {
        const existingItem = await ctx.prisma.item.findFirst({
          where: { 
            sku: data.sku,
            organizationId: ctx.user.organizationId,
          },
        });

        if (existingItem) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'An item with this SKU already exists',
          });
        }
      }

      // Update item with audit log
      const updatedItem = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.item.update({
          where: { id },
          data,
          include: {
            category: true,
            unitOfMeasure: true,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'items',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            beforeData: currentItem,
            afterData: updated,
          },
        });

        // Update price history if price changed
        if (data.defaultPrice && data.defaultPrice !== Number(currentItem.defaultPrice)) {
          // End current price
          await tx.priceHistory.updateMany({
            where: {
              itemId: id,
              priceType: 'RETAIL',
              endDate: null,
            },
            data: {
              endDate: new Date(),
            },
          });

          // Create new price
          await tx.priceHistory.create({
            data: {
              itemId: id,
              priceType: 'RETAIL',
              price: data.defaultPrice,
              startDate: new Date(),
              organizationId: ctx.user.organizationId!,
            },
          });
        }

        return updated;
      });

      return updatedItem;
    }),

  // Soft delete item
  delete: organizationProcedure
    .input(z.object({ 
      id: z.string().cuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check for role permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can delete items',
        });
      }

      // Check if item has active inventory
      const activeInventory = await ctx.prisma.inventory.findFirst({
        where: {
          itemId: input.id,
          qtyOnHand: { gt: 0 },
        },
      });

      if (activeInventory) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete item with active inventory',
        });
      }

      // Soft delete with audit log
      const deletedItem = await ctx.prisma.$transaction(async (tx) => {
        const item = await tx.item.update({
          where: { id: input.id },
          data: { isActive: false },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'items',
            recordPk: input.id,
            action: 'DELETE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            beforeData: { isActive: true },
            afterData: { isActive: false, reason: input.reason },
          },
        });

        return item;
      });

      return deletedItem;
    }),

  // Bulk import items
  bulkImport: organizationProcedure
    .input(bulkImportSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for role permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can bulk import items',
        });
      }

      const { items, validateOnly } = input;
      const errors: Array<{ row: number; errors: string[] }> = [];
      const validItems: typeof items = [];

      // Validate all items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemErrors: string[] = [];

        // Check for duplicate SKU
        const existingItem = await ctx.prisma.item.findFirst({
          where: { 
            sku: item.sku,
            organizationId: ctx.user.organizationId,
          },
        });

        if (existingItem) {
          itemErrors.push(`SKU ${item.sku} already exists`);
        }

        // Validate category exists
        const category = await ctx.prisma.itemCategory.findUnique({
          where: { id: item.categoryId },
        });

        if (!category) {
          itemErrors.push('Invalid category');
        }

        // Validate UOM exists
        const uom = await ctx.prisma.unitOfMeasure.findUnique({
          where: { id: item.uomId },
        });

        if (!uom) {
          itemErrors.push('Invalid unit of measure');
        }

        // Validate supplier if provided
        if (item.defaultSupplierId) {
          const supplier = await ctx.prisma.supplier.findUnique({
            where: { id: item.defaultSupplierId },
          });

          if (!supplier) {
            itemErrors.push('Invalid supplier');
          }
        }

        if (itemErrors.length > 0) {
          errors.push({ row: i + 1, errors: itemErrors });
        } else {
          validItems.push(item);
        }
      }

      // Return validation results if validateOnly
      if (validateOnly) {
        return {
          valid: errors.length === 0,
          errors,
          validCount: validItems.length,
          totalCount: items.length,
        };
      }

      // If errors found, don't proceed
      if (errors.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Validation failed for ${errors.length} items`,
          cause: errors,
        });
      }

      // Import valid items
      const createdItems = await ctx.prisma.$transaction(async (tx) => {
        const created = [];

        for (const item of validItems) {
          const newItem = await tx.item.create({
            data: {
              ...item,
              organizationId: ctx.user.organizationId,
            },
          });

          // Create initial price history if default price is set
          if (item.defaultPrice) {
            await tx.priceHistory.create({
              data: {
                itemId: newItem.id,
                priceType: 'RETAIL',
                price: item.defaultPrice,
                startDate: new Date(),
              },
            });
          }

          created.push(newItem);
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'items',
            recordPk: 'BULK_IMPORT',
            action: 'CREATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            afterData: { count: created.length },
          },
        });

        return created;
      });

      return {
        success: true,
        imported: createdItems.length,
        items: createdItems,
      };
    }),

  // Get item history
  getHistory: organizationProcedure
    .input(z.object({ 
      itemId: z.string().cuid(),
      days: z.number().int().min(1).max(365).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const [movements, adjustments, priceChanges, auditLogs] = await Promise.all([
        // Stock movements
        ctx.prisma.stockMovement.findMany({
          where: {
            itemId: input.itemId,
            movedAt: { gte: since },
          },
          include: {
            movedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            fromLocation: {
              include: { warehouse: true },
            },
            toLocation: {
              include: { warehouse: true },
            },
          },
          orderBy: { movedAt: 'desc' },
        }),

        // Stock adjustments
        ctx.prisma.stockAdjustment.findMany({
          where: {
            itemId: input.itemId,
            adjustedAt: { gte: since },
          },
          include: {
            adjustedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            location: {
              include: { warehouse: true },
            },
          },
          orderBy: { adjustedAt: 'desc' },
        }),

        // Price changes
        ctx.prisma.priceHistory.findMany({
          where: {
            itemId: input.itemId,
            startDate: { gte: since },
          },
          orderBy: { startDate: 'desc' },
        }),

        // Audit logs
        ctx.prisma.auditLog.findMany({
          where: {
            tableName: 'items',
            recordPk: input.itemId,
            eventTime: { gte: since },
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { eventTime: 'desc' },
        }),
      ]);

      return {
        movements,
        adjustments,
        priceChanges,
        auditLogs,
      };
    }),

  // Duplicate item
  duplicate: organizationProcedure
    .input(z.object({
      itemId: z.string().cuid(),
      newSku: z.string().min(1).max(50),
      newName: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check for role permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators and managers can duplicate items',
        });
      }

      // Get source item
      const sourceItem = await ctx.prisma.item.findFirst({
        where: { 
          id: input.itemId,
          organizationId: ctx.user.organizationId,
        },
        include: {
          images: true,
        },
      });

      if (!sourceItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source item not found',
        });
      }

      // Check for duplicate SKU
      const existingItem = await ctx.prisma.item.findFirst({
        where: { 
          sku: input.newSku,
          organizationId: ctx.user.organizationId,
        },
      });

      if (existingItem) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An item with this SKU already exists',
        });
      }

      // Create duplicate with audit log
      const duplicatedItem = await ctx.prisma.$transaction(async (tx) => {
        // Create new item
        const { id, sku, name, createdAt, updatedAt, images, ...itemData } = sourceItem;
        
        const newItem = await tx.item.create({
          data: {
            ...itemData,
            sku: input.newSku,
            name: input.newName,
            organizationId: ctx.user.organizationId,
          },
          include: {
            category: true,
            unitOfMeasure: true,
          },
        });

        // Copy images
        if (sourceItem.images.length > 0) {
          await tx.itemImage.createMany({
            data: sourceItem.images.map(img => ({
              itemId: newItem.id,
              url: img.url,
              altText: img.altText,
              isPrimary: img.isPrimary,
              organizationId: ctx.user.organizationId!,
            })),
          });
        }

        // Create initial price history if default price is set
        if (newItem.defaultPrice) {
          await tx.priceHistory.create({
            data: {
              itemId: newItem.id,
              priceType: 'RETAIL',
              price: newItem.defaultPrice,
              startDate: new Date(),
              organizationId: ctx.user.organizationId!,
            },
          });
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'items',
            recordPk: newItem.id,
            action: 'CREATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            afterData: {
              ...newItem,
              duplicatedFrom: input.itemId,
            },
          },
        });

        return newItem;
      });

      return duplicatedItem;
    }),

  // Archive items
  archive: organizationProcedure
    .input(z.object({
      itemIds: z.array(z.string().cuid()),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check for role permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can archive items',
        });
      }

      // Check if any items have active inventory
      const activeInventory = await ctx.prisma.inventory.findMany({
        where: {
          itemId: { in: input.itemIds },
          qtyOnHand: { gt: 0 },
        },
        select: {
          itemId: true,
          item: {
            select: { sku: true, name: true },
          },
        },
      });

      if (activeInventory.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot archive items with active inventory',
          cause: activeInventory.map(inv => ({
            sku: inv.item.sku,
            name: inv.item.name,
          })),
        });
      }

      // Archive items with audit log
      const archivedCount = await ctx.prisma.$transaction(async (tx) => {
        // Update items
        const result = await tx.item.updateMany({
          where: {
            organizationId: ctx.user.organizationId,
            id: { in: input.itemIds },
          },
          data: {
            isActive: false,
          },
        });

        // Create audit logs
        for (const itemId of input.itemIds) {
          await tx.auditLog.create({
            data: {
              tableName: 'items',
              recordPk: itemId,
              action: 'UPDATE',
              userId: ctx.user.id,
              organizationId: ctx.user.organizationId!,
              beforeData: { isActive: true },
              afterData: { isActive: false, reason: input.reason },
            },
          });
        }

        return result.count;
      });

      return {
        success: true,
        archived: archivedCount,
      };
    }),
});