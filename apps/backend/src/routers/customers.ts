import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

import { Prisma } from '@ventry/database';

// Input validation schemas
const customerCreateSchema = z.object({
  customerCode: z.string().min(1).max(50),
  companyName: z.string().min(1).max(200).optional().nullable(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  currencyId: z.string().default('USD'),
  defaultPaymentTerms: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const customerUpdateSchema = customerCreateSchema.partial().extend({
  id: z.string().cuid(),
});

const customerFilterSchema = z.object({
  search: z.string().optional(),
  hasOpenOrders: z.boolean().optional(),
  customerType: z.enum(['B2B', 'B2C', 'ALL']).default('ALL'),
  creditStatus: z.enum(['GOOD', 'WARNING', 'BLOCKED', 'ALL']).default('ALL'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['code', 'name', 'createdAt', 'totalRevenue']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

const addressSchema = z.object({
  customerId: z.string().cuid(),
  addressType: z.enum(['BILLING', 'SHIPPING', 'BOTH']),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  instructions: z.string().optional().nullable(),
});

const creditCheckSchema = z.object({
  customerId: z.string().cuid(),
  orderAmount: z.number().positive(),
});

const customerMetricsSchema = z.object({
  customerId: z.string().cuid(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

export const customersRouter = createTRPCRouter({
  // List customers with filtering
  list: organizationProcedure
    .input(customerFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        search,
        hasOpenOrders,
        customerType,
        creditStatus,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: Prisma.CustomerWhereInput = {
        organizationId: ctx.user.organizationId,
      };

      // Search filter
      if (search) {
        where.OR = [
          { customerCode: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Remove active filter - field doesn't exist

      // Customer type filter
      if (customerType !== 'ALL') {
        if (customerType === 'B2B') {
          where.companyName = { not: null };
        } else if (customerType === 'B2C') {
          where.companyName = null;
        }
      }

      // Open orders filter
      if (hasOpenOrders) {
        where.orders = {
          some: {
            status: { in: ['PENDING', 'CONFIRMED', 'PICKING'] },
          },
        };
      }

      // Execute queries
      const [customers, total] = await Promise.all([
        ctx.prisma.customer.findMany({
          where,
          include: {
            _count: {
              select: {
                addresses: true,
                orders: true,
              },
            },
            orders: {
              select: {
                id: true,
                orderDate: true,
                grandTotal: true,
                status: true,
              },
              orderBy: { orderDate: 'desc' },
              take: 1,
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        ctx.prisma.customer.count({ where }),
      ]);

      // Calculate additional metrics
      const customersWithMetrics = await Promise.all(
        customers.map(async (customer) => {
          // Get lifetime statistics
          const [orderStats, paymentStats] = await Promise.all([
            ctx.prisma.order.aggregate({
              where: {
                customerId: customer.id,
                status: { in: ['SHIPPED', 'DELIVERED'] },
              },
              _sum: { grandTotal: true },
              _count: true,
              _avg: { grandTotal: true },
            }),
            ctx.prisma.payment.aggregate({
              where: {
                order: { customerId: customer.id },
                status: 'COMPLETED',
              },
              _sum: { amount: true },
            }),
          ]);

          const totalRevenue = Number(orderStats._sum.grandTotal || 0);
          const totalPaid = Number(paymentStats._sum.amount || 0);
          const outstandingBalance = totalRevenue - totalPaid;

          // Determine credit status based on balance
          let creditStatus = 'GOOD';
          if (outstandingBalance > 10000) {
            creditStatus = 'BLOCKED';
          } else if (outstandingBalance > 5000) {
            creditStatus = 'WARNING';
          }

          return {
            ...customer,
            metrics: {
              lifetimeRevenue: totalRevenue,
              orderCount: orderStats._count,
              avgOrderValue: orderStats._avg.grandTotal || 0,
              outstandingBalance,
              creditStatus,
              lastOrderDate: customer.orders[0]?.orderDate || null,
            },
          };
        })
      );

      // Apply credit status filter if needed
      let filteredCustomers = customersWithMetrics;
      if (creditStatus !== 'ALL') {
        filteredCustomers = customersWithMetrics.filter(
          c => c.metrics.creditStatus === creditStatus
        );
      }

      return {
        customers: filteredCustomers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get single customer with full details
  get: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.id },
        include: {
          addresses: {
            orderBy: [
              { isDefault: 'desc' },
              { addressType: 'asc' },
            ],
          },
          orders: {
            select: {
              id: true,
              orderNumber: true,
              orderDate: true,
              requestedShipDate: true,
              status: true,
              subtotal: true,
              taxTotal: true,
              shippingTotal: true,
              grandTotal: true,
              shipments: {
                select: {
                  id: true,
                  trackingNumber: true,
                  status: true,
                },
              },
            },
            orderBy: { orderDate: 'desc' },
            take: 20,
          },
          returns: {
            select: {
              id: true,
              returnNumber: true,
              returnDate: true,
              status: true,
              order: {
                select: {
                  orderNumber: true,
                },
              },
            },
            orderBy: { returnDate: 'desc' },
            take: 10,
          },
        },
      });

      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        });
      }

      // Get customer statistics
      const [orderStats, paymentStats, productStats] = await Promise.all([
        // Order statistics
        ctx.prisma.order.groupBy({
          by: ['status'],
          where: { customerId: customer.id },
          _count: true,
          _sum: { grandTotal: true },
        }),

        // Payment statistics
        ctx.prisma.payment.aggregate({
          where: {
            order: { customerId: customer.id },
          },
          _sum: { amount: true },
          _count: true,
        }),

        // Product preferences
        ctx.prisma.orderItem.groupBy({
          by: ['itemId'],
          where: {
            order: {
              customerId: customer.id,
              status: { in: ['SHIPPED', 'DELIVERED'] },
            },
          },
          _sum: {
            qtyOrdered: true,
            totalPrice: true,
          },
          _count: true,
          orderBy: {
            _sum: {
              totalPrice: 'desc',
            },
          },
          take: 10,
        }),
      ]);

      // Get product details for preferences
      const favoriteProducts = await Promise.all(
        productStats.map(async (stat) => {
          const item = await ctx.prisma.item.findUnique({
            where: { id: stat.itemId },
            select: {
              id: true,
              sku: true,
              name: true,
              category: {
                select: { name: true },
              },
            },
          });

          return {
            ...item,
            orderCount: stat._count,
            totalQuantity: stat._sum.qtyOrdered || 0,
            totalRevenue: stat._sum.totalPrice || 0,
          };
        })
      );

      return {
        ...customer,
        statistics: {
          orders: {
            byStatus: orderStats.reduce((acc, stat) => {
              acc[stat.status] = {
                count: stat._count,
                value: Number(stat._sum.grandTotal || 0),
              };
              return acc;
            }, {} as Record<string, any>),
            total: orderStats.reduce((sum, stat) => sum + stat._count, 0),
            totalValue: orderStats.reduce((sum, stat) => sum + Number(stat._sum.grandTotal || 0), 0),
          },
          payments: {
            total: paymentStats._sum.amount || 0,
            count: paymentStats._count,
          },
          outstandingBalance: 
            orderStats.reduce((sum, stat) => sum + Number(stat._sum.grandTotal || 0), 0) - 
            Number(paymentStats._sum.amount || 0),
          favoriteProducts,
        },
      };
    }),

  // Create customer
  create: organizationProcedure
    .input(customerCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate customer code
      const existing = await ctx.prisma.customer.findFirst({
        where: { 
          organizationId: ctx.user.organizationId,
          customerCode: input.customerCode,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A customer with this code already exists',
        });
      }

      // Check for duplicate email
      const existingEmail = await ctx.prisma.customer.findFirst({
        where: { 
          organizationId: ctx.user.organizationId,
          email: input.email,
        },
      });

      if (existingEmail) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A customer with this email already exists',
        });
      }

      // Create customer with audit log
      const customer = await ctx.prisma.$transaction(async (tx) => {
        const newCustomer = await tx.customer.create({
          data: {
            ...input,
            organizationId: ctx.user.organizationId,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'customers',
            recordPk: newCustomer.id,
            action: 'CREATE',
            userId: ctx.user.id,
            afterData: newCustomer,
          },
        });

        // Create notification for sales team
        await tx.notification.create({
          data: {
            notifType: 'NEW_CUSTOMER',
            message: `New customer ${newCustomer.companyName || `${newCustomer.firstName} ${newCustomer.lastName}`} has been registered`,
            relatedTable: 'CUSTOMER',
            relatedId: newCustomer.id,
            userId: ctx.user.id,
          },
        });

        return newCustomer;
      });

      return customer;
    }),

  // Update customer
  update: organizationProcedure
    .input(customerUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Get current customer
      const currentCustomer = await ctx.prisma.customer.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!currentCustomer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        });
      }

      // Check for code uniqueness if updating
      if (data.customerCode && data.customerCode !== currentCustomer.customerCode) {
        const existing = await ctx.prisma.customer.findFirst({
          where: { 
            organizationId: ctx.user.organizationId,
            customerCode: data.customerCode,
          },
        });

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A customer with this code already exists',
          });
        }
      }

      // Check for email uniqueness if updating
      if (data.email && data.email !== currentCustomer.email) {
        const existingEmail = await ctx.prisma.customer.findFirst({
          where: { 
            organizationId: ctx.user.organizationId,
            email: data.email,
          },
        });

        if (existingEmail) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A customer with this email already exists',
          });
        }
      }

      // Update customer with audit log
      const updatedCustomer = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.customer.update({
          where: { id },
          data,
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'customers',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: currentCustomer,
            afterData: updated,
          },
        });

        return updated;
      });

      return updatedCustomer;
    }),

  // Delete/deactivate customer
  delete: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      force: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators and managers can delete customers',
        });
      }

      // Check for active orders
      const activeOrders = await ctx.prisma.order.count({
        where: {
          customerId: input.id,
          status: { in: ['PENDING', 'CONFIRMED', 'PICKING'] },
        },
      });

      if (activeOrders > 0 && !input.force) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot delete customer with ${activeOrders} active orders`,
        });
      }

      // Get the customer before deletion
      const currentCustomer = await ctx.prisma.customer.findFirst({
        where: { 
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!currentCustomer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        });
      }

      // Delete customer
      const result = await ctx.prisma.$transaction(async (tx) => {
        const deleted = await tx.customer.delete({
          where: { id: input.id },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'customers',
            recordPk: input.id,
            action: 'DELETE',
            userId: ctx.user.id,
            beforeData: currentCustomer,
            afterData: undefined,
          },
        });

        return deleted;
      });

      return result;
    }),

  // Customer addresses sub-router
  addresses: createTRPCRouter({
    // List addresses for a customer
    list: organizationProcedure
      .input(z.object({ customerId: z.string().cuid() }))
      .query(async ({ ctx, input }) => {
        const addresses = await ctx.prisma.address.findMany({
          where: { customerId: input.customerId },
          orderBy: [
            { isDefault: 'desc' },
            { addressType: 'asc' },
          ],
        });

        return addresses;
      }),

    // Create address
    create: organizationProcedure
      .input(addressSchema)
      .mutation(async ({ ctx, input }) => {
        // If marking as default, unmark others of same type
        if (input.isDefault) {
          await ctx.prisma.address.updateMany({
            where: {
              customerId: input.customerId,
              addressType: input.addressType === 'BOTH' 
                ? { in: ['BILLING', 'SHIPPING', 'BOTH'] }
                : input.addressType,
              isDefault: true,
            },
            data: { isDefault: false },
          });
        }

        const address = await ctx.prisma.address.create({
          data: input,
        });

        return address;
      }),

    // Update address
    update: organizationProcedure
      .input(z.object({
        id: z.string().cuid(),
        data: addressSchema.partial(),
      }))
      .mutation(async ({ ctx, input }) => {
        // If marking as default, unmark others
        if (input.data.isDefault) {
          const currentAddress = await ctx.prisma.address.findUnique({
            where: { id: input.id },
          });

          if (currentAddress) {
            await ctx.prisma.address.updateMany({
              where: {
                customerId: currentAddress.customerId,
                addressType: input.data.addressType || currentAddress.addressType,
                isDefault: true,
                id: { not: input.id },
              },
              data: { isDefault: false },
            });
          }
        }

        const updated = await ctx.prisma.address.update({
          where: { id: input.id },
          data: input.data,
        });

        return updated;
      }),

    // Delete address
    delete: organizationProcedure
      .input(z.object({ id: z.string().cuid() }))
      .mutation(async ({ ctx, input }) => {
        // Check if address is used in any orders
        // TODO: Implement order address tracking
        const ordersUsingAddress = 0;

        if (ordersUsingAddress > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Cannot delete address that is used in orders',
          });
        }

        const deleted = await ctx.prisma.address.delete({
          where: { id: input.id },
        });

        return deleted;
      }),

    // Validate address
    validate: organizationProcedure
      .input(addressSchema.omit({ customerId: true, isDefault: true }))
      .mutation(async ({ ctx, input }) => {
        // This could integrate with address validation services
        // For now, just return the input as valid
        return {
          valid: true,
          standardized: input,
          suggestions: [],
        };
      }),
  }),

  // Check customer credit
  checkCredit: organizationProcedure
    .input(creditCheckSchema)
    .query(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findFirst({
        where: { 
          id: input.customerId,
          organizationId: ctx.user.organizationId,
        },
        select: {
          defaultPaymentTerms: true,
        },
      });

      if (!customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Customer not found',
        });
      }

      // Get current outstanding balance
      const [orderTotal, paymentTotal] = await Promise.all([
        ctx.prisma.order.aggregate({
          where: {
            customerId: input.customerId,
            status: { in: ['PENDING', 'CONFIRMED', 'PICKING', 'SHIPPED'] },
          },
          _sum: { grandTotal: true },
        }),
        ctx.prisma.payment.aggregate({
          where: {
            order: { customerId: input.customerId },
            status: 'COMPLETED',
          },
          _sum: { amount: true },
        }),
      ]);

      const currentBalance = Number(orderTotal._sum.grandTotal || 0) - Number(paymentTotal._sum.amount || 0);
      const projectedBalance = currentBalance + input.orderAmount;

      const result = {
        creditLimit: 0, // TODO: Implement credit limit tracking
        currentBalance,
        projectedBalance,
        availableCredit: Infinity, // No credit limit implemented yet
        orderAmount: input.orderAmount,
        approved: true,
        reason: '',
      };

      // TODO: Implement credit limit checking

      return result;
    }),

  // Get customer metrics
  getMetrics: organizationProcedure
    .input(customerMetricsSchema)
    .query(async ({ ctx, input }) => {
      const { customerId, dateFrom, dateTo } = input;

      const where: Prisma.OrderWhereInput = {
        customerId,
        status: { in: ['SHIPPED', 'DELIVERED'] },
      };

      if (dateFrom || dateTo) {
        where.orderDate = {};
        if (dateFrom) where.orderDate.gte = dateFrom;
        if (dateTo) where.orderDate.lte = dateTo;
      }

      // Get orders and calculate metrics
      const orders = await ctx.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  category: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          shipments: true,
          returns: true,
          payments: true,
        },
      });

      // Calculate order metrics
      const orderMetrics = {
        count: orders.length,
        totalRevenue: orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
        avgOrderValue: orders.length > 0 
          ? orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0) / orders.length 
          : 0,
        totalItems: orders.reduce((sum, order) => 
          sum + order.items.reduce((itemSum, item) => itemSum + item.qtyOrdered, 0), 0
        ),
        returnRate: orders.length > 0
          ? (orders.filter(order => order.returns.length > 0).length / orders.length) * 100
          : 0,
      };

      // Calculate product metrics
      const productMap = new Map();
      for (const order of orders) {
        for (const item of order.items) {
          const key = item.itemId;
          if (!productMap.has(key)) {
            productMap.set(key, {
              ...item.item,
              quantity: 0,
              revenue: 0,
              orders: 0,
            });
          }
          const product = productMap.get(key);
          product.quantity += item.qtyOrdered;
          product.revenue += item.totalPrice;
          product.orders += 1;
        }
      }

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Calculate category distribution
      const categoryMap = new Map();
      for (const product of productMap.values()) {
        const category = product.category.name;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            name: category,
            quantity: 0,
            revenue: 0,
            orders: 0,
          });
        }
        const cat = categoryMap.get(category);
        cat.quantity += product.quantity;
        cat.revenue += product.revenue;
        cat.orders += product.orders;
      }

      const categoryDistribution = Array.from(categoryMap.values())
        .sort((a, b) => b.revenue - a.revenue);

      // Calculate time-based metrics
      const ordersByMonth = orders.reduce((acc, order) => {
        const month = order.orderDate.toISOString().substring(0, 7);
        if (!acc[month]) {
          acc[month] = {
            month,
            count: 0,
            revenue: 0,
          };
        }
        acc[month].count += 1;
        acc[month].revenue += order.grandTotal || 0;
        return acc;
      }, {} as Record<string, any>);

      // Calculate fulfillment metrics
      const fulfillmentMetrics = {
        avgDaysToShip: 0,
        avgDaysToDeliver: 0,
        onTimeDeliveryRate: 0,
      };

      let shippedCount = 0;
      let deliveredCount = 0;
      let totalDaysToShip = 0;
      let totalDaysToDeliver = 0;
      let onTimeDeliveries = 0;

      for (const order of orders) {
        if (order.shipments.length > 0) {
          const firstShipment = order.shipments[0];
          if (firstShipment.shipDate) {
            const daysToShip = Math.floor(
              (firstShipment.shipDate.getTime() - order.orderDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            totalDaysToShip += daysToShip;
            shippedCount++;
          }

          // TODO: Track delivery date when implemented
          if (firstShipment.status === 'DELIVERED') {
            deliveredCount++;
            // Check if delivered on time based on expected delivery
            if (order.requestedShipDate && firstShipment.expectedDelivery && 
                firstShipment.expectedDelivery <= order.requestedShipDate) {
              onTimeDeliveries++;
            }
          }
        }
      }

      if (shippedCount > 0) {
        fulfillmentMetrics.avgDaysToShip = totalDaysToShip / shippedCount;
      }
      if (deliveredCount > 0) {
        fulfillmentMetrics.avgDaysToDeliver = totalDaysToDeliver / deliveredCount;
        fulfillmentMetrics.onTimeDeliveryRate = (onTimeDeliveries / deliveredCount) * 100;
      }

      return {
        period: {
          from: dateFrom || orders[orders.length - 1]?.orderDate,
          to: dateTo || orders[0]?.orderDate,
        },
        orderMetrics,
        topProducts,
        categoryDistribution,
        orderTrend: Object.values(ordersByMonth).sort((a: any, b: any) => a.month.localeCompare(b.month)),
        fulfillmentMetrics,
      };
    }),

  // Get customer recommendations
  getRecommendations: organizationProcedure
    .input(z.object({ customerId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      // Get customer's purchase history
      const orderItems = await ctx.prisma.orderItem.findMany({
        where: {
          order: {
            customerId: input.customerId,
            status: { in: ['SHIPPED', 'DELIVERED'] },
          },
        },
        include: {
          item: {
            include: {
              category: true,
            },
          },
        },
      });

      // Extract purchased items and categories
      const purchasedItemIds = new Set(orderItems.map(oi => oi.itemId));
      const purchasedCategories = new Map();

      for (const orderItem of orderItems) {
        const categoryId = orderItem.item.categoryId;
        purchasedCategories.set(
          categoryId,
          (purchasedCategories.get(categoryId) || 0) + orderItem.qtyOrdered
        );
      }

      // Sort categories by purchase frequency
      const topCategories = Array.from(purchasedCategories.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([categoryId]) => categoryId);

      // Get recommendations based on categories
      const recommendations = await ctx.prisma.item.findMany({
        where: {
          categoryId: { in: topCategories },
          id: { notIn: Array.from(purchasedItemIds) },
          isActive: true,
        },
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
        take: 20,
      });

      // Calculate availability and score
      const scoredRecommendations = recommendations.map(item => {
        const totalStock = item.inventory.reduce((sum: number, inv) => sum + inv.qtyOnHand, 0);
        const totalAvailable = item.inventory.reduce(
          (sum: number, inv) => sum + (inv.qtyOnHand - inv.qtyReserved), 0
        );

        // Score based on category purchase frequency
        const categoryScore = purchasedCategories.get(item.categoryId) || 0;

        return {
          ...item,
          stock: {
            total: totalStock,
            available: totalAvailable,
          },
          score: categoryScore,
          reason: `Popular in ${item.category.name} category`,
        };
      });

      // Sort by score and availability
      scoredRecommendations.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return b.stock.available - a.stock.available;
      });

      // Also get frequently bought together items
      const frequentlyBoughtTogether = await ctx.prisma.$queryRaw<Array<{
        item_id: string;
        co_occurrence_count: bigint;
      }>>`
        SELECT 
          oi2.item_id,
          COUNT(*) as co_occurrence_count
        FROM order_items oi1
        JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.item_id != oi2.item_id
        JOIN orders o ON oi1.order_id = o.id
        WHERE 
          o.customer_id = ${input.customerId}
          AND o.status IN ('SHIPPED', 'DELIVERED')
          AND oi1.item_id IN (${Prisma.join(Array.from(purchasedItemIds))})
          AND oi2.item_id NOT IN (${Prisma.join(Array.from(purchasedItemIds))})
        GROUP BY oi2.item_id
        ORDER BY co_occurrence_count DESC
        LIMIT 10
      `;

      const crossSellItems = [];
      if (frequentlyBoughtTogether.length > 0) {
        const itemIds = frequentlyBoughtTogether.map(row => row.item_id);
        const items = await ctx.prisma.item.findMany({
          where: {
            id: { in: itemIds },
            isActive: true,
          },
          include: {
            category: true,
            unitOfMeasure: true,
          },
        });

        for (const row of frequentlyBoughtTogether) {
          const item = items.find(i => i.id === row.item_id);
          if (item) {
            crossSellItems.push({
              ...item,
              coOccurrenceCount: Number(row.co_occurrence_count),
              reason: 'Frequently bought together',
            });
          }
        }
      }

      return {
        recommendations: scoredRecommendations.slice(0, 10),
        crossSellItems,
      };
    }),

  // Merge duplicate customers
  merge: organizationProcedure
    .input(z.object({
      primaryId: z.string().cuid(),
      duplicateId: z.string().cuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can merge customers',
        });
      }

      // Get both customers
      const [primary, duplicate] = await Promise.all([
        ctx.prisma.customer.findUnique({ where: { id: input.primaryId } }),
        ctx.prisma.customer.findUnique({ where: { id: input.duplicateId } }),
      ]);

      if (!primary || !duplicate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or both customers not found',
        });
      }

      // Merge in a transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Update all related records to point to primary customer
        await Promise.all([
          tx.address.updateMany({
            where: { customerId: input.duplicateId },
            data: { customerId: input.primaryId },
          }),
          tx.order.updateMany({
            where: { customerId: input.duplicateId },
            data: { customerId: input.primaryId },
          }),
          tx.return.updateMany({
            where: { customerId: input.duplicateId },
            data: { customerId: input.primaryId },
          }),
        ]);

        // Update primary customer with any missing data
        const updateData: any = {};
        if (!primary.companyName && duplicate.companyName) {
          updateData.companyName = duplicate.companyName;
        }
        if (!primary.taxId && duplicate.taxId) {
          updateData.taxId = duplicate.taxId;
        }
        if (!primary.website && duplicate.website) {
          updateData.website = duplicate.website;
        }
        // Remove creditLimit - field doesn't exist

        let updatedPrimary = primary;
        if (Object.keys(updateData).length > 0) {
          updatedPrimary = await tx.customer.update({
            where: { id: input.primaryId },
            data: updateData,
          });
        }

        // Delete duplicate customer
        await tx.customer.delete({
          where: { id: input.duplicateId },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'customers',
            recordPk: input.primaryId,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: primary,
            afterData: {
              ...updatedPrimary,
              mergedFrom: input.duplicateId,
            },
          },
        });

        return updatedPrimary;
      });

      return {
        success: true,
        customer: result,
        message: `Successfully merged customer ${duplicate.customerCode} into ${primary.customerCode}`,
      };
    }),

  // Export customers
  export: organizationProcedure
    .input(z.object({
      filters: customerFilterSchema,
      format: z.enum(['csv', 'excel']).default('csv'),
      includeAddresses: z.boolean().default(false),
      includeMetrics: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get customers with filters
      const customers = await ctx.prisma.customer.findMany({
        where: {
          ...input.filters as any,
          organizationId: ctx.user.organizationId,
        },
        include: {
          addresses: input.includeAddresses,
          _count: {
            select: {
              orders: true,
            },
          },
        },
      });

      // Prepare export data
      let exportData = customers.map(customer => ({
        id: customer.id,
        code: customer.customerCode,
        companyName: customer.companyName || '',
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone || '',
        // mobile field not in schema
        taxId: customer.taxId || '',
        defaultPaymentTerms: customer.defaultPaymentTerms || '',
        orderCount: customer._count.orders,
        createdAt: customer.createdAt.toISOString(),
      }));

      // Add metrics if requested
      if (input.includeMetrics) {
        exportData = await Promise.all(
          exportData.map(async (customer) => {
            const orderStats = await ctx.prisma.order.aggregate({
              where: {
                customerId: customer.id,
                status: { in: ['SHIPPED', 'DELIVERED'] },
              },
              _sum: { grandTotal: true },
              _count: true,
            });

            return {
              ...customer,
              lifetimeRevenue: orderStats._sum.grandTotal || 0,
              completedOrders: orderStats._count,
            };
          })
        );
      }

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          tableName: 'customers',
          recordPk: 'EXPORT',
          action: 'CREATE',
          userId: ctx.user.id,
          afterData: {
            format: input.format,
            recordCount: exportData.length,
            filters: input.filters,
            includeAddresses: input.includeAddresses,
            includeMetrics: input.includeMetrics,
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