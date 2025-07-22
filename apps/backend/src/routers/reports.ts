import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

import type { Prisma } from '@ventry/database';

// Input validation schemas
const dateRangeSchema = z.object({
  dateFrom: z.date(),
  dateTo: z.date(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
});

const warehouseFilterSchema = z.object({
  warehouseIds: z.array(z.string().cuid()).optional(),
  includeAllWarehouses: z.boolean().default(true),
});

const itemFilterSchema = z.object({
  itemIds: z.array(z.string().cuid()).optional(),
  categoryIds: z.array(z.string().cuid()).optional(),
  includeInactive: z.boolean().default(false),
});

const customerFilterSchema = z.object({
  customerIds: z.array(z.string().cuid()).optional(),
  customerTypes: z.array(z.enum(['B2B', 'B2C', 'DISTRIBUTOR', 'RETAIL'])).optional(),
});

const supplierFilterSchema = z.object({
  supplierIds: z.array(z.string().cuid()).optional(),
  includeInactive: z.boolean().default(false),
});

const reportExportSchema = z.object({
  format: z.enum(['csv', 'json', 'pdf', 'excel']).default('csv'),
  email: z.string().email().optional(),
});

export const reportsRouter = createTRPCRouter({
  // Inventory Valuation Report
  inventoryValuation: organizationProcedure
    .input(z.object({
      asOfDate: z.date().default(() => new Date()),
      ...warehouseFilterSchema.shape,
      ...itemFilterSchema.shape,
      valuationMethod: z.enum(['FIFO', 'LIFO', 'AVERAGE']).default('AVERAGE'),
      groupBy: z.enum(['item', 'category', 'warehouse', 'location']).default('item'),
    }))
    .query(async ({ ctx, input }) => {
      const { asOfDate, warehouseIds, includeAllWarehouses, itemIds, categoryIds, includeInactive, valuationMethod, groupBy } = input;

      // Build filters
      const inventoryWhere: Prisma.InventoryWhereInput = {
        qtyOnHand: { gt: 0 },
        item: {
          organizationId: ctx.user.organizationId,
        },
      };

      if (!includeAllWarehouses && warehouseIds?.length) {
        inventoryWhere.location = {
          warehouseId: { in: warehouseIds },
        };
      }

      if (itemIds?.length) {
        inventoryWhere.itemId = { in: itemIds };
      }

      if (categoryIds?.length || !includeInactive) {
        inventoryWhere.item = {
          organizationId: ctx.user.organizationId,
          ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
          ...(includeInactive ? {} : { isActive: true }),
        };
      }

      // Get inventory data
      const inventory = await ctx.prisma.inventory.findMany({
        where: inventoryWhere,
        include: {
          item: {
            include: {
              category: true,
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

      // Calculate valuation based on method
      const valuationData = await Promise.all(inventory.map(async (inv) => {
        let unitCost = 0;

        if (valuationMethod === 'AVERAGE') {
          // Get average cost from recent receipts
          const recentReceipts = await ctx.prisma.receiptItem.findMany({
            where: {
              itemId: inv.itemId,
              receipt: {
                receivedDate: { lte: asOfDate },
                purchaseOrder: {
                  organizationId: ctx.user.organizationId,
                },
              },
            },
            orderBy: { receipt: { receivedDate: 'desc' } },
            take: 10,
          });

          if (recentReceipts.length > 0) {
            const totalCost = recentReceipts.reduce((sum, r) => 
              sum + Number(r.unitCost) * r.qtyReceived, 0
            );
            const totalQty = recentReceipts.reduce((sum, r) => sum + r.qtyReceived, 0);
            unitCost = totalQty > 0 ? totalCost / totalQty : 0;
          }
        } else if (valuationMethod === 'FIFO') {
          // Get oldest receipts first
          const receipts = await ctx.prisma.receiptItem.findMany({
            where: {
              itemId: inv.itemId,
              receipt: {
                receivedDate: { lte: asOfDate },
                purchaseOrder: {
                  organizationId: ctx.user.organizationId,
                },
              },
            },
            orderBy: { receipt: { receivedDate: 'asc' } },
          });

          let remainingQty = inv.qtyOnHand;
          let totalValue = 0;

          for (const receipt of receipts) {
            if (remainingQty <= 0) break;
            const qtyToUse = Math.min(remainingQty, receipt.qtyReceived);
            totalValue += qtyToUse * Number(receipt.unitCost);
            remainingQty -= qtyToUse;
          }

          unitCost = inv.qtyOnHand > 0 ? totalValue / inv.qtyOnHand : 0;
        } else if (valuationMethod === 'LIFO') {
          // Get newest receipts first
          const receipts = await ctx.prisma.receiptItem.findMany({
            where: {
              itemId: inv.itemId,
              receipt: {
                receivedDate: { lte: asOfDate },
                purchaseOrder: {
                  organizationId: ctx.user.organizationId,
                },
              },
            },
            orderBy: { receipt: { receivedDate: 'desc' } },
          });

          let remainingQty = inv.qtyOnHand;
          let totalValue = 0;

          for (const receipt of receipts) {
            if (remainingQty <= 0) break;
            const qtyToUse = Math.min(remainingQty, receipt.qtyReceived);
            totalValue += qtyToUse * Number(receipt.unitCost);
            remainingQty -= qtyToUse;
          }

          unitCost = inv.qtyOnHand > 0 ? totalValue / inv.qtyOnHand : 0;
        }

        // Use default cost if no cost found
        if (unitCost === 0) {
          unitCost = Number(inv.item.defaultCost) || 0;
        }

        return {
          itemId: inv.itemId,
          itemSku: inv.item.sku,
          itemName: inv.item.name,
          categoryName: inv.item.category?.name || 'Uncategorized',
          warehouseName: inv.location.warehouse?.name || 'Unknown',
          locationName: inv.location.code,
          quantityOnHand: inv.qtyOnHand,
          unitCost,
          totalValue: inv.qtyOnHand * unitCost,
          lotNumber: inv.lot?.lotNumber || null,
          expirationDate: inv.lot?.expirationDate || null,
        };
      }));

      // Group data based on groupBy parameter
      let groupedData: any[] = [];
      const summary = {
        totalValue: valuationData.reduce((sum, v) => sum + v.totalValue, 0),
        totalItems: valuationData.length,
        totalQuantity: valuationData.reduce((sum, v) => sum + v.quantityOnHand, 0),
      };

      if (groupBy === 'category') {
        const grouped = valuationData.reduce((acc, item) => {
          const key = item.categoryName;
          if (!acc[key]) {
            acc[key] = {
              category: key,
              items: [],
              totalValue: 0,
              totalQuantity: 0,
            };
          }
          acc[key].items.push(item);
          acc[key].totalValue += item.totalValue;
          acc[key].totalQuantity += item.quantityOnHand;
          return acc;
        }, {} as Record<string, any>);
        groupedData = Object.values(grouped);
      } else if (groupBy === 'warehouse') {
        const grouped = valuationData.reduce((acc, item) => {
          const key = item.warehouseName;
          if (!acc[key]) {
            acc[key] = {
              warehouse: key,
              items: [],
              totalValue: 0,
              totalQuantity: 0,
            };
          }
          acc[key].items.push(item);
          acc[key].totalValue += item.totalValue;
          acc[key].totalQuantity += item.quantityOnHand;
          return acc;
        }, {} as Record<string, any>);
        groupedData = Object.values(grouped);
      } else {
        groupedData = valuationData;
      }

      return {
        asOfDate,
        valuationMethod,
        summary,
        data: groupedData,
      };
    }),

  // Stock Movement Report
  stockMovement: organizationProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      ...warehouseFilterSchema.shape,
      ...itemFilterSchema.shape,
      movementTypes: z.array(z.enum(['INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'TRANSFER', 'RETURN', 'DAMAGE', 'LOSS'])).optional(),
      includeDetails: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, groupBy, warehouseIds, includeAllWarehouses, itemIds: filterItemIds, categoryIds, movementTypes, includeDetails } = input;

      // Build filters
      const movementWhere: Prisma.StockMovementWhereInput = {
        movedAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        item: {
          organizationId: ctx.user.organizationId,
        },
      };

      if (movementTypes?.length) {
        movementWhere.movementType = { in: movementTypes };
      }

      if (!includeAllWarehouses && warehouseIds?.length) {
        movementWhere.OR = [
          { fromLocation: { warehouseId: { in: warehouseIds } } },
          { toLocation: { warehouseId: { in: warehouseIds } } },
        ];
      }

      if (filterItemIds?.length) {
        movementWhere.itemId = { in: filterItemIds };
      }

      if (categoryIds?.length) {
        // Stock movements don't have direct item relation, need to filter by itemId
        const itemsInCategories = await ctx.prisma.item.findMany({
          where: {
            organizationId: ctx.user.organizationId,
            categoryId: { in: categoryIds },
          },
          select: { id: true },
        });
        const itemIdsInCategories = itemsInCategories.map(i => i.id);
        movementWhere.itemId = { in: itemIdsInCategories };
      }

      // Get movements
      const movements = await ctx.prisma.stockMovement.findMany({
        where: movementWhere,
        include: {
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
          movedBy: true,
        },
        orderBy: { movedAt: 'desc' },
      });

      // Get item details for movements
      const movementItemIds = [...new Set(movements.map(m => m.itemId))];
      const items = await ctx.prisma.item.findMany({
        where: { id: { in: movementItemIds } },
        include: { category: true },
      });
      const itemMap = new Map(items.map(i => [i.id, i]));

      // Calculate summary by movement type
      const summaryByType = movements.reduce((acc, movement) => {
        if (!acc[movement.movementType]) {
          acc[movement.movementType] = {
            type: movement.movementType,
            count: 0,
            totalQuantity: 0,
          };
        }
        acc[movement.movementType].count++;
        acc[movement.movementType].totalQuantity += movement.qty;
        return acc;
      }, {} as Record<string, any>);

      // Calculate item movements
      const itemMovements = movements.reduce((acc, movement) => {
        const key = movement.itemId;
        if (!acc[key]) {
          const item = itemMap.get(movement.itemId);
          acc[key] = {
            item: {
              id: item?.id || movement.itemId,
              sku: item?.sku || 'Unknown',
              name: item?.name || 'Unknown',
              category: item?.category?.name || 'Unknown',
            },
            receipts: 0,
            shipments: 0,
            adjustments: 0,
            transfers: 0,
            returns: 0,
            netChange: 0,
          };
        }

        switch (movement.movementType) {
          case 'INBOUND':
            acc[key].receipts += movement.qty;
            acc[key].netChange += movement.qty;
            break;
          case 'OUTBOUND':
            acc[key].shipments += movement.qty;
            acc[key].netChange -= movement.qty;
            break;
          case 'ADJUSTMENT':
            acc[key].adjustments += movement.qty;
            acc[key].netChange += movement.qty;
            break;
          case 'TRANSFER':
            acc[key].transfers += movement.qty;
            // Net change is 0 for transfers (moves between locations)
            break;
          case 'RETURN':
            acc[key].returns += movement.qty;
            acc[key].netChange += movement.qty;
            break;
        }

        return acc;
      }, {} as Record<string, any>);

      // Get opening and closing balances
      const itemIdsList = Object.keys(itemMovements);
      const openingBalances = await ctx.prisma.stockMovement.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: itemIdsList },
          movedAt: { lt: dateFrom },
          item: {
            organizationId: ctx.user.organizationId,
          },
        },
        _sum: {
          qty: true,
        },
      });

      const currentInventory = await ctx.prisma.inventory.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: itemIdsList },
        },
        _sum: {
          qtyOnHand: true,
        },
      });

      // Enhance item movements with balances
      Object.values(itemMovements).forEach((item: any) => {
        const opening = openingBalances.find(b => b.itemId === item.item.id);
        const current = currentInventory.find(i => i.itemId === item.item.id);
        
        item.openingBalance = opening?._sum.qty || 0;
        item.closingBalance = current?._sum.qtyOnHand || 0;
      });

      return {
        period: {
          from: dateFrom,
          to: dateTo,
        },
        summary: {
          totalMovements: movements.length,
          byType: Object.values(summaryByType),
        },
        itemMovements: Object.values(itemMovements),
        details: includeDetails ? movements : undefined,
      };
    }),

  // Low Stock Alert Report
  lowStockAlert: organizationProcedure
    .input(z.object({
      ...warehouseFilterSchema.shape,
      ...itemFilterSchema.shape,
      includeSufficientStock: z.boolean().default(false),
      daysOfSupply: z.number().int().min(1).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const { warehouseIds, includeAllWarehouses, itemIds, categoryIds, includeInactive, includeSufficientStock, daysOfSupply } = input;

      // Build filters
      const itemWhere: Prisma.ItemWhereInput = {
        organizationId: ctx.user.organizationId,
        isActive: includeInactive ? undefined : true,
      };

      if (itemIds?.length) {
        itemWhere.id = { in: itemIds };
      }

      if (categoryIds?.length) {
        itemWhere.categoryId = { in: categoryIds };
      }

      // Get items with inventory and calculate stock status
      const items = await ctx.prisma.item.findMany({
        where: itemWhere,
        include: {
          category: true,
          inventory: {
            where: {
              ...(includeAllWarehouses ? {} : {
                location: {
                  warehouseId: { in: warehouseIds || [] },
                },
              }),
            },
            include: {
              location: {
                include: {
                  warehouse: true,
                },
              },
            },
          },
        },
      });

      // Calculate average daily usage for each item
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stockAnalysis = await Promise.all(items.map(async (item) => {
        // Get shipments in last 30 days
        const recentShipments = await ctx.prisma.stockMovement.aggregate({
          where: {
            itemId: item.id,
            movementType: 'OUTBOUND',
            movedAt: { gte: thirtyDaysAgo },
          },
          _sum: {
            qty: true,
          },
          _count: true,
        });

        const avgDailyUsage = (recentShipments._sum.qty || 0) / 30;
        const totalOnHand = item.inventory.reduce((sum, inv) => sum + inv.qtyOnHand, 0);
        const totalAvailable = item.inventory.reduce((sum, inv) => sum + (inv.qtyOnHand - inv.qtyReserved), 0);
        const daysRemaining = avgDailyUsage > 0 ? totalAvailable / avgDailyUsage : Infinity;

        // Get pending orders
        const pendingOrders = await ctx.prisma.purchaseOrderItem.aggregate({
          where: {
            itemId: item.id,
            purchaseOrder: {
              status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
              organizationId: ctx.user.organizationId,
            },
          },
          _sum: {
            qtyOrdered: true,
          },
        });

        const stockStatus = 
          daysRemaining === 0 ? 'OUT_OF_STOCK' :
          daysRemaining < 7 ? 'CRITICAL' :
          daysRemaining < daysOfSupply ? 'LOW' :
          'SUFFICIENT';

        return {
          item: {
            id: item.id,
            sku: item.sku,
            name: item.name,
            category: item.category?.name,
            reorderPoint: item.reorderPoint,
            reorderQty: item.reorderQty,
          },
          inventory: {
            totalOnHand,
            totalAvailable,
            totalAllocated: totalOnHand - totalAvailable,
            byWarehouse: item.inventory.map(inv => ({
              warehouse: inv.location.warehouse?.name || 'Unknown',
              location: inv.location.code,
              onHand: inv.qtyOnHand,
              available: inv.qtyOnHand - inv.qtyReserved,
            })),
          },
          usage: {
            avgDailyUsage: Math.round(avgDailyUsage * 10) / 10,
            last30DaysTotal: recentShipments._sum.qty || 0,
            daysOfSupplyRemaining: Math.round(daysRemaining),
          },
          ordering: {
            pendingQuantity: pendingOrders._sum.qtyOrdered || 0,
            suggestedReorderQty: Math.max(
              item.reorderQty || 0,
              Math.ceil(avgDailyUsage * daysOfSupply) - totalAvailable - (pendingOrders._sum.qtyOrdered || 0)
            ),
          },
          status: stockStatus,
        };
      }));

      // Filter based on includeSufficientStock
      const filteredAnalysis = includeSufficientStock 
        ? stockAnalysis 
        : stockAnalysis.filter(a => a.status !== 'SUFFICIENT');

      // Sort by urgency
      filteredAnalysis.sort((a, b) => {
        const statusOrder: Record<string, number> = { 'OUT_OF_STOCK': 0, 'CRITICAL': 1, 'LOW': 2, 'SUFFICIENT': 3 };
        return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999) || 
               a.usage.daysOfSupplyRemaining - b.usage.daysOfSupplyRemaining;
      });

      // Calculate summary
      const summary = {
        totalItems: filteredAnalysis.length,
        outOfStock: filteredAnalysis.filter(a => a.status === 'OUT_OF_STOCK').length,
        critical: filteredAnalysis.filter(a => a.status === 'CRITICAL').length,
        low: filteredAnalysis.filter(a => a.status === 'LOW').length,
        sufficient: filteredAnalysis.filter(a => a.status === 'SUFFICIENT').length,
      };

      return {
        summary,
        items: filteredAnalysis,
        parameters: {
          daysOfSupply,
          includeSufficientStock,
        },
      };
    }),

  // Expiring Items Report
  expiringItems: organizationProcedure
    .input(z.object({
      ...warehouseFilterSchema.shape,
      ...itemFilterSchema.shape,
      daysAhead: z.number().int().min(1).default(90),
      includeExpired: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const { warehouseIds, includeAllWarehouses, itemIds, categoryIds, daysAhead, includeExpired } = input;

      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysAhead);

      // Build filters
      const inventoryWhere: Prisma.InventoryWhereInput = {
        lot: {
          expirationDate: includeExpired 
            ? { lte: expirationDate }
            : { lte: expirationDate, gte: new Date() },
        },
        qtyOnHand: { gt: 0 },
        item: {
          organizationId: ctx.user.organizationId,
        },
      };

      if (!includeAllWarehouses && warehouseIds?.length) {
        inventoryWhere.location = {
          warehouseId: { in: warehouseIds },
        };
      }

      if (itemIds?.length) {
        inventoryWhere.itemId = { in: itemIds };
      }

      if (categoryIds?.length) {
        inventoryWhere.item = {
          organizationId: ctx.user.organizationId,
          categoryId: { in: categoryIds },
        };
      }

      // Get expiring inventory
      const expiringInventory = await ctx.prisma.inventory.findMany({
        where: inventoryWhere,
        include: {
          item: {
            include: {
              category: true,
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

      // Sort by expiration date
      expiringInventory.sort((a, b) => {
        const aDate = a.lot?.expirationDate?.getTime() || Number.MAX_SAFE_INTEGER;
        const bDate = b.lot?.expirationDate?.getTime() || Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });

      // Group by expiration status
      const now = new Date();
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const sixtyDays = new Date();
      sixtyDays.setDate(sixtyDays.getDate() + 60);

      const grouped = expiringInventory.map(inv => {
        const daysUntilExpiry = inv.lot?.expirationDate 
          ? Math.ceil((inv.lot.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let status: string;
        if (!daysUntilExpiry || daysUntilExpiry < 0) {
          status = 'EXPIRED';
        } else if (daysUntilExpiry <= 30) {
          status = 'EXPIRING_SOON';
        } else if (daysUntilExpiry <= 60) {
          status = 'EXPIRING';
        } else {
          status = 'FUTURE';
        }

        // Get unit cost
        const unitCost = Number(inv.item.defaultCost) || 0;
        const totalValue = inv.qtyOnHand * unitCost;

        return {
          inventory: {
            id: inv.id,
            lotNumber: inv.lot?.lotNumber || null,
            expirationDate: inv.lot?.expirationDate || null,
            daysUntilExpiry,
            status,
          },
          item: {
            id: inv.item.id,
            sku: inv.item.sku,
            name: inv.item.name,
            category: inv.item.category?.name,
          },
          location: {
            warehouse: inv.location.warehouse?.name || 'Unknown',
            location: inv.location.code,
          },
          quantities: {
            onHand: inv.qtyOnHand,
            available: inv.qtyOnHand - inv.qtyReserved,
            allocated: inv.qtyReserved,
          },
          value: {
            unitCost,
            totalValue,
          },
        };
      });

      // Calculate summary
      const summary = {
        totalItems: grouped.length,
        expired: grouped.filter(g => g.inventory.status === 'EXPIRED').length,
        expiringSoon: grouped.filter(g => g.inventory.status === 'EXPIRING_SOON').length,
        expiring: grouped.filter(g => g.inventory.status === 'EXPIRING').length,
        totalValue: grouped.reduce((sum, g) => sum + g.value.totalValue, 0),
        totalQuantity: grouped.reduce((sum, g) => sum + g.quantities.onHand, 0),
      };

      return {
        summary,
        items: grouped,
        parameters: {
          daysAhead,
          includeExpired,
        },
      };
    }),

  // Sales Analysis Report
  salesAnalysis: organizationProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      ...customerFilterSchema.shape,
      ...itemFilterSchema.shape,
      groupByCustomer: z.boolean().default(false),
      groupByItem: z.boolean().default(true),
      includeReturns: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, groupBy, customerIds, customerTypes, itemIds, categoryIds, groupByCustomer, groupByItem, includeReturns } = input;

      // Build filters
      const orderWhere: Prisma.OrderWhereInput = {
        orderDate: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
        organizationId: ctx.user.organizationId,
      };

      if (customerIds?.length) {
        orderWhere.customerId = { in: customerIds };
      }

      // Customer type filtering not supported - no type field on Customer model
      // TODO: Add customer type field if needed

      // Get orders with items
      const orders = await ctx.prisma.order.findMany({
        where: orderWhere,
        include: {
          customer: true,
          items: {
            where: {
              ...(itemIds?.length ? { itemId: { in: itemIds } } : {}),
              ...(categoryIds?.length ? { item: { categoryId: { in: categoryIds } } } : {}),
            },
            include: {
              item: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      });

      // Get returns if included
      let returns: any[] = [];
      if (includeReturns) {
        returns = await ctx.prisma.return.findMany({
          where: {
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
            organizationId: ctx.user.organizationId,
            ...(customerIds?.length ? { customerId: { in: customerIds } } : {}),
          },
          include: {
            order: {
              include: {
                customer: true,
              },
            },
            items: {
              include: {
                item: true,
              },
            },
          },
        });
      }

      // Calculate sales data
      const salesData: any[] = [];
      
      if (groupByItem) {
        const itemSales = new Map<string, any>();

        // Process orders
        orders.forEach(order => {
          order.items.forEach(orderItem => {
            const key = orderItem.itemId;
            if (!itemSales.has(key)) {
              itemSales.set(key, {
                item: {
                  id: orderItem.item.id,
                  sku: orderItem.item.sku,
                  name: orderItem.item.name,
                  category: orderItem.item.category?.name,
                },
                quantitySold: 0,
                grossRevenue: 0,
                discountAmount: 0,
                netRevenue: 0,
                returnQuantity: 0,
                returnAmount: 0,
                customerCount: new Set(),
                orderCount: 0,
              });
            }

            const itemData = itemSales.get(key)!;
            itemData.quantitySold += orderItem.qtyOrdered;
            const grossAmount = Number(orderItem.unitPrice) * orderItem.qtyOrdered;
            const discountAmount = grossAmount * (Number(orderItem.discountPct) / 100);
            itemData.grossRevenue += grossAmount;
            itemData.discountAmount += discountAmount;
            itemData.netRevenue += Number(orderItem.totalPrice);
            itemData.customerCount.add(order.customerId);
            itemData.orderCount++;
          });
        });

        // Process returns
        returns.forEach(ret => {
          ret.items.forEach((returnItem: any) => {
            const itemData = itemSales.get(returnItem.itemId);
            if (itemData) {
              itemData.returnQuantity += returnItem.qtyReturned;
              // Estimate return amount based on average price
              const avgPrice = itemData.grossRevenue / itemData.quantitySold;
              itemData.returnAmount += returnItem.qtyReturned * avgPrice;
            }
          });
        });

        // Convert to array and calculate final metrics
        itemSales.forEach((data, key) => {
          data.customerCount = data.customerCount.size;
          data.avgOrderValue = data.netRevenue / data.orderCount;
          data.returnRate = data.quantitySold > 0 ? (data.returnQuantity / data.quantitySold) * 100 : 0;
          salesData.push(data);
        });
      }

      if (groupByCustomer) {
        const customerSales = new Map<string, any>();

        // Process orders
        orders.forEach(order => {
          const key = order.customerId;
          if (!customerSales.has(key)) {
            customerSales.set(key, {
              customer: {
                id: order.customer.id,
                name: order.customer.companyName || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Unnamed',
                email: order.customer.email || '',
              },
              orderCount: 0,
              itemCount: 0,
              grossRevenue: 0,
              discountAmount: 0,
              netRevenue: 0,
              returnCount: 0,
              returnAmount: 0,
            });
          }

          const customerData = customerSales.get(key)!;
          customerData.orderCount++;
          customerData.itemCount += order.items.reduce((sum, oi) => sum + oi.qtyOrdered, 0);
          customerData.grossRevenue += order.subtotal;
          customerData.discountAmount += Number(order.discountTotal || 0);
          customerData.netRevenue += Number(order.grandTotal);
        });

        // Process returns
        returns.forEach(ret => {
          const customerData = customerSales.get(ret.customerId);
          if (customerData) {
            customerData.returnCount++;
            // Calculate return amount from return items
            const returnValue = ret.items.reduce((sum: number, ri: any) => {
              return sum + Number(ri.refundAmount);
            }, 0);
            customerData.returnAmount += returnValue;
          }
        });

        // Convert to array and calculate metrics
        customerSales.forEach((data) => {
          data.avgOrderValue = data.orderCount > 0 ? data.netRevenue / data.orderCount : 0;
          data.returnRate = data.orderCount > 0 ? (data.returnCount / data.orderCount) * 100 : 0;
          salesData.push(data);
        });
      }

      // Calculate period summary
      const summary = {
        totalOrders: orders.length,
        totalCustomers: new Set(orders.map(o => o.customerId)).size,
        totalQuantity: orders.reduce((sum, o) => 
          sum + o.items.reduce((s, oi) => s + oi.qtyOrdered, 0), 0
        ),
        grossRevenue: orders.reduce((sum, o) => sum + Number(o.subtotal), 0),
        totalDiscounts: orders.reduce((sum, o) => sum + Number(o.discountTotal || 0), 0),
        netRevenue: orders.reduce((sum, o) => sum + Number(o.grandTotal), 0),
        avgOrderValue: orders.length > 0 ? 
          orders.reduce((sum, o) => sum + Number(o.grandTotal), 0) / orders.length : 0,
        returnCount: returns.length,
        returnRate: orders.length > 0 ? (returns.length / orders.length) * 100 : 0,
      };

      // Sort sales data by revenue
      salesData.sort((a, b) => b.netRevenue - a.netRevenue);

      return {
        period: {
          from: dateFrom,
          to: dateTo,
        },
        summary,
        data: salesData,
      };
    }),

  // Purchase Analysis Report
  purchaseAnalysis: organizationProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      ...supplierFilterSchema.shape,
      ...itemFilterSchema.shape,
      groupBySupplier: z.boolean().default(true),
      groupByItem: z.boolean().default(false),
      includeReturns: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, supplierIds, includeInactive, itemIds, categoryIds, groupBySupplier, groupByItem, includeReturns } = input;

      // Build filters
      const poWhere: Prisma.PurchaseOrderWhereInput = {
        orderDate: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: { in: ['APPROVED', 'RECEIVED'] },
        organizationId: ctx.user.organizationId,
      };

      if (supplierIds?.length) {
        poWhere.supplierId = { in: supplierIds };
      }

      if (!includeInactive) {
        // Supplier doesn't have isActive field - filter by active suppliers separately if needed
        // TODO: Add supplier status filtering if needed
      }

      // Get purchase orders
      const purchaseOrders = await ctx.prisma.purchaseOrder.findMany({
        where: poWhere,
        include: {
          supplier: true,
          items: {
            where: {
              ...(itemIds?.length ? { itemId: { in: itemIds } } : {}),
              ...(categoryIds?.length ? { item: { categoryId: { in: categoryIds } } } : {}),
            },
            include: {
              item: {
                include: {
                  category: true,
                },
              },
            },
          },
          receipts: {
            include: {
              items: true,
            },
          },
        },
      });

      // Get supplier returns if included
      let returns: any[] = [];
      if (includeReturns) {
        // Note: Returns are linked to customer orders, not supplier purchase orders
        // Supplier returns would need a different model or type field
        // For now, returns array remains empty for purchase analysis
        // TODO: Implement supplier returns if needed
      }

      // Calculate purchase data
      const purchaseData: any[] = [];

      if (groupBySupplier) {
        const supplierPurchases = new Map<string, any>();

        // Process purchase orders
        purchaseOrders.forEach(po => {
          const key = po.supplierId;
          if (!supplierPurchases.has(key)) {
            supplierPurchases.set(key, {
              supplier: {
                id: po.supplier.id,
                name: po.supplier.name,
                email: po.supplier.email,
              },
              poCount: 0,
              itemCount: 0,
              orderedQuantity: 0,
              receivedQuantity: 0,
              totalAmount: 0,
              onTimeDeliveries: 0,
              lateDeliveries: 0,
              returnCount: 0,
              returnQuantity: 0,
            });
          }

          const supplierData = supplierPurchases.get(key)!;
          supplierData.poCount++;
          supplierData.itemCount += po.items.length;
          supplierData.orderedQuantity += po.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
          supplierData.totalAmount += Number(po.total);

          // Calculate received quantities and delivery performance
          po.receipts.forEach(receipt => {
            const receivedQty = receipt.items.reduce((sum, ri) => sum + ri.qtyReceived, 0);
            supplierData.receivedQuantity += receivedQty;

            if (receipt.receivedDate && po.expectedDate) {
              if (receipt.receivedDate <= po.expectedDate) {
                supplierData.onTimeDeliveries++;
              } else {
                supplierData.lateDeliveries++;
              }
            }
          });
        });

        // Process returns - currently empty as returns are customer-based
        // TODO: Add supplier return handling if needed

        // Convert to array and calculate metrics
        supplierPurchases.forEach((data) => {
          data.fulfillmentRate = data.orderedQuantity > 0 ? 
            (data.receivedQuantity / data.orderedQuantity) * 100 : 0;
          data.onTimeRate = (data.onTimeDeliveries + data.lateDeliveries) > 0 ?
            (data.onTimeDeliveries / (data.onTimeDeliveries + data.lateDeliveries)) * 100 : 0;
          data.returnRate = data.receivedQuantity > 0 ?
            (data.returnQuantity / data.receivedQuantity) * 100 : 0;
          data.avgOrderValue = data.poCount > 0 ? data.totalAmount / data.poCount : 0;
          purchaseData.push(data);
        });
      }

      if (groupByItem) {
        const itemPurchases = new Map<string, any>();

        // Process purchase orders
        purchaseOrders.forEach(po => {
          po.items.forEach(poItem => {
            const key = poItem.itemId;
            if (!itemPurchases.has(key)) {
              itemPurchases.set(key, {
                item: {
                  id: poItem.item.id,
                  sku: poItem.item.sku,
                  name: poItem.item.name,
                  category: poItem.item.category?.name,
                },
                orderedQuantity: 0,
                receivedQuantity: 0,
                totalAmount: 0,
                avgUnitPrice: 0,
                minUnitPrice: Infinity,
                maxUnitPrice: 0,
                supplierCount: new Set(),
                poCount: 0,
              });
            }

            const itemData = itemPurchases.get(key)!;
            itemData.orderedQuantity += poItem.qtyOrdered;
            itemData.totalAmount += Number(poItem.totalCost);
            itemData.minUnitPrice = Math.min(itemData.minUnitPrice, Number(poItem.unitCost));
            itemData.maxUnitPrice = Math.max(itemData.maxUnitPrice, Number(poItem.unitCost));
            itemData.supplierCount.add(po.supplierId);
            itemData.poCount++;

            // Get received quantity for this item from all receipts
            const receivedQty = po.receipts.reduce((sum, receipt) => {
              const receiptItem = receipt.items.find((ri: any) => ri.itemId === poItem.itemId);
              return sum + (receiptItem ? receiptItem.qtyReceived : 0);
            }, 0);
            itemData.receivedQuantity += receivedQty;
          });
        });

        // Convert to array and calculate metrics
        itemPurchases.forEach((data) => {
          data.supplierCount = data.supplierCount.size;
          data.avgUnitPrice = data.orderedQuantity > 0 ? data.totalAmount / data.orderedQuantity : 0;
          data.fulfillmentRate = data.orderedQuantity > 0 ?
            (data.receivedQuantity / data.orderedQuantity) * 100 : 0;
          purchaseData.push(data);
        });
      }

      // Calculate summary
      const summary = {
        totalPOs: purchaseOrders.length,
        totalSuppliers: new Set(purchaseOrders.map(po => po.supplierId)).size,
        totalItems: purchaseOrders.reduce((sum, po) => 
          sum + new Set(po.items.map((i: any) => i.itemId)).size, 0
        ),
        totalAmount: purchaseOrders.reduce((sum, po) => sum + Number(po.total), 0),
        avgPOValue: purchaseOrders.length > 0 ?
          purchaseOrders.reduce((sum, po) => sum + Number(po.total), 0) / purchaseOrders.length : 0,
        returnCount: returns.length,
      };

      // Sort by total amount
      purchaseData.sort((a, b) => b.totalAmount - a.totalAmount);

      return {
        period: {
          from: dateFrom,
          to: dateTo,
        },
        summary,
        data: purchaseData,
      };
    }),

  // Profitability Report
  profitability: organizationProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      ...itemFilterSchema.shape,
      ...customerFilterSchema.shape,
      includeIndirectCosts: z.boolean().default(false),
      indirectCostPercentage: z.number().min(0).max(100).default(15),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, itemIds, categoryIds, customerIds, includeIndirectCosts, indirectCostPercentage } = input;

      // Get sales data
      const orders = await ctx.prisma.order.findMany({
        where: {
          orderDate: {
            gte: dateFrom,
            lte: dateTo,
          },
          status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
          organizationId: ctx.user.organizationId,
          ...(customerIds?.length ? { customerId: { in: customerIds } } : {}),
        },
        include: {
          customer: true,
          items: {
            where: {
              ...(itemIds?.length ? { itemId: { in: itemIds } } : {}),
              ...(categoryIds?.length ? { item: { categoryId: { in: categoryIds } } } : {}),
            },
            include: {
              item: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      });

      // Calculate profitability by item
      const itemProfitability = new Map<string, any>();

      for (const order of orders) {
        for (const orderItem of order.items) {
          const key = orderItem.itemId;
          
          if (!itemProfitability.has(key)) {
            // Get average cost for the item
            const avgCost = await ctx.prisma.receiptItem.findMany({
              where: {
                itemId: orderItem.itemId,
                receipt: {
                  receivedDate: { lte: order.orderDate },
                },
              },
              orderBy: { receipt: { receivedDate: 'desc' } },
              take: 5,
            }).then(receipts => {
              if (receipts.length === 0) return Number(orderItem.item.defaultCost || 0) || Number(orderItem.unitPrice) * 0.6; // Estimate 40% margin
              const totalCost = receipts.reduce((sum, r) => 
                sum + Number(r.unitCost) * r.qtyReceived, 0
              );
              const totalQty = receipts.reduce((sum, r) => sum + r.qtyReceived, 0);
              return totalQty > 0 ? totalCost / totalQty : 0;
            });

            itemProfitability.set(key, {
              item: {
                id: orderItem.item.id,
                sku: orderItem.item.sku,
                name: orderItem.item.name,
                category: orderItem.item.category?.name,
              },
              quantitySold: 0,
              revenue: 0,
              costOfGoodsSold: 0,
              grossProfit: 0,
              indirectCosts: 0,
              netProfit: 0,
              avgSellingPrice: 0,
              avgCost,
              customerCount: new Set(),
              orderCount: 0,
            });
          }

          const itemData = itemProfitability.get(key)!;
          const itemCost = itemData.avgCost * orderItem.qtyOrdered;
          const itemRevenue = Number(orderItem.totalPrice);
          const itemGrossProfit = itemRevenue - itemCost;
          const itemIndirectCost = includeIndirectCosts ? 
            itemRevenue * (indirectCostPercentage / 100) : 0;

          itemData.quantitySold += orderItem.qtyOrdered;
          itemData.revenue += itemRevenue;
          itemData.costOfGoodsSold += itemCost;
          itemData.grossProfit += itemGrossProfit;
          itemData.indirectCosts += itemIndirectCost;
          itemData.netProfit += itemGrossProfit - itemIndirectCost;
          itemData.customerCount.add(order.customerId);
          itemData.orderCount++;
        }
      }

      // Convert to array and calculate metrics
      const profitabilityData: any[] = [];
      itemProfitability.forEach((data) => {
        data.customerCount = data.customerCount.size;
        data.avgSellingPrice = data.quantitySold > 0 ? data.revenue / data.quantitySold : 0;
        data.grossMargin = data.revenue > 0 ? (data.grossProfit / data.revenue) * 100 : 0;
        data.netMargin = data.revenue > 0 ? (data.netProfit / data.revenue) * 100 : 0;
        profitabilityData.push(data);
      });

      // Sort by net profit
      profitabilityData.sort((a, b) => b.netProfit - a.netProfit);

      // Calculate summary
      const summary = {
        totalRevenue: profitabilityData.reduce((sum, p) => sum + p.revenue, 0),
        totalCOGS: profitabilityData.reduce((sum, p) => sum + p.costOfGoodsSold, 0),
        totalGrossProfit: profitabilityData.reduce((sum, p) => sum + p.grossProfit, 0),
        totalIndirectCosts: profitabilityData.reduce((sum, p) => sum + p.indirectCosts, 0),
        totalNetProfit: profitabilityData.reduce((sum, p) => sum + p.netProfit, 0),
        avgGrossMargin: 0,
        avgNetMargin: 0,
      };

      summary.avgGrossMargin = summary.totalRevenue > 0 ?
        (summary.totalGrossProfit / summary.totalRevenue) * 100 : 0;
      summary.avgNetMargin = summary.totalRevenue > 0 ?
        (summary.totalNetProfit / summary.totalRevenue) * 100 : 0;

      // Get top and bottom performers
      const topPerformers = profitabilityData.slice(0, 10);
      const bottomPerformers = profitabilityData
        .filter(p => p.netProfit < 0)
        .sort((a, b) => a.netProfit - b.netProfit)
        .slice(0, 10);

      return {
        period: {
          from: dateFrom,
          to: dateTo,
        },
        summary,
        byItem: profitabilityData,
        topPerformers,
        bottomPerformers,
        parameters: {
          includeIndirectCosts,
          indirectCostPercentage,
        },
      };
    }),

  // Inventory Turnover Report
  inventoryTurnover: organizationProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      ...warehouseFilterSchema.shape,
      ...itemFilterSchema.shape,
      method: z.enum(['COGS', 'SALES']).default('COGS'),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, warehouseIds, includeAllWarehouses, itemIds, categoryIds, includeInactive, method } = input;

      // Calculate days in period
      const daysInPeriod = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24));
      const annualizationFactor = 365 / daysInPeriod;

      // Build filters
      const itemWhere: Prisma.ItemWhereInput = {
        isActive: includeInactive ? undefined : true,
        organizationId: ctx.user.organizationId,
        ...(itemIds?.length ? { id: { in: itemIds } } : {}),
        ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
      };

      // Get items with current inventory
      const items = await ctx.prisma.item.findMany({
        where: itemWhere,
        include: {
          category: true,
          inventory: {
            where: {
              ...(includeAllWarehouses ? {} : {
                location: {
                  warehouseId: { in: warehouseIds || [] },
                },
              }),
            },
          },
        },
      });

      // Calculate turnover for each item
      const turnoverData = await Promise.all(items.map(async (item) => {
        // Get current inventory value
        const currentInventory = item.inventory.reduce((sum, inv) => sum + inv.qtyOnHand, 0);
        const avgUnitCost = Number(item.defaultCost || 0) || 10; // Use default cost or fallback
        const currentInventoryValue = currentInventory * avgUnitCost;

        // Get beginning inventory (estimate from movements)
        const beginningMovement = await ctx.prisma.stockMovement.aggregate({
          where: {
            itemId: item.id,
            movedAt: { lt: dateFrom },
          },
          _sum: {
            qty: true,
          },
        });

        const beginningInventory = beginningMovement._sum.qty || currentInventory;
        const avgInventory = (beginningInventory + currentInventory) / 2;
        const avgInventoryValue = avgInventory * avgUnitCost;

        let turnoverRate = 0;
        let daysOnHand = 0;

        if (method === 'COGS') {
          // Get COGS from shipments
          const shipments = await ctx.prisma.stockMovement.aggregate({
            where: {
              itemId: item.id,
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

          const cogs = (shipments._sum.qty || 0) * avgUnitCost;
          const annualizedCOGS = cogs * annualizationFactor;
          
          if (avgInventoryValue > 0) {
            turnoverRate = annualizedCOGS / avgInventoryValue;
            daysOnHand = turnoverRate > 0 ? 365 / turnoverRate : 365;
          }
        } else {
          // Get sales value
          const sales = await ctx.prisma.orderItem.aggregate({
            where: {
              itemId: item.id,
              order: {
                orderDate: {
                  gte: dateFrom,
                  lte: dateTo,
                },
                status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
              },
            },
            _sum: {
              totalPrice: true,
              qtyOrdered: true,
            },
          });

          const salesValue = Number(sales._sum.totalPrice || 0);
          const annualizedSales = salesValue * annualizationFactor;
          
          // For sales method, use retail value of inventory
          const avgInventoryRetailValue = avgInventory * Number(item.defaultCost || 10) * 1.67; // Estimate retail markup
          
          if (avgInventoryRetailValue > 0) {
            turnoverRate = Number(annualizedSales) / avgInventoryRetailValue;
            daysOnHand = turnoverRate > 0 ? 365 / turnoverRate : 365;
          }
        }

        // Classify turnover performance
        let performance: string;
        if (turnoverRate === 0) {
          performance = 'NO_MOVEMENT';
        } else if (turnoverRate < 2) {
          performance = 'SLOW_MOVING';
        } else if (turnoverRate < 6) {
          performance = 'MODERATE';
        } else if (turnoverRate < 12) {
          performance = 'FAST_MOVING';
        } else {
          performance = 'VERY_FAST';
        }

        return {
          item: {
            id: item.id,
            sku: item.sku,
            name: item.name,
            category: item.category?.name,
          },
          inventory: {
            beginning: beginningInventory,
            ending: currentInventory,
            average: Math.round(avgInventory),
            value: avgInventoryValue,
          },
          turnover: {
            rate: Math.round(turnoverRate * 100) / 100,
            daysOnHand: Math.round(daysOnHand),
            performance,
          },
        };
      }));

      // Filter out items with no inventory
      const filteredData = turnoverData.filter(d => d.inventory.average > 0);

      // Sort by turnover rate
      filteredData.sort((a, b) => b.turnover.rate - a.turnover.rate);

      // Calculate summary
      const summary = {
        totalItems: filteredData.length,
        avgTurnoverRate: filteredData.reduce((sum, d) => sum + d.turnover.rate, 0) / filteredData.length,
        avgDaysOnHand: filteredData.reduce((sum, d) => sum + d.turnover.daysOnHand, 0) / filteredData.length,
        byPerformance: {
          noMovement: filteredData.filter(d => d.turnover.performance === 'NO_MOVEMENT').length,
          slowMoving: filteredData.filter(d => d.turnover.performance === 'SLOW_MOVING').length,
          moderate: filteredData.filter(d => d.turnover.performance === 'MODERATE').length,
          fastMoving: filteredData.filter(d => d.turnover.performance === 'FAST_MOVING').length,
          veryFast: filteredData.filter(d => d.turnover.performance === 'VERY_FAST').length,
        },
        totalInventoryValue: filteredData.reduce((sum, d) => sum + d.inventory.value, 0),
      };

      return {
        period: {
          from: dateFrom,
          to: dateTo,
          days: daysInPeriod,
        },
        method,
        summary,
        items: filteredData,
      };
    }),

  // Forecast Accuracy Report
  forecast: organizationProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      ...itemFilterSchema.shape,
      forecastHorizon: z.number().int().min(1).max(365).default(30),
      confidenceLevel: z.number().min(0.5).max(0.99).default(0.95),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, itemIds, categoryIds, forecastHorizon, confidenceLevel } = input;

      // Build filters
      const itemWhere: Prisma.ItemWhereInput = {
        isActive: true,
        organizationId: ctx.user.organizationId,
        ...(itemIds?.length ? { id: { in: itemIds } } : {}),
        ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
      };

      // Get items
      const items = await ctx.prisma.item.findMany({
        where: itemWhere,
        include: {
          category: true,
        },
      });

      // Generate forecasts for each item
      const forecasts = await Promise.all(items.map(async (item) => {
        // Get historical sales data - need to aggregate differently since groupBy can't use nested fields
        const orders = await ctx.prisma.order.findMany({
          where: {
            orderDate: {
              gte: dateFrom,
              lte: dateTo,
            },
            status: { in: ['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'] },
            organizationId: ctx.user.organizationId,
            items: {
              some: {
                itemId: item.id,
              },
            },
          },
          include: {
            items: {
              where: {
                itemId: item.id,
              },
            },
          },
        });

        // Group by date manually
        const salesByDate = new Map<string, number>();
        orders.forEach(order => {
          const dateKey = order.orderDate.toISOString().split('T')[0];
          const qty = order.items.reduce((sum: number, oi: any) => sum + oi.qtyOrdered, 0);
          salesByDate.set(dateKey, (salesByDate.get(dateKey) || 0) + qty);
        });
        const salesHistory = Array.from(salesByDate.values());

        // Simple moving average forecast (in production, use proper time series methods)
        const dailySales = salesHistory;
        const avgDailySales = dailySales.length > 0 ?
          dailySales.reduce((sum, q) => sum + q, 0) / dailySales.length : 0;

        // Calculate standard deviation for confidence intervals
        const variance = dailySales.length > 0 ?
          dailySales.reduce((sum, q) => sum + Math.pow(q - avgDailySales, 2), 0) / dailySales.length : 0;
        const stdDev = Math.sqrt(variance);

        // Z-score for confidence level (simplified)
        const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645;

        // Generate forecast
        const forecastDaily = avgDailySales;
        const forecastTotal = forecastDaily * forecastHorizon;
        const lowerBound = Math.max(0, forecastTotal - (zScore * stdDev * Math.sqrt(forecastHorizon)));
        const upperBound = forecastTotal + (zScore * stdDev * Math.sqrt(forecastHorizon));

        // Get current inventory
        const currentInventory = await ctx.prisma.inventory.aggregate({
          where: { itemId: item.id },
          _sum: {
            qtyOnHand: true,
            qtyReserved: true,
          },
        });

        const qtyAvailable = (currentInventory._sum.qtyOnHand || 0) - (currentInventory._sum.qtyReserved || 0);
        const daysOfSupply = forecastDaily > 0 ?
          qtyAvailable / forecastDaily : Infinity;

        return {
          item: {
            id: item.id,
            sku: item.sku,
            name: item.name,
            category: item.category?.name,
          },
          historical: {
            avgDailySales: Math.round(avgDailySales * 10) / 10,
            stdDeviation: Math.round(stdDev * 10) / 10,
            dataPoints: dailySales.length,
          },
          forecast: {
            daily: Math.round(forecastDaily * 10) / 10,
            total: Math.round(forecastTotal),
            lowerBound: Math.round(lowerBound),
            upperBound: Math.round(upperBound),
            confidenceLevel: confidenceLevel * 100,
          },
          inventory: {
            current: currentInventory._sum.qtyOnHand || 0,
            available: qtyAvailable,
            daysOfSupply: Math.round(daysOfSupply),
            stockoutRisk: daysOfSupply < forecastHorizon ? 'HIGH' : 'LOW',
          },
          recommendation: {
            reorderNeeded: daysOfSupply < forecastHorizon,
            suggestedQuantity: Math.max(0, Math.round(upperBound - qtyAvailable)),
          },
        };
      }));

      // Sort by stockout risk
      forecasts.sort((a, b) => {
        if (a.inventory.stockoutRisk !== b.inventory.stockoutRisk) {
          return a.inventory.stockoutRisk === 'HIGH' ? -1 : 1;
        }
        return a.inventory.daysOfSupply - b.inventory.daysOfSupply;
      });

      // Calculate summary
      const summary = {
        totalItems: forecasts.length,
        itemsAtRisk: forecasts.filter(f => f.inventory.stockoutRisk === 'HIGH').length,
        totalForecastDemand: forecasts.reduce((sum, f) => sum + f.forecast.total, 0),
        totalCurrentInventory: forecasts.reduce((sum, f) => sum + f.inventory.current, 0),
        totalReorderQuantity: forecasts.reduce((sum, f) => sum + f.recommendation.suggestedQuantity, 0),
      };

      return {
        period: {
          historical: { from: dateFrom, to: dateTo },
          forecast: { horizon: forecastHorizon, confidenceLevel: confidenceLevel * 100 },
        },
        summary,
        forecasts,
      };
    }),

  // Custom Report Builder
  custom: organizationProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      query: z.object({
        table: z.enum(['items', 'inventory', 'orders', 'customers', 'suppliers', 'stockMovements']),
        filters: z.record(z.any()).optional(),
        groupBy: z.array(z.string()).optional(),
        aggregations: z.array(z.object({
          field: z.string(),
          function: z.enum(['sum', 'avg', 'count', 'min', 'max']),
          alias: z.string(),
        })).optional(),
        orderBy: z.array(z.object({
          field: z.string(),
          direction: z.enum(['asc', 'desc']),
        })).optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      }),
    }))
    .query(async ({ ctx, input }) => {
      // This is a simplified custom report builder
      // In production, you'd want more sophisticated query building with proper validation
      
      const { name, description, query } = input;

      // Security check - only allow specific fields
      const allowedTables = {
        items: ctx.prisma.item,
        inventory: ctx.prisma.inventory,
        orders: ctx.prisma.order,
        customers: ctx.prisma.customer,
        suppliers: ctx.prisma.supplier,
        stockMovements: ctx.prisma.stockMovement,
      };

      const model = allowedTables[query.table];
      if (!model) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid table specified',
        });
      }

      // Build query
      const queryOptions: any = {
        where: {
          ...query.filters,
          organizationId: ctx.user.organizationId,
        },
        take: query.limit,
      };

      if (query.orderBy) {
        queryOptions.orderBy = query.orderBy;
      }

      // Execute query
      const results = await (model as any).findMany(queryOptions);

      // Apply aggregations if specified
      let processedResults = results;
      if (query.groupBy && query.aggregations) {
        // Simple grouping implementation
        const grouped = results.reduce((acc: Record<string, any[]>, row: any) => {
          const key = query.groupBy!.map(field => row[field]).join('-');
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(row);
          return acc;
        }, {} as Record<string, any[]>);

        processedResults = Object.entries(grouped).map(([key, rows]) => {
          const result: any = {};
          
          // Add group keys
          query.groupBy!.forEach((field, index) => {
            result[field] = (rows as any[])[0][field];
          });

          // Apply aggregations
          query.aggregations!.forEach(agg => {
            const values = (rows as any[]).map((r: any) => r[agg.field]).filter((v: any) => v !== null);
            switch (agg.function) {
              case 'sum':
                result[agg.alias] = values.reduce((sum: number, v: any) => sum + v, 0);
                break;
              case 'avg':
                result[agg.alias] = values.length > 0 ?
                  values.reduce((sum: number, v: any) => sum + v, 0) / values.length : 0;
                break;
              case 'count':
                result[agg.alias] = values.length;
                break;
              case 'min':
                result[agg.alias] = Math.min(...values);
                break;
              case 'max':
                result[agg.alias] = Math.max(...values);
                break;
            }
          });

          return result;
        });
      }

      return {
        report: {
          name,
          description,
          generatedAt: new Date(),
          query,
        },
        data: processedResults,
        rowCount: processedResults.length,
      };
    }),

  // Export report
  export: organizationProcedure
    .input(z.object({
      reportType: z.string(),
      parameters: z.record(z.any()),
      format: z.enum(['csv', 'json', 'pdf', 'excel']).default('csv'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { reportType, parameters, format } = input;

      // Log export activity
      // Activity model doesn't exist in schema
      await ctx.prisma.auditLog.create({
        data: {
          tableName: 'reports',
          recordPk: reportType,
          action: 'CREATE' as const, // Using CREATE as there's no EXPORT action
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          afterData: {
            reportType,
            format,
            parameters,
          },
        },
      });

      // In a real implementation, this would generate the actual file
      // and return a download URL or send via email
      return {
        success: true,
        message: `Report ${reportType} exported as ${format}`,
        downloadUrl: `/api/reports/download/${Date.now()}.${format}`,
      };
    }),
});