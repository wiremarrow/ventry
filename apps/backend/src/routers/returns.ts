import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { organizationProcedure, createTRPCRouter } from '../trpc/trpc.js';
import { Prisma } from '@ventry/database';

// Input validation schemas
const returnCreateSchema = z.object({
  customerId: z.string().cuid(),
  orderId: z.string().cuid().optional(), // Optional as per schema
  reason: z.string(), // Schema uses string, not enum
  refundAmount: z.number().min(0).default(0),
  restockFee: z.number().min(0).default(0),
  rmaNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().cuid(),
    qtyReturned: z.number().int().positive(),
    orderItemId: z.string().cuid().optional(),
    lotId: z.string().cuid().optional(),
    serialId: z.string().cuid().optional(),
    condition: z.enum(['NEW', 'OPENED', 'DAMAGED', 'DEFECTIVE']),
    refundAmount: z.number().min(0),
  })).min(1),
});

const returnUpdateSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(['PENDING', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED']).optional(),
  reason: z.string().optional(),
  refundAmount: z.number().min(0).optional(),
  restockFee: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const returnFilterSchema = z.object({
  search: z.string().optional(),
  // type: z.enum(['CUSTOMER', 'SUPPLIER']).optional(), // Not in schema
  status: z.enum(['PENDING', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED']).optional(),
  // reason: z.enum(['DEFECTIVE', 'DAMAGED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'QUALITY_ISSUE', 'OTHER']).optional(), // String in schema
  customerId: z.string().cuid().optional(),
  // supplierId: z.string().cuid().optional(), // Not supported - only customer returns
  // warehouseId: z.string().cuid().optional(), // Not directly in schema
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['returnNumber', 'createdAt', 'status', 'returnDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const returnApprovalSchema = z.object({
  id: z.string().cuid(),
  approved: z.boolean(),
  notes: z.string().optional(),
  replacementAction: z.object({
    createPO: z.boolean().optional(),
    expedite: z.boolean().optional(),
  }).optional(),
});

const returnReceiveSchema = z.object({
  id: z.string().cuid(),
  receivedDate: z.date().default(() => new Date()),
  items: z.array(z.object({
    returnItemId: z.string().cuid(),
    qtyReceived: z.number().int().min(0),
    condition: z.enum(['AS_RETURNED', 'DAMAGED_FURTHER', 'DIFFERENT_ISSUE']),
    inspectionNotes: z.string().optional(),
    dispositionAction: z.enum(['RETURN_TO_STOCK', 'DISPOSE', 'SEND_TO_SUPPLIER', 'REPAIR']),
    locationId: z.string().cuid().optional(),
  })).min(1),
});

const returnShipmentSchema = z.object({
  id: z.string().cuid(),
  carrier: z.string(),
  trackingNumber: z.string(),
  shippedDate: z.date().default(() => new Date()),
  estimatedDelivery: z.date().optional(),
  shippingCost: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const returnsRouter = createTRPCRouter({
  // List returns with filtering
  list: organizationProcedure
    .input(returnFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        search,
        // type, // Not in schema
        status,
        // reason, // Not a filter anymore
        customerId,
        // supplierId, // Not supported
        // warehouseId, // Not directly available
        dateFrom,
        dateTo,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: Prisma.ReturnWhereInput = {
        organizationId: ctx.user.organizationId,
      };

      // Search filter
      if (search) {
        where.OR = [
          { returnNumber: { contains: search, mode: 'insensitive' } },
          { reason: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
          { rmaNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Type filter - removed as not in schema
      // if (type) {
      //   where.type = type;
      // }

      // Status filter
      if (status) {
        where.status = status;
      }

      // Reason filter - removed as reason is now a string
      // if (reason) {
      //   where.reason = reason;
      // }

      // Customer filter
      if (customerId) {
        where.customerId = customerId;
      }

      // Supplier filter - removed as only customer returns are supported
      // if (supplierId && type === 'SUPPLIER') {
      //   where.receipt = {
      //     purchaseOrder: {
      //       supplierId,
      //     },
      //   };
      // }

      // Warehouse filter - removed as not directly available in schema
      // Complex warehouse filtering would require joins through order items

      // Date filters
      if (dateFrom || dateTo) {
        where.returnDate = {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        };
      }

      // Get total count
      const totalCount = await ctx.prisma.return.count({ where });

      // Get paginated results
      const returns = await ctx.prisma.return.findMany({
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
            },
          },
          order: {
            include: {
              customer: true,
            },
          },
          // receipt: { // Not in schema - only customer returns supported
          //   include: {
          //     purchaseOrder: {
          //       include: {
          //         supplier: true,
          //       },
          //     },
          //   },
          // },
          _count: {
            select: {
              items: true,
            },
          },
        },
      });

      // Calculate summary stats
      const stats = await ctx.prisma.return.groupBy({
        by: ['status'],
        where,
        _count: true,
      });

      const statusCounts = stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {} as Record<string, number>);

      return {
        returns,
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
          processing: statusCounts['PROCESSING'] || 0,
          completed: statusCounts['COMPLETED'] || 0,
        },
      };
    }),

  // Get return details
  get: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const returnData = await ctx.prisma.return.findUnique({
        where: { id: input.id },
        include: {
          items: {
            include: {
              item: {
                include: {
                  category: true,
                },
              },
            },
          },
          order: {
            include: {
              customer: true,
              items: {
                include: {
                  item: true,
                },
              },
            },
          },
          // receipt: { // Not in schema - only customer returns supported
          //   include: {
          //     purchaseOrder: {
          //       include: {
          //         supplier: true,
          //         purchaseOrderItems: {
          //           include: {
          //             item: true,
          //           },
          //         },
          //       },
          //     },
          //     items: {
          //       include: {
          //         item: true,
          //       },
          //     },
          //   },
          // },
          // activities: { // Not in schema
          //   orderBy: { timestamp: 'desc' },
          //   take: 20,
          // },
          // shipment: true, // Not in schema
        },
      });

      if (!returnData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Return not found',
        });
      }

      return returnData;
    }),

  // Create a new return
  create: organizationProcedure
    .input(returnCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { customerId, orderId, reason, refundAmount, restockFee, rmaNumber, notes, items } = input;

      // Validate order if provided
      let orderData: any;

      if (orderId) {
        orderData = await ctx.prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: {
              include: {
                item: true,
              },
            },
            customer: true,
          },
        });

        if (!orderData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order not found',
          });
        }

        if (!['CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(orderData.status)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Order must be confirmed or shipped to create a return',
          });
        }

        // Ensure order belongs to the customer
        if (orderData.customerId !== customerId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Order does not belong to this customer',
          });
        }
      }

      // Validate return items
      for (const item of items) {
        if (orderId) {
          const orderItem = orderData.items.find((oi: any) => oi.itemId === item.itemId);
          if (!orderItem) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Item ${item.itemId} not found in order`,
            });
          }

          // Use ordered quantity since we don't have allocations
          const orderedQty = orderItem.qtyOrdered;

          // Check already returned quantity
          const returnedQty = await ctx.prisma.returnItem.aggregate({
            where: {
              itemId: item.itemId,
              return: {
                orderId: orderId,
                status: { notIn: ['REJECTED'] },
              },
            },
            _sum: {
              qtyReturned: true,
            },
          });

          const availableQty = orderedQty - (returnedQty._sum.qtyReturned || 0);

          // Check quantity
          if (item.qtyReturned > availableQty) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Return quantity for item ${item.itemId} exceeds available quantity (${availableQty})`,
            });
          }
        }

      }

      // Generate return number
      const returnCount = await ctx.prisma.return.count({
        where: {
          organizationId: ctx.user.organizationId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), 0, 1),
          },
        },
      });

      const returnNumber = `RMA-${new Date().getFullYear()}-${String(returnCount + 1).padStart(5, '0')}`;

      // Create return in transaction
      const newReturn = await ctx.prisma.$transaction(async (tx) => {
        // Create return
        const returnData = await tx.return.create({
          data: {
            organizationId: ctx.user.organizationId,
            returnNumber,
            customerId,
            orderId,
            status: 'PENDING',
            reason,
            notes,
            rmaNumber,
            refundAmount,
            restockFee,
          },
        });

        // Create return items
        const returnItems: Prisma.ReturnItemCreateManyInput[] = items.map(item => ({
          returnId: returnData.id,
          itemId: item.itemId,
          qtyReturned: item.qtyReturned,
          orderItemId: item.orderItemId || null,
          lotId: item.lotId || null,
          serialId: item.serialId || null,
          condition: item.condition,
          refundAmount: item.refundAmount,
        }));
        
        await tx.returnItem.createMany({
          data: returnItems,
          skipDuplicates: true,
        });

        // Fetch the complete return with items
        const completeReturn = await tx.return.findUnique({
          where: { id: returnData.id },
          include: {
            items: {
              include: {
                item: true,
                orderItem: true,
                lot: true,
                serialNumber: true,
              },
            },
            customer: true,
            order: true,
          },
        });

        // TODO: Add audit logging when activity model is available
        // Log activity
        // await tx.activity.create({
        //   data: {
        //     type: 'RETURN_CREATED',
        //     entityType: 'RETURN',
        //     entityId: returnData.id,
        //     userId: ctx.user.id,
        //     description: `Created return ${returnNumber}`,
        //     metadata: {
        //       returnNumber,
        //       reason,
        //       itemCount: items.length,
        //       totalQuantity: items.reduce((sum, item) => sum + item.qtyReturned, 0),
        //     },
        //   },
        // });

        return completeReturn || returnData;
      });

      return newReturn;
    }),

  // Update return
  update: organizationProcedure
    .input(returnUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Check if return exists and belongs to organization
      const existingReturn = await ctx.prisma.return.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!existingReturn) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Return not found',
        });
      }

      // Check if return can be updated
      if (['COMPLETED', 'CANCELLED'].includes(existingReturn.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot update completed or cancelled return',
        });
      }

      // Update return
      const updatedReturn = await ctx.prisma.$transaction(async (tx) => {
        const returnData = await tx.return.update({
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

        // TODO: Add audit logging when activity model is available
        // await tx.activity.create({
        //   data: {
        //     type: 'RETURN_UPDATED',
        //     entityType: 'RETURN',
        //     entityId: id,
        //     userId: ctx.user.id,
        //     description: `Updated return ${returnData.returnNumber}`,
        //     metadata: {
        //       changes: updateData,
        //     },
        //   },
        // });

        return returnData;
      });

      return updatedReturn;
    }),

  // Approve or reject return
  approve: organizationProcedure
    .input(returnApprovalSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, approved, notes, replacementAction } = input;

      // Check if user has permission
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins and managers can approve returns',
        });
      }

      // Get return details
      const existingReturn = await ctx.prisma.return.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              item: true,
            },
          },
          order: {
            include: {
              customer: true,
            },
          },
          // receipt: { // Not in schema - only customer returns supported
          //   include: {
          //     purchaseOrder: {
          //       include: {
          //         supplier: true,
          //       },
          //     },
          //   },
          // },
        },
      });

      if (!existingReturn) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Return not found',
        });
      }

      if (existingReturn.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only pending returns can be approved or rejected',
        });
      }

      // Process approval/rejection
      const updatedReturn = await ctx.prisma.$transaction(async (tx) => {
        // Update return status
        const returnData = await tx.return.update({
          where: { id },
          data: {
            status: approved ? 'APPROVED' : 'REJECTED',
            // approvedBy: ctx.user.id, // Not in schema
            // approvedAt: new Date(), // Not in schema
            notes: notes || existingReturn.notes, // Update notes if provided
          },
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        // If approved, handle any follow-up actions
        // TODO: Implement replacement order creation when needed
        // if (approved && replacementAction?.createPO) {
        //   // Create replacement order
        //   await tx.activity.create({
        //     data: {
        //       type: 'REPLACEMENT_ORDER_NEEDED',
        //       entityType: 'RETURN',
        //       entityId: id,
        //       userId: ctx.user.id,
        //       description: 'Replacement order needs to be created',
        //       metadata: {
        //         returnNumber: returnData.returnNumber,
        //         expedite: replacementAction.expedite,
        //       },
        //     },
        //   });
        // }

        // TODO: Add audit logging when activity model is available
        // Log approval/rejection
        // await tx.activity.create({
        //   data: {
        //     type: approved ? 'RETURN_APPROVED' : 'RETURN_REJECTED',
        //     entityType: 'RETURN',
        //     entityId: id,
        //     userId: ctx.user.id,
        //     description: `${approved ? 'Approved' : 'Rejected'} return ${returnData.returnNumber}`,
        //     metadata: {
        //       notes,
        //       replacementAction,
        //     },
        //   },
        // });

        return returnData;
      });

      return updatedReturn;
    }),

  // Ship return to supplier
  ship: organizationProcedure
    .input(returnShipmentSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, carrier, trackingNumber, shippedDate, estimatedDelivery, shippingCost, notes } = input;

      // Get return details
      const existingReturn = await ctx.prisma.return.findUnique({
        where: { id },
      });

      if (!existingReturn) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Return not found',
        });
      }

      // Type check removed - schema only supports customer returns
      // if (existingReturn.type !== 'SUPPLIER') {
      //   throw new TRPCError({
      //     code: 'BAD_REQUEST',
      //     message: 'Only supplier returns can be shipped',
      //   });
      // }

      if (existingReturn.status !== 'APPROVED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Return must be approved before shipping',
        });
      }

      // Create shipment and update return
      const updatedReturn = await ctx.prisma.$transaction(async (tx) => {
        // Create shipment record
        // TODO: Implement shipment creation for returns
        // The Shipment model seems to be designed for outbound shipments, not returns
        // await tx.shipment.create({
        //   data: {
        //     type: 'RETURN',
        //     status: 'IN_TRANSIT',
        //     trackingNumber,
        //     carrier,
        //     shippedDate,
        //     estimatedDelivery,
        //     actualCost: shippingCost,
        //     notes,
        //     returnId: id,
        //   },
        // });

        // Update return status
        const returnData = await tx.return.update({
          where: { id },
          data: {
            status: 'RECEIVED', // Changed from SHIPPED - not in ReturnStatus enum
          },
          include: {
            items: {
              include: {
                item: true,
              },
            },
            // shipment: true, // Not in schema
          },
        });

        // TODO: Add audit logging when activity model is available
        // await tx.activity.create({
        //   data: {
        //     type: 'RETURN_SHIPPED',
        //     entityType: 'RETURN',
        //     entityId: id,
        //     userId: ctx.user.id,
        //     description: `Shipped return ${returnData.returnNumber} via ${carrier}`,
        //     metadata: {
        //       carrier,
        //       trackingNumber,
        //       shippingCost,
        //     },
        //   },
        // });

        return returnData;
      });

      return updatedReturn;
    }),

  // Receive returned items
  receive: organizationProcedure
    .input(returnReceiveSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, receivedDate, items } = input;

      // Get return details
      const existingReturn = await ctx.prisma.return.findUnique({
        where: { id },
        include: {
          items: true,
          order: true,
        },
      });

      if (!existingReturn) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Return not found',
        });
      }

      // Type check removed - schema only supports customer returns
      // if (existingReturn.type !== 'CUSTOMER') {
      //   throw new TRPCError({
      //     code: 'BAD_REQUEST',
      //     message: 'Only customer returns can be received',
      //   });
      // }

      if (!['APPROVED', 'PROCESSING'].includes(existingReturn.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Return must be approved to receive items',
        });
      }

      // Process receipt
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Update return items
        for (const item of items) {
          const returnItem = existingReturn.items.find(ri => ri.id === item.returnItemId);
          if (!returnItem) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Return item ${item.returnItemId} not found`,
            });
          }

          // TODO: The ReturnItem model doesn't support updating receipt information
          // This functionality might need to be redesigned
          // await tx.returnItem.update({
          //   where: { id: item.returnItemId },
          //   data: {
          //     qtyReceived: item.qtyReceived,
          //     receivedCondition: item.condition,
          //     receivedInspectionNotes: item.inspectionNotes,
          //     dispositionAction: item.dispositionAction,
          //   },
          // });

          // Handle inventory based on disposition
          if (item.dispositionAction === 'RETURN_TO_STOCK' && item.locationId && item.qtyReceived > 0) {
            // Find or create inventory record
            const inventory = await tx.inventory.findFirst({
              where: {
                itemId: returnItem.itemId,
                locationId: item.locationId,
                lotId: returnItem.lotId || null,
              },
            });

            if (inventory) {
              // Update existing inventory
              await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                  qtyOnHand: {
                    increment: item.qtyReceived,
                  },
                },
              });
            } else {
              // Create new inventory record
              await tx.inventory.create({
                data: {
                  itemId: returnItem.itemId,
                  locationId: item.locationId,
                  qtyOnHand: item.qtyReceived,
                  qtyReserved: 0,
                  lotId: returnItem.lotId || null,
                },
              });
            }

            // Create stock movement
            await tx.stockMovement.create({
              data: {
                movementType: 'RETURN',
                itemId: returnItem.itemId,
                qty: item.qtyReceived,
                fromLocationId: null,
                toLocationId: item.locationId,
                movedById: ctx.user.id,
                notes: `Return ${existingReturn.returnNumber} - ${item.dispositionAction}`,
                refType: 'RETURN',
                refId: id,
              },
            });
          }
        }

        // Check if all items received
        const allReceived = items.every(item => {
          const returnItem = existingReturn.items.find(ri => ri.id === item.returnItemId);
          return returnItem && item.qtyReceived === returnItem.qtyReturned;
        });

        // Update return status
        const updatedReturn = await tx.return.update({
          where: { id },
          data: {
            status: allReceived ? 'REFUNDED' : 'RECEIVED', // Updated to valid enum values
            // receivedDate, // Not a field in Return model
          },
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        // TODO: Process refund/credit if applicable and all items received
        // if (allReceived) {
        //   await tx.activity.create({
        //     data: {
        //       type: 'REFUND_NEEDED',
        //       entityType: 'RETURN',
        //       entityId: id,
        //       userId: ctx.user.id,
        //       description: 'Refund needs to be processed',
        //       metadata: {
        //         returnNumber: existingReturn.returnNumber,
        //         orderId: existingReturn.orderId,
        //       },
        //     },
        //   });
        // }

        // TODO: Add audit logging when activity model is available
        // await tx.activity.create({
        //   data: {
        //     type: 'RETURN_RECEIVED',
        //     entityType: 'RETURN',
        //     entityId: id,
        //     userId: ctx.user.id,
        //     description: `Received items for return ${existingReturn.returnNumber}`,
        //     metadata: {
        //       itemsReceived: items.length,
        //       totalQtyReceived: items.reduce((sum, item) => sum + item.qtyReceived, 0),
        //       allReceived,
        //     },
        //   },
        // });

        return updatedReturn;
      });

      return result;
    }),

  // Cancel return
  cancel: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, reason } = input;

      // Get return details
      const existingReturn = await ctx.prisma.return.findUnique({
        where: { id },
      });

      if (!existingReturn) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Return not found',
        });
      }

      if (['COMPLETED', 'CANCELLED'].includes(existingReturn.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot cancel completed or already cancelled return',
        });
      }

      // Cancel return
      const cancelledReturn = await ctx.prisma.$transaction(async (tx) => {
        const returnData = await tx.return.update({
          where: { id },
          data: {
            status: 'REJECTED', // Using REJECTED since CANCELLED doesn't exist in ReturnStatus enum
            // cancelledAt: new Date(), // Not in schema
            // cancelledBy: ctx.user.id, // Not in schema
            notes: reason || existingReturn.notes, // Store cancellation reason in notes
          },
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
        });

        // TODO: Add audit logging when activity model is available
        // await tx.activity.create({
        //   data: {
        //     type: 'RETURN_CANCELLED',
        //     entityType: 'RETURN',
        //     entityId: id,
        //     userId: ctx.user.id,
        //     description: `Cancelled return ${returnData.returnNumber}`,
        //     metadata: {
        //       reason,
        //     },
        //   },
        // });

        return returnData;
      });

      return cancelledReturn;
    }),

  // Get return metrics
  getMetrics: organizationProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      groupBy: z.enum(['day', 'week', 'month']).default('month'),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, groupBy } = input;

      const where: Prisma.ReturnWhereInput = {};
      if (dateFrom || dateTo) {
        where.createdAt = {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        };
      }

      // Get return counts by status
      const statusCounts = await ctx.prisma.return.groupBy({
        by: ['status'],
        where,
        _count: true,
      });

      // Get return counts by reason
      const reasonCounts = await ctx.prisma.return.groupBy({
        by: ['reason'],
        where,
        _count: true,
      });

      // Get return counts by type - removed as type field doesn't exist
      // const typeCounts = await ctx.prisma.return.groupBy({
      //   by: ['type'],
      //   where,
      //   _count: true,
      // });

      // Get processing time stats
      const completedReturns = await ctx.prisma.return.findMany({
        where: {
          ...where,
          status: 'REFUNDED', // Changed from COMPLETED
          // receivedDate: { not: null }, // Not in schema
        },
        select: {
          createdAt: true,
          returnDate: true, // Use returnDate instead
        },
      });

      const processingTimes = completedReturns.map(r => {
        const days = Math.ceil((r.returnDate.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return days;
      });

      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

      // Get top returned items
      const topReturnedItems = await ctx.prisma.returnItem.groupBy({
        by: ['itemId'],
        where: {
          return: where,
        },
        _sum: {
          qtyReturned: true,
        },
        orderBy: {
          _sum: {
            qtyReturned: 'desc',
          },
        },
        take: 10,
      });

      // Get item details
      const itemIds = topReturnedItems.map(item => item.itemId);
      const items = await ctx.prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, sku: true, name: true },
      });

      const topItems = topReturnedItems.map(ri => {
        const item = items.find(i => i.id === ri.itemId);
        return {
          item,
          totalQuantity: ri._sum.qtyReturned || 0,
        };
      });

      return {
        summary: {
          total: statusCounts.reduce((sum, s) => sum + s._count, 0),
          pending: statusCounts.find(s => s.status === 'PENDING')?._count || 0,
          approved: statusCounts.find(s => s.status === 'APPROVED')?._count || 0,
          refunded: statusCounts.find(s => s.status === 'REFUNDED')?._count || 0,
          avgProcessingTimeDays: Math.round(avgProcessingTime * 10) / 10,
        },
        byStatus: statusCounts.reduce((acc, s) => {
          acc[s.status] = s._count;
          return acc;
        }, {} as Record<string, number>),
        byReason: reasonCounts.reduce((acc, r) => {
          acc[r.reason] = r._count;
          return acc;
        }, {} as Record<string, number>),
        // byType: typeCounts.reduce((acc, t) => { // Removed - type field doesn't exist
        //   acc[t.type] = t._count;
        //   return acc;
        // }, {} as Record<string, number>),
        topReturnedItems: topItems,
      };
    }),

  // Export returns data
  exportReturns: organizationProcedure
    .input(z.object({
      format: z.enum(['csv', 'json']).default('csv'),
      filters: returnFilterSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { format, filters } = input;

      // Build where clause from filters
      const where: Prisma.ReturnWhereInput = {};
      if (filters) {
        // Apply same filters as list
        if (filters.search) {
          where.OR = [
            { returnNumber: { contains: filters.search, mode: 'insensitive' } },
            // { reasonDetails: { contains: filters.search, mode: 'insensitive' } }, // Field doesn't exist
            { notes: { contains: filters.search, mode: 'insensitive' } },
          ];
        }
        // if (filters.type) where.type = filters.type; // Field doesn't exist
        if (filters.status) where.status = filters.status;
        // if (filters.reason) where.reason = filters.reason; // reason is a string, not an enum filter
        if (filters.dateFrom || filters.dateTo) {
          where.createdAt = {
            ...(filters.dateFrom && { gte: filters.dateFrom }),
            ...(filters.dateTo && { lte: filters.dateTo }),
          };
        }
      }

      // Get returns with details
      const returns = await ctx.prisma.return.findMany({
        where,
        include: {
          items: {
            include: {
              item: true,
            },
          },
          order: {
            include: {
              customer: true,
            },
          },
          // receipt: { // Not in schema - only customer returns supported
          //   include: {
          //     purchaseOrder: {
          //       include: {
          //         supplier: true,
          //       },
          //     },
          //   },
          // },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (format === 'json') {
        return {
          format: 'json',
          data: returns,
          count: returns.length,
        };
      }

      // Format as CSV
      const csvRows = [
        // Header
        [
          'Return Number',
          // 'Type', // Field doesn't exist
          'Status',
          'Reason',
          // 'Reason Details', // Field doesn't exist
          // 'Requested Action', // Field doesn't exist
          'Customer/Supplier',
          'Reference',
          'Created Date',
          'Return Date',
          'Item Count',
          'Total Quantity',
        ].join(','),
      ];

      // Data rows
      for (const ret of returns) {
        // Only customer returns are supported
        const customerSupplier = ret.order?.customer ? `${ret.order.customer.firstName || ''} ${ret.order.customer.lastName || ''}`.trim() || ret.order.customer.email || '' : '';
        const reference = ret.order?.orderNumber || '';

        const totalQty = ret.items.reduce((sum, item) => sum + item.qtyReturned, 0);

        csvRows.push([
          ret.returnNumber,
          // ret.type, // Field doesn't exist
          ret.status,
          ret.reason,
          // ret.reasonDetails || '', // Field doesn't exist
          // ret.requestedAction, // Field doesn't exist
          customerSupplier,
          reference,
          ret.createdAt.toISOString(),
          ret.returnDate.toISOString(),
          ret.items.length.toString(),
          totalQty.toString(),
        ].map(val => `"${val}"`).join(','));
      }

      return {
        format: 'csv',
        data: csvRows.join('\n'),
        count: returns.length,
      };
    }),
});