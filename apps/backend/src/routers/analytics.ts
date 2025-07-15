import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

import type { Prisma } from '@ventry/database';

// Input validation schemas
const timeRangeSchema = z.object({
  period: z.enum(['today', 'yesterday', 'last7days', 'last30days', 'last90days', 'last365days', 'custom']).default('last30days'),
  customFrom: z.date().optional(),
  customTo: z.date().optional(),
  compareWith: z.enum(['previous', 'lastYear', 'none']).default('none'),
});

const metricsFilterSchema = z.object({
  warehouseIds: z.array(z.string().cuid()).optional(),
  includeAllWarehouses: z.boolean().default(true),
  categoryIds: z.array(z.string().cuid()).optional(),
  includeInactive: z.boolean().default(false),
});

export const analyticsRouter = createTRPCRouter({
  // Main Dashboard Analytics
  dashboard: organizationProcedure
    .input(z.object({
      ...timeRangeSchema.shape,
      ...metricsFilterSchema.shape,
    }))
    .query(async ({ ctx, input }) => {
      const { period, customFrom, customTo, compareWith, warehouseIds, includeAllWarehouses, categoryIds } = input;

      // Calculate date ranges
      const now = new Date();
      let dateFrom: Date;
      let dateTo: Date = now;

      switch (period) {
        case 'today':
          dateFrom = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'yesterday':
          dateFrom = new Date(now.setDate(now.getDate() - 1));
          dateFrom.setHours(0, 0, 0, 0);
          dateTo = new Date(dateFrom);
          dateTo.setHours(23, 59, 59, 999);
          break;
        case 'last7days':
          dateFrom = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'last30days':
          dateFrom = new Date(now.setDate(now.getDate() - 30));
          break;
        case 'last90days':
          dateFrom = new Date(now.setDate(now.getDate() - 90));
          break;
        case 'last365days':
          dateFrom = new Date(now.setDate(now.getDate() - 365));
          break;
        case 'custom':
          dateFrom = customFrom || new Date(now.setDate(now.getDate() - 30));
          dateTo = customTo || now;
          break;
        default:
          dateFrom = new Date(now.setDate(now.getDate() - 30));
      }

      // Get comparison period if needed
      let compareDateFrom: Date | null = null;
      let compareDateTo: Date | null = null;

      if (compareWith !== 'none') {
        const periodDays = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
        
        if (compareWith === 'previous') {
          compareDateTo = new Date(dateFrom.getTime() - 1);
          compareDateFrom = new Date(compareDateTo.getTime() - periodDays * 24 * 60 * 60 * 1000);
        } else if (compareWith === 'lastYear') {
          compareDateFrom = new Date(dateFrom);
          compareDateFrom.setFullYear(compareDateFrom.getFullYear() - 1);
          compareDateTo = new Date(dateTo);
          compareDateTo.setFullYear(compareDateTo.getFullYear() - 1);
        }
      }

      // Build warehouse filter
      const warehouseFilter = includeAllWarehouses ? {} : {
        location: {
          warehouseId: { in: warehouseIds || [] },
        },
      };

      // 1. Inventory Metrics
      const currentInventory = await ctx.prisma.inventory.aggregate({
        where: {
          ...warehouseFilter,
          ...(categoryIds?.length ? {
            item: {
              categoryId: { in: categoryIds },
            },
          } : {}),
        },
        _sum: {
          qtyOnHand: true,
          qtyReserved: true,
          qtyInTransit: true,
        },
      });

      // Get inventory value
      const inventoryValue = await ctx.prisma.inventory.findMany({
        where: {
          ...warehouseFilter,
          qtyOnHand: { gt: 0 },
        },
        include: {
          item: true,
        },
      }).then(inventory => 
        inventory.reduce((sum, inv) => 
          sum + (inv.qtyOnHand * Number(inv.item.defaultPrice || 0)), 0
        )
      );

      // 2. Sales Metrics
      const orderCount = await ctx.prisma.order.count({
        where: {
          orderDate: {
            gte: dateFrom,
            lte: dateTo,
          },
          status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
        },
      });
      const salesMetrics = await ctx.prisma.order.aggregate({
        where: {
          orderDate: {
            gte: dateFrom,
            lte: dateTo,
          },
          status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
        },
        _sum: {
          grandTotal: true,
        },
      });

      // Get comparison sales if needed
      let compareOrderCount = 0;
      let compareSalesMetrics = null;
      if (compareDateFrom && compareDateTo) {
        compareOrderCount = await ctx.prisma.order.count({
          where: {
            orderDate: {
              gte: compareDateFrom,
              lte: compareDateTo,
            },
            status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
          },
        });
        compareSalesMetrics = await ctx.prisma.order.aggregate({
          where: {
            orderDate: {
              gte: compareDateFrom,
              lte: compareDateTo,
            },
            status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
          },
          _sum: {
            grandTotal: true,
          },
        });
      }

      // 3. Purchase Metrics
      const purchaseMetrics = await ctx.prisma.purchaseOrder.aggregate({
        where: {
          orderDate: {
            gte: dateFrom,
            lte: dateTo,
          },
          status: { in: ['APPROVED', 'PARTIAL', 'RECEIVED'] },
        },
        _count: true,
        _sum: {
          total: true,
        },
      });

      // 4. Stock Movement Metrics
      const stockMovements = await ctx.prisma.stockMovement.groupBy({
        by: ['movementType'],
        where: {
          movedAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        _count: true,
        _sum: {
          qty: true,
        },
      });

      // 5. Low Stock Count
      const lowStockCount = await ctx.prisma.item.count({
        where: {
          isActive: true,
          inventory: {
            some: {
              qtyOnHand: {
                lte: 10, // TODO: Add reorderPoint to Item model
              },
            },
          },
        },
      });

      // 6. Expiring Items Count
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // TODO: Add expiration tracking to Lot model
      const expiringItemsCount = 0;

      // 7. Active Items/Customers/Suppliers
      const activeCounts = await Promise.all([
        ctx.prisma.item.count({ where: { isActive: true } }),
        ctx.prisma.customer.count({}),
        ctx.prisma.supplier.count({}),
      ]);

      // Calculate changes if comparing
      const calculateChange = (current: number, previous: number | null) => {
        if (!previous || previous === 0) return null;
        return ((current - previous) / previous) * 100;
      };

      return {
        period: {
          from: dateFrom,
          to: dateTo,
          label: period,
        },
        comparison: compareDateFrom && compareDateTo ? {
          from: compareDateFrom,
          to: compareDateTo,
          type: compareWith,
        } : null,
        inventory: {
          totalValue: inventoryValue,
          totalOnHand: currentInventory._sum?.qtyOnHand || 0,
          totalAvailable: (currentInventory._sum?.qtyOnHand || 0) - (currentInventory._sum?.qtyReserved || 0),
          totalAllocated: 0, // TODO: Track allocated quantity
          totalReserved: currentInventory._sum?.qtyReserved || 0,
          lowStockItems: lowStockCount,
          expiringItems: expiringItemsCount,
        },
        sales: {
          orderCount: orderCount,
          totalRevenue: Number(salesMetrics._sum?.grandTotal || 0),
          avgOrderValue: orderCount > 0 
            ? Number(salesMetrics._sum?.grandTotal || 0) / orderCount 
            : 0,
          change: compareSalesMetrics 
            ? calculateChange(Number(salesMetrics._sum?.grandTotal || 0), Number(compareSalesMetrics._sum?.grandTotal || 0))
            : null,
        },
        purchases: {
          orderCount: purchaseMetrics._count,
          totalSpend: Number(purchaseMetrics._sum?.total || 0),
          avgOrderValue: purchaseMetrics._count > 0 
            ? Number(purchaseMetrics._sum?.total || 0) / purchaseMetrics._count 
            : 0,
        },
        operations: {
          receipts: stockMovements.find(m => m.movementType === 'INBOUND')?._count || 0,
          shipments: stockMovements.find(m => m.movementType === 'OUTBOUND')?._count || 0,
          adjustments: stockMovements.find(m => m.movementType === 'ADJUSTMENT')?._count || 0,
          transfers: stockMovements.find(m => m.movementType === 'TRANSFER')?._count || 0,
          returns: stockMovements.find(m => m.movementType === 'RETURN')?._count || 0,
        },
        entities: {
          activeItems: activeCounts[0],
          activeCustomers: activeCounts[1],
          activeSuppliers: activeCounts[2],
        },
      };
    }),

  // Sales Trends Analysis
  trends: organizationProcedure
    .input(z.object({
      ...timeRangeSchema.shape,
      groupBy: z.enum(['day', 'week', 'month']).default('day'),
      metric: z.enum(['revenue', 'orders', 'quantity', 'customers']).default('revenue'),
      itemIds: z.array(z.string().cuid()).optional(),
      categoryIds: z.array(z.string().cuid()).optional(),
      customerIds: z.array(z.string().cuid()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { period, customFrom, customTo, groupBy, metric, itemIds, categoryIds, customerIds } = input;

      // Calculate date range
      const now = new Date();
      let dateFrom: Date;
      let dateTo: Date = now;

      // (Similar date calculation logic as dashboard)
      switch (period) {
        case 'today':
          dateFrom = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'yesterday':
          dateFrom = new Date(now.setDate(now.getDate() - 1));
          dateFrom.setHours(0, 0, 0, 0);
          dateTo = new Date(dateFrom);
          dateTo.setHours(23, 59, 59, 999);
          break;
        case 'last7days':
          dateFrom = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'last30days':
          dateFrom = new Date(now.setDate(now.getDate() - 30));
          break;
        case 'last90days':
          dateFrom = new Date(now.setDate(now.getDate() - 90));
          break;
        case 'last365days':
          dateFrom = new Date(now.setDate(now.getDate() - 365));
          break;
        case 'custom':
          dateFrom = customFrom || new Date(now.setDate(now.getDate() - 30));
          dateTo = customTo || now;
          break;
        default:
          dateFrom = new Date(now.setDate(now.getDate() - 30));
      }

      // Build order filters
      const orderWhere: Prisma.OrderWhereInput = {
        orderDate: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
        ...(customerIds?.length ? { customerId: { in: customerIds } } : {}),
      };

      // Get orders with items
      const orders = await ctx.prisma.order.findMany({
        where: orderWhere,
        include: {
          items: {
            where: {
              ...(itemIds?.length ? { itemId: { in: itemIds } } : {}),
              ...(categoryIds?.length ? { item: { categoryId: { in: categoryIds } } } : {}),
            },
            include: {
              item: true,
            },
          },
        },
      });

      // Group data by time period
      const groupedData = new Map<string, any>();

      orders.forEach(order => {
        let groupKey: string;
        const orderDate = new Date(order.orderDate);

        switch (groupBy) {
          case 'day':
            groupKey = orderDate.toISOString().split('T')[0];
            break;
          case 'week':
            const weekStart = new Date(orderDate);
            weekStart.setDate(orderDate.getDate() - orderDate.getDay());
            groupKey = weekStart.toISOString().split('T')[0];
            break;
          case 'month':
            groupKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
            break;
        }

        if (!groupedData.has(groupKey)) {
          groupedData.set(groupKey, {
            period: groupKey,
            revenue: 0,
            orders: 0,
            quantity: 0,
            customers: new Set(),
          });
        }

        const data = groupedData.get(groupKey)!;
        data.orders++;
        data.customers.add(order.customerId);

        // Calculate based on filtered items
        const filteredRevenue = order.items.reduce((sum: number, item: any) => sum + Number(item.totalPrice), 0);
        const filteredQuantity = order.items.reduce((sum: number, item: any) => sum + item.qtyOrdered, 0);

        data.revenue += filteredRevenue;
        data.quantity += filteredQuantity;
      });

      // Convert to array and sort by period
      const trendData = Array.from(groupedData.values())
        .map(d => ({
          period: d.period,
          value: metric === 'revenue' ? d.revenue :
                 metric === 'orders' ? d.orders :
                 metric === 'quantity' ? d.quantity :
                 d.customers.size,
          orders: d.orders,
          revenue: d.revenue,
          quantity: d.quantity,
          customers: d.customers.size,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      // Calculate summary statistics
      const values = trendData.map(d => d.value);
      const summary = {
        total: values.reduce((sum, v) => sum + v, 0),
        average: values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0,
        min: values.length > 0 ? Math.min(...values) : 0,
        max: values.length > 0 ? Math.max(...values) : 0,
        trend: values.length > 1 ? 
          ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0,
      };

      return {
        period: {
          from: dateFrom,
          to: dateTo,
        },
        metric,
        groupBy,
        summary,
        data: trendData,
      };
    }),

  // Key Performance Indicators
  kpis: organizationProcedure
    .input(z.object({
      ...timeRangeSchema.shape,
      kpiTypes: z.array(z.enum([
        'inventoryTurnover',
        'stockAccuracy',
        'orderFulfillmentRate',
        'onTimeDeliveryRate',
        'supplierPerformance',
        'customerSatisfaction',
        'grossMargin',
        'operatingMargin',
      ])).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { period, customFrom, customTo, kpiTypes } = input;

      // Calculate date range
      const now = new Date();
      let dateFrom: Date;
      let dateTo: Date = now;

      switch (period) {
        case 'last30days':
          dateFrom = new Date(now.setDate(now.getDate() - 30));
          break;
        case 'custom':
          dateFrom = customFrom || new Date(now.setDate(now.getDate() - 30));
          dateTo = customTo || now;
          break;
        default:
          dateFrom = new Date(now.setDate(now.getDate() - 30));
      }

      const requestedKPIs = kpiTypes || [
        'inventoryTurnover',
        'stockAccuracy',
        'orderFulfillmentRate',
        'onTimeDeliveryRate',
        'supplierPerformance',
        'grossMargin',
      ];

      const kpis: Record<string, any> = {};

      // 1. Inventory Turnover
      if (requestedKPIs.includes('inventoryTurnover')) {
        const shipments = await ctx.prisma.stockMovement.aggregate({
          where: {
            movementType: 'OUTBOUND',
            movedAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
          _sum: {
            qty: true,
          },
        });

        const avgInventory = await ctx.prisma.inventory.aggregate({
          _avg: {
            qtyOnHand: true,
          },
        });

        const daysInPeriod = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
        const annualizationFactor = 365 / daysInPeriod;
        const annualizedShipments = (shipments._sum.qty || 0) * annualizationFactor;
        const turnoverRate = avgInventory._avg.qtyOnHand && avgInventory._avg.qtyOnHand > 0
          ? annualizedShipments / avgInventory._avg.qtyOnHand
          : 0;

        kpis.inventoryTurnover = {
          name: 'Inventory Turnover',
          value: Math.round(turnoverRate * 10) / 10,
          unit: 'times/year',
          target: 12,
          status: turnoverRate >= 12 ? 'good' : turnoverRate >= 6 ? 'warning' : 'poor',
          description: 'How many times inventory is sold and replaced per year',
        };
      }

      // 2. Stock Accuracy
      if (requestedKPIs.includes('stockAccuracy')) {
        // Count adjustments as indicator of inaccuracy
        const adjustments = await ctx.prisma.stockMovement.count({
          where: {
            movementType: 'ADJUSTMENT',
            movedAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
        });

        const totalMovements = await ctx.prisma.stockMovement.count({
          where: {
            movedAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
        });

        const accuracy = totalMovements > 0 
          ? ((totalMovements - adjustments) / totalMovements) * 100
          : 100;

        kpis.stockAccuracy = {
          name: 'Stock Accuracy',
          value: Math.round(accuracy * 10) / 10,
          unit: '%',
          target: 99,
          status: accuracy >= 99 ? 'good' : accuracy >= 95 ? 'warning' : 'poor',
          description: 'Percentage of stock movements without adjustments',
        };
      }

      // 3. Order Fulfillment Rate
      if (requestedKPIs.includes('orderFulfillmentRate')) {
        const totalOrders = await ctx.prisma.order.count({
          where: {
            orderDate: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
        });

        const fulfilledOrders = await ctx.prisma.order.count({
          where: {
            orderDate: {
              gte: dateFrom,
              lte: dateTo,
            },
            status: { in: ['SHIPPED', 'DELIVERED'] },
          },
        });

        const fulfillmentRate = totalOrders > 0 
          ? (fulfilledOrders / totalOrders) * 100
          : 0;

        kpis.orderFulfillmentRate = {
          name: 'Order Fulfillment Rate',
          value: Math.round(fulfillmentRate * 10) / 10,
          unit: '%',
          target: 95,
          status: fulfillmentRate >= 95 ? 'good' : fulfillmentRate >= 85 ? 'warning' : 'poor',
          description: 'Percentage of orders successfully shipped',
        };
      }

      // 4. On-Time Delivery Rate
      if (requestedKPIs.includes('onTimeDeliveryRate')) {
        const deliveredShipments = await ctx.prisma.shipment.findMany({
          where: {
            updatedAt: { // Use updatedAt for delivered date
              gte: dateFrom,
              lte: dateTo,
            },
            expectedDelivery: { not: null },
          },
          select: {
            updatedAt: true,
            expectedDelivery: true,
            status: true,
          },
        });

        const onTimeCount = deliveredShipments.filter(s => 
          s.status === 'DELIVERED' && s.expectedDelivery &&
          s.updatedAt <= s.expectedDelivery
        ).length;

        const onTimeRate = deliveredShipments.length > 0
          ? (onTimeCount / deliveredShipments.length) * 100
          : 100;

        kpis.onTimeDeliveryRate = {
          name: 'On-Time Delivery Rate',
          value: Math.round(onTimeRate * 10) / 10,
          unit: '%',
          target: 90,
          status: onTimeRate >= 90 ? 'good' : onTimeRate >= 80 ? 'warning' : 'poor',
          description: 'Percentage of deliveries made on or before promised date',
        };
      }

      // 5. Supplier Performance
      if (requestedKPIs.includes('supplierPerformance')) {
        const receipts = await ctx.prisma.receipt.findMany({
          where: {
            receivedDate: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
          include: {
            purchaseOrder: true,
          },
        });

        const onTimeReceipts = receipts.filter(r => 
          r.purchaseOrder?.expectedDate &&
          r.receivedDate <= r.purchaseOrder.expectedDate
        ).length;

        const supplierScore = receipts.length > 0
          ? (onTimeReceipts / receipts.length) * 100
          : 100;

        kpis.supplierPerformance = {
          name: 'Supplier Performance',
          value: Math.round(supplierScore * 10) / 10,
          unit: '%',
          target: 85,
          status: supplierScore >= 85 ? 'good' : supplierScore >= 75 ? 'warning' : 'poor',
          description: 'Percentage of purchase orders received on time',
        };
      }

      // 6. Gross Margin
      if (requestedKPIs.includes('grossMargin')) {
        const sales = await ctx.prisma.order.aggregate({
          where: {
            orderDate: {
              gte: dateFrom,
              lte: dateTo,
            },
            status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
          },
          _sum: {
            grandTotal: true,
          },
        });

        // Estimate COGS as 60% of sales (would use actual cost data in production)
        const revenue = Number(sales._sum?.grandTotal || 0);
        const cogs = revenue * 0.6;
        const grossProfit = revenue - cogs;
        const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        kpis.grossMargin = {
          name: 'Gross Margin',
          value: Math.round(grossMargin * 10) / 10,
          unit: '%',
          target: 40,
          status: grossMargin >= 40 ? 'good' : grossMargin >= 30 ? 'warning' : 'poor',
          description: 'Gross profit as percentage of revenue',
        };
      }

      return {
        period: {
          from: dateFrom,
          to: dateTo,
        },
        kpis,
      };
    }),

  // Predictive Analytics
  predictions: organizationProcedure
    .input(z.object({
      predictionType: z.enum(['demand', 'stockout', 'reorder', 'seasonal']),
      horizonDays: z.number().int().min(1).max(365).default(30),
      itemIds: z.array(z.string().cuid()).optional(),
      categoryIds: z.array(z.string().cuid()).optional(),
      confidenceLevel: z.number().min(0.5).max(0.99).default(0.95),
    }))
    .query(async ({ ctx, input }) => {
      const { predictionType, horizonDays, itemIds, categoryIds, confidenceLevel } = input;

      // Get historical data for prediction
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const itemWhere: Prisma.ItemWhereInput = {
        isActive: true,
        ...(itemIds?.length ? { id: { in: itemIds } } : {}),
        ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
      };

      const items = await ctx.prisma.item.findMany({
        where: itemWhere,
        include: {
          category: true,
        },
      });

      const predictions: any[] = [];

      for (const item of items) {
        if (predictionType === 'demand') {
          // Get historical sales with raw query
          const historicalSales = await ctx.prisma.$queryRaw<any[]>`
            SELECT 
              DATE(o."order_date") as orderDate,
              SUM(oi."qty_ordered") as _sum
            FROM "order_items" oi
            JOIN "orders" o ON oi."order_id" = o.id
            WHERE oi."item_id" = ${item.id}
              AND o."order_date" >= ${ninetyDaysAgo}
              AND o.status IN ('CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED')
            GROUP BY DATE(o."order_date")
            ORDER BY DATE(o."order_date")
          `;

          // Simple linear regression for demand prediction
          const salesData = historicalSales.map((s, index) => ({
            day: index,
            quantity: Number(s._sum) || 0,
          }));

          const avgDailySales = salesData.length > 0
            ? salesData.reduce((sum, s) => sum + s.quantity, 0) / salesData.length
            : 0;

          // Calculate trend
          let trend = 0;
          if (salesData.length > 1) {
            const n = salesData.length;
            const sumX = salesData.reduce((sum, s) => sum + s.day, 0);
            const sumY = salesData.reduce((sum, s) => sum + s.quantity, 0);
            const sumXY = salesData.reduce((sum, s) => sum + s.day * s.quantity, 0);
            const sumX2 = salesData.reduce((sum, s) => sum + s.day * s.day, 0);

            trend = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
          }

          const predictedDemand = avgDailySales * horizonDays + (trend * horizonDays * horizonDays / 2);
          const stdDev = Math.sqrt(
            salesData.reduce((sum, s) => sum + Math.pow(s.quantity - avgDailySales, 2), 0) / 
            Math.max(1, salesData.length - 1)
          );

          const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645;
          const margin = zScore * stdDev * Math.sqrt(horizonDays);

          predictions.push({
            item: {
              id: item.id,
              sku: item.sku,
              name: item.name,
              category: item.category?.name,
            },
            type: 'demand',
            prediction: {
              value: Math.round(predictedDemand),
              lowerBound: Math.max(0, Math.round(predictedDemand - margin)),
              upperBound: Math.round(predictedDemand + margin),
              confidence: confidenceLevel * 100,
              trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
            },
            historicalData: {
              avgDailySales: Math.round(avgDailySales * 10) / 10,
              dataPoints: salesData.length,
            },
          });

        } else if (predictionType === 'stockout') {
          // Get current inventory
          const inventory = await ctx.prisma.inventory.aggregate({
            where: { itemId: item.id },
            _sum: {
              qtyOnHand: true,
              qtyReserved: true,
            },
          });

          // Get average daily usage
          const usage = await ctx.prisma.stockMovement.aggregate({
            where: {
              itemId: item.id,
              movementType: 'OUTBOUND',
              movedAt: { gte: ninetyDaysAgo },
            },
            _sum: {
              qty: true,
            },
            _count: true,
          });

          const avgDailyUsage = usage._count > 0 
            ? (usage._sum.qty || 0) / 90
            : 0;

          const currentStock = (inventory._sum?.qtyOnHand || 0) - (inventory._sum?.qtyReserved || 0);
          const daysUntilStockout = avgDailyUsage > 0 
            ? currentStock / avgDailyUsage
            : Infinity;

          const stockoutProbability = 
            daysUntilStockout <= horizonDays ? 
              Math.min(100, (horizonDays - daysUntilStockout) / horizonDays * 100) : 0;

          predictions.push({
            item: {
              id: item.id,
              sku: item.sku,
              name: item.name,
              category: item.category?.name,
            },
            type: 'stockout',
            prediction: {
              daysUntilStockout: Math.round(daysUntilStockout),
              probability: Math.round(stockoutProbability),
              riskLevel: stockoutProbability > 75 ? 'high' : 
                         stockoutProbability > 25 ? 'medium' : 'low',
              currentStock,
              avgDailyUsage: Math.round(avgDailyUsage * 10) / 10,
            },
          });

        } else if (predictionType === 'reorder') {
          // Get lead time from recent POs
          const recentPOs = await ctx.prisma.purchaseOrderItem.findMany({
            where: {
              itemId: item.id,
              purchaseOrder: {
                status: { in: ['APPROVED', 'PARTIAL', 'RECEIVED'] },
              },
            },
            include: {
              purchaseOrder: true,
            },
            orderBy: {
              purchaseOrder: {
                orderDate: 'desc',
              },
            },
            take: 5,
          });

          const leadTimes = recentPOs
            .filter(po => po.purchaseOrder.status === 'RECEIVED')
            .map(po => {
              const days = Math.ceil(
                (po.purchaseOrder.updatedAt.getTime() - po.purchaseOrder.orderDate.getTime()) / 
                (1000 * 60 * 60 * 24)
              );
              return days;
            });

          const avgLeadTime = leadTimes.length > 0
            ? leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length
            : 14; // Default 2 weeks

          // Get usage data
          const usage = await ctx.prisma.stockMovement.aggregate({
            where: {
              itemId: item.id,
              movementType: 'OUTBOUND',
              movedAt: { gte: ninetyDaysAgo },
            },
            _sum: {
              qty: true,
            },
          });

          const avgDailyUsage = (usage._sum.qty || 0) / 90;
          const safetyStock = avgDailyUsage * 7; // 1 week safety stock
          const reorderPoint = (avgDailyUsage * avgLeadTime) + safetyStock;
          const reorderQuantity = avgDailyUsage * 30; // 1 month supply

          // Get current stock
          const currentStock = await ctx.prisma.inventory.aggregate({
            where: { itemId: item.id },
            _sum: {
              qtyOnHand: true,
              qtyReserved: true,
            },
          });

          const shouldReorder = ((currentStock._sum?.qtyOnHand || 0) - (currentStock._sum?.qtyReserved || 0)) <= reorderPoint;

          predictions.push({
            item: {
              id: item.id,
              sku: item.sku,
              name: item.name,
              category: item.category?.name,
            },
            type: 'reorder',
            prediction: {
              shouldReorder,
              reorderPoint: Math.round(reorderPoint),
              reorderQuantity: Math.round(reorderQuantity),
              currentStock: (currentStock._sum?.qtyOnHand || 0) - (currentStock._sum?.qtyReserved || 0),
              avgLeadTimeDays: Math.round(avgLeadTime),
              safetyStock: Math.round(safetyStock),
            },
          });

        } else if (predictionType === 'seasonal') {
          // Analyze seasonal patterns
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

          const monthlySales = await ctx.prisma.$queryRaw<any[]>`
            SELECT 
              EXTRACT(MONTH FROM o."order_date") as month,
              SUM(oi."qty_ordered") as quantity
            FROM "order_items" oi
            JOIN "orders" o ON oi."order_id" = o.id
            WHERE oi."item_id" = ${item.id}
              AND o."order_date" >= ${oneYearAgo}
              AND o.status IN ('CONFIRMED', 'PICKING', 'SHIPPED', 'DELIVERED')
            GROUP BY EXTRACT(MONTH FROM o."order_date")
            ORDER BY month
          `;

          const monthlyData = Array(12).fill(0);
          monthlySales.forEach(ms => {
            monthlyData[ms.month - 1] = Number(ms.quantity);
          });

          const avgMonthlySales = monthlyData.reduce((sum, q) => sum + q, 0) / 12;
          const seasonalFactors = monthlyData.map(q => 
            avgMonthlySales > 0 ? q / avgMonthlySales : 1
          );

          const currentMonth = new Date().getMonth();
          const targetMonth = new Date();
          targetMonth.setDate(targetMonth.getDate() + horizonDays);
          const targetMonthIndex = targetMonth.getMonth();

          const predictedDemand = avgMonthlySales * seasonalFactors[targetMonthIndex];

          predictions.push({
            item: {
              id: item.id,
              sku: item.sku,
              name: item.name,
              category: item.category?.name,
            },
            type: 'seasonal',
            prediction: {
              targetMonth: targetMonth.toLocaleString('default', { month: 'long' }),
              expectedDemand: Math.round(predictedDemand),
              seasonalFactor: Math.round(seasonalFactors[targetMonthIndex] * 100) / 100,
              trend: seasonalFactors[targetMonthIndex] > 1.2 ? 'peak' :
                     seasonalFactors[targetMonthIndex] < 0.8 ? 'low' : 'normal',
            },
            historicalData: {
              monthlyAverage: Math.round(avgMonthlySales),
              seasonalPattern: monthlyData,
            },
          });
        }
      }

      // Sort predictions by importance
      predictions.sort((a, b) => {
        if (predictionType === 'stockout') {
          return b.prediction.probability - a.prediction.probability;
        } else if (predictionType === 'reorder') {
          return a.prediction.shouldReorder ? -1 : 1;
        }
        return 0;
      });

      return {
        predictionType,
        horizonDays,
        confidenceLevel: confidenceLevel * 100,
        predictions,
        summary: {
          totalItems: predictions.length,
          ...(predictionType === 'stockout' && {
            highRisk: predictions.filter(p => p.prediction.riskLevel === 'high').length,
            mediumRisk: predictions.filter(p => p.prediction.riskLevel === 'medium').length,
            lowRisk: predictions.filter(p => p.prediction.riskLevel === 'low').length,
          }),
          ...(predictionType === 'reorder' && {
            needsReorder: predictions.filter(p => p.prediction.shouldReorder).length,
          }),
        },
      };
    }),

  // Anomaly Detection
  anomalies: organizationProcedure
    .input(z.object({
      anomalyType: z.enum(['price', 'quantity', 'movement', 'pattern']),
      sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
      lookbackDays: z.number().int().min(7).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const { anomalyType, sensitivity, lookbackDays } = input;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const anomalies: any[] = [];

      // Sensitivity thresholds
      const thresholds = {
        low: { zscore: 3, percentile: 0.99 },
        medium: { zscore: 2.5, percentile: 0.95 },
        high: { zscore: 2, percentile: 0.90 },
      };

      const threshold = thresholds[sensitivity];

      if (anomalyType === 'price') {
        // Detect unusual pricing in orders
        const orderItems = await ctx.prisma.orderItem.findMany({
          where: {
            order: {
              orderDate: { gte: startDate },
            },
          },
          include: {
            item: true,
            order: true,
          },
        });

        // Group by item and calculate statistics
        const itemPrices = new Map<string, number[]>();
        orderItems.forEach(oi => {
          if (!itemPrices.has(oi.itemId)) {
            itemPrices.set(oi.itemId, []);
          }
          itemPrices.get(oi.itemId)!.push(Number(oi.unitPrice));
        });

        // Detect anomalies
        itemPrices.forEach((prices, itemId) => {
          if (prices.length < 5) return; // Need sufficient data

          const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
          const stdDev = Math.sqrt(variance);

          // Find outliers
          orderItems
            .filter(oi => oi.itemId === itemId)
            .forEach(oi => {
              const zScore = stdDev > 0 ? Math.abs((Number(oi.unitPrice) - mean) / stdDev) : 0;
              if (zScore > threshold.zscore) {
                anomalies.push({
                  type: 'price',
                  severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
                  item: {
                    id: oi.item.id,
                    sku: oi.item.sku,
                    name: oi.item.name,
                  },
                  details: {
                    orderNumber: oi.order.orderNumber,
                    date: oi.order.orderDate,
                    anomalousPrice: Number(oi.unitPrice),
                    normalPrice: mean,
                    deviation: `${Math.round((Number(oi.unitPrice) - mean) / mean * 100)}%`,
                    zScore: Math.round(zScore * 10) / 10,
                  },
                });
              }
            });
        });

      } else if (anomalyType === 'quantity') {
        // Detect unusual order quantities
        const movements = await ctx.prisma.stockMovement.findMany({
          where: {
            movedAt: { gte: startDate },
            movementType: { in: ['OUTBOUND', 'INBOUND'] },
          },
          include: {
            item: true,
          },
        });

        // Group by item and type
        const itemMovements = new Map<string, number[]>();
        movements.forEach(m => {
          const key = `${m.itemId}-${m.movementType}`;
          if (!itemMovements.has(key)) {
            itemMovements.set(key, []);
          }
          itemMovements.get(key)!.push(m.qty);
        });

        // Detect anomalies
        itemMovements.forEach((quantities, key) => {
          if (quantities.length < 5) return;

          const [itemId, type] = key.split('-');
          const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
          const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
          const stdDev = Math.sqrt(variance);

          movements
            .filter(m => m.itemId === itemId && m.movementType === type)
            .forEach(m => {
              const zScore = stdDev > 0 ? Math.abs((m.qty - mean) / stdDev) : 0;
              if (zScore > threshold.zscore) {
                anomalies.push({
                  type: 'quantity',
                  severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
                  item: m.item ? {
                    id: m.item.id,
                    sku: m.item.sku,
                    name: m.item.name,
                  } : {
                    id: m.itemId,
                    sku: 'Unknown',
                    name: 'Unknown Item',
                  },
                  details: {
                    movementType: m.movementType,
                    date: m.movedAt,
                    anomalousQuantity: m.qty,
                    normalQuantity: Math.round(mean),
                    deviation: `${Math.round((m.qty - mean) / mean * 100)}%`,
                    zScore: Math.round(zScore * 10) / 10,
                  },
                });
              }
            });
        });

      } else if (anomalyType === 'movement') {
        // Detect unusual movement patterns
        const dailyMovements = await ctx.prisma.$queryRaw<any[]>`
          SELECT 
            DATE("moved_at") as date,
            "item_id",
            "movement_type",
            COUNT(*) as count,
            SUM(qty) as total_quantity
          FROM "stock_movements"
          WHERE "moved_at" >= ${startDate}
          GROUP BY DATE("moved_at"), "item_id", "movement_type"
        `;

        // Analyze patterns
        const patterns = new Map<string, any[]>();
        dailyMovements.forEach(dm => {
          const key = `${dm.itemId}-${dm.movementType}`;
          if (!patterns.has(key)) {
            patterns.set(key, []);
          }
          patterns.get(key)!.push({
            date: dm.date,
            count: Number(dm.count),
            quantity: Number(dm.total_quantity),
          });
        });

        // Detect unusual days
        patterns.forEach((days, key) => {
          if (days.length < 7) return;

          const [itemId, type] = key.split('-');
          const counts = days.map(d => d.count);
          const meanCount = counts.reduce((sum, c) => sum + c, 0) / counts.length;

          // Find days with unusual activity
          days.forEach(day => {
            if (day.count > meanCount * 3 || (meanCount > 0 && day.count === 0)) {
              anomalies.push({
                type: 'movement',
                severity: day.count > meanCount * 5 ? 'high' : 'medium',
                details: {
                  date: day.date,
                  movementType: type,
                  unusualPattern: day.count === 0 ? 'no_activity' : 'high_activity',
                  movementCount: day.count,
                  normalCount: Math.round(meanCount),
                  totalQuantity: day.quantity,
                },
              });
            }
          });
        });

      } else if (anomalyType === 'pattern') {
        // Detect unusual ordering patterns
        const customers = await ctx.prisma.customer.findMany({});

        for (const customer of customers) {
          // Get customer's order history
          const orders = await ctx.prisma.order.findMany({
            where: {
              customerId: customer.id,
              orderDate: { gte: startDate },
            },
            orderBy: { orderDate: 'asc' },
          });

          if (orders.length < 3) continue;

          // Calculate intervals between orders
          const intervals: number[] = [];
          for (let i = 1; i < orders.length; i++) {
            const days = Math.ceil(
              (orders[i].orderDate.getTime() - orders[i-1].orderDate.getTime()) / 
              (1000 * 60 * 60 * 24)
            );
            intervals.push(days);
          }

          const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
          const lastOrderDays = Math.ceil(
            (new Date().getTime() - orders[orders.length - 1].orderDate.getTime()) / 
            (1000 * 60 * 60 * 24)
          );

          // Detect unusual patterns
          if (lastOrderDays > avgInterval * 2.5) {
            anomalies.push({
              type: 'pattern',
              severity: lastOrderDays > avgInterval * 3 ? 'high' : 'medium',
              customer: {
                id: customer.id,
                name: customer.companyName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
                email: customer.email,
              },
              details: {
                lastOrderDate: orders[orders.length - 1].orderDate,
                daysSinceLastOrder: lastOrderDays,
                avgOrderInterval: Math.round(avgInterval),
                pattern: 'delayed_order',
                risk: 'customer_churn',
              },
            });
          }
        }
      }

      // Sort by severity
      anomalies.sort((a, b) => {
        const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
      });

      return {
        anomalyType,
        sensitivity,
        lookbackDays,
        anomalies,
        summary: {
          total: anomalies.length,
          high: anomalies.filter(a => a.severity === 'high').length,
          medium: anomalies.filter(a => a.severity === 'medium').length,
          low: anomalies.filter(a => a.severity === 'low').length,
        },
      };
    }),

  // Real-time Activity Feed
  // NOTE: Activity model not included in current schema
  // TODO: Implement activity tracking when model is added
  /*
  activityFeed: protectedProcedure
    .input(z.object({
      entityTypes: z.array(z.enum([
        'ORDER', 'PURCHASE_ORDER', 'SHIPMENT', 'RECEIPT', 
        'RETURN', 'STOCK_MOVEMENT', 'ITEM', 'CUSTOMER', 'SUPPLIER'
      ])).optional(),
      activityTypes: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { entityTypes, activityTypes, limit, offset } = input;

      const where: Prisma.ActivityWhereInput = {};

      if (entityTypes?.length) {
        where.entityType = { in: entityTypes };
      }

      if (activityTypes?.length) {
        where.type = { in: activityTypes };
      }

      const activities = await ctx.prisma.activity.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      // Format activities for display
      const formattedActivities = activities.map(activity => ({
        id: activity.id,
        timestamp: activity.timestamp,
        type: activity.type,
        entityType: activity.entityType,
        entityId: activity.entityId,
        description: activity.description,
        user: {
          id: activity.user.id,
          email: activity.user.email,
          name: activity.user.profile 
            ? `${activity.user.profile.firstName} ${activity.user.profile.lastName}`
            : activity.user.email,
        },
        metadata: activity.metadata,
        icon: getActivityIcon(activity.type),
        color: getActivityColor(activity.type),
      }));

      // Get total count
      const totalCount = await ctx.prisma.activity.count({ where });

      return {
        activities: formattedActivities,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      };
    }),
  */

  // Warehouse Performance Analytics
  warehouseAnalytics: organizationProcedure
    .input(z.object({
      warehouseId: z.string().cuid(),
      ...timeRangeSchema.shape,
    }))
    .query(async ({ ctx, input }) => {
      const { warehouseId, period, customFrom, customTo } = input;

      // Get warehouse details
      const warehouse = await ctx.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        include: {
          locations: {
            include: {
              inventory: {
                include: {
                  item: true,
                },
              },
            },
          },
        },
      });

      if (!warehouse) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Warehouse not found',
        });
      }

      // Calculate date range
      const now = new Date();
      let dateFrom: Date;
      let dateTo: Date = now;

      switch (period) {
        case 'last30days':
          dateFrom = new Date(now.setDate(now.getDate() - 30));
          break;
        case 'custom':
          dateFrom = customFrom || new Date(now.setDate(now.getDate() - 30));
          dateTo = customTo || now;
          break;
        default:
          dateFrom = new Date(now.setDate(now.getDate() - 30));
      }

      // Calculate space utilization
      const totalLocations = warehouse.locations.length;
      const occupiedLocations = warehouse.locations.filter(loc => 
        loc.inventory.some(inv => inv.qtyOnHand > 0)
      ).length;
      const utilizationRate = totalLocations > 0 ? (occupiedLocations / totalLocations) * 100 : 0;

      // Calculate inventory value
      const inventoryValue = warehouse.locations.reduce((sum, loc) => 
        sum + loc.inventory.reduce((locSum, inv) => 
          locSum + (inv.qtyOnHand * (Number(inv.item.defaultPrice) || 0)), 0
        ), 0
      );

      // Get movement statistics
      const movements = await ctx.prisma.stockMovement.groupBy({
        by: ['movementType'],
        where: {
          OR: [
            { fromLocationId: { in: await getWarehouseLocationIds(ctx, warehouseId) } },
            { toLocationId: { in: await getWarehouseLocationIds(ctx, warehouseId) } },
          ],
          movedAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        _count: true,
        _sum: {
          qty: true,
        },
      });

      // Get top items by movement
      const topMovedItems = await ctx.prisma.$queryRaw<any[]>`
        SELECT 
          i.id,
          i.sku,
          i.name,
          COUNT(sm.id) as movement_count,
          SUM(sm.qty) as total_quantity
        FROM "stock_movements" sm
        JOIN "items" i ON sm."item_id" = i.id
        JOIN "locations" l ON (sm."from_location_id" = l.id OR sm."to_location_id" = l.id)
        WHERE l."warehouse_id" = ${warehouseId}
          AND sm."moved_at" >= ${dateFrom}
          AND sm."moved_at" <= ${dateTo}
        GROUP BY i.id, i.sku, i.name
        ORDER BY movement_count DESC
        LIMIT 10
      `;

      // Calculate pick/pack efficiency
      const shipments = await ctx.prisma.shipment.count({
        where: {
          items: {
            some: {
              item: {
                inventory: {
                  some: {
                    location: {
                      warehouseId,
                    },
                  },
                },
              },
            },
          },
          shipDate: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      });

      const daysInPeriod = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
      const avgShipmentsPerDay = shipments / daysInPeriod;

      return {
        warehouse: {
          id: warehouse.id,
          name: warehouse.name,
          type: 'MAIN', // TODO: Add warehouse type to schema
        },
        period: {
          from: dateFrom,
          to: dateTo,
        },
        space: {
          totalLocations,
          occupiedLocations,
          availableLocations: totalLocations - occupiedLocations,
          utilizationRate: Math.round(utilizationRate * 10) / 10,
          totalCapacity: warehouse.locations.reduce((sum, loc) => sum + (loc.maxCapacity || 0), 0),
        },
        inventory: {
          totalValue: inventoryValue,
          totalItems: warehouse.locations.reduce((sum, loc) => 
            sum + loc.inventory.length, 0
          ),
          totalQuantity: warehouse.locations.reduce((sum, loc) => 
            sum + loc.inventory.reduce((locSum, inv) => 
              locSum + inv.qtyOnHand, 0
            ), 0
          ),
        },
        movements: movements.map(m => ({
          type: m.movementType,
          count: m._count,
          quantity: m._sum.qty || 0,
        })),
        efficiency: {
          avgShipmentsPerDay: Math.round(avgShipmentsPerDay * 10) / 10,
          topMovedItems: topMovedItems.map(item => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            movementCount: Number(item.movement_count),
            totalQuantity: Number(item.total_quantity),
          })),
        },
      };
    }),
});

// Helper functions
async function getWarehouseLocationIds(ctx: any, warehouseId: string): Promise<string[]> {
  const locations = await ctx.prisma.location.findMany({
    where: { warehouseId },
    select: { id: true },
  });
  return locations.map((loc: any) => loc.id);
}

function getActivityIcon(type: string): string {
  const iconMap: Record<string, string> = {
    ORDER_CREATED: '🛒',
    ORDER_CONFIRMED: '✅',
    ORDER_SHIPPED: '📦',
    ORDER_DELIVERED: '✔️',
    SHIPMENT_CREATED: '🚚',
    RECEIPT_CREATED: '📥',
    RETURN_CREATED: '↩️',
    STOCK_ADJUSTED: '📊',
    ITEM_CREATED: '➕',
    CUSTOMER_CREATED: '👤',
    SUPPLIER_CREATED: '🏭',
  };
  return iconMap[type] || '📌';
}

function getActivityColor(type: string): string {
  if (type.includes('CREATED')) return 'green';
  if (type.includes('UPDATED')) return 'blue';
  if (type.includes('DELETED') || type.includes('CANCELLED')) return 'red';
  if (type.includes('SHIPPED') || type.includes('DELIVERED')) return 'purple';
  return 'gray';
}