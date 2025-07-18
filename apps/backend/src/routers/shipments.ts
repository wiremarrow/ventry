import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

import type { Prisma } from '@ventry/database';

// Input validation schemas
const shipmentCreateSchema = z.object({
  orderId: z.string().cuid(),
  locationId: z.string().cuid(), // shippedFromLocationId
  carrierId: z.string().cuid().optional(),
  carrierService: z.string().optional(),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    orderItemId: z.string().cuid(),
    itemId: z.string().cuid(),
    qtyShipped: z.number().int().positive(),
    lotId: z.string().cuid().optional(),
    serialId: z.string().cuid().optional(),
  })).min(1),
});

const shipmentUpdateSchema = z.object({
  id: z.string().cuid(),
  carrierId: z.string().cuid().optional(),
  carrierService: z.string().optional(),
  trackingNumber: z.string().optional(),
  expectedDelivery: z.date().optional(),
  shippingCost: z.number().positive().optional(),
  notes: z.string().optional(),
  shipDate: z.date().optional(),
  status: z.enum(['PENDING', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED']).optional(),
});

const shipmentFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['PENDING', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED']).optional(),
  warehouseId: z.string().cuid().optional(),
  carrierId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['shipmentNumber', 'createdAt', 'shipDate', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const shipmentsRouter = createTRPCRouter({
  // List shipments with filtering
  list: organizationProcedure
    .input(shipmentFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        search,
        status,
        warehouseId,
        carrierId,
        customerId,
        dateFrom,
        dateTo,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: Prisma.ShipmentWhereInput = {
        organizationId: ctx.user.organizationId,
      };

      // Search filter
      if (search) {
        where.OR = [
          { shipmentNumber: { contains: search, mode: 'insensitive' } },
          { trackingNumber: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      // Warehouse filter
      if (warehouseId) {
        where.shippedFromLocation = {
          warehouseId,
        };
      }

      // Carrier filter
      if (carrierId) {
        where.carrierId = carrierId;
      }

      // Customer filter
      if (customerId) {
        where.order = {
          customerId,
        };
      }

      // Date filters
      if (dateFrom || dateTo) {
        where.createdAt = {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        };
      }

      // Get total count
      const totalCount = await ctx.prisma.shipment.count({ where });

      // Get paginated results
      const shipments = await ctx.prisma.shipment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          items: {
            include: {
              item: true,
              orderItem: true,
            },
          },
          order: {
            include: {
              customer: true,
            },
          },
          carrier: true,
          shippedFromLocation: {
            include: {
              warehouse: true,
            },
          },
          shippedBy: true,
          _count: {
            select: {
              items: true,
            },
          },
        },
      });

      // Calculate summary stats
      const stats = await ctx.prisma.shipment.groupBy({
        by: ['status'],
        where,
        _count: true,
      });

      const statusCounts = stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>);

      // Get carrier performance
      const carrierStats = await ctx.prisma.shipment.groupBy({
        by: ['carrierId'],
        where: {
          ...where,
          status: 'DELIVERED',
        },
        _avg: {
          shippingCost: true,
        },
        _count: true,
      });

      return {
        shipments,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        stats: {
          total: totalCount,
          byStatus: statusCounts,
          pending: statusCounts['PENDING'] || 0,
          shipped: statusCounts['SHIPPED'] || 0,
          delivered: statusCounts['DELIVERED'] || 0,
          carrierPerformance: carrierStats.map(cs => ({
            carrierId: cs.carrierId,
            shipmentCount: cs._count,
            avgCost: Number(cs._avg.shippingCost || 0),
          })),
        },
      };
    }),

  // Get shipment details
  get: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const shipment = await ctx.prisma.shipment.findFirst({
        where: { 
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          items: {
            include: {
              item: {
                include: {
                  category: true,
                },
              },
              orderItem: true,
              lot: true,
              serialNumber: true,
            },
          },
          order: {
            include: {
              customer: true,
              items: true,
            },
          },
          carrier: true,
          shippedFromLocation: {
            include: {
              warehouse: true,
            },
          },
          shippedBy: true,
        },
      });

      if (!shipment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shipment not found',
        });
      }

      return shipment;
    }),

  // Create a new shipment
  create: organizationProcedure
    .input(shipmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { orderId, locationId, carrierId, carrierService, trackingNumber, notes, items } = input;

      // Validate location exists
      const location = await ctx.prisma.location.findFirst({
        where: { 
          id: locationId,
          warehouse: {
            organizationId: ctx.user.organizationId,
          },
        },
      });

      if (!location) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Location not found',
        });
      }

      // Validate order
      const order = await ctx.prisma.order.findFirst({
        where: { 
          id: orderId,
          organizationId: ctx.user.organizationId,
        },
        include: {
          items: true,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      if (!['CONFIRMED', 'PICKING', 'PACKED'].includes(order.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Order must be confirmed and allocated before shipping',
        });
      }

      // Validate order items
      for (const item of items) {
        if (item.orderItemId) {
          const orderItem = order.items.find(oi => oi.id === item.orderItemId);
          if (!orderItem) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Order item ${item.orderItemId} not found`,
            });
          }

          // Check if we've already shipped this order item
          const alreadyShipped = orderItem.qtyShipped;
          const availableToShip = orderItem.qtyOrdered - alreadyShipped;

          if (item.qtyShipped > availableToShip) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Quantity ${item.qtyShipped} exceeds available to ship (${availableToShip}) for item ${item.itemId}`,
            });
          }
        }
      }

      // Validate inventory availability
      for (const item of items) {
        const inventory = await ctx.prisma.inventory.findFirst({
          where: {
            itemId: item.itemId,
            locationId,
            ...(item.lotId && { lotId: item.lotId }),
          },
        });

        if (!inventory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Inventory not found for item ${item.itemId} at location`,
          });
        }

        const available = inventory.qtyOnHand - inventory.qtyReserved;
        if (available < item.qtyShipped) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient inventory for item ${item.itemId}. Available: ${available}, Requested: ${item.qtyShipped}`,
          });
        }
      }

      // Generate shipment number
      const shipmentCount = await ctx.prisma.shipment.count({
        where: {
          organizationId: ctx.user.organizationId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), 0, 1),
          },
        },
      });

      const shipmentNumber = `SHP-${new Date().getFullYear()}-${String(shipmentCount + 1).padStart(5, '0')}`;

      // Create shipment in transaction
      const newShipment = await ctx.prisma.$transaction(async (tx) => {
        // Create shipment
        const shipment = await tx.shipment.create({
          data: {
            organizationId: ctx.user.organizationId,
            shipmentNumber,
            orderId,
            status: 'PENDING',
            carrierId,
            carrierService,
            trackingNumber,
            shippedFromLocationId: locationId,
            shippedById: ctx.user.id,
            notes,
            items: {
              create: items.map((item) => ({
                orderItemId: item.orderItemId,
                itemId: item.itemId,
                qtyShipped: item.qtyShipped,
                lotId: item.lotId,
                serialId: item.serialId,
              })),
            },
          },
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        // Reserve inventory
        for (const item of items) {
          await tx.inventory.updateMany({
            where: {
              itemId: item.itemId,
              locationId,
              ...(item.lotId && { lotId: item.lotId }),
            },
            data: {
              qtyReserved: {
                increment: item.qtyShipped,
              },
            },
          });
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'shipments',
            recordPk: shipment.id,
            action: 'CREATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            afterData: shipment,
          },
        });

        return shipment;
      });

      return newShipment;
    }),

  // Update shipment
  update: organizationProcedure
    .input(shipmentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Check if shipment exists
      const existingShipment = await ctx.prisma.shipment.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!existingShipment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shipment not found',
        });
      }

      // Check if shipment can be updated
      if (['DELIVERED', 'CANCELLED'].includes(existingShipment.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot update delivered or cancelled shipment',
        });
      }

      // Update shipment
      const updatedShipment = await ctx.prisma.$transaction(async (tx) => {
        const shipment = await tx.shipment.update({
          where: { id },
          data: updateData,
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'shipments',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            beforeData: existingShipment,
            afterData: shipment,
          },
        });

        return shipment;
      });

      return updatedShipment;
    }),

  // Ship shipment (update status and reduce inventory)
  ship: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      trackingNumber: z.string().optional(),
      shippingCost: z.number().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, trackingNumber, shippingCost } = input;

      // Get shipment details
      const shipment = await ctx.prisma.shipment.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          items: true,
          order: true,
        },
      });

      if (!shipment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shipment not found',
        });
      }

      if (!['PENDING', 'PACKED'].includes(shipment.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Shipment must be pending or packed to ship',
        });
      }

      // Ship items in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Update inventory - move from reserved to shipped
        for (const item of shipment.items) {
          await tx.inventory.updateMany({
            where: {
              itemId: item.itemId,
              locationId: shipment.shippedFromLocationId,
              ...(item.lotId && { lotId: item.lotId }),
            },
            data: {
              qtyReserved: {
                decrement: item.qtyShipped,
              },
              qtyOnHand: {
                decrement: item.qtyShipped,
              },
            },
          });

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              movementType: 'OUTBOUND',  // Using OUTBOUND for shipments
              itemId: item.itemId,
              qty: item.qtyShipped,
              fromLocationId: shipment.shippedFromLocationId,
              toLocationId: null,
              movedById: ctx.user.id,
              movedAt: new Date(),
              notes: `Shipped via shipment ${shipment.shipmentNumber}`,
              refType: 'SHIPMENT',
              refId: id,
            },
          });

          // Update order item shipped quantity
          if (item.orderItemId) {
            await tx.orderItem.update({
              where: { id: item.orderItemId },
              data: {
                qtyShipped: {
                  increment: item.qtyShipped,
                },
              },
            });
          }
        }

        // Update shipment
        const updatedShipment = await tx.shipment.update({
          where: { id },
          data: {
            status: 'SHIPPED',
            trackingNumber,
            shippingCost,
            shipDate: new Date(),
          },
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        // Update order status if all items shipped
        if (shipment.orderId) {
          const order = await tx.order.findUnique({
            where: { id: shipment.orderId },
            include: {
              items: true,
            },
          });

          if (order) {
            const allShipped = order.items.every(oi => oi.qtyShipped >= oi.qtyOrdered);
            if (allShipped) {
              await tx.order.update({
                where: { id: shipment.orderId },
                data: { status: 'SHIPPED' },
              });
            }
          }
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'shipments',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            beforeData: shipment,
            afterData: updatedShipment,
          },
        });

        return updatedShipment;
      });

      return result;
    }),

  // Cancel shipment
  cancel: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, reason } = input;

      // Get shipment details
      const shipment = await ctx.prisma.shipment.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          items: true,
        },
      });

      if (!shipment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shipment not found',
        });
      }

      if (['SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'].includes(shipment.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot cancel shipped or delivered shipments',
        });
      }

      // Cancel shipment in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Release reserved inventory
        for (const item of shipment.items) {
          await tx.inventory.updateMany({
            where: {
              itemId: item.itemId,
              locationId: shipment.shippedFromLocationId,
              ...(item.lotId && { lotId: item.lotId }),
            },
            data: {
              qtyReserved: {
                decrement: item.qtyShipped,
              },
            },
          });
        }

        // Update shipment
        const cancelledShipment = await tx.shipment.update({
          where: { id },
          data: {
            status: 'RETURNED',  // Using RETURNED for cancelled shipments
            notes: `${shipment.notes || ''}\nCancelled: ${reason}`.trim(),
          },
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'shipments',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            beforeData: shipment,
            afterData: cancelledShipment,
          },
        });

        return cancelledShipment;
      });

      return result;
    }),
});