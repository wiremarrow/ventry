import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

import type { Prisma } from '@ventry/database';

// Input validation schemas
const supplierCreateSchema = z.object({
  supplierCode: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(),
  currencyId: z.string().default('USD'),
  paymentTerms: z.string().optional().nullable(),
  leadTimeDays: z.number().int().min(0).default(0),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  taxId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const supplierUpdateSchema = supplierCreateSchema.partial().extend({
  id: z.string().cuid(),
});

const supplierFilterSchema = z.object({
  search: z.string().optional(),
  // isActive: z.boolean().optional(), // Field doesn't exist
  country: z.string().optional(),
  hasOpenOrders: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['code', 'name', 'createdAt', 'lastOrderDate']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

const supplierContactSchema = z.object({
  supplierId: z.string().cuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const supplierItemSchema = z.object({
  supplierId: z.string().cuid(),
  itemId: z.string().cuid(),
  supplierSku: z.string().optional().nullable(),
  supplierItemName: z.string().optional().nullable(),
  unitCost: z.number().min(0),
  moq: z.number().int().min(1).default(1),
  leadTimeDays: z.number().int().min(0).default(0),
  isPreferred: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

const performanceMetricsSchema = z.object({
  supplierId: z.string().cuid(),
  dateFrom: z.date(),
  dateTo: z.date(),
});

export const suppliersRouter = createTRPCRouter({
  // List suppliers with filtering
  list: organizationProcedure
    .input(supplierFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        search,
        // isActive,
        country,
        hasOpenOrders,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: Prisma.SupplierWhereInput = {
        organizationId: ctx.user.organizationId,
      };

      // Search filter
      if (search) {
        where.OR = [
          { supplierCode: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Active filter - field doesn't exist
      // TODO: Implement supplier active status

      // Country filter
      if (country) {
        where.country = country;
      }

      // Open orders filter
      if (hasOpenOrders) {
        where.purchaseOrders = {
          some: {
            status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
          },
        };
      }

      // Execute queries
      const [suppliers, total] = await Promise.all([
        ctx.prisma.supplier.findMany({
          where,
          include: {
            _count: {
              select: {
                contacts: true,
                // supplierItems: true, // Model doesn't exist
                purchaseOrders: true,
              },
            },
            purchaseOrders: {
              select: {
                id: true,
                orderDate: true,
                status: true,
              },
              orderBy: { orderDate: 'desc' },
              take: 1,
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: sortBy === 'lastOrderDate'
            ? { purchaseOrders: { _count: sortOrder } }
            : { [sortBy]: sortOrder },
        }),
        ctx.prisma.supplier.count({ where }),
      ]);

      // Calculate additional metrics
      const suppliersWithMetrics = await Promise.all(
        suppliers.map(async (supplier) => {
          // Get total order value for last 12 months
          const twelveMonthsAgo = new Date();
          twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

          const orderStats = await ctx.prisma.purchaseOrder.aggregate({
            where: {
              supplierId: supplier.id,
              orderDate: { gte: twelveMonthsAgo },
              status: { in: ['APPROVED', 'RECEIVED'] },
            },
            _sum: { total: true },
            _count: true,
          });

          return {
            ...supplier,
            lastOrderDate: supplier.purchaseOrders[0]?.orderDate || null,
            totalOrderValue12Months: orderStats._sum.total || 0,
            orderCount12Months: orderStats._count,
          };
        })
      );

      return {
        suppliers: suppliersWithMetrics,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get single supplier with full details
  get: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const supplier = await ctx.prisma.supplier.findFirst({
        where: { 
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          contacts: true,
          // supplierItems model doesn't exist
          purchaseOrders: {
            select: {
              id: true,
              poNumber: true,
              orderDate: true,
              expectedDate: true,
              status: true,
              total: true,
            },
            orderBy: { orderDate: 'desc' },
            take: 10,
          },
          lots: {
            select: {
              id: true,
              lotNumber: true,
              receivedDate: true,
              qtyInitial: true,
              qtyOnHand: true,
              item: {
                select: {
                  sku: true,
                  name: true,
                },
              },
            },
            orderBy: { receivedDate: 'desc' },
            take: 10,
          },
        },
      });

      if (!supplier) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        });
      }

      // Get supplier statistics
      const [orderStats, itemStats, qualityStats] = await Promise.all([
        // Order statistics
        ctx.prisma.purchaseOrder.groupBy({
          by: ['status'],
          where: { supplierId: supplier.id },
          _count: true,
          _sum: { total: true },
        }),

        // Item statistics - TODO: Implement supplier items
        Promise.resolve({ _count: 0, _avg: { unitCost: null } }),

        // Quality statistics (from receipts)
        ctx.prisma.receipt.aggregate({
          where: {
            purchaseOrder: { supplierId: supplier.id },
          },
          _count: true,
        }),
      ]);

      return {
        ...supplier,
        statistics: {
          orders: {
            byStatus: orderStats.reduce((acc: Record<string, any>, stat) => {
              acc[stat.status] = {
                count: stat._count,
                value: Number(stat._sum.total || 0),
              };
              return acc;
            }, {} as Record<string, any>),
            total: orderStats.reduce((sum, stat) => sum + stat._count, 0),
            totalValue: orderStats.reduce((sum, stat) => sum + Number(stat._sum.total || 0), 0),
          },
          items: {
            count: itemStats._count,
            avgCost: itemStats._avg.unitCost || 0,
          },
          quality: {
            receiptsCount: qualityStats._count,
          },
        },
      };
    }),

  // Create supplier
  create: organizationProcedure
    .input(supplierCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators and managers can create suppliers',
        });
      }

      // Check for duplicate supplier code
      const existing = await ctx.prisma.supplier.findFirst({
        where: { 
          supplierCode: input.supplierCode,
          organizationId: ctx.user.organizationId,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A supplier with this code already exists',
        });
      }

      // Create supplier with audit log
      const supplier = await ctx.prisma.$transaction(async (tx) => {
        const newSupplier = await tx.supplier.create({
          data: {
            ...input,
            organizationId: ctx.user.organizationId,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'suppliers',
            recordPk: newSupplier.id,
            action: 'CREATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            afterData: newSupplier,
          },
        });

        return newSupplier;
      });

      return supplier;
    }),

  // Update supplier
  update: organizationProcedure
    .input(supplierUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators and managers can update suppliers',
        });
      }

      const { id, ...data } = input;

      // Get current supplier
      const currentSupplier = await ctx.prisma.supplier.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!currentSupplier) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        });
      }

      // Check for code uniqueness if updating
      if (data.supplierCode && data.supplierCode !== currentSupplier.supplierCode) {
        const existing = await ctx.prisma.supplier.findFirst({
          where: { 
            supplierCode: data.supplierCode,
            organizationId: ctx.user.organizationId,
          },
        });

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A supplier with this code already exists',
          });
        }
      }

      // Update supplier with audit log
      const updatedSupplier = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.supplier.update({
          where: { id },
          data,
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'suppliers',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            beforeData: currentSupplier,
            afterData: updated,
          },
        });

        return updated;
      });

      return updatedSupplier;
    }),

  // Delete/deactivate supplier
  delete: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      force: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can delete suppliers',
        });
      }

      // Check for active relationships
      const [activeOrders, activeItems] = await Promise.all([
        ctx.prisma.purchaseOrder.count({
          where: {
            supplierId: input.id,
            status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
          },
        }),
        // TODO: Implement supplier items
        Promise.resolve(0),
      ]);

      if (activeOrders > 0 && !input.force) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot delete supplier with ${activeOrders} active orders`,
        });
      }

      if (activeItems > 0 && !input.force) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot delete supplier with ${activeItems} preferred items`,
        });
      }

      // Delete supplier
      const result = await ctx.prisma.$transaction(async (tx) => {
        const deleted = await tx.supplier.delete({
          where: { id: input.id },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'suppliers',
            recordPk: input.id,
            action: 'DELETE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            beforeData: deleted,
            afterData: undefined,
          },
        });

        return deleted;
      });

      return result;
    }),

  // Supplier contacts sub-router
  contacts: createTRPCRouter({
    // List contacts for a supplier
    list: organizationProcedure
      .input(z.object({ supplierId: z.string().cuid() }))
      .query(async ({ ctx, input }) => {
        const contacts = await ctx.prisma.supplierContact.findMany({
          where: { supplierId: input.supplierId },
          // orderBy by id for now
        });

        return contacts;
      }),

    // Create contact
    create: organizationProcedure
      .input(supplierContactSchema)
      .mutation(async ({ ctx, input }) => {
        // TODO: Implement primary contact logic

        const contact = await ctx.prisma.supplierContact.create({
          data: input,
        });

        return contact;
      }),

    // Update contact
    update: organizationProcedure
      .input(z.object({
        id: z.string().cuid(),
        data: supplierContactSchema.partial(),
      }))
      .mutation(async ({ ctx, input }) => {
        // TODO: Implement primary contact logic

        const updated = await ctx.prisma.supplierContact.update({
          where: { id: input.id },
          data: input.data,
        });

        return updated;
      }),

    // Delete contact
    delete: organizationProcedure
      .input(z.object({ id: z.string().cuid() }))
      .mutation(async ({ ctx, input }) => {
        const deleted = await ctx.prisma.supplierContact.delete({
          where: { id: input.id },
        });

        return deleted;
      }),
  }),

  // Supplier items sub-router - TODO: Implement SupplierItem model
  /* items: createTRPCRouter({
    // List items for a supplier
    list: organizationProcedure
      .input(z.object({
        supplierId: z.string().cuid(),
        includeInactive: z.boolean().default(false),
      }))
      .query(async ({ ctx, input }) => {
        const where: Prisma.SupplierItemWhereInput = {
          supplierId: input.supplierId,
        };

        if (!input.includeInactive) {
          where.item = { isActive: true };
        }

        const items = await ctx.prisma.supplierItem.findMany({
          where,
          include: {
            item: {
              include: {
                category: true,
                unitOfMeasure: true,
                inventory: {
                  select: {
                    qtyOnHand: true,
                    qtyReserved: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { isPreferred: 'desc' },
            { item: { name: 'asc' } },
          ],
        });

        // Calculate total stock for each item
        const itemsWithStock = items.map(supplierItem => ({
          ...supplierItem,
          item: {
            ...supplierItem.item,
            totalStock: supplierItem.item.inventory.reduce(
              (sum, inv) => sum + inv.qtyOnHand,
              0
            ),
            totalAvailable: supplierItem.item.inventory.reduce(
              (sum, inv) => sum + (inv.qtyOnHand - inv.qtyReserved),
              0
            ),
          },
        }));

        return itemsWithStock;
      }),

    // Add item to supplier
    create: organizationProcedure
      .input(supplierItemSchema)
      .mutation(async ({ ctx, input }) => {
        // Check if item already exists for supplier
        const existing = await ctx.prisma.supplierItem.findUnique({
          where: {
            supplierId_itemId: {
              supplierId: input.supplierId,
              itemId: input.itemId,
            },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This item is already linked to the supplier',
          });
        }

        // If marking as preferred, unmark others
        if (input.isPreferred) {
          await ctx.prisma.supplierItem.updateMany({
            where: {
              itemId: input.itemId,
              isPreferred: true,
            },
            data: { isPreferred: false },
          });
        }

        const supplierItem = await ctx.prisma.supplierItem.create({
          data: input,
          include: {
            item: {
              include: {
                category: true,
                unitOfMeasure: true,
              },
            },
          },
        });

        return supplierItem;
      }),

    // Update supplier item
    update: organizationProcedure
      .input(z.object({
        supplierId: z.string().cuid(),
        itemId: z.string().cuid(),
        data: supplierItemSchema.omit({ supplierId: true, itemId: true }).partial(),
      }))
      .mutation(async ({ ctx, input }) => {
        // If marking as preferred, unmark others
        if (input.data.isPreferred) {
          await ctx.prisma.supplierItem.updateMany({
            where: {
              itemId: input.itemId,
              isPreferred: true,
              NOT: {
                supplierId: input.supplierId,
              },
            },
            data: { isPreferred: false },
          });
        }

        const updated = await ctx.prisma.supplierItem.update({
          where: {
            supplierId_itemId: {
              supplierId: input.supplierId,
              itemId: input.itemId,
            },
          },
          data: input.data,
          include: {
            item: {
              include: {
                category: true,
                unitOfMeasure: true,
              },
            },
          },
        });

        return updated;
      }),

    // Remove item from supplier
    delete: organizationProcedure
      .input(z.object({
        supplierId: z.string().cuid(),
        itemId: z.string().cuid(),
      }))
      .mutation(async ({ ctx, input }) => {
        const deleted = await ctx.prisma.supplierItem.delete({
          where: {
            supplierId_itemId: {
              supplierId: input.supplierId,
              itemId: input.itemId,
            },
          },
        });

        return deleted;
      }),

    // Get price comparison
    priceComparison: organizationProcedure
      .input(z.object({ itemId: z.string().cuid() }))
      .query(async ({ ctx, input }) => {
        const suppliers = await ctx.prisma.supplierItem.findMany({
          where: {
            itemId: input.itemId,
            // supplier: { isActive: true }, // Field doesn't exist
          },
          include: {
            supplier: true,
          },
          orderBy: { unitCost: 'asc' },
        });

        // Get recent purchase history
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentPurchases = await ctx.prisma.purchaseOrderItem.findMany({
          where: {
            itemId: input.itemId,
            purchaseOrder: {
              orderDate: { gte: thirtyDaysAgo },
              status: { in: ['APPROVED', 'RECEIVED'] },
            },
          },
          include: {
            purchaseOrder: {
              include: {
                supplier: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { purchaseOrder: { orderDate: 'desc' } },
          take: 10,
        });

        return {
          suppliers,
          recentPurchases: recentPurchases.map(purchase => ({
            supplierId: purchase.purchaseOrder.supplierId,
            supplierName: purchase.purchaseOrder.supplier.name,
            orderDate: purchase.purchaseOrder.orderDate,
            quantity: purchase.qtyOrdered,
            unitCost: Number(purchase.unitCost),
            totalCost: Number(purchase.totalCost),
          })),
          lowestPrice: suppliers[0]?.unitCost || null,
          preferredSupplier: suppliers.find(s => s.isPreferred) || null,
        };
      }),
  }), */

  // Get supplier performance metrics
  getPerformance: organizationProcedure
    .input(performanceMetricsSchema)
    .query(async ({ ctx, input }) => {
      const { supplierId, dateFrom, dateTo } = input;

      // Get all purchase orders in the period
      const purchaseOrders = await ctx.prisma.purchaseOrder.findMany({
        where: {
          supplierId,
          orderDate: {
            gte: dateFrom,
            lte: dateTo,
          },
          status: { in: ['APPROVED', 'RECEIVED'] },
        },
        include: {
          receipts: true,
          items: true,
        },
      });

      // Calculate metrics
      const metrics = {
        orderMetrics: {
          totalOrders: purchaseOrders.length,
          totalValue: purchaseOrders.reduce((sum, po) => sum + Number(po.total || 0), 0),
          avgOrderValue: purchaseOrders.length > 0
            ? purchaseOrders.reduce((sum, po) => sum + Number(po.total || 0), 0) / purchaseOrders.length
            : 0,
        },
        deliveryMetrics: {
          onTimeDeliveries: 0,
          lateDeliveries: 0,
          earlyDeliveries: 0,
          avgLeadTime: 0,
          onTimeRate: 0,
        },
        qualityMetrics: {
          receiptsWithIssues: 0,
          perfectReceipts: 0,
          qualityRate: 0,
        },
        itemMetrics: {
          uniqueItems: new Set(),
          totalQuantity: 0,
        },
      };

      // Calculate delivery performance
      let totalLeadTime = 0;
      let deliveryCount = 0;

      for (const po of purchaseOrders) {
        if (po.receipts.length > 0) {
          const receipt = po.receipts[0]; // Consider first receipt
          const leadTime = Math.floor(
            (receipt.receivedDate.getTime() - po.orderDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          totalLeadTime += leadTime;
          deliveryCount++;

          if (po.expectedDate) {
            const daysDiff = Math.floor(
              (receipt.receivedDate.getTime() - po.expectedDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysDiff <= 0) {
              metrics.deliveryMetrics.onTimeDeliveries++;
            } else if (daysDiff > 0) {
              metrics.deliveryMetrics.lateDeliveries++;
            } else {
              metrics.deliveryMetrics.earlyDeliveries++;
            }
          }

          // Quality metrics
          // TODO: Add discrepancy tracking to Receipt model
          metrics.qualityMetrics.perfectReceipts++;
        }

        // Item metrics
        for (const item of po.items) {
          metrics.itemMetrics.uniqueItems.add(item.itemId);
          metrics.itemMetrics.totalQuantity += item.qtyOrdered;
        }
      }

      // Calculate rates
      if (deliveryCount > 0) {
        metrics.deliveryMetrics.avgLeadTime = Math.round(totalLeadTime / deliveryCount);
        metrics.deliveryMetrics.onTimeRate = 
          (metrics.deliveryMetrics.onTimeDeliveries / deliveryCount) * 100;
      }

      if (purchaseOrders.length > 0) {
        metrics.qualityMetrics.qualityRate = 
          (metrics.qualityMetrics.perfectReceipts / purchaseOrders.length) * 100;
      }

      // Get top items
      const topItems = await ctx.prisma.purchaseOrderItem.groupBy({
        by: ['itemId'],
        where: {
          purchaseOrder: {
            supplierId,
            orderDate: {
              gte: dateFrom,
              lte: dateTo,
            },
            status: { in: ['APPROVED', 'RECEIVED'] },
          },
        },
        _sum: {
          qtyOrdered: true,
          totalCost: true,
        },
        _count: true,
        orderBy: {
          _sum: {
            totalCost: 'desc',
          },
        },
        take: 10,
      });

      // Get item details for top items
      const topItemsWithDetails = await Promise.all(
        topItems.map(async (item) => {
          const itemDetails = await ctx.prisma.item.findUnique({
            where: { id: item.itemId },
            select: {
              sku: true,
              name: true,
              category: {
                select: { name: true },
              },
            },
          });

          return {
            ...itemDetails,
            orderCount: item._count,
            totalQuantity: item._sum?.qtyOrdered || 0,
            totalValue: Number(item._sum?.totalCost || 0),
          };
        })
      );

      return {
        period: {
          from: dateFrom,
          to: dateTo,
        },
        metrics: {
          ...metrics,
          itemMetrics: {
            ...metrics.itemMetrics,
            uniqueItems: metrics.itemMetrics.uniqueItems.size,
          },
        },
        topItems: topItemsWithDetails,
      };
    }),

  // Get suggested reorder items
  getSuggestedReorders: organizationProcedure
    .input(z.object({ supplierId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      // Get supplier's items
      // TODO: Implement SupplierItem model
      return {
        suggestions: [],
        summary: {
          totalItems: 0,
          totalValue: 0,
          criticalItems: 0,
        },
      };
      /* const supplierItems = await ctx.prisma.supplierItem.findMany({
        where: {
          supplierId: input.supplierId,
          item: { isActive: true },
        },
        include: {
          item: {
            include: {
              category: true,
              unitOfMeasure: true,
            },
          },
        },
      });

      const suggestedReorders = [];

      for (const supplierItem of supplierItems) {
        // Get current inventory levels
        const inventory = await ctx.prisma.inventory.aggregate({
          where: { itemId: supplierItem.itemId },
          _sum: {
            qtyOnHand: true,
            qtyReserved: true,
            qtyInTransit: true,
          },
        });

        const onHand = inventory._sum.qtyOnHand || 0;
        const reserved = inventory._sum.qtyReserved || 0;
        const inTransit = inventory._sum.qtyInTransit || 0;
        const available = onHand - reserved + inTransit;

        // Check if below reorder point
        if (available <= supplierItem.item.reorderPoint) {
          // Calculate suggested order quantity
          const suggestedQty = Math.max(
            supplierItem.moq,
            supplierItem.item.reorderQty,
            supplierItem.item.reorderPoint - available + supplierItem.item.reorderQty
          );

          // Round up to MOQ multiple
          const orderQty = Math.ceil(suggestedQty / supplierItem.moq) * supplierItem.moq;

          suggestedReorders.push({
            item: supplierItem.item,
            supplierItem: {
              unitCost: supplierItem.unitCost,
              moq: supplierItem.moq,
              leadTimeDays: supplierItem.leadTimeDays,
              isPreferred: supplierItem.isPreferred,
            },
            inventory: {
              onHand,
              reserved,
              available,
              inTransit,
              reorderPoint: supplierItem.item.reorderPoint,
            },
            suggestion: {
              orderQty,
              totalCost: orderQty * supplierItem.unitCost,
              urgency: available <= 0 ? 'CRITICAL' : available <= supplierItem.item.reorderPoint / 2 ? 'HIGH' : 'MEDIUM',
              estimatedDelivery: new Date(Date.now() + supplierItem.leadTimeDays * 24 * 60 * 60 * 1000),
            },
          });
        }
      }

      // Sort by urgency and value
      suggestedReorders.sort((a, b) => {
        const urgencyOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        const urgencyDiff = urgencyOrder[a.suggestion.urgency] - urgencyOrder[b.suggestion.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return b.suggestion.totalCost - a.suggestion.totalCost;
      });

      return {
        suggestions: suggestedReorders,
        summary: {
          totalItems: suggestedReorders.length,
          totalValue: suggestedReorders.reduce((sum, item) => sum + item.suggestion.totalCost, 0),
          criticalItems: suggestedReorders.filter(item => item.suggestion.urgency === 'CRITICAL').length,
        },
      }; */
    }),

  // Import suppliers from CSV
  import: organizationProcedure
    .input(z.object({
      suppliers: z.array(supplierCreateSchema),
      validateOnly: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can import suppliers',
        });
      }

      const errors: Array<{ row: number; errors: string[] }> = [];
      const validSuppliers: typeof input.suppliers = [];

      // Validate all suppliers
      for (let i = 0; i < input.suppliers.length; i++) {
        const supplier = input.suppliers[i];
        const supplierErrors: string[] = [];

        // Check for duplicate code
        const existing = await ctx.prisma.supplier.findFirst({
          where: { 
            supplierCode: supplier.supplierCode,
            organizationId: ctx.user.organizationId,
          },
        });

        if (existing) {
          supplierErrors.push(`Supplier code ${supplier.supplierCode} already exists`);
        }

        // Validate email format
        if (supplier.email && !z.string().email().safeParse(supplier.email).success) {
          supplierErrors.push('Invalid email format');
        }

        if (supplierErrors.length > 0) {
          errors.push({ row: i + 1, errors: supplierErrors });
        } else {
          validSuppliers.push(supplier);
        }
      }

      // Return validation results if validateOnly
      if (input.validateOnly) {
        return {
          valid: errors.length === 0,
          errors,
          validCount: validSuppliers.length,
          totalCount: input.suppliers.length,
        };
      }

      // If errors found, don't proceed
      if (errors.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Validation failed for ${errors.length} suppliers`,
          cause: errors,
        });
      }

      // Import valid suppliers
      const createdSuppliers = await ctx.prisma.$transaction(async (tx) => {
        const created = [];

        for (const supplier of validSuppliers) {
          const newSupplier = await tx.supplier.create({
            data: {
              ...supplier,
              organizationId: ctx.user.organizationId,
            },
          });
          created.push(newSupplier);
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'suppliers',
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
        imported: createdSuppliers.length,
        suppliers: createdSuppliers,
      };
    }),
});