import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';
import type { Prisma } from '@ventry/database';

// Input validation schemas
const orderCreateSchema = z.object({
  customerId: z.string().cuid(),
  requestedShipDate: z.date().optional(),
  defaultPaymentTerms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().cuid(),
    qtyOrdered: z.number().int().positive(),
    unitPrice: z.number().min(0),
    discountPct: z.number().min(0).max(100).default(0),
    taxRate: z.number().min(0).max(100).default(0),
    description: z.string().optional(),
  })).min(1),
});

const orderUpdateSchema = z.object({
  id: z.string().cuid(),
  customerId: z.string().cuid().optional(),
  requestedShipDate: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const orderFilterSchema = z.object({
  search: z.string().optional(),
  customerId: z.string().cuid().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  hasBackorders: z.boolean().optional(),
  isOverdue: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['orderNumber', 'orderDate', 'customer', 'status', 'grandTotal']).default('orderDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const orderItemSchema = z.object({
  orderId: z.string().cuid(),
  itemId: z.string().cuid(),
  qtyOrdered: z.number().int().positive(),
  unitPrice: z.number().min(0),
  discountPct: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  description: z.string().optional(),
});

const allocationCheckSchema = z.object({
  orderId: z.string().cuid(),
  strategyId: z.string().cuid().optional(),
  checkOnly: z.boolean().default(true),
});

const shipmentCreateSchema = z.object({
  orderId: z.string().cuid(),
  carrierName: z.string().min(1),
  trackingNumber: z.string().optional(),
  estimatedDelivery: z.date().optional(),
  shippingCost: z.number().min(0).default(0),
  shippedFromLocationId: z.string().cuid().optional(),
  items: z.array(z.object({
    orderItemId: z.string().cuid(),
    qtyShipped: z.number().int().positive(),
    lotId: z.string().cuid().optional(),
    serialNumbers: z.array(z.string()).optional(),
  })).min(1),
});

export const ordersRouter = createTRPCRouter({
  // List orders with filtering
  list: organizationProcedure
    .input(orderFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        search,
        customerId,
        status,
        dateFrom,
        dateTo,
        hasBackorders,
        isOverdue,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: Prisma.OrderWhereInput = {
        organizationId: ctx.user.organizationId,
      };

      // Search filter
      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { customer: { 
            OR: [
              { customerCode: { contains: search, mode: 'insensitive' } },
              { companyName: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }},
          { notes: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Customer filter
      if (customerId) {
        where.customerId = customerId;
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      // NOTE: warehouseId, orderType, and priority are not in the Order model
      // These would need to be added to the schema or removed from the filter

      // Date filters
      if (dateFrom || dateTo) {
        where.orderDate = {};
        if (dateFrom) where.orderDate.gte = dateFrom;
        if (dateTo) where.orderDate.lte = dateTo;
      }

      // Has backorders filter - items where ordered > shipped
      if (hasBackorders) {
        // This will be handled in post-processing since Prisma doesn't support field comparisons
      }

      // Overdue filter
      if (isOverdue) {
        where.AND = [
          { requestedShipDate: { lt: new Date() } },
          { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        ];
      }

      // Execute queries
      const [orders, total] = await Promise.all([
        ctx.prisma.order.findMany({
          where,
          include: {
            customer: {
              select: {
                id: true,
                customerCode: true,
                companyName: true,
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: {
                items: true,
                shipments: true,
              },
            },
            items: {
              select: {
                id: true,
                qtyOrdered: true,
                qtyAllocated: true,
                qtyShipped: true,
                totalPrice: true,
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: sortBy === 'customer'
            ? { customer: { companyName: sortOrder } }
            : { [sortBy]: sortOrder },
        }),
        ctx.prisma.order.count({ where }),
      ]);

      // Calculate additional metrics
      let ordersWithMetrics = orders.map(order => ({
        ...order,
        itemCount: order._count.items,
        shipmentCount: order._count.shipments,
        total: order.items.reduce((sum: number, item: any) => sum + Number(item.totalPrice || 0), 0),
        fulfillmentRate: order.items.length > 0
          ? (order.items.reduce((sum: number, item: any) => sum + item.qtyShipped, 0) /
             order.items.reduce((sum: number, item: any) => sum + item.qtyOrdered, 0)) * 100
          : 0,
        hasBackorders: order.items.some((item: any) => item.qtyOrdered > item.qtyShipped),
      }));

      // Apply hasBackorders filter if requested
      if (hasBackorders) {
        ordersWithMetrics = ordersWithMetrics.filter(order => order.hasBackorders);
      }

      return {
        orders: ordersWithMetrics,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get single order with full details
  get: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findFirst({
        where: { 
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          customer: {
            include: {
              addresses: {
                where: { isDefault: true },
              },
            },
          },
          // NOTE: warehouse, shippingAddress, billingAddress, shippingMethod not in Order model
          items: {
            include: {
              item: {
                include: {
                  category: true,
                  unitOfMeasure: true,
                },
              },
              // TODO: allocations not in schema
            },
          },
          shipments: {
            include: {
              items: {
                include: {
                  orderItem: {
                    include: {
                      item: true,
                    },
                  },
                  lot: true,
                  serialNumber: true,
                },
              },
            },
            orderBy: { shipDate: 'desc' },
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
          // TODO: activities not in schema
        },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Calculate order metrics
      const metrics = {
        itemCount: order.items.length,
        totalQuantity: order.items.reduce((sum: number, item: any) => sum + item.qtyOrdered, 0),
        allocatedQuantity: order.items.reduce((sum: number, item: any) => sum + item.qtyAllocated, 0),
        shippedQuantity: order.items.reduce((sum: number, item: any) => sum + item.qtyShipped, 0),
        backorderedQuantity: order.items.reduce((sum: number, item: any) => sum + Math.max(0, item.qtyOrdered - item.qtyShipped), 0),
        fulfillmentRate: order.items.reduce((sum: number, item: any) => sum + item.qtyOrdered, 0) > 0
          ? (order.items.reduce((sum: number, item: any) => sum + item.qtyShipped, 0) /
             order.items.reduce((sum: number, item: any) => sum + item.qtyOrdered, 0)) * 100
          : 0,
        paymentStatus: {
          total: Number(order.grandTotal || 0),
          paid: order.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0),
          balance: Number(order.grandTotal || 0) - order.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0),
        },
      };

      return {
        ...order,
        metrics,
      };
    }),

  // Create order
  create: organizationProcedure
    .input(orderCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { items, ...orderData } = input;

      // Verify customer exists and belongs to organization
      const customer = await ctx.prisma.customer.findFirst({
        where: { 
          id: orderData.customerId,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        });
      }

      // Create order with items in transaction
      const order = await ctx.prisma.$transaction(async (tx) => {
        // Generate order number
        const orderCount = await tx.order.count({
          where: {
            orderDate: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        });
        
        const orderNumber = `ORD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(orderCount + 1).padStart(5, '0')}`;

        // Calculate order totals
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        const itemsWithTotals = items.map(item => {
          const lineTotal = item.qtyOrdered * item.unitPrice;
          const discountAmount = lineTotal * (item.discountPct / 100);
          const subtotalAfterDiscount = lineTotal - discountAmount;
          const taxAmount = subtotalAfterDiscount * (item.taxRate / 100);
          const totalPrice = subtotalAfterDiscount + taxAmount;

          subtotal += lineTotal;
          totalDiscount += discountAmount;
          totalTax += taxAmount;

          return {
            ...item,
            totalPrice,
          };
        });

        const grandTotal = subtotal - totalDiscount + totalTax;

        // Create order
        const newOrder = await tx.order.create({
          data: {
            ...orderData,
            orderNumber,
            orderDate: new Date(),
            status: 'PENDING',
            organizationId: ctx.user.organizationId,
            subtotal,
            taxTotal: totalTax,
            discountTotal: totalDiscount,
            grandTotal,
            createdById: ctx.user.id,
          },
        });

        // Create order items
        for (const item of itemsWithTotals) {
          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              itemId: item.itemId,
              qtyOrdered: item.qtyOrdered,
              qtyAllocated: 0,
              qtyShipped: 0,
              unitPrice: item.unitPrice,
              discountPct: item.discountPct,
              taxRate: item.taxRate,
              totalPrice: item.totalPrice,
              description: item.description,
            },
          });
        }

        // TODO: Implement order activity tracking when model is added

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'orders',
            recordPk: newOrder.id,
            action: 'CREATE',
            userId: ctx.user.id,
            afterData: newOrder,
          },
        });

        return newOrder;
      });

      return order;
    }),

  // Update order
  update: organizationProcedure
    .input(orderUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Get current order
      const currentOrder = await ctx.prisma.order.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!currentOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Check if order can be updated based on status
      if (['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(currentOrder.status)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot update order in ${currentOrder.status} status`,
        });
      }

      // Update order with audit log
      const updatedOrder = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id },
          data,
        });

        // Create activity log
        // TODO: Implement order activity tracking when model is added

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'orders',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: currentOrder,
            afterData: updated,
          },
        });

        return updated;
      });

      return updatedOrder;
    }),

  // Update order status
  updateStatus: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      status: z.enum(['PENDING', 'CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, status, notes } = input;

      // Get current order
      const currentOrder = await ctx.prisma.order.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!currentOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        PENDING: ['CONFIRMED', 'CANCELLED'],
        CONFIRMED: ['PICKING', 'CANCELLED'],
        PICKING: ['PACKED', 'CONFIRMED', 'CANCELLED'],
        PACKED: ['SHIPPED', 'PICKING', 'CANCELLED'],
        SHIPPED: ['DELIVERED', 'PACKED'],
        DELIVERED: [],
        CANCELLED: [],
      };

      if (!validTransitions[currentOrder.status]?.includes(status)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot transition from ${currentOrder.status} to ${status}`,
        });
      }

      // Perform status-specific actions
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Handle cancellation
        if (status === 'CANCELLED') {
          // TODO: Release reserved inventory when allocation model is implemented
        }

        // Update order status
        const updated = await tx.order.update({
          where: { id },
          data: { 
            status,
            updatedById: ctx.user.id,
          },
        });

        // Create activity log
        // TODO: Implement order activity tracking when model is added
        /*
        await tx.orderActivity.create({
          data: {
            orderId: id,
            userId: ctx.user.id,
            activityType: `STATUS_CHANGED_TO_${status}`,
            description: `Order status changed from ${currentOrder.status} to ${status}${notes ? `: ${notes}` : ''}`,
            activityDate: new Date(),
          },
        });
        */

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'orders',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: { status: currentOrder.status },
            afterData: { status },
          },
        });

        return updated;
      });

      return result;
    }),

  // Cancel order
  cancel: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      reason: z.string().min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, reason, notes } = input;

      // Cancel the order
      const order = await ctx.prisma.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: `Cancellation reason: ${reason}${notes ? `. Additional notes: ${notes}` : ''}`,
          updatedById: ctx.user.id,
        },
      });

      return order;
    }),

  // Order items sub-router
  items: createTRPCRouter({
    // Add item to order
    add: organizationProcedure
      .input(orderItemSchema)
      .mutation(async ({ ctx, input }) => {
        const order = await ctx.prisma.order.findFirst({
          where: { 
            id: input.orderId,
            organizationId: ctx.user.organizationId,
          },
        });

        if (!order) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order not found',
          });
        }

        if (['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot add items to order in ${order.status} status`,
          });
        }

        // Check if item already exists
        const existingItem = await ctx.prisma.orderItem.findFirst({
          where: {
            orderId: input.orderId,
            itemId: input.itemId,
          },
        });

        if (existingItem) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Item already exists in order. Use update instead.',
          });
        }

        // Add item and recalculate totals
        const result = await ctx.prisma.$transaction(async (tx) => {
          // Calculate item totals
          const lineTotal = input.qtyOrdered * input.unitPrice;
          const discountAmount = lineTotal * (input.discountPct / 100);
          const subtotalAfterDiscount = lineTotal - discountAmount;
          const taxAmount = subtotalAfterDiscount * (input.taxRate / 100);
          const totalPrice = subtotalAfterDiscount + taxAmount;

          // Create order item
          const newItem = await tx.orderItem.create({
            data: {
              ...input,
              qtyAllocated: 0,
              qtyShipped: 0,
              totalPrice,
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

          // Update order totals
          await tx.order.update({
            where: { id: input.orderId },
            data: {
              subtotal: { increment: lineTotal },
              discountTotal: { increment: discountAmount },
              taxTotal: { increment: taxAmount },
              grandTotal: { increment: totalPrice },
              updatedById: ctx.user.id,
            },
          });

          // TODO: Implement order activity tracking when model is added

          return newItem;
        });

        return result;
      }),

    // Update order item
    update: organizationProcedure
      .input(z.object({
        id: z.string().cuid(),
        qtyOrdered: z.number().int().positive().optional(),
        unitPrice: z.number().min(0).optional(),
        discountPct: z.number().min(0).max(100).optional(),
        taxRate: z.number().min(0).max(100).optional(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;

        const currentItem = await ctx.prisma.orderItem.findFirst({
          where: { id },
          include: {
            order: true,
          },
        });

        if (!currentItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order item not found',
          });
        }

        if (['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(currentItem.order.status)) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot update items in order with ${currentItem.order.status} status`,
          });
        }

        // Update item and recalculate totals
        const result = await ctx.prisma.$transaction(async (tx) => {
          // Calculate new totals
          const qtyOrdered = data.qtyOrdered ?? currentItem.qtyOrdered;
          const unitPrice = data.unitPrice ?? Number(currentItem.unitPrice);
          const discountPct = data.discountPct ?? Number(currentItem.discountPct);
          const taxRate = data.taxRate ?? Number(currentItem.taxRate);

          const lineTotal = qtyOrdered * unitPrice;
          const discountAmount = lineTotal * (discountPct / 100);
          const subtotalAfterDiscount = lineTotal - discountAmount;
          const taxAmount = subtotalAfterDiscount * (taxRate / 100);
          const totalPrice = subtotalAfterDiscount + taxAmount;

          // Update order item
          const updated = await tx.orderItem.update({
            where: { id },
            data: {
              ...data,
              totalPrice,
            },
          });

          // Update order totals (subtract old, add new)
          await tx.order.update({
            where: { id: currentItem.orderId },
            data: {
              subtotal: {
                increment: lineTotal - Number(currentItem.totalPrice) * Number(currentItem.qtyOrdered) / (Number(currentItem.qtyOrdered) * (1 - Number(currentItem.discountPct) / 100) * (1 + Number(currentItem.taxRate) / 100)),
              },
              discountTotal: {
                increment: discountAmount - (Number(currentItem.totalPrice) * Number(currentItem.discountPct) / 100),
              },
              taxTotal: {
                increment: taxAmount - (Number(currentItem.totalPrice) * Number(currentItem.taxRate) / 100 / (1 + Number(currentItem.taxRate) / 100)),
              },
              grandTotal: {
                increment: totalPrice - Number(currentItem.totalPrice),
              },
              updatedById: ctx.user.id,
            },
          });

          // TODO: Implement order activity tracking when model is added

          return updated;
        });

        return result;
      }),

    // Remove item from order
    remove: organizationProcedure
      .input(z.object({ id: z.string().cuid() }))
      .mutation(async ({ ctx, input }) => {
        const item = await ctx.prisma.orderItem.findUnique({
          where: { id: input.id },
          include: {
            order: true,
          },
        });

        if (!item) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order item not found',
          });
        }

        if (!item.order || ['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(item.order.status)) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot remove items from order in ${item.order?.status || 'unknown'} status`,
          });
        }

        if (item.qtyShipped > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Cannot remove item that has been partially shipped',
          });
        }

        // Remove item and update totals
        const result = await ctx.prisma.$transaction(async (tx) => {
          // TODO: Release any inventory reservations when allocation model is implemented

          // Delete item
          await tx.orderItem.delete({
            where: { id: input.id },
          });

          // Update order totals
          await tx.order.update({
            where: { id: item.orderId },
            data: {
              // Calculate the amounts to decrement based on the item's totalPrice
              // We need to reverse-calculate since we don't store lineTotal, discountAmount, taxAmount
              subtotal: { decrement: Number(item.totalPrice) * Number(item.qtyOrdered) / (Number(item.qtyOrdered) * (1 - Number(item.discountPct) / 100) * (1 + Number(item.taxRate) / 100)) },
              discountTotal: { decrement: Number(item.totalPrice) * Number(item.discountPct) / 100 / (1 + Number(item.taxRate) / 100) },
              taxTotal: { decrement: Number(item.totalPrice) * Number(item.taxRate) / 100 / (1 + Number(item.taxRate) / 100) },
              grandTotal: { decrement: Number(item.totalPrice) },
              updatedById: ctx.user.id,
            },
          });

          // Create activity log
          // TODO: Implement order activity tracking when model is added
          /*
          await tx.orderActivity.create({
            data: {
              orderId: item.orderId,
              userId: ctx.user.id,
              activityType: 'ITEM_REMOVED',
              description: `Removed item from order`,
              activityDate: new Date(),
            },
          });
          */
          
          return { success: true };
        });

        return result;
      }),
  }),

  // TODO: Implement inventory allocation when allocation models are added
  // allocateInventory: ...
  // releaseInventory: ...

  // Check availability
  checkAvailability: organizationProcedure
    .input(z.object({
      items: z.array(z.object({
        itemId: z.string().cuid(),
        qty: z.number().int().positive(),
      })),
      warehouseId: z.string().cuid(),
    }))
    .query(async ({ ctx, input }) => {
      const { items, warehouseId } = input;
      const availability = [];

      for (const item of items) {
        const inventory = await ctx.prisma.inventory.aggregate({
          where: {
            itemId: item.itemId,
            location: {
              warehouseId,
            },
          },
          _sum: {
            qtyOnHand: true,
            qtyReserved: true,
          },
        });

        const itemDetails = await ctx.prisma.item.findUnique({
          where: { id: item.itemId },
          select: {
            sku: true,
            name: true,
          },
        });

        const onHand = inventory._sum?.qtyOnHand || 0;
        const reserved = inventory._sum?.qtyReserved || 0;
        const available = onHand - reserved;

        availability.push({
          itemId: item.itemId,
          sku: itemDetails?.sku,
          name: itemDetails?.name,
          qtyRequested: item.qty,
          qtyOnHand: onHand,
          qtyReserved: reserved,
          qtyAvailable: available,
          canFulfill: available >= item.qty,
          shortage: Math.max(0, item.qty - available),
        });
      }

      const summary = {
        totalItems: items.length,
        availableItems: availability.filter(a => a.canFulfill).length,
        partialItems: availability.filter(a => a.qtyAvailable > 0 && !a.canFulfill).length,
        unavailableItems: availability.filter(a => a.qtyAvailable === 0).length,
        canFulfillOrder: availability.every(a => a.canFulfill),
      };

      return {
        availability,
        summary,
      };
    }),

  // Calculate totals
  calculateTotals: organizationProcedure
    .input(z.object({
      items: z.array(z.object({
        qty: z.number().int().positive(),
        unitPrice: z.number().min(0),
        discountPct: z.number().min(0).max(100).default(0),
        taxRate: z.number().min(0).max(100).default(0),
      })),
      shippingCost: z.number().min(0).default(0),
      additionalDiscount: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { items, shippingCost, additionalDiscount } = input;

      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      const itemTotals = items.map(item => {
        const lineTotal = item.qty * item.unitPrice;
        const discountAmount = lineTotal * (item.discountPct / 100);
        const subtotalAfterDiscount = lineTotal - discountAmount;
        const taxAmount = subtotalAfterDiscount * (item.taxRate / 100);
        const totalPrice = subtotalAfterDiscount + taxAmount;

        subtotal += lineTotal;
        totalDiscount += discountAmount;
        totalTax += taxAmount;

        return {
          lineTotal,
          discountAmount,
          taxAmount,
          totalPrice,
        };
      });

      const subtotalAfterItemDiscounts = subtotal - totalDiscount;
      const additionalDiscountAmount = subtotalAfterItemDiscounts * (additionalDiscount / 100);
      totalDiscount += additionalDiscountAmount;

      const total = subtotalAfterItemDiscounts - additionalDiscountAmount + totalTax + shippingCost;

      return {
        itemTotals,
        summary: {
          subtotal,
          totalDiscount,
          totalTax,
          shippingCost,
          total,
          itemCount: items.length,
          totalQuantity: items.reduce((sum, item) => sum + item.qty, 0),
        },
      };
    }),

  // Create shipment
  createShipment: organizationProcedure
    .input(shipmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { orderId, items, ...shipmentData } = input;

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
          code: 'PRECONDITION_FAILED',
          message: `Cannot create shipment for order in ${order.status} status`,
        });
      }

      // Validate shipment items
      for (const shipItem of items) {
        const orderItem = order.items.find(oi => oi.id === shipItem.orderItemId);
        
        if (!orderItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order item not found',
          });
        }

        const remainingToShip = orderItem.qtyOrdered - orderItem.qtyShipped;
        if (shipItem.qtyShipped > remainingToShip) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot ship ${shipItem.qtyShipped} units. Only ${remainingToShip} remaining to ship.`,
          });
        }
      }

      // Create shipment in transaction
      const shipment = await ctx.prisma.$transaction(async (tx) => {
        // Generate shipment number
        const shipmentCount = await tx.shipment.count({
          where: {
            shipDate: {
              gte: new Date(new Date().getFullYear(), 0, 1),
            },
          },
        });

        const shipmentNumber = `SHIP-${new Date().getFullYear()}-${String(shipmentCount + 1).padStart(6, '0')}`;

        // Create shipment
        const newShipment = await tx.shipment.create({
          data: {
            ...shipmentData,
            orderId,
            shipmentNumber,
            organizationId: ctx.user.organizationId,
            shipDate: new Date(),
            status: 'IN_TRANSIT',
            shippedFromLocationId: input.shippedFromLocationId || 'default-location-id', // TODO: Get from warehouse default location
            shippedById: ctx.user.id,
          },
        });

        // Process shipment items
        for (const shipItem of items) {
          // Create shipment item
          // Get the order item to get itemId
          const orderItem = order.items.find(oi => oi.id === shipItem.orderItemId);
          
          await tx.shipmentItem.create({
            data: {
              shipmentId: newShipment.id,
              orderItemId: shipItem.orderItemId,
              itemId: orderItem!.itemId,
              qtyShipped: shipItem.qtyShipped,
              lotId: shipItem.lotId,
            },
          });

          // Handle serial numbers if provided
          if (shipItem.serialNumbers && shipItem.serialNumbers.length > 0) {
            // TODO: Implement shipment serial number tracking when model is added
          /*
          await tx.shipmentSerialNumber.createMany({
              data: shipItem.serialNumbers.map(sn => ({
                shipmentId: newShipment.id,
                serialNumberId: sn,
              })),
            });
          */

            // Update serial number status
            await tx.serialNumber.updateMany({
              where: {
                serialNumber: { in: shipItem.serialNumbers },
              },
              data: {
                status: 'SOLD',
                // TODO: Add soldDate when field is added to schema
              },
            });
          }

          // Update order item
          await tx.orderItem.update({
            where: { id: shipItem.orderItemId },
            data: {
              qtyShipped: {
                increment: shipItem.qtyShipped,
              },
            },
          });

          // Create stock movements
          const orderItemForMovement = order.items.find(oi => oi.id === shipItem.orderItemId);
          if (orderItemForMovement) {
            // TODO: Create stock movements based on inventory locations
            // For now, just create a simple outbound movement
            await tx.stockMovement.create({
              data: {
                itemId: orderItemForMovement.itemId,
                fromLocationId: input.shippedFromLocationId || 'default-location-id',
                qty: shipItem.qtyShipped,
                movementType: 'OUTBOUND',
                refType: 'ORDER',
                refId: orderId,
                movedById: ctx.user.id,
                movedAt: new Date(),
                notes: `Shipment ${shipmentNumber}`,
              },
            });
          }
        }

        // Check if order is fully shipped
        const updatedOrder = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: true,
          },
        });

        const fullyShipped = updatedOrder?.items.every(
          item => item.qtyShipped >= item.qtyOrdered
        );

        if (fullyShipped) {
          await tx.order.update({
            where: { id: orderId },
            data: { 
              status: 'SHIPPED',
              // TODO: Add shippedDate field when available
            },
          });
        }

        // Create activity log
        // TODO: Implement order activity tracking when model is added
        /*
        await tx.orderActivity.create({
          data: {
            orderId,
            userId: ctx.user.id,
            activityType: 'SHIPMENT_CREATED',
            description: `Created shipment ${shipmentNumber}`,
            activityDate: new Date(),
          },
        });
        */

        return newShipment;
      });

      return shipment;
    }),

  // Get shipments for order
  getShipments: organizationProcedure
    .input(z.object({ orderId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const shipments = await ctx.prisma.shipment.findMany({
        where: { orderId: input.orderId },
        include: {
          items: {
            include: {
              orderItem: {
                include: {
                  item: true,
                },
              },
              lot: true,
              serialNumber: true,
            },
          },
        },
        orderBy: { shipDate: 'desc' },
      });

      return shipments;
    }),

  // Export orders
  export: organizationProcedure
    .input(z.object({
      filters: orderFilterSchema,
      format: z.enum(['csv', 'excel']).default('csv'),
      includeItems: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const baseQuery = {
        where: input.filters as any,
        include: {
          customer: true,
          items: false as const,
        },
        orderBy: { orderDate: 'desc' } as const,
      };

      const orders = input.includeItems 
        ? await ctx.prisma.order.findMany({
            ...baseQuery,
            include: {
              ...baseQuery.include,
              items: {
                include: {
                  item: true,
                },
              },
            },
          })
        : await ctx.prisma.order.findMany(baseQuery);

      // Prepare export data
      const exportData = [];
      
      for (const order of orders) {
        const baseData = {
          orderNumber: order.orderNumber,
          orderDate: order.orderDate.toISOString(),
          status: order.status,
          customerCode: order.customer.customerCode,
          customerName: order.customer.companyName || `${order.customer.firstName} ${order.customer.lastName}`,
          subtotal: Number(order.subtotal),
          discount: Number(order.discountTotal),
          tax: Number(order.taxTotal),
          shipping: Number(order.shippingTotal),
          total: Number(order.grandTotal),
          requestedShipDate: order.requestedShipDate?.toISOString() || '',
          notes: order.notes || '',
        };

        if (input.includeItems && 'items' in order && Array.isArray(order.items)) {
          for (const orderItem of order.items) {
            // Type assertion since we know items include item relation when includeItems is true
            const itemWithRelation = orderItem as typeof orderItem & { item: { sku: string; name: string } };
            exportData.push({
              ...baseData,
              itemSku: itemWithRelation.item.sku,
              itemName: itemWithRelation.item.name,
              qtyOrdered: itemWithRelation.qtyOrdered,
              qtyShipped: itemWithRelation.qtyShipped,
              unitPrice: Number(itemWithRelation.unitPrice),
              lineTotal: Number(itemWithRelation.totalPrice),
            });
          }
        } else {
          exportData.push(baseData);
        }
      }

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          tableName: 'orders',
          recordPk: 'EXPORT',
          action: 'UPDATE', // Using UPDATE as EXPORT is not a valid AuditAction
          userId: ctx.user.id,
          afterData: {
            format: input.format,
            recordCount: orders.length,
            includeItems: input.includeItems,
          },
        },
      });

      return {
        data: exportData,
        count: exportData.length,
        format: input.format,
      };
    }),
});