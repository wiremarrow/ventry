import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

import type { Prisma } from '@ventry/database';

// Input validation schemas
const movementFilterSchema = z.object({
  itemId: z.string().cuid().optional(),
  warehouseId: z.string().cuid().optional(),
  locationId: z.string().cuid().optional(),
  movementType: z.enum(['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT', 'RETURN']).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  userId: z.string().cuid().optional(),
  referenceType: z.enum(['PO', 'ORDER', 'TRANSFER', 'ADJUSTMENT', 'RETURN']).optional(),
  referenceId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['movedAt', 'item', 'qty', 'type']).default('movedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const createMovementSchema = z.object({
  itemId: z.string().cuid(),
  lotId: z.string().cuid().optional(),
  fromLocationId: z.string().cuid().optional(),
  toLocationId: z.string().cuid().optional(),
  qty: z.number().int().positive(),
  movementType: z.enum(['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT', 'RETURN']),
  referenceType: z.enum(['PO', 'ORDER', 'TRANSFER', 'ADJUSTMENT', 'RETURN']).optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
  serialNumbers: z.array(z.string()).optional(),
});

const batchMovementSchema = z.object({
  movements: z.array(createMovementSchema).min(1).max(100),
  validateOnly: z.boolean().default(false),
});

const movementSummarySchema = z.object({
  warehouseId: z.string().cuid().optional(),
  dateFrom: z.date(),
  dateTo: z.date(),
  groupBy: z.enum(['item', 'type', 'warehouse', 'date']).default('type'),
});

export const stockMovementsRouter = createTRPCRouter({
  // List movements with filtering
  list: organizationProcedure
    .input(movementFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        itemId,
        warehouseId,
        locationId,
        movementType,
        dateFrom,
        dateTo,
        userId,
        referenceType,
        referenceId,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: Prisma.StockMovementWhereInput = {
        item: { organizationId: ctx.user.organizationId },
      };

      // Item filter
      if (itemId) {
        where.itemId = itemId;
      }

      // Location filters
      if (locationId) {
        where.OR = [
          { fromLocationId: locationId },
          { toLocationId: locationId },
        ];
      } else if (warehouseId) {
        where.OR = [
          { fromLocation: { warehouseId } },
          { toLocation: { warehouseId } },
        ];
      }

      // Movement type filter
      if (movementType) {
        where.movementType = movementType;
      }

      // Date filters
      if (dateFrom || dateTo) {
        where.movedAt = {};
        if (dateFrom) where.movedAt.gte = dateFrom;
        if (dateTo) where.movedAt.lte = dateTo;
      }

      // User filter
      if (userId) {
        where.movedById = userId;
      }

      // Reference filters
      if (referenceType) {
        where.refType = referenceType;
      }
      if (referenceId) {
        where.refId = referenceId;
      }

      // Execute queries
      const [movements, total] = await Promise.all([
        ctx.prisma.stockMovement.findMany({
          where,
          include: {
            item: {
              include: {
                category: true,
                unitOfMeasure: true,
              },
            },
            lot: true,
            fromLocation: {
              include: {
                warehouse: true,
              },
            },
            toLocation: {
              include: {
                warehouse: true,
              },
            },
            movedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: sortBy === 'item'
            ? { item: { name: sortOrder } }
            : sortBy === 'qty'
            ? { qty: sortOrder }
            : sortBy === 'type'
            ? { movementType: sortOrder }
            : { movedAt: sortOrder },
        }),
        ctx.prisma.stockMovement.count({ where }),
      ]);

      return {
        movements,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get single movement details
  get: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const movement = await ctx.prisma.stockMovement.findFirst({
        where: { 
          id: input.id,
          item: { organizationId: ctx.user.organizationId },
        },
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
          lot: {
            include: {
              supplier: true,
            },
          },
          fromLocation: {
            include: {
              warehouse: true,
            },
          },
          toLocation: {
            include: {
              warehouse: true,
            },
          },
          movedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          serialNumber: true,
        },
      });

      if (!movement) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Stock movement not found',
        });
      }

      // Get related movements if part of a batch
      let relatedMovements: any[] = [];
      if (movement.refType && movement.refId) {
        relatedMovements = await ctx.prisma.stockMovement.findMany({
          where: {
            refType: movement.refType,
            refId: movement.refId,
            id: { not: movement.id },
          },
          include: {
            item: {
              select: {
                sku: true,
                name: true,
              },
            },
          },
          orderBy: { movedAt: 'desc' },
        });
      }

      return {
        ...movement,
        relatedMovements,
      };
    }),

  // Create stock movement
  create: organizationProcedure
    .input(createMovementSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate movement type requirements
      if (input.movementType === 'INBOUND' && !input.toLocationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Inbound movements require a destination location',
        });
      }

      if (input.movementType === 'OUTBOUND' && !input.fromLocationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Outbound movements require a source location',
        });
      }

      if (input.movementType === 'TRANSFER' && (!input.fromLocationId || !input.toLocationId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transfer movements require both source and destination locations',
        });
      }

      // Perform movement with inventory updates
      const movement = await ctx.prisma.$transaction(async (tx) => {
        // Handle source inventory for outbound/transfer
        if (input.fromLocationId) {
          const sourceInventory = await tx.inventory.findFirst({
            where: {
              itemId: input.itemId,
              locationId: input.fromLocationId,
              lotId: input.lotId,
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
              message: `Only ${availableQty} units available at source location`,
            });
          }

          // Update source inventory
          await tx.inventory.update({
            where: { id: sourceInventory.id },
            data: {
              qtyOnHand: sourceInventory.qtyOnHand - input.qty,
            },
          });
        }

        // Handle destination inventory for inbound/transfer
        if (input.toLocationId) {
          const destInventory = await tx.inventory.findFirst({
            where: {
              itemId: input.itemId,
              locationId: input.toLocationId,
              lotId: input.lotId,
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
                lotId: input.lotId,
                qtyOnHand: input.qty,
                qtyReserved: 0,
                qtyInTransit: 0,
                organizationId: ctx.user.organizationId!,
              },
            });
          }
        }

        // Create movement record
        const newMovement = await tx.stockMovement.create({
          data: {
            itemId: input.itemId,
            lotId: input.lotId,
            fromLocationId: input.fromLocationId,
            toLocationId: input.toLocationId,
            qty: input.qty,
            movementType: input.movementType,
            refType: input.referenceType,
            refId: input.referenceId,
            movedById: ctx.user.id,
            movedAt: new Date(),
            notes: input.notes,
            organizationId: ctx.user.organizationId!,
          },
          include: {
            item: true,
            fromLocation: true,
            toLocation: true,
          },
        });

        // Handle serial numbers if provided
        if (input.serialNumbers && input.serialNumbers.length > 0) {
          // Validate serial number count
          if (input.serialNumbers.length !== input.qty) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Serial number count (${input.serialNumbers.length}) must match quantity (${input.qty})`,
            });
          }

          // Update serial number locations
          if (input.fromLocationId && input.toLocationId) {
            await tx.serialNumber.updateMany({
              where: {
                serialNumber: { in: input.serialNumbers },
                itemId: input.itemId,
                locationId: input.fromLocationId,
                status: 'AVAILABLE',
              },
              data: {
                locationId: input.toLocationId,
              },
            });
          } else if (input.fromLocationId) {
            // Mark as sold/consumed for outbound
            await tx.serialNumber.updateMany({
              where: {
                serialNumber: { in: input.serialNumbers },
                itemId: input.itemId,
                locationId: input.fromLocationId,
              },
              data: {
                status: 'SOLD',
                // TODO: Track sold date separately
              },
            });
          }

          // Create movement-serial number relationships
          // TODO: Implement serial number tracking
          /* await tx.stockMovementSerialNumber.createMany({
            data: input.serialNumbers.map(sn => ({
              movementId: newMovement.id,
              serialNumberId: sn,
            })),
          }); */
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'stock_movements',
            recordPk: newMovement.id,
            action: 'CREATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            afterData: newMovement,
          },
        });

        return newMovement;
      });

      return movement;
    }),

  // Batch create movements
  batchCreate: organizationProcedure
    .input(batchMovementSchema)
    .mutation(async ({ ctx, input }) => {
      const { movements, validateOnly } = input;
      const errors: Array<{ index: number; errors: string[] }> = [];
      const validMovements: typeof movements = [];

      // Validate all movements
      for (let i = 0; i < movements.length; i++) {
        const movement = movements[i];
        const movementErrors: string[] = [];

        // Type-specific validation
        if (movement.movementType === 'INBOUND' && !movement.toLocationId) {
          movementErrors.push('Inbound movements require a destination location');
        }
        if (movement.movementType === 'OUTBOUND' && !movement.fromLocationId) {
          movementErrors.push('Outbound movements require a source location');
        }
        if (movement.movementType === 'TRANSFER' && (!movement.fromLocationId || !movement.toLocationId)) {
          movementErrors.push('Transfer movements require both source and destination locations');
        }

        // Check inventory availability for outbound/transfer
        if (movement.fromLocationId) {
          const inventory = await ctx.prisma.inventory.findFirst({
            where: {
              itemId: movement.itemId,
              locationId: movement.fromLocationId,
              lotId: movement.lotId,
            },
          });

          if (!inventory) {
            movementErrors.push('Source inventory not found');
          } else {
            const available = inventory.qtyOnHand - inventory.qtyReserved;
            if (movement.qty > available) {
              movementErrors.push(`Only ${available} units available (requested ${movement.qty})`);
            }
          }
        }

        if (movementErrors.length > 0) {
          errors.push({ index: i, errors: movementErrors });
        } else {
          validMovements.push(movement);
        }
      }

      // Return validation results if validateOnly
      if (validateOnly) {
        return {
          valid: errors.length === 0,
          errors,
          validCount: validMovements.length,
          totalCount: movements.length,
        };
      }

      // If errors found, don't proceed
      if (errors.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Validation failed for ${errors.length} movements`,
          cause: errors,
        });
      }

      // Process valid movements in a transaction
      const createdMovements = await ctx.prisma.$transaction(async (tx) => {
        const created = [];

        // Group movements by reference for efficiency
        const referenceId = `BATCH-${new Date().toISOString()}`;

        for (const movement of validMovements) {
          // Handle source inventory
          if (movement.fromLocationId) {
            const sourceInventory = await tx.inventory.findFirst({
              where: {
                itemId: movement.itemId,
                locationId: movement.fromLocationId,
                lotId: movement.lotId,
              },
            });

            if (sourceInventory) {
              await tx.inventory.update({
                where: { id: sourceInventory.id },
                data: {
                  qtyOnHand: sourceInventory.qtyOnHand - movement.qty,
                },
              });
            }
          }

          // Handle destination inventory
          if (movement.toLocationId) {
            const destInventory = await tx.inventory.findFirst({
              where: {
                itemId: movement.itemId,
                locationId: movement.toLocationId,
                lotId: movement.lotId,
              },
            });

            if (destInventory) {
              await tx.inventory.update({
                where: { id: destInventory.id },
                data: {
                  qtyOnHand: destInventory.qtyOnHand + movement.qty,
                },
              });
            } else {
              await tx.inventory.create({
                data: {
                  itemId: movement.itemId,
                  locationId: movement.toLocationId,
                  lotId: movement.lotId,
                  qtyOnHand: movement.qty,
                  qtyReserved: 0,
                  qtyInTransit: 0,
                },
              });
            }
          }

          // Create movement record
          const newMovement = await tx.stockMovement.create({
            data: {
              ...movement,
              movedById: ctx.user.id,
              movedAt: new Date(),
              refType: movement.referenceType || 'TRANSFER',
              refId: movement.referenceId || referenceId,
            },
          });

          created.push(newMovement);
        }

        // Create audit log for batch operation
        await tx.auditLog.create({
          data: {
            tableName: 'stock_movements',
            recordPk: created[0]?.refId || referenceId,
            action: 'CREATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            afterData: {
              type: 'BATCH_MOVEMENT',
              count: created.length,
              referenceId,
            },
          },
        });

        return created;
      });

      return {
        success: true,
        created: createdMovements.length,
        referenceId: createdMovements[0]?.refId,
        movements: createdMovements,
      };
    }),

  // Get movement history for an item
  getItemHistory: organizationProcedure
    .input(z.object({
      itemId: z.string().cuid(),
      locationId: z.string().cuid().optional(),
      days: z.number().int().min(1).max(365).default(30),
      includeRelated: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const where: Prisma.StockMovementWhereInput = {
        itemId: input.itemId,
        movedAt: { gte: since },
      };

      if (input.locationId) {
        where.OR = [
          { fromLocationId: input.locationId },
          { toLocationId: input.locationId },
        ];
      }

      const movements = await ctx.prisma.stockMovement.findMany({
        where,
        include: {
          lot: true,
          fromLocation: {
            include: { warehouse: true },
          },
          toLocation: {
            include: { warehouse: true },
          },
          movedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { movedAt: 'desc' },
      });

      // Calculate running balance
      let runningBalance = 0;
      const movementsWithBalance = movements.reverse().map(movement => {
        if (movement.toLocationId === input.locationId) {
          runningBalance += movement.qty;
        } else if (movement.fromLocationId === input.locationId) {
          runningBalance -= movement.qty;
        } else if (!input.locationId) {
          // For item-level history without location filter
          if (movement.movementType === 'INBOUND') {
            runningBalance += movement.qty;
          } else if (movement.movementType === 'OUTBOUND') {
            runningBalance -= movement.qty;
          }
        }

        return {
          ...movement,
          runningBalance,
        };
      }).reverse();

      // Get current inventory levels
      const currentInventory = await ctx.prisma.inventory.aggregate({
        where: {
          itemId: input.itemId,
          ...(input.locationId && { locationId: input.locationId }),
        },
        _sum: {
          qtyOnHand: true,
          qtyReserved: true,
          qtyInTransit: true,
        },
      });

      // Get movement statistics
      const stats = movements.reduce(
        (acc: any, movement) => {
          acc.totalMovements++;
          acc.totalQuantity += movement.qty;

          if (movement.movementType === 'INBOUND') {
            acc.inbound.count++;
            acc.inbound.quantity += movement.qty;
          } else if (movement.movementType === 'OUTBOUND') {
            acc.outbound.count++;
            acc.outbound.quantity += movement.qty;
          } else if (movement.movementType === 'TRANSFER') {
            acc.transfers.count++;
            acc.transfers.quantity += movement.qty;
          } else if (movement.movementType === 'ADJUSTMENT') {
            acc.adjustments.count++;
            acc.adjustments.quantity += movement.qty;
          }

          return acc;
        },
        {
          totalMovements: 0,
          totalQuantity: 0,
          inbound: { count: 0, quantity: 0 },
          outbound: { count: 0, quantity: 0 },
          transfers: { count: 0, quantity: 0 },
          adjustments: { count: 0, quantity: 0 },
        }
      );

      return {
        movements: movementsWithBalance,
        currentInventory: {
          onHand: currentInventory._sum.qtyOnHand || 0,
          reserved: currentInventory._sum.qtyReserved || 0,
          inTransit: currentInventory._sum.qtyInTransit || 0,
          available: (currentInventory._sum.qtyOnHand || 0) - (currentInventory._sum.qtyReserved || 0),
        },
        stats,
        period: {
          from: since,
          to: new Date(),
          days: input.days,
        },
      };
    }),

  // Get movement summary/analytics
  getSummary: organizationProcedure
    .input(movementSummarySchema)
    .query(async ({ ctx, input }) => {
      const { warehouseId, dateFrom, dateTo, groupBy } = input;

      const where: Prisma.StockMovementWhereInput = {
        item: { organizationId: ctx.user.organizationId },
        movedAt: {
          gte: dateFrom,
          lte: dateTo,
        },
      };

      if (warehouseId) {
        where.OR = [
          { fromLocation: { warehouseId } },
          { toLocation: { warehouseId } },
        ];
      }

      const movements = await ctx.prisma.stockMovement.findMany({
        where,
        include: {
          item: {
            include: {
              category: true,
              unitOfMeasure: true,
            },
          },
          fromLocation: {
            include: { warehouse: true },
          },
          toLocation: {
            include: { warehouse: true },
          },
        },
      });

      // Group data based on input parameter
      let grouped: Record<string, any> = {};

      if (groupBy === 'type') {
        grouped = movements.reduce((acc: Record<string, any>, movement) => {
          const key = movement.movementType;
          if (!acc[key]) {
            acc[key] = {
              type: key,
              count: 0,
              quantity: 0,
              items: new Set(),
              value: 0,
            };
          }

          acc[key].count++;
          acc[key].quantity += movement.qty;
          acc[key].items.add(movement.itemId);
          acc[key].value += movement.qty * (Number(movement.item.defaultCost) || 0);

          return acc;
        }, {} as Record<string, any>);

        // Convert sets to counts
        Object.values(grouped).forEach((g: any) => {
          g.itemCount = g.items.size;
          delete g.items;
        });

      } else if (groupBy === 'item') {
        grouped = movements.reduce((acc: Record<string, any>, movement) => {
          const key = movement.item.sku;
          if (!acc[key]) {
            acc[key] = {
              itemId: movement.itemId,
              sku: movement.item.sku,
              name: movement.item.name,
              category: movement.item.category.name,
              movements: {
                inbound: { count: 0, quantity: 0 },
                outbound: { count: 0, quantity: 0 },
                transfer: { count: 0, quantity: 0 },
                adjustment: { count: 0, quantity: 0 },
              },
              totalQuantity: 0,
              netChange: 0,
            };
          }

          const type = movement.movementType.toLowerCase();
          if (acc[key].movements[type]) {
            acc[key].movements[type].count++;
            acc[key].movements[type].quantity += movement.qty;
          }

          acc[key].totalQuantity += movement.qty;

          // Calculate net change
          if (movement.movementType === 'INBOUND') {
            acc[key].netChange += movement.qty;
          } else if (movement.movementType === 'OUTBOUND') {
            acc[key].netChange -= movement.qty;
          } else if (movement.movementType === 'TRANSFER') {
            if (movement.toLocationId && (!warehouseId || movement.toLocation?.warehouseId === warehouseId)) {
              acc[key].netChange += movement.qty;
            }
            if (movement.fromLocationId && (!warehouseId || movement.fromLocation?.warehouseId === warehouseId)) {
              acc[key].netChange -= movement.qty;
            }
          }

          return acc;
        }, {} as Record<string, any>);

      } else if (groupBy === 'warehouse') {
        grouped = movements.reduce((acc: Record<string, any>, movement) => {
          // Handle source warehouse
          if (movement.fromLocation) {
            const key = movement.fromLocation.warehouse.name;
            if (!acc[key]) {
              acc[key] = {
                warehouseId: movement.fromLocation.warehouseId,
                warehouseName: key,
                inbound: { count: 0, quantity: 0 },
                outbound: { count: 0, quantity: 0 },
                netChange: 0,
              };
            }
            acc[key].outbound.count++;
            acc[key].outbound.quantity += movement.qty;
            acc[key].netChange -= movement.qty;
          }

          // Handle destination warehouse
          if (movement.toLocation) {
            const key = movement.toLocation.warehouse.name;
            if (!acc[key]) {
              acc[key] = {
                warehouseId: movement.toLocation.warehouseId,
                warehouseName: key,
                inbound: { count: 0, quantity: 0 },
                outbound: { count: 0, quantity: 0 },
                netChange: 0,
              };
            }
            acc[key].inbound.count++;
            acc[key].inbound.quantity += movement.qty;
            acc[key].netChange += movement.qty;
          }

          return acc;
        }, {} as Record<string, any>);

      } else {
        // Group by date
        grouped = movements.reduce((acc: Record<string, any>, movement) => {
          const key = movement.movedAt.toISOString().split('T')[0];
          if (!acc[key]) {
            acc[key] = {
              date: key,
              movements: {
                inbound: { count: 0, quantity: 0 },
                outbound: { count: 0, quantity: 0 },
                transfer: { count: 0, quantity: 0 },
                adjustment: { count: 0, quantity: 0 },
              },
              totalCount: 0,
              totalQuantity: 0,
              uniqueItems: new Set(),
            };
          }

          const type = movement.movementType.toLowerCase();
          if (acc[key].movements[type]) {
            acc[key].movements[type].count++;
            acc[key].movements[type].quantity += movement.qty;
          }

          acc[key].totalCount++;
          acc[key].totalQuantity += movement.qty;
          acc[key].uniqueItems.add(movement.itemId);

          return acc;
        }, {} as Record<string, any>);

        // Convert sets to counts
        Object.values(grouped).forEach((g: any) => {
          g.itemCount = g.uniqueItems.size;
          delete g.uniqueItems;
        });
      }

      // Calculate overall summary
      const summary = {
        totalMovements: movements.length,
        totalQuantity: movements.reduce((sum: number, m) => sum + m.qty, 0),
        totalValue: movements.reduce((sum: number, m) => sum + (m.qty * (Number(m.item.defaultCost) || 0)), 0),
        uniqueItems: new Set(movements.map(m => m.itemId)).size,
        period: {
          from: dateFrom,
          to: dateTo,
          days: Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)),
        },
      };

      return {
        grouped: Object.values(grouped),
        summary,
      };
    }),

  // Export movements data
  export: organizationProcedure
    .input(z.object({
      filters: movementFilterSchema,
      format: z.enum(['csv', 'excel']).default('csv'),
      columns: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get movements with filters
      const where = {
        ...input.filters,
        item: { organizationId: ctx.user.organizationId },
      } as Prisma.StockMovementWhereInput;
      
      const movements = await ctx.prisma.stockMovement.findMany({
        where,
        include: {
          item: {
            include: {
              category: true,
              unitOfMeasure: true,
            },
          },
          lot: true,
          fromLocation: {
            include: { warehouse: true },
          },
          toLocation: {
            include: { warehouse: true },
          },
          movedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { movedAt: 'desc' },
      });

      // Prepare data for export
      const exportData = movements.map(movement => ({
        id: movement.id,
        date: movement.movedAt.toISOString(),
        type: movement.movementType,
        itemSku: movement.item.sku,
        itemName: movement.item.name,
        category: movement.item.category.name,
        quantity: movement.qty,
        unit: movement.item.unitOfMeasure.code,
        lotNumber: movement.lot?.lotNumber || '',
        fromWarehouse: movement.fromLocation?.warehouse.name || '',
        fromLocation: movement.fromLocation?.code || '',
        toWarehouse: movement.toLocation?.warehouse.name || '',
        toLocation: movement.toLocation?.code || '',
        movedBy: `${movement.movedBy.firstName} ${movement.movedBy.lastName}`,
        referenceType: movement.refType || '',
        referenceId: movement.refId || '',
        notes: movement.notes || '',
      }));

      // Create audit log for export
      await ctx.prisma.auditLog.create({
        data: {
          tableName: 'stock_movements',
          recordPk: 'EXPORT',
          action: 'CREATE',
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          afterData: {
            format: input.format,
            recordCount: exportData.length,
            filters: input.filters,
          },
        },
      });

      return {
        data: exportData,
        count: exportData.length,
        format: input.format,
      };
    }),

  // Reverse a movement (create compensating movement)
  reverse: organizationProcedure
    .input(z.object({
      movementId: z.string().cuid(),
      reason: z.string().min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators and managers can reverse movements',
        });
      }

      // Get original movement
      const originalMovement = await ctx.prisma.stockMovement.findFirst({
        where: { 
          id: input.movementId,
          item: { organizationId: ctx.user.organizationId },
        },
        include: {
          item: true,
          lot: true,
          fromLocation: true,
          toLocation: true,
        },
      });

      if (!originalMovement) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Original movement not found',
        });
      }

      // Check if already reversed
      const existingReversal = await ctx.prisma.stockMovement.findFirst({
        where: {
          refType: 'ADJUSTMENT',
          refId: `REVERSAL-${originalMovement.id}`,
        },
      });

      if (existingReversal) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This movement has already been reversed',
        });
      }

      // Create compensating movement
      const reversal = await ctx.prisma.$transaction(async (tx) => {
        // Swap source and destination for reversal
        const reversalData = {
          itemId: originalMovement.itemId,
          lotId: originalMovement.lotId,
          fromLocationId: originalMovement.toLocationId,
          toLocationId: originalMovement.fromLocationId,
          qty: originalMovement.qty,
          movementType: 'ADJUSTMENT' as const,
          refType: 'ADJUSTMENT' as const,
          refId: `REVERSAL-${originalMovement.id}`,
          movedById: ctx.user.id,
          movedAt: new Date(),
          notes: `Reversal of movement ${originalMovement.id}. Reason: ${input.reason}. ${input.notes || ''}`,
        };

        // Validate inventory availability for reversal
        if (reversalData.fromLocationId) {
          const sourceInventory = await tx.inventory.findFirst({
            where: {
              itemId: reversalData.itemId,
              locationId: reversalData.fromLocationId,
              lotId: reversalData.lotId,
            },
          });

          if (!sourceInventory || sourceInventory.qtyOnHand < reversalData.qty) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'Insufficient inventory to reverse this movement',
            });
          }

          // Update source inventory
          await tx.inventory.update({
            where: { id: sourceInventory.id },
            data: {
              qtyOnHand: sourceInventory.qtyOnHand - reversalData.qty,
            },
          });
        }

        // Update destination inventory
        if (reversalData.toLocationId) {
          const destInventory = await tx.inventory.findFirst({
            where: {
              itemId: reversalData.itemId,
              locationId: reversalData.toLocationId,
              lotId: reversalData.lotId,
            },
          });

          if (destInventory) {
            await tx.inventory.update({
              where: { id: destInventory.id },
              data: {
                qtyOnHand: destInventory.qtyOnHand + reversalData.qty,
              },
            });
          } else {
            await tx.inventory.create({
              data: {
                itemId: reversalData.itemId,
                locationId: reversalData.toLocationId,
                lotId: reversalData.lotId,
                qtyOnHand: reversalData.qty,
                qtyReserved: 0,
                qtyInTransit: 0,
              },
            });
          }
        }

        // Create reversal movement
        const newMovement = await tx.stockMovement.create({
          data: reversalData,
        });

        // Create audit logs
        await tx.auditLog.createMany({
          data: [
            {
              tableName: 'stock_movements',
              recordPk: originalMovement.id,
              action: 'UPDATE',
              userId: ctx.user.id,
              organizationId: ctx.user.organizationId!,
              beforeData: { reversed: false },
              afterData: { reversed: true, reversalId: newMovement.id },
            },
            {
              tableName: 'stock_movements',
              recordPk: newMovement.id,
              action: 'CREATE',
              userId: ctx.user.id,
              organizationId: ctx.user.organizationId!,
              afterData: {
                type: 'REVERSAL',
                originalMovementId: originalMovement.id,
                reason: input.reason,
              },
            },
          ],
        });

        return newMovement;
      });

      return {
        success: true,
        reversalMovement: reversal,
        originalMovement: originalMovement.id,
      };
    }),
});