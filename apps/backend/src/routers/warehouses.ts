import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { organizationProcedure, createTRPCRouter } from '../trpc/trpc.js';
import type { Prisma } from '@ventry/database';

// Input validation schemas
const warehouseCreateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  phone: z.string().optional().nullable(),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const warehouseUpdateSchema = warehouseCreateSchema.partial().extend({
  id: z.string().cuid(),
});

const locationCreateSchema = z.object({
  warehouseId: z.string().cuid(),
  code: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  aisle: z.string().optional().nullable(),
  shelf: z.string().optional().nullable(),
  bin: z.string().optional().nullable(),
  maxCapacity: z.number().int().min(0).optional().nullable(),
  isTempControlled: z.boolean().default(false),
});

const locationUpdateSchema = locationCreateSchema.partial().extend({
  id: z.string().cuid(),
});

export const warehousesRouter = createTRPCRouter({
  // List warehouses
  list: organizationProcedure
    .input(z.object({
      includeInactive: z.boolean().default(false),
      includeStats: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.WarehouseWhereInput = {
        organizationId: ctx.user.organizationId,
      };

      const warehouses = await ctx.prisma.warehouse.findMany({
        where,
        include: {
          _count: {
            select: {
              locations: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Get stats if requested
      if (input.includeStats) {
        const warehouseIds = warehouses.map(w => w.id);
        
        const stats = await ctx.prisma.location.groupBy({
          by: ['warehouseId'],
          where: { warehouseId: { in: warehouseIds } },
          _count: true,
          _sum: {
            maxCapacity: true,
          },
        });

        const inventoryStats = await ctx.prisma.inventory.groupBy({
          by: ['locationId'],
          _sum: {
            qtyOnHand: true,
            qtyReserved: true,
          },
        });

        // Get additional stats for each warehouse
        const warehousesWithStats = await Promise.all(warehouses.map(async (warehouse) => {
          const stat = stats.find(s => s.warehouseId === warehouse.id);
          
          // Get locations with inventory count
          const locations = await ctx.prisma.location.findMany({
            where: { warehouseId: warehouse.id },
            include: {
              _count: {
                select: {
                  inventory: true,
                },
              },
            },
          });
          
          const occupiedLocations = locations.filter(l => l._count.inventory > 0).length;
          
          // Get inventory totals
          const inventoryTotals = await ctx.prisma.inventory.aggregate({
            where: {
              location: {
                warehouseId: warehouse.id,
              },
            },
            _sum: {
              qtyOnHand: true,
              qtyReserved: true,
            },
            _count: {
              itemId: true,
            },
          });
          
          return {
            ...warehouse,
            stats: {
              locationCount: stat?._count || 0,
              totalCapacity: stat?._sum.maxCapacity || 0,
              occupiedLocations,
              inventoryCount: inventoryTotals._count.itemId || 0,
              totalStock: inventoryTotals._sum.qtyOnHand || 0,
              reservedStock: inventoryTotals._sum.qtyReserved || 0,
              utilizationRate: locations.length > 0 
                ? Math.round((occupiedLocations / locations.length) * 100)
                : 0,
            },
          };
        }));

        return warehousesWithStats;
      }

      return warehouses;
    }),

  // Get single warehouse with locations
  get: organizationProcedure
    .input(z.object({ 
      id: z.string().cuid(),
      includeLocations: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const warehouse = await ctx.prisma.warehouse.findFirst({
        where: { 
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          locations: input.includeLocations ? {
            include: {
              _count: {
                select: {
                  inventory: true,
                },
              },
            },
            orderBy: [
              { zone: 'asc' },
              { aisle: 'asc' },
              { shelf: 'asc' },
              { bin: 'asc' },
            ],
          } : false,
        },
      });

      if (!warehouse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      // Calculate warehouse statistics
      if (input.includeLocations && warehouse.locations) {
        const totalCapacity = warehouse.locations.reduce(
          (sum, loc) => sum + (loc.maxCapacity || 0), 
          0
        );

        const occupiedLocations = warehouse.locations.filter(
          (loc: any) => loc._count.inventory > 0
        ).length;

        const inventoryCount = await ctx.prisma.inventory.count({
          where: {
            location: {
              warehouseId: warehouse.id,
            },
          },
        });

        const totalStock = await ctx.prisma.inventory.aggregate({
          where: {
            location: {
              warehouseId: warehouse.id,
            },
          },
          _sum: {
            qtyOnHand: true,
            qtyReserved: true,
          },
        });

        return {
          ...warehouse,
          stats: {
            totalCapacity,
            locationCount: warehouse.locations.length,
            occupiedLocations,
            inventoryCount,
            totalStock: totalStock._sum.qtyOnHand || 0,
            reservedStock: totalStock._sum.qtyReserved || 0,
            utilizationRate: totalCapacity > 0 
              ? Math.round((occupiedLocations / warehouse.locations.length) * 100)
              : 0,
          },
        };
      }

      return warehouse;
    }),

  // Create warehouse
  create: organizationProcedure
    .input(warehouseCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for role permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can create warehouses',
        });
      }

      // Check for duplicate code
      const existing = await ctx.prisma.warehouse.findFirst({
        where: { 
          code: input.code,
          organizationId: ctx.user.organizationId,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A warehouse with this code already exists',
        });
      }

      // Create warehouse with audit log
      const warehouse = await ctx.prisma.$transaction(async (tx) => {
        const newWarehouse = await tx.warehouse.create({
          data: {
            ...input,
            organizationId: ctx.user.organizationId,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'warehouses',
            recordPk: newWarehouse.id,
            action: 'CREATE',
            userId: ctx.user.id,
            afterData: newWarehouse,
          },
        });

        return newWarehouse;
      });

      return warehouse;
    }),

  // Update warehouse
  update: organizationProcedure
    .input(warehouseUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for role permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can update warehouses',
        });
      }

      const { id, ...data } = input;

      // Get current warehouse for audit
      const currentWarehouse = await ctx.prisma.warehouse.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!currentWarehouse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      // Check for code uniqueness if updating code
      if (data.code && data.code !== currentWarehouse.code) {
        const existing = await ctx.prisma.warehouse.findFirst({
          where: { 
            code: data.code,
            organizationId: ctx.user.organizationId,
          },
        });

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A warehouse with this code already exists',
          });
        }
      }

      // Update warehouse with audit log
      const updatedWarehouse = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.warehouse.update({
          where: { id },
          data,
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'warehouses',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: currentWarehouse,
            afterData: updated,
          },
        });

        return updated;
      });

      return updatedWarehouse;
    }),

  // Delete warehouse (only if empty)
  delete: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check for role permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can delete warehouses',
        });
      }

      // Check if warehouse has locations
      const locationCount = await ctx.prisma.location.count({
        where: { warehouseId: input.id },
      });

      if (locationCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot delete warehouse with ${locationCount} locations`,
        });
      }

      // Delete warehouse with audit log
      const deletedWarehouse = await ctx.prisma.$transaction(async (tx) => {
        const warehouse = await tx.warehouse.delete({
          where: { id: input.id },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'warehouses',
            recordPk: input.id,
            action: 'DELETE',
            userId: ctx.user.id,
            beforeData: warehouse,
          },
        });

        return warehouse;
      });

      return deletedWarehouse;
    }),

  // Get warehouse activity
  getActivity: organizationProcedure
    .input(z.object({
      warehouseId: z.string().cuid(),
      days: z.number().int().min(1).max(90).default(7),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      // Get recent movements
      const movements = await ctx.prisma.stockMovement.findMany({
        where: {
          OR: [
            {
              fromLocation: {
                warehouseId: input.warehouseId,
              },
            },
            {
              toLocation: {
                warehouseId: input.warehouseId,
              },
            },
          ],
          movedAt: { gte: since },
        },
        include: {
          item: {
            select: {
              sku: true,
              name: true,
            },
          },
          movedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          fromLocation: {
            select: {
              code: true,
              warehouse: {
                select: { code: true, name: true },
              },
            },
          },
          toLocation: {
            select: {
              code: true,
              warehouse: {
                select: { code: true, name: true },
              },
            },
          },
        },
        orderBy: { movedAt: 'desc' },
        take: input.limit,
      });

      // Get recent receipts
      const receipts = await ctx.prisma.receipt.findMany({
        where: {
          items: {
            some: {
              location: {
                warehouseId: input.warehouseId,
              },
            },
          },
          receivedDate: { gte: since },
        },
        include: {
          receivedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          purchaseOrder: {
            select: {
              poNumber: true,
              supplier: {
                select: {
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: { receivedDate: 'desc' },
        take: Math.floor(input.limit / 2),
      });

      // Get recent shipments
      const shipments = await ctx.prisma.shipment.findMany({
        where: {
          shippedFromLocationId: {
            in: await ctx.prisma.location.findMany({
              where: { warehouseId: input.warehouseId },
              select: { id: true },
            }).then(locs => locs.map(l => l.id)),
          },
          shipDate: { gte: since },
        },
        include: {
          order: {
            select: {
              orderNumber: true,
              customer: {
                select: {
                  companyName: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          carrier: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: { shipDate: 'desc' },
        take: Math.floor(input.limit / 2),
      });

      return {
        movements,
        receipts,
        shipments,
        summary: {
          totalMovements: movements.length,
          totalReceipts: receipts.length,
          totalShipments: shipments.length,
        },
      };
    }),

  // Get warehouse statistics
  getStats: organizationProcedure
    .input(z.object({ warehouseId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      // Verify warehouse exists
      const warehouse = await ctx.prisma.warehouse.findUnique({
        where: { id: input.warehouseId },
      });

      if (!warehouse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      // Get location statistics
      const locations = await ctx.prisma.location.findMany({
        where: { warehouseId: input.warehouseId },
        include: {
          _count: {
            select: {
              inventory: true,
            },
          },
        },
      });

      const totalLocations = locations.length;
      const occupiedLocations = locations.filter(l => l._count.inventory > 0).length;
      const emptyLocations = totalLocations - occupiedLocations;
      const tempControlledLocations = locations.filter(l => l.isTempControlled).length;

      // Get inventory statistics
      const inventory = await ctx.prisma.inventory.aggregate({
        where: {
          location: {
            warehouseId: input.warehouseId,
          },
        },
        _sum: {
          qtyOnHand: true,
          qtyReserved: true,
          qtyInTransit: true,
        },
        _count: true,
      });

      // Get item variety
      const uniqueItems = await ctx.prisma.inventory.groupBy({
        by: ['itemId'],
        where: {
          location: {
            warehouseId: input.warehouseId,
          },
          qtyOnHand: { gt: 0 },
        },
        _count: true,
      });

      // Get value statistics
      const inventoryValue = await ctx.prisma.$queryRaw<Array<{ totalValue: number }>>`
        SELECT SUM(i."qty_on_hand" * item."default_cost") as "totalValue"
        FROM inventory i
        JOIN items item ON i."item_id" = item.id
        JOIN locations l ON i."location_id" = l.id
        WHERE l."warehouse_id" = ${input.warehouseId}
          AND item."default_cost" IS NOT NULL
      `;

      // Get movement statistics for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const movements = await ctx.prisma.stockMovement.groupBy({
        by: ['movementType'],
        where: {
          OR: [
            {
              fromLocation: {
                warehouseId: input.warehouseId,
              },
            },
            {
              toLocation: {
                warehouseId: input.warehouseId,
              },
            },
          ],
          movedAt: { gte: thirtyDaysAgo },
        },
        _count: true,
        _sum: {
          qty: true,
        },
      });

      return {
        locations: {
          total: totalLocations,
          occupied: occupiedLocations,
          empty: emptyLocations,
          tempControlled: tempControlledLocations,
          utilizationRate: totalLocations > 0 
            ? Math.round((occupiedLocations / totalLocations) * 100)
            : 0,
        },
        inventory: {
          totalItems: uniqueItems.length,
          totalQuantity: inventory._sum.qtyOnHand || 0,
          reservedQuantity: inventory._sum.qtyReserved || 0,
          inTransitQuantity: inventory._sum.qtyInTransit || 0,
          availableQuantity: (inventory._sum.qtyOnHand || 0) - (inventory._sum.qtyReserved || 0),
          totalValue: inventoryValue[0]?.totalValue || 0,
        },
        movements: {
          last30Days: movements.map(m => ({
            type: m.movementType,
            count: m._count,
            quantity: m._sum.qty || 0,
          })),
        },
        capacity: {
          totalCapacity: locations.reduce((sum, loc) => sum + (loc.maxCapacity || 0), 0),
          usedCapacity: inventory._sum.qtyOnHand || 0,
          capacityUtilization: 0, // Calculate based on volume if needed
        },
      };
    }),

  // Locations sub-router
  locations: createTRPCRouter({
    // List locations for a warehouse
    list: organizationProcedure
      .input(z.object({
        warehouseId: z.string().cuid(),
        zone: z.string().optional(),
        onlyEmpty: z.boolean().default(false),
        onlyOccupied: z.boolean().default(false),
        tempControlled: z.boolean().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const where: Prisma.LocationWhereInput = {
          warehouseId: input.warehouseId,
        };

        if (input.zone) {
          where.zone = input.zone;
        }

        if (input.tempControlled !== undefined) {
          where.isTempControlled = input.tempControlled;
        }

        const locations = await ctx.prisma.location.findMany({
          where,
          include: {
            inventory: {
              include: {
                item: {
                  select: {
                    sku: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { zone: 'asc' },
            { aisle: 'asc' },
            { shelf: 'asc' },
            { bin: 'asc' },
          ],
        });

        // Filter by occupancy if requested
        let filteredLocations = locations;
        
        if (input.onlyEmpty) {
          filteredLocations = locations.filter(loc => loc.inventory.length === 0);
        } else if (input.onlyOccupied) {
          filteredLocations = locations.filter(loc => loc.inventory.length > 0);
        }

        return filteredLocations.map(location => ({
          ...location,
          isOccupied: location.inventory.length > 0,
          occupancy: location.inventory.reduce((sum, inv) => sum + inv.qtyOnHand, 0),
          utilization: location.maxCapacity 
            ? Math.round((location.inventory.reduce((sum, inv) => sum + inv.qtyOnHand, 0) / location.maxCapacity) * 100)
            : 0,
        }));
      }),

    // Get single location
    get: organizationProcedure
      .input(z.object({ id: z.string().cuid() }))
      .query(async ({ ctx, input }) => {
        const location = await ctx.prisma.location.findUnique({
          where: { id: input.id },
          include: {
            warehouse: true,
            inventory: {
              include: {
                item: true,
                lot: true,
                serialNumber: true,
              },
            },
          },
        });

        if (!location) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Location not found',
          });
        }

        return location;
      }),

    // Create location
    create: organizationProcedure
      .input(locationCreateSchema)
      .mutation(async ({ ctx, input }) => {
        // Check for role permissions
        if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only administrators and managers can create locations',
          });
        }

        // Check for duplicate code
        const existing = await ctx.prisma.location.findUnique({
          where: { code: input.code },
        });

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A location with this code already exists',
          });
        }

        // Create location with audit log
        const location = await ctx.prisma.$transaction(async (tx) => {
          const newLocation = await tx.location.create({
            data: input,
          });

          // Create audit log
          await tx.auditLog.create({
            data: {
              tableName: 'locations',
              recordPk: newLocation.id,
              action: 'CREATE',
              userId: ctx.user.id,
              afterData: newLocation,
            },
          });

          return newLocation;
        });

        return location;
      }),

    // Update location
    update: organizationProcedure
      .input(locationUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        // Check for role permissions
        if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only administrators and managers can update locations',
          });
        }

        const { id, ...data } = input;

        // Get current location for audit
        const currentLocation = await ctx.prisma.location.findUnique({
          where: { id },
        });

        if (!currentLocation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Location not found',
          });
        }

        // Check for code uniqueness if updating code
        if (data.code && data.code !== currentLocation.code) {
          const existing = await ctx.prisma.location.findUnique({
            where: { code: data.code },
          });

          if (existing) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'A location with this code already exists',
            });
          }
        }

        // Update location with audit log
        const updatedLocation = await ctx.prisma.$transaction(async (tx) => {
          const updated = await tx.location.update({
            where: { id },
            data,
          });

          // Create audit log
          await tx.auditLog.create({
            data: {
              tableName: 'locations',
              recordPk: id,
              action: 'UPDATE',
              userId: ctx.user.id,
              beforeData: currentLocation,
              afterData: updated,
            },
          });

          return updated;
        });

        return updatedLocation;
      }),

    // Delete location (only if empty)
    delete: organizationProcedure
      .input(z.object({ id: z.string().cuid() }))
      .mutation(async ({ ctx, input }) => {
        // Check for role permissions
        if (ctx.user.role !== 'ADMIN') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only administrators can delete locations',
          });
        }

        // Check if location has inventory
        const inventoryCount = await ctx.prisma.inventory.count({
          where: { 
            locationId: input.id,
            qtyOnHand: { gt: 0 },
          },
        });

        if (inventoryCount > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Cannot delete location with inventory',
          });
        }

        // Delete location with audit log
        const deletedLocation = await ctx.prisma.$transaction(async (tx) => {
          const location = await tx.location.delete({
            where: { id: input.id },
          });

          // Create audit log
          await tx.auditLog.create({
            data: {
              tableName: 'locations',
              recordPk: input.id,
              action: 'DELETE',
              userId: ctx.user.id,
              beforeData: location,
            },
          });

          return location;
        });

        return deletedLocation;
      }),

    // Get location inventory
    getInventory: organizationProcedure
      .input(z.object({ locationId: z.string().cuid() }))
      .query(async ({ ctx, input }) => {
        const inventory = await ctx.prisma.inventory.findMany({
          where: { locationId: input.locationId },
          include: {
            item: {
              include: {
                category: true,
                unitOfMeasure: true,
              },
            },
            lot: true,
            serialNumber: true,
          },
          orderBy: [
            { item: { name: 'asc' } },
          ],
        });

        const summary = {
          totalItems: inventory.length,
          totalQuantity: inventory.reduce((sum, inv) => sum + inv.qtyOnHand, 0),
          totalReserved: inventory.reduce((sum, inv) => sum + inv.qtyReserved, 0),
          totalAvailable: inventory.reduce((sum, inv) => sum + (inv.qtyOnHand - inv.qtyReserved), 0),
        };

        return {
          inventory,
          summary,
        };
      }),

    // Optimize location suggestions
    optimize: organizationProcedure
      .input(z.object({ warehouseId: z.string().cuid() }))
      .query(async ({ ctx, input }) => {
        // This would implement location optimization logic
        // For now, return basic suggestions

        const suggestions = [];

        // Find underutilized locations
        const underutilized = await ctx.prisma.location.findMany({
          where: {
            warehouseId: input.warehouseId,
            maxCapacity: { gt: 0 },
          },
          include: {
            inventory: true,
          },
        });

        for (const location of underutilized) {
          const used = location.inventory.reduce((sum, inv) => sum + inv.qtyOnHand, 0);
          const utilization = location.maxCapacity ? (used / location.maxCapacity) * 100 : 0;
          
          if (utilization < 20 && location.inventory.length > 0) {
            suggestions.push({
              type: 'CONSOLIDATE',
              locationId: location.id,
              locationCode: location.code,
              reason: `Location is only ${utilization.toFixed(1)}% utilized`,
              priority: 'MEDIUM',
            });
          }
        }

        // Find items split across multiple locations
        const splitItems = await ctx.prisma.inventory.groupBy({
          by: ['itemId'],
          where: {
            location: {
              warehouseId: input.warehouseId,
            },
          },
          having: {
            itemId: {
              _count: {
                gt: 3,
              },
            },
          },
        });

        return {
          suggestions,
          summary: {
            total: suggestions.length,
            byType: {
              CONSOLIDATE: suggestions.filter(s => s.type === 'CONSOLIDATE').length,
              RELOCATE: suggestions.filter(s => s.type === 'RELOCATE').length,
            },
          },
        };
      }),
  }),
});