import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

import type { Prisma } from '@ventry/database';

// Input validation schemas
const inventoryFilterSchema = z.object({
  search: z.string().optional(),
  warehouseId: z.string().cuid().optional(),
  locationId: z.string().cuid().optional(),
  itemId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  lotId: z.string().cuid().optional(),
  lowStock: z.boolean().optional(),
  expiringSoon: z.boolean().optional(),
  daysUntilExpiration: z.number().int().min(1).default(30),
  includeZeroQuantity: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['item', 'location', 'quantity', 'lastCounted']).default('location'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

const inventoryAdjustmentSchema = z.object({
  inventoryId: z.string().cuid(),
  adjustmentType: z.enum(['COUNT', 'DAMAGE', 'LOSS', 'FOUND', 'CORRECTION']),
  qty: z.number().int(), // Can be positive or negative
  reason: z.string().min(1),
  notes: z.string().optional(),
});

const inventoryTransferSchema = z.object({
  itemId: z.string().cuid(),
  fromLocationId: z.string().cuid(),
  toLocationId: z.string().cuid(),
  qty: z.number().int().min(1),
  lotId: z.string().cuid().optional(),
  serialNumbers: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const inventoryReservationSchema = z.object({
  inventoryId: z.string().cuid(),
  qty: z.number().int().min(1),
  orderId: z.string().cuid().optional(),
  notes: z.string().optional(),
});

const cycleCountSchema = z.object({
  warehouseId: z.string().cuid(),
  locationIds: z.array(z.string().cuid()).optional(),
  itemIds: z.array(z.string().cuid()).optional(),
  scheduledDate: z.date(),
  notes: z.string().optional(),
});

export const inventoryRouter = createTRPCRouter({
  // List inventory with advanced filtering
  list: organizationProcedure
    .input(inventoryFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        search,
        warehouseId,
        locationId,
        itemId,
        categoryId,
        lotId,
        lowStock,
        expiringSoon,
        daysUntilExpiration,
        includeZeroQuantity,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: Prisma.InventoryWhereInput = {};
      const itemWhere: Prisma.ItemWhereInput = {
        organizationId: ctx.user.organizationId,
      };

      // Search filter
      if (search) {
        itemWhere.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { upc: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Location filters
      if (locationId) {
        where.locationId = locationId;
      } else if (warehouseId) {
        where.location = {
          warehouseId,
        };
      }

      // Item filters
      if (itemId) {
        where.itemId = itemId;
      } else if (categoryId) {
        itemWhere.categoryId = categoryId;
      }

      // Apply item where conditions
      where.item = itemWhere;

      // Lot filter
      if (lotId) {
        where.lotId = lotId;
      }

      // Quantity filters
      if (!includeZeroQuantity) {
        where.qtyOnHand = { gt: 0 };
      }

      // Low stock filter
      if (lowStock) {
        // We'll filter low stock items in post-processing since we can't compare fields directly in Prisma
      }

      // Expiring soon filter
      if (expiringSoon) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration);
        
        where.lot = {
          expirationDate: {
            not: null,
            lte: expirationDate,
          },
        };
      }

      // Execute queries
      const [inventory, total] = await Promise.all([
        ctx.prisma.inventory.findMany({
          where,
          include: {
            item: {
              include: {
                category: true,
                unitOfMeasure: true,
              },
            },
            location: {
              include: {
                warehouse: true,
              },
            },
            lot: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: sortBy === 'item' 
            ? { item: { name: sortOrder } }
            : sortBy === 'location'
            ? { location: { code: sortOrder } }
            : sortBy === 'quantity'
            ? { qtyOnHand: sortOrder }
            : { lastCountedAt: sortOrder },
        }),
        ctx.prisma.inventory.count({ where }),
      ]);

      // Calculate available quantities and filter if needed
      let inventoryWithAvailable = inventory.map(inv => ({
        ...inv,
        qtyAvailable: inv.qtyOnHand - inv.qtyReserved,
        lowStock: inv.item.reorderPoint ? inv.qtyOnHand <= inv.item.reorderPoint : false,
        expiring: inv.lot?.expirationDate ? 
          inv.lot.expirationDate <= new Date(Date.now() + daysUntilExpiration * 24 * 60 * 60 * 1000) : 
          false,
      }));

      // Apply low stock filter if requested
      if (lowStock) {
        inventoryWithAvailable = inventoryWithAvailable.filter(inv => inv.lowStock);
      }

      return {
        inventory: inventoryWithAvailable,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get inventory by location
  getByLocation: organizationProcedure
    .input(z.object({
      locationId: z.string().cuid(),
      includeZeroQuantity: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.InventoryWhereInput = {
        locationId: input.locationId,
        item: {
          organizationId: ctx.user.organizationId,
        },
      };

      if (!input.includeZeroQuantity) {
        where.qtyOnHand = { gt: 0 };
      }

      const inventory = await ctx.prisma.inventory.findMany({
        where,
        include: {
          item: {
            include: {
              category: true,
              unitOfMeasure: true,
              images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
          lot: true,
          location: {
            include: {
              warehouse: true,
            },
          },
        },
        orderBy: [
          { item: { category: { name: 'asc' } } },
          { item: { name: 'asc' } },
        ],
      });

      // Group by category for easier viewing
      const groupedByCategory = inventory.reduce((acc, inv) => {
        const categoryName = inv.item.category.name;
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push({
          ...inv,
          qtyAvailable: inv.qtyOnHand - inv.qtyReserved,
        });
        return acc;
      }, {} as Record<string, Array<typeof inventory[0] & { qtyAvailable: number }>>);

      const summary = {
        totalItems: inventory.length,
        totalQuantity: inventory.reduce((sum, inv) => sum + inv.qtyOnHand, 0),
        totalReserved: inventory.reduce((sum, inv) => sum + inv.qtyReserved, 0),
        totalValue: inventory.reduce((sum, inv) => 
          sum + (inv.qtyOnHand * Number(inv.item.defaultCost || 0)), 0
        ),
      };

      return {
        inventory,
        groupedByCategory,
        summary,
      };
    }),

  // Get inventory by item
  getByItem: organizationProcedure
    .input(z.object({
      itemId: z.string().cuid(),
      warehouseId: z.string().cuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.InventoryWhereInput = {
        itemId: input.itemId,
        qtyOnHand: { gt: 0 },
        item: {
          organizationId: ctx.user.organizationId,
        },
      };

      if (input.warehouseId) {
        where.location = {
          warehouseId: input.warehouseId,
        };
      }

      const inventory = await ctx.prisma.inventory.findMany({
        where,
        include: {
          location: {
            include: {
              warehouse: true,
            },
          },
          lot: true,
        },
        orderBy: [
          { location: { warehouse: { name: 'asc' } } },
          { location: { code: 'asc' } },
        ],
      });

      // Group by warehouse
      const groupedByWarehouse = inventory.reduce((acc, inv) => {
        const warehouseName = inv.location.warehouse.name;
        if (!acc[warehouseName]) {
          acc[warehouseName] = {
            warehouseId: inv.location.warehouseId,
            warehouseName,
            locations: [],
            totalQuantity: 0,
            totalAvailable: 0,
          };
        }
        
        acc[warehouseName].locations.push({
          ...inv,
          qtyAvailable: inv.qtyOnHand - inv.qtyReserved,
        });
        acc[warehouseName].totalQuantity += inv.qtyOnHand;
        acc[warehouseName].totalAvailable += inv.qtyOnHand - inv.qtyReserved;
        
        return acc;
      }, {} as Record<string, any>);

      const summary = {
        totalLocations: inventory.length,
        totalQuantity: inventory.reduce((sum, inv) => sum + inv.qtyOnHand, 0),
        totalReserved: inventory.reduce((sum, inv) => sum + inv.qtyReserved, 0),
        totalAvailable: inventory.reduce((sum, inv) => sum + (inv.qtyOnHand - inv.qtyReserved), 0),
      };

      return {
        inventory,
        groupedByWarehouse: Object.values(groupedByWarehouse),
        summary,
      };
    }),

  // Get low stock items
  getLowStock: organizationProcedure
    .input(z.object({
      warehouseId: z.string().cuid().optional(),
      includeBelowZero: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      // First, get all items with reorder points
      const itemsWithReorderPoints = await ctx.prisma.item.findMany({
        where: {
          reorderPoint: { gt: 0 },
          isActive: true,
        },
        include: {
          category: true,
          unitOfMeasure: true,
          defaultSupplier: true,
        },
      });

      const lowStockItems = [];

      for (const item of itemsWithReorderPoints) {
        // Get total inventory for this item
        const inventoryWhere: Prisma.InventoryWhereInput = {
          itemId: item.id,
        };

        if (input.warehouseId) {
          inventoryWhere.location = {
            warehouseId: input.warehouseId,
          };
        }

        const inventory = await ctx.prisma.inventory.aggregate({
          where: inventoryWhere,
          _sum: {
            qtyOnHand: true,
            qtyReserved: true,
            qtyInTransit: true,
          },
        });

        const totalOnHand = inventory._sum.qtyOnHand || 0;
        const totalReserved = inventory._sum.qtyReserved || 0;
        const totalInTransit = inventory._sum.qtyInTransit || 0;
        const totalAvailable = totalOnHand - totalReserved;

        // Check if low stock
        if (totalAvailable <= item.reorderPoint) {
          // Get location details
          const locations = await ctx.prisma.inventory.findMany({
            where: inventoryWhere,
            include: {
              location: {
                include: {
                  warehouse: true,
                },
              },
            },
            orderBy: { qtyOnHand: 'desc' },
          });

          lowStockItems.push({
            item,
            stock: {
              onHand: totalOnHand,
              reserved: totalReserved,
              available: totalAvailable,
              inTransit: totalInTransit,
              reorderPoint: item.reorderPoint,
              reorderQty: item.reorderQty,
              shortfall: Math.max(0, item.reorderPoint - totalAvailable),
            },
            locations,
            suggestedOrderQty: Math.max(
              item.reorderQty,
              item.reorderPoint - totalAvailable + item.reorderQty
            ),
          });
        }
      }

      // Sort by urgency (highest shortfall percentage first)
      lowStockItems.sort((a, b) => {
        const aUrgency = a.stock.shortfall / (a.item.reorderPoint || 1);
        const bUrgency = b.stock.shortfall / (b.item.reorderPoint || 1);
        return bUrgency - aUrgency;
      });

      return {
        items: lowStockItems,
        summary: {
          total: lowStockItems.length,
          critical: lowStockItems.filter(i => i.stock.available <= 0).length,
          belowReorderPoint: lowStockItems.filter(i => i.stock.available > 0).length,
          totalShortfall: lowStockItems.reduce((sum, i) => sum + i.stock.shortfall, 0),
        },
      };
    }),

  // Get expiring items
  getExpiring: organizationProcedure
    .input(z.object({
      warehouseId: z.string().cuid().optional(),
      daysAhead: z.number().int().min(1).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + input.daysAhead);

      const where: Prisma.InventoryWhereInput = {
        qtyOnHand: { gt: 0 },
        lot: {
          expirationDate: {
            not: null,
            lte: expirationDate,
          },
        },
      };

      if (input.warehouseId) {
        where.location = {
          warehouseId: input.warehouseId,
        };
      }

      const inventory = await ctx.prisma.inventory.findMany({
        where,
        include: {
          item: {
            include: {
              category: true,
              unitOfMeasure: true,
            },
          },
          location: {
            include: {
              warehouse: true,
            },
          },
          lot: true,
        },
        orderBy: [
          { lot: { expirationDate: 'asc' } },
          { qtyOnHand: 'desc' },
        ],
      });

      // Group by expiration urgency
      const today = new Date();
      type InventoryWithValue = typeof inventory[0] & { daysUntilExpiration: number; value: number };
      
      const grouped = {
        expired: [] as InventoryWithValue[],
        expiringThisWeek: [] as InventoryWithValue[],
        expiringThisMonth: [] as InventoryWithValue[],
        expiringLater: [] as InventoryWithValue[],
      };

      for (const inv of inventory) {
        if (!inv.lot?.expirationDate) continue;

        const daysUntilExpiration = Math.floor(
          (inv.lot.expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        const record = {
          ...inv,
          daysUntilExpiration,
          value: inv.qtyOnHand * Number(inv.item.defaultCost || 0),
        };

        if (daysUntilExpiration < 0) {
          grouped.expired.push(record);
        } else if (daysUntilExpiration <= 7) {
          grouped.expiringThisWeek.push(record);
        } else if (daysUntilExpiration <= 30) {
          grouped.expiringThisMonth.push(record);
        } else {
          grouped.expiringLater.push(record);
        }
      }

      const summary = {
        expired: {
          count: grouped.expired.length,
          quantity: grouped.expired.reduce((sum, inv) => sum + inv.qtyOnHand, 0),
          value: grouped.expired.reduce((sum, inv) => sum + inv.value, 0),
        },
        expiringThisWeek: {
          count: grouped.expiringThisWeek.length,
          quantity: grouped.expiringThisWeek.reduce((sum, inv) => sum + inv.qtyOnHand, 0),
          value: grouped.expiringThisWeek.reduce((sum, inv) => sum + inv.value, 0),
        },
        expiringThisMonth: {
          count: grouped.expiringThisMonth.length,
          quantity: grouped.expiringThisMonth.reduce((sum, inv) => sum + inv.qtyOnHand, 0),
          value: grouped.expiringThisMonth.reduce((sum, inv) => sum + inv.value, 0),
        },
      };

      return {
        inventory,
        grouped,
        summary,
      };
    }),

  // Adjust inventory
  adjust: organizationProcedure
    .input(inventoryAdjustmentSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions based on adjustment type
      const allowedRoles = ['COUNT', 'CORRECTION'].includes(input.adjustmentType)
        ? ['ADMIN', 'MANAGER', 'WAREHOUSE']
        : ['ADMIN', 'MANAGER'];

      if (!allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to make this type of adjustment',
        });
      }

      // Get current inventory
      const inventory = await ctx.prisma.inventory.findUnique({
        where: { id: input.inventoryId },
        include: {
          item: true,
          location: true,
        },
      });

      if (!inventory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inventory record not found',
        });
      }

      // Calculate new quantity
      const oldQty = inventory.qtyOnHand;
      const newQty = input.adjustmentType === 'COUNT' 
        ? input.qty // Absolute count
        : oldQty + input.qty; // Relative adjustment

      if (newQty < 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Adjustment would result in negative inventory',
        });
      }

      if (newQty < inventory.qtyReserved) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Adjustment would result in quantity less than reserved amount',
        });
      }

      // Perform adjustment with audit trail
      const adjustment = await ctx.prisma.$transaction(async (tx) => {
        // Update inventory
        const updatedInventory = await tx.inventory.update({
          where: { id: input.inventoryId },
          data: {
            qtyOnHand: newQty,
            lastCountedAt: input.adjustmentType === 'COUNT' ? new Date() : undefined,
          },
        });

        // Create stock adjustment record
        const stockAdjustment = await tx.stockAdjustment.create({
          data: {
            itemId: inventory.itemId,
            locationId: inventory.locationId,
            lotId: inventory.lotId,
            qtyBefore: oldQty,
            qtyAfter: newQty,
            reason: `${input.adjustmentType}: ${input.reason}`,
            notes: input.notes,
            adjustedById: ctx.user.id,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'inventory',
            recordPk: input.inventoryId,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: { qtyOnHand: oldQty },
            afterData: { 
              qtyOnHand: newQty,
              adjustmentType: input.adjustmentType,
              reason: input.reason,
            },
          },
        });

        return stockAdjustment;
      });

      return {
        success: true,
        adjustment,
        inventory: {
          ...inventory,
          qtyOnHand: newQty,
        },
      };
    }),

  // Reserve inventory
  reserve: organizationProcedure
    .input(inventoryReservationSchema)
    .mutation(async ({ ctx, input }) => {
      // Get current inventory
      const inventory = await ctx.prisma.inventory.findUnique({
        where: { id: input.inventoryId },
        include: {
          item: true,
          location: true,
        },
      });

      if (!inventory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inventory record not found',
        });
      }

      const availableQty = inventory.qtyOnHand - inventory.qtyReserved;
      if (input.qty > availableQty) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Only ${availableQty} units available for reservation`,
        });
      }

      // Update reservation
      const updatedInventory = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.inventory.update({
          where: { id: input.inventoryId },
          data: {
            qtyReserved: inventory.qtyReserved + input.qty,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'inventory',
            recordPk: input.inventoryId,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: { qtyReserved: inventory.qtyReserved },
            afterData: { 
              qtyReserved: updated.qtyReserved,
              orderId: input.orderId,
              notes: input.notes,
            },
          },
        });

        return updated;
      });

      return {
        success: true,
        inventory: updatedInventory,
        reserved: input.qty,
        totalReserved: updatedInventory.qtyReserved,
        available: updatedInventory.qtyOnHand - updatedInventory.qtyReserved,
      };
    }),

  // Release reservation
  release: organizationProcedure
    .input(z.object({
      inventoryId: z.string().cuid(),
      qty: z.number().int().min(1),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get current inventory
      const inventory = await ctx.prisma.inventory.findUnique({
        where: { id: input.inventoryId },
      });

      if (!inventory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inventory record not found',
        });
      }

      if (input.qty > inventory.qtyReserved) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Only ${inventory.qtyReserved} units are reserved`,
        });
      }

      // Release reservation
      const updatedInventory = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.inventory.update({
          where: { id: input.inventoryId },
          data: {
            qtyReserved: inventory.qtyReserved - input.qty,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'inventory',
            recordPk: input.inventoryId,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: { qtyReserved: inventory.qtyReserved },
            afterData: { 
              qtyReserved: updated.qtyReserved,
              reason: input.reason,
            },
          },
        });

        return updated;
      });

      return {
        success: true,
        inventory: updatedInventory,
        released: input.qty,
        totalReserved: updatedInventory.qtyReserved,
        available: updatedInventory.qtyOnHand - updatedInventory.qtyReserved,
      };
    }),

  // Transfer inventory between locations
  transfer: organizationProcedure
    .input(inventoryTransferSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to transfer inventory',
        });
      }

      // Validate locations are different
      if (input.fromLocationId === input.toLocationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Source and destination locations must be different',
        });
      }

      // Get source inventory
      const sourceWhere: Prisma.InventoryWhereInput = {
        itemId: input.itemId,
        locationId: input.fromLocationId,
      };

      if (input.lotId) {
        sourceWhere.lotId = input.lotId;
      }

      const sourceInventory = await ctx.prisma.inventory.findFirst({
        where: sourceWhere,
        include: {
          item: true,
          lot: true,
          location: {
            include: { warehouse: true },
          },
        },
      });

      if (!sourceInventory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source inventory not found',
        });
      }

      const availableQty = sourceInventory.qtyOnHand - sourceInventory.qtyReserved;
      if (input.qty > availableQty) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Only ${availableQty} units available for transfer`,
        });
      }

      // Get destination location
      const destLocation = await ctx.prisma.location.findUnique({
        where: { id: input.toLocationId },
        include: { warehouse: true },
      });

      if (!destLocation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Destination location not found',
        });
      }

      // Perform transfer
      const transfer = await ctx.prisma.$transaction(async (tx) => {
        // Update source inventory
        await tx.inventory.update({
          where: { id: sourceInventory.id },
          data: {
            qtyOnHand: sourceInventory.qtyOnHand - input.qty,
          },
        });

        // Find or create destination inventory
        const destInventory = await tx.inventory.findFirst({
          where: {
            itemId: input.itemId,
            locationId: input.toLocationId,
            lotId: input.lotId || sourceInventory.lotId,
          },
        });

        if (destInventory) {
          // Update existing inventory
          await tx.inventory.update({
            where: { id: destInventory.id },
            data: {
              qtyOnHand: destInventory.qtyOnHand + input.qty,
            },
          });
        } else {
          // Create new inventory record
          await tx.inventory.create({
            data: {
              itemId: input.itemId,
              locationId: input.toLocationId,
              lotId: input.lotId || sourceInventory.lotId,
              qtyOnHand: input.qty,
              qtyReserved: 0,
              qtyInTransit: 0,
            },
          });
        }

        // Create stock movement record
        const movement = await tx.stockMovement.create({
          data: {
            itemId: input.itemId,
            lotId: input.lotId || sourceInventory.lotId,
            fromLocationId: input.fromLocationId,
            toLocationId: input.toLocationId,
            qty: input.qty,
            movementType: 'TRANSFER',
            movedById: ctx.user.id,
            movedAt: new Date(),
            notes: input.notes,
          },
        });

        // Handle serial numbers if provided
        if (input.serialNumbers && input.serialNumbers.length > 0) {
          await tx.serialNumber.updateMany({
            where: {
              serialNumber: { in: input.serialNumbers },
              itemId: input.itemId,
              locationId: input.fromLocationId,
            },
            data: {
              locationId: input.toLocationId,
            },
          });
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'stock_movements',
            recordPk: movement.id,
            action: 'CREATE',
            userId: ctx.user.id,
            afterData: {
              type: 'TRANSFER',
              itemId: input.itemId,
              qty: input.qty,
              from: `${sourceInventory.location.warehouse.code}-${sourceInventory.location.code}`,
              to: `${destLocation.warehouse.code}-${destLocation.code}`,
            },
          },
        });

        return movement;
      });

      return {
        success: true,
        movementId: transfer.id,
        transferred: input.qty,
        from: {
          warehouse: sourceInventory.location.warehouse.name,
          location: sourceInventory.location.code,
        },
        to: {
          warehouse: destLocation.warehouse.name,
          location: destLocation.code,
        },
      };
    }),

  // Create cycle count
  createCycleCount: organizationProcedure
    .input(cycleCountSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to create cycle counts',
        });
      }

      // Create cycle count
      const cycleCount = await ctx.prisma.$transaction(async (tx) => {
        // For now, create cycle count for the first location in the warehouse
        const location = await tx.location.findFirst({
          where: { warehouseId: input.warehouseId },
        });

        if (!location) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No locations found in warehouse',
          });
        }

        // Create cycle count record
        const count = await tx.cycleCount.create({
          data: {
            locationId: location.id,
            countDate: input.scheduledDate,
            countedById: ctx.user.id,
            status: 'PENDING',
            notes: input.notes,
          },
        });

        // Determine what to count
        let inventoryToCount;
        
        if (input.locationIds) {
          // Count specific locations
          inventoryToCount = await tx.inventory.findMany({
            where: {
              locationId: { in: input.locationIds },
              qtyOnHand: { gt: 0 },
            },
            select: { id: true, itemId: true, locationId: true, lotId: true, qtyOnHand: true },
          });
        } else if (input.itemIds) {
          // Count specific items
          inventoryToCount = await tx.inventory.findMany({
            where: {
              itemId: { in: input.itemIds },
              location: { warehouseId: input.warehouseId },
              qtyOnHand: { gt: 0 },
            },
            select: { id: true, itemId: true, locationId: true, lotId: true, qtyOnHand: true },
          });
        } else {
          // Full warehouse count
          inventoryToCount = await tx.inventory.findMany({
            where: {
              location: { warehouseId: input.warehouseId },
              qtyOnHand: { gt: 0 },
            },
            select: { id: true, itemId: true, locationId: true, lotId: true, qtyOnHand: true },
          });
        }

        // Create cycle count items
        for (const inv of inventoryToCount) {
          await tx.cycleCountItem.create({
            data: {
              countId: count.id,
              itemId: inv.itemId,
              lotId: inv.lotId,
              qtyCounted: 0,
              qtySystem: inv.qtyOnHand,
              variance: 0,
            },
          });
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'cycle_counts',
            recordPk: count.id,
            action: 'CREATE',
            userId: ctx.user.id,
            afterData: {
              warehouseId: input.warehouseId,
              itemCount: inventoryToCount.length,
              type: input.locationIds ? 'LOCATION' : input.itemIds ? 'ITEM' : 'FULL',
            },
          },
        });

        return {
          count,
          itemCount: inventoryToCount.length,
        };
      });

      return {
        success: true,
        cycleCount: cycleCount.count,
        itemsToCount: cycleCount.itemCount,
      };
    }),

  // Get inventory value report
  getValueReport: organizationProcedure
    .input(z.object({
      warehouseId: z.string().cuid().optional(),
      categoryId: z.string().cuid().optional(),
      groupBy: z.enum(['category', 'warehouse', 'item']).default('category'),
    }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.InventoryWhereInput = {
        qtyOnHand: { gt: 0 },
      };

      if (input.warehouseId) {
        where.location = {
          warehouseId: input.warehouseId,
        };
      }

      if (input.categoryId) {
        where.item = {
          categoryId: input.categoryId,
        };
      }

      const inventory = await ctx.prisma.inventory.findMany({
        where,
        include: {
          item: {
            include: {
              category: true,
              unitOfMeasure: true,
            },
          },
          location: {
            include: {
              warehouse: true,
            },
          },
          lot: true,
        },
      });

      // Calculate values
      const inventoryWithValue = inventory.map(inv => ({
        ...inv,
        unitCost: Number(inv.lot?.unitCost || inv.item.defaultCost || 0),
        totalValue: inv.qtyOnHand * Number(inv.lot?.unitCost || inv.item.defaultCost || 0),
        reservedValue: inv.qtyReserved * Number(inv.lot?.unitCost || inv.item.defaultCost || 0),
        availableValue: (inv.qtyOnHand - inv.qtyReserved) * Number(inv.lot?.unitCost || inv.item.defaultCost || 0),
      }));

      // Group based on input
      let grouped: Record<string, any> = {};

      if (input.groupBy === 'category') {
        grouped = inventoryWithValue.reduce((acc, inv) => {
          const key = inv.item.category.name;
          if (!acc[key]) {
            acc[key] = {
              categoryId: inv.item.categoryId,
              categoryName: key,
              itemCount: new Set(),
              totalQuantity: 0,
              totalValue: 0,
              reservedValue: 0,
              availableValue: 0,
            };
          }
          
          acc[key].itemCount.add(inv.itemId);
          acc[key].totalQuantity += inv.qtyOnHand;
          acc[key].totalValue += inv.totalValue;
          acc[key].reservedValue += inv.reservedValue;
          acc[key].availableValue += inv.availableValue;
          
          return acc;
        }, {} as Record<string, any>);

        // Convert Set to count
        Object.values(grouped).forEach((g: any) => {
          g.itemCount = g.itemCount.size;
        });

      } else if (input.groupBy === 'warehouse') {
        grouped = inventoryWithValue.reduce((acc, inv) => {
          const key = inv.location.warehouse.name;
          if (!acc[key]) {
            acc[key] = {
              warehouseId: inv.location.warehouseId,
              warehouseName: key,
              locationCount: new Set(),
              itemCount: new Set(),
              totalQuantity: 0,
              totalValue: 0,
              reservedValue: 0,
              availableValue: 0,
            };
          }
          
          acc[key].locationCount.add(inv.locationId);
          acc[key].itemCount.add(inv.itemId);
          acc[key].totalQuantity += inv.qtyOnHand;
          acc[key].totalValue += inv.totalValue;
          acc[key].reservedValue += inv.reservedValue;
          acc[key].availableValue += inv.availableValue;
          
          return acc;
        }, {} as Record<string, any>);

        // Convert Sets to counts
        Object.values(grouped).forEach((g: any) => {
          g.locationCount = g.locationCount.size;
          g.itemCount = g.itemCount.size;
        });

      } else {
        // Group by item
        grouped = inventoryWithValue.reduce((acc, inv) => {
          const key = inv.item.sku;
          if (!acc[key]) {
            acc[key] = {
              itemId: inv.itemId,
              sku: inv.item.sku,
              name: inv.item.name,
              category: inv.item.category.name,
              locationCount: new Set(),
              totalQuantity: 0,
              totalReserved: 0,
              totalAvailable: 0,
              avgCost: 0,
              totalValue: 0,
              reservedValue: 0,
              availableValue: 0,
              locations: [],
            };
          }
          
          acc[key].locationCount.add(inv.locationId);
          acc[key].totalQuantity += inv.qtyOnHand;
          acc[key].totalReserved += inv.qtyReserved;
          acc[key].totalAvailable += inv.qtyOnHand - inv.qtyReserved;
          acc[key].totalValue += inv.totalValue;
          acc[key].reservedValue += inv.reservedValue;
          acc[key].availableValue += inv.availableValue;
          acc[key].locations.push({
            warehouse: inv.location.warehouse.name,
            location: inv.location.code,
            quantity: inv.qtyOnHand,
            value: inv.totalValue,
          });
          
          return acc;
        }, {} as Record<string, any>);

        // Calculate average costs and convert Sets
        Object.values(grouped).forEach((g: any) => {
          g.locationCount = g.locationCount.size;
          g.avgCost = g.totalQuantity > 0 ? g.totalValue / g.totalQuantity : 0;
        });
      }

      // Calculate summary
      const summary = {
        totalItems: new Set(inventory.map(i => i.itemId)).size,
        totalLocations: new Set(inventory.map(i => i.locationId)).size,
        totalQuantity: inventory.reduce((sum, inv) => sum + inv.qtyOnHand, 0),
        totalReserved: inventory.reduce((sum, inv) => sum + inv.qtyReserved, 0),
        totalValue: inventoryWithValue.reduce((sum, inv) => sum + inv.totalValue, 0),
        reservedValue: inventoryWithValue.reduce((sum, inv) => sum + inv.reservedValue, 0),
        availableValue: inventoryWithValue.reduce((sum, inv) => sum + inv.availableValue, 0),
      };

      return {
        grouped: Object.values(grouped),
        summary,
        generatedAt: new Date(),
      };
    }),
});