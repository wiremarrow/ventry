import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { organizationProcedure, createTRPCRouter } from '../trpc/trpc.js';
import type { Prisma } from '@ventry/database';

// Input validation schemas
const purchaseOrderCreateSchema = z.object({
  supplierId: z.string().cuid(),
  // warehouseId removed - PO doesn't have this field
  expectedDate: z.date().optional(),
  paymentTerms: z.string().optional(),
  shippingTerms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().cuid(),
    qtyOrdered: z.number().int().positive(),
    unitCost: z.number().min(0),
    taxRate: z.number().min(0).max(100).default(0),
    notes: z.string().optional(),
  })).min(1),
});

const purchaseOrderUpdateSchema = z.object({
  id: z.string().cuid(),
  supplierId: z.string().cuid().optional(),
  // warehouseId removed - PO doesn't have this field
  expectedDate: z.date().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  shippingTerms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const purchaseOrderFilterSchema = z.object({
  search: z.string().optional(),
  supplierId: z.string().cuid().optional(),
  // warehouseId removed - PO doesn't have this field
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED']).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  isOverdue: z.boolean().optional(),
  // hasDiscrepancies removed - Receipt doesn't have this field
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['poNumber', 'orderDate', 'supplier', 'status', 'total']).default('orderDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const purchaseOrderItemSchema = z.object({
  poId: z.string().cuid(),
  itemId: z.string().cuid(),
  qtyOrdered: z.number().int().positive(),
  unitCost: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

const approvalSchema = z.object({
  poId: z.string().cuid(),
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const receiveItemsSchema = z.object({
  poId: z.string().cuid(),
  receivedDate: z.date().default(() => new Date()),
  items: z.array(z.object({
    poItemId: z.string().cuid(),
    qtyReceived: z.number().int().min(0),
    qtyRejected: z.number().int().min(0).default(0),
    locationId: z.string().cuid(),
    lotNumber: z.string().optional(),
    expirationDate: z.date().optional(),
    serialNumbers: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })).min(1),
  createReceipt: z.boolean().default(true),
});

export const purchaseOrdersRouter = createTRPCRouter({
  // List purchase orders with filtering
  list: organizationProcedure
    .input(purchaseOrderFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        search,
        supplierId,
        status,
        dateFrom,
        dateTo,
        isOverdue,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: Prisma.PurchaseOrderWhereInput = {
        organizationId: ctx.user.organizationId,
      };

      // Search filter
      if (search) {
        where.OR = [
          { poNumber: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } },
          { notes: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Supplier filter
      if (supplierId) {
        where.supplierId = supplierId;
      }

      // Warehouse filter - removed as PO doesn't have warehouseId
      // hasDiscrepancies filter - removed as Receipt doesn't have hasDiscrepancies field

      // Status filter
      if (status) {
        where.status = status;
      }

      // Date filters
      if (dateFrom || dateTo) {
        where.orderDate = {};
        if (dateFrom) where.orderDate.gte = dateFrom;
        if (dateTo) where.orderDate.lte = dateTo;
      }

      // Overdue filter
      if (isOverdue) {
        where.AND = [
          { expectedDate: { lt: new Date() } },
          { status: { in: ['SUBMITTED', 'APPROVED'] } },
        ];
      }

      // Has discrepancies filter - removed as Receipt doesn't have hasDiscrepancies field

      // Execute queries
      const [purchaseOrders, total] = await Promise.all([
        ctx.prisma.purchaseOrder.findMany({
          where,
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                supplierCode: true,
              },
            },
            _count: {
              select: {
                items: true,
                receipts: true,
              },
            },
            items: {
              select: {
                id: true,
                qtyOrdered: true,
                qtyReceived: true,
                totalCost: true,
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: sortBy === 'supplier'
            ? { supplier: { name: sortOrder } }
            : sortBy === 'total'
            ? { total: sortOrder }
            : { [sortBy]: sortOrder },
        }),
        ctx.prisma.purchaseOrder.count({ where }),
      ]);

      // Calculate additional metrics
      const ordersWithMetrics = purchaseOrders.map(po => ({
        ...po,
        itemCount: po._count.items,
        receiptCount: po._count.receipts,
        total: po.items.reduce((sum: number, item: any) => sum + Number(item.totalCost || 0), 0),
        receivedPercentage: po.items.length > 0
          ? (po.items.reduce((sum: number, item: any) => sum + item.qtyReceived, 0) /
             po.items.reduce((sum: number, item: any) => sum + item.qtyOrdered, 0)) * 100
          : 0,
        isOverdue: po.expectedDate && po.expectedDate < new Date() && 
                   ['SUBMITTED', 'APPROVED'].includes(po.status),
      }));

      return {
        purchaseOrders: ordersWithMetrics,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get single purchase order with full details
  get: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const purchaseOrder = await ctx.prisma.purchaseOrder.findFirst({
        where: { 
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          supplier: {
            include: {
              contacts: true,
            },
          },
          items: {
            include: {
              item: {
                include: {
                  category: true,
                  unitOfMeasure: true,
                },
              },
            },
          },
          receipts: {
            include: {
              items: {
                include: {
                  item: true,
                },
              },
            },
            orderBy: { receivedDate: 'desc' },
          },
          createdBy: true,
          approvedBy: true,
        },
      });

      if (!purchaseOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase order not found',
        });
      }

      // Calculate metrics
      const metrics = {
        itemCount: purchaseOrder.items.length,
        totalQuantity: purchaseOrder.items.reduce((sum: number, item: any) => sum + item.qtyOrdered, 0),
        receivedQuantity: purchaseOrder.items.reduce((sum: number, item: any) => sum + item.qtyReceived, 0),
        pendingQuantity: purchaseOrder.items.reduce((sum: number, item: any) => sum + (item.qtyOrdered - item.qtyReceived), 0),
        receivedPercentage: purchaseOrder.items.reduce((sum: number, item: any) => sum + item.qtyOrdered, 0) > 0
          ? (purchaseOrder.items.reduce((sum: number, item: any) => sum + item.qtyReceived, 0) /
             purchaseOrder.items.reduce((sum: number, item: any) => sum + item.qtyOrdered, 0)) * 100
          : 0,
        discrepancies: 0, // hasDiscrepancies field doesn't exist in Receipt model
      };

      return {
        ...purchaseOrder,
        metrics,
      };
    }),

  // Create purchase order
  create: organizationProcedure
    .input(purchaseOrderCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to create purchase orders',
        });
      }

      const { items, ...orderData } = input;

      // Validate supplier
      const supplier = await ctx.prisma.supplier.findFirst({
        where: { 
          id: orderData.supplierId,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!supplier) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Supplier not found',
        });
      }

      // Create purchase order with items in transaction
      const purchaseOrder = await ctx.prisma.$transaction(async (tx) => {
        // Generate PO number
        const poCount = await tx.purchaseOrder.count({
          where: {
            organizationId: ctx.user.organizationId,
            orderDate: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        });
        
        const poNumber = `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(poCount + 1).padStart(5, '0')}`;

        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;

        const itemsWithTotals = items.map(item => {
          const lineTotal = item.qtyOrdered * item.unitCost;
          const taxAmount = lineTotal * (item.taxRate / 100);
          const totalCost = lineTotal + taxAmount;

          subtotal += lineTotal;
          totalTax += taxAmount;

          return {
            ...item,
            lineTotal,
            taxAmount,
            totalCost,
          };
        });

        const total = subtotal + totalTax;

        // Create purchase order
        const newPO = await tx.purchaseOrder.create({
          data: {
            ...orderData,
            organizationId: ctx.user.organizationId,
            poNumber,
            orderDate: new Date(),
            status: 'DRAFT',
            subtotal,
            tax: totalTax,
            total,
            createdById: ctx.user.id,
          },
        });

        // Create purchase order items
        for (const item of itemsWithTotals) {
          await tx.purchaseOrderItem.create({
            data: {
              poId: newPO.id,
              itemId: item.itemId,
              qtyOrdered: item.qtyOrdered,
              qtyReceived: 0,
              unitCost: item.unitCost,
              taxRate: item.taxRate,
              totalCost: item.totalCost,
              description: item.notes || '', // Use description field instead of notes
            },
          });
        }

        // Activity log removed - model doesn't exist

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'purchase_orders',
            recordPk: newPO.id,
            action: 'CREATE',
            userId: ctx.user.id,
            afterData: newPO,
          },
        });

        return newPO;
      });

      return purchaseOrder;
    }),

  // Update purchase order
  update: organizationProcedure
    .input(purchaseOrderUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Get current PO
      const currentPO = await ctx.prisma.purchaseOrder.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          items: true,
        },
      });

      if (!currentPO) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase order not found',
        });
      }

      // Check if PO can be updated based on status
      if (['RECEIVED', 'CANCELLED'].includes(currentPO.status)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot update purchase order in ${currentPO.status} status`,
        });
      }

      // Only allow certain changes after approval
      if (currentPO.status === 'APPROVED' && data.supplierId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot change supplier after approval',
        });
      }

      // Update PO with audit log
      const updatedPO = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.update({
          where: { id },
          data,
        });

        // Activity log removed - purchaseOrderActivity model doesn't exist

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'purchase_orders',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: currentPO,
            afterData: updated,
          },
        });

        return updated;
      });

      return updatedPO;
    }),

  // Submit PO for approval
  submit: organizationProcedure
    .input(z.object({ 
      id: z.string().cuid(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, notes } = input;

      const purchaseOrder = await ctx.prisma.purchaseOrder.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          items: true,
        },
      });

      if (!purchaseOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase order not found',
        });
      }

      if (purchaseOrder.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Only draft purchase orders can be submitted',
        });
      }

      if (purchaseOrder.items.length === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot submit purchase order without items',
        });
      }

      // Submit PO
      const result = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.update({
          where: { id },
          data: { 
            status: 'SUBMITTED',
          },
        });

        // Activity log removed - purchaseOrderActivity model doesn't exist

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'purchase_orders',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: { status: 'DRAFT' },
            afterData: { status: 'SUBMITTED' },
          },
        });

        return updated;
      });

      return result;
    }),

  // Approve or reject PO
  approve: organizationProcedure
    .input(approvalSchema)
    .mutation(async ({ ctx, input }) => {
      const { poId, action, reason, notes } = input;

      // Check permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators and managers can approve purchase orders',
        });
      }

      const purchaseOrder = await ctx.prisma.purchaseOrder.findFirst({
        where: { 
          id: poId,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!purchaseOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase order not found',
        });
      }

      if (purchaseOrder.status !== 'SUBMITTED') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Only submitted purchase orders can be approved or rejected',
        });
      }

      // Process approval/rejection
      const result = await ctx.prisma.$transaction(async (tx) => {
        const newStatus = action === 'APPROVE' ? 'APPROVED' : 'DRAFT'; // 'REJECTED' not in POStatus enum

        const updated = await tx.purchaseOrder.update({
          where: { id: poId },
          data: { 
            status: newStatus,
            ...(action === 'APPROVE' && { approvedById: ctx.user.id }),
          },
        });

        // Approval record removed - purchaseOrderApproval model doesn't exist

        // Activity log removed - purchaseOrderActivity model doesn't exist

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'purchase_orders',
            recordPk: poId,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: { status: 'SUBMITTED' },
            afterData: { status: newStatus },
          },
        });

        return updated;
      });

      return result;
    }),

  // Reject PO
  reject: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      reason: z.string().min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, reason, notes } = input;

      // Directly implement rejection logic
      const purchaseOrder = await ctx.prisma.purchaseOrder.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!purchaseOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase order not found',
        });
      }

      if (purchaseOrder.status !== 'SUBMITTED') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Only submitted purchase orders can be rejected',
        });
      }

      const result = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.update({
          where: { id },
          data: { status: 'DRAFT' }, // 'REJECTED' not in POStatus enum, using DRAFT
        });

        await tx.auditLog.create({
          data: {
            tableName: 'purchase_orders',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: { status: 'SUBMITTED' },
            afterData: { status: 'REJECTED', reason },
          },
        });

        return updated;
      });

      return result;
    }),

  // Cancel PO
  cancel: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      reason: z.string().min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, reason, notes } = input;

      const purchaseOrder = await ctx.prisma.purchaseOrder.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          items: true,
        },
      });

      if (!purchaseOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase order not found',
        });
      }

      if (['RECEIVED', 'CANCELLED'].includes(purchaseOrder.status)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot cancel purchase order in ${purchaseOrder.status} status`,
        });
      }

      // Check if any items received
      const hasReceivedItems = purchaseOrder.items.some(item => item.qtyReceived > 0);
      if (hasReceivedItems) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot cancel purchase order with received items',
        });
      }

      // Cancel PO
      const result = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.update({
          where: { id },
          data: { 
            status: 'CANCELLED',
          },
        });

        // Activity log removed - purchaseOrderActivity model doesn't exist

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'purchase_orders',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            beforeData: { status: purchaseOrder.status },
            afterData: { status: 'CANCELLED' },
          },
        });

        return updated;
      });

      return result;
    }),

  // Receive items
  receive: organizationProcedure
    .input(receiveItemsSchema)
    .mutation(async ({ ctx, input }) => {
      const { poId, receivedDate, items, createReceipt } = input;

      const purchaseOrder = await ctx.prisma.purchaseOrder.findFirst({
        where: { 
          id: poId,
          organizationId: ctx.user.organizationId,
        },
        include: {
          items: true,
        },
      });

      if (!purchaseOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Purchase order not found',
        });
      }

      if (purchaseOrder.status !== 'APPROVED') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Only approved purchase orders can be received',
        });
      }

      // Validate items
      for (const receiveItem of items) {
        const poItem = purchaseOrder.items.find(item => item.id === receiveItem.poItemId);
        
        if (!poItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Purchase order item not found',
          });
        }

        const remainingToReceive = poItem.qtyOrdered - poItem.qtyReceived;
        if (receiveItem.qtyReceived > remainingToReceive) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot receive ${receiveItem.qtyReceived} units. Only ${remainingToReceive} remaining.`,
          });
        }
      }

      // Process receipt in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        let receipt = null;
        let hasDiscrepancies = false;

        // Create receipt if requested
        if (createReceipt) {
          // Generate receipt number
          const receiptCount = await tx.receipt.count({
            where: {
              receivedDate: {
                gte: new Date(new Date().getFullYear(), 0, 1),
              },
            },
          });

          const receiptNumber = `REC-${new Date().getFullYear()}-${String(receiptCount + 1).padStart(6, '0')}`;

          receipt = await tx.receipt.create({
            data: {
              poId,
              // receiptNumber doesn't exist in Receipt model
              reference: receiptNumber,
              receivedDate,
              receivedById: ctx.user.id,
              // status doesn't exist in Receipt model
            },
          });
        }

        // Process each item
        for (const receiveItem of items) {
          const poItem = purchaseOrder.items.find(item => item.id === receiveItem.poItemId);
          if (!poItem) continue;

          // Check for discrepancies
          if (receiveItem.qtyReceived !== poItem.qtyOrdered || receiveItem.qtyRejected > 0) {
            hasDiscrepancies = true;
          }

          // Create lot if lot number provided
          let lotId = null;
          if (receiveItem.lotNumber) {
            const lot = await tx.lot.create({
              data: {
                lotNumber: receiveItem.lotNumber,
                itemId: poItem.itemId,
                supplierId: purchaseOrder.supplierId,
                receivedDate,
                expirationDate: receiveItem.expirationDate,
                qtyInitial: receiveItem.qtyReceived,
                qtyOnHand: receiveItem.qtyReceived,
                unitCost: poItem.unitCost,
              },
            });
            lotId = lot.id;
          }

          // Update or create inventory
          const existingInventory = await tx.inventory.findFirst({
            where: {
              itemId: poItem.itemId,
              locationId: receiveItem.locationId,
              lotId,
            },
          });

          if (existingInventory) {
            await tx.inventory.update({
              where: { id: existingInventory.id },
              data: {
                qtyOnHand: {
                  increment: receiveItem.qtyReceived,
                },
              },
            });
          } else {
            await tx.inventory.create({
              data: {
                itemId: poItem.itemId,
                locationId: receiveItem.locationId,
                lotId,
                qtyOnHand: receiveItem.qtyReceived,
                qtyReserved: 0,
                qtyInTransit: 0,
              },
            });
          }

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              itemId: poItem.itemId,
              toLocationId: receiveItem.locationId,
              qty: receiveItem.qtyReceived,
              movementType: 'INBOUND',
              refType: 'PO',
              refId: poId,
              movedById: ctx.user.id,
              movedAt: receivedDate,
              notes: `Received from PO ${purchaseOrder.poNumber}`,
              lotId,
            },
          });

          // Update PO item
          await tx.purchaseOrderItem.update({
            where: { id: receiveItem.poItemId },
            data: {
              qtyReceived: {
                increment: receiveItem.qtyReceived,
              },
            },
          });

          // Create receipt item if receipt exists
          if (receipt) {
            await tx.receiptItem.create({
              data: {
                receiptId: receipt.id,
                itemId: poItem!.itemId,
                qtyReceived: receiveItem.qtyReceived,
                // qtyRejected doesn't exist in ReceiptItem
                unitCost: poItem!.unitCost,
                lotId,
                locationId: receiveItem.locationId,
                serialNumber: receiveItem.serialNumbers?.[0], // Take first serial number if available
                expirationDate: receiveItem.expirationDate,
              },
            });
          }

          // Handle serial numbers if provided
          if (receiveItem.serialNumbers && receiveItem.serialNumbers.length > 0) {
            for (const serialNumber of receiveItem.serialNumbers) {
              await tx.serialNumber.create({
                data: {
                  serialNumber,
                  itemId: poItem.itemId,
                  locationId: receiveItem.locationId,
                  lotId,
                  status: 'AVAILABLE',
                  // receivedDate doesn't exist in SerialNumber
                },
              });
            }
          }
        }

        // hasDiscrepancies field doesn't exist in Receipt model

        // Check if PO is fully received
        const updatedPO = await tx.purchaseOrder.findUnique({
          where: { id: poId },
          include: { items: true },
        });

        const fullyReceived = updatedPO?.items.every(
          item => item.qtyReceived >= item.qtyOrdered
        );

        if (fullyReceived) {
          await tx.purchaseOrder.update({
            where: { id: poId },
            data: { 
              status: 'RECEIVED',
            },
          });
        }

        // Activity log removed - purchaseOrderActivity model doesn't exist

        return {
          receipt,
          itemsReceived: items.length,
          hasDiscrepancies,
          fullyReceived,
        };
      });

      return result;
    }),

  // Duplicate PO
  duplicate: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      includeItems: z.boolean().default(true),
      updateExpectedDate: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, includeItems, updateExpectedDate } = input;

      const sourcePO = await ctx.prisma.purchaseOrder.findFirst({
        where: { 
          id,
          organizationId: ctx.user.organizationId,
        },
        include: includeItems ? { items: true } : undefined,
      });

      if (!sourcePO) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source purchase order not found',
        });
      }

      // Create duplicate
      const duplicatePO = await ctx.prisma.$transaction(async (tx) => {
        // Generate new PO number
        const poCount = await tx.purchaseOrder.count({
          where: {
            organizationId: ctx.user.organizationId,
            orderDate: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        });
        
        const poNumber = `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(poCount + 1).padStart(5, '0')}`;

        // Create new PO
        const newPO = await tx.purchaseOrder.create({
          data: {
            organizationId: ctx.user.organizationId,
            poNumber,
            supplierId: sourcePO.supplierId,
            orderDate: new Date(),
            expectedDate: updateExpectedDate 
              ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
              : sourcePO.expectedDate,
            status: 'DRAFT',
            // paymentTerms and shippingTerms don't exist in PurchaseOrder
            subtotal: Number(sourcePO.subtotal),
            tax: Number(sourcePO.tax),
            total: Number(sourcePO.total),
            notes: `Duplicated from ${sourcePO.poNumber}`,
            createdById: ctx.user.id,
          },
        });

        // Duplicate items if requested
        if (includeItems && 'items' in sourcePO && Array.isArray(sourcePO.items)) {
          for (const item of sourcePO.items) {
            await tx.purchaseOrderItem.create({
              data: {
                poId: newPO.id,
                itemId: item.itemId,
                qtyOrdered: item.qtyOrdered,
                qtyReceived: 0,
                unitCost: item.unitCost,
                taxRate: item.taxRate,
                totalCost: Number(item.totalCost),
                description: item.description,
              },
            });
          }
        }

        // Activity log removed - purchaseOrderActivity model doesn't exist
        
        await tx.auditLog.create({
          data: {
            tableName: 'purchase_orders',
            recordPk: newPO.id,
            action: 'CREATE',
            userId: ctx.user.id,
            afterData: { duplicatedFrom: sourcePO.poNumber },
          },
        });

        return newPO;
      });

      return duplicatePO;
    }),

  // PO items sub-router
  items: createTRPCRouter({
    // Add item to PO
    add: organizationProcedure
      .input(purchaseOrderItemSchema)
      .mutation(async ({ ctx, input }) => {
        const purchaseOrder = await ctx.prisma.purchaseOrder.findFirst({
          where: { 
            id: input.poId,
            organizationId: ctx.user.organizationId,
          },
        });

        if (!purchaseOrder) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Purchase order not found',
          });
        }

        if (!['DRAFT', 'SUBMITTED'].includes(purchaseOrder.status)) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot add items to purchase order in ${purchaseOrder.status} status`,
          });
        }

        // Check if item already exists
        const existingItem = await ctx.prisma.purchaseOrderItem.findFirst({
          where: {
            poId: input.poId,
            itemId: input.itemId,
          },
        });

        if (existingItem) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Item already exists in purchase order. Use update instead.',
          });
        }

        // Add item and recalculate totals
        const result = await ctx.prisma.$transaction(async (tx) => {
          // Calculate item totals
          const lineTotal = input.qtyOrdered * input.unitCost;
          const taxAmount = lineTotal * (input.taxRate / 100);
          const totalCost = lineTotal + taxAmount;

          // Create PO item
          const newItem = await tx.purchaseOrderItem.create({
            data: {
              ...input,
              qtyReceived: 0,
              totalCost,
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

          // Update PO totals
          await tx.purchaseOrder.update({
            where: { id: input.poId },
            data: {
              subtotal: { increment: lineTotal },
              tax: { increment: taxAmount },
              total: { increment: totalCost },
            },
          });

          // Activity log removed - purchaseOrderActivity model doesn't exist

          return newItem;
        });

        return result;
      }),

    // Update PO item
    update: organizationProcedure
      .input(z.object({
        id: z.string().cuid(),
        qtyOrdered: z.number().int().positive().optional(),
        unitCost: z.number().min(0).optional(),
        taxRate: z.number().min(0).max(100).optional(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;

        const currentItem = await ctx.prisma.purchaseOrderItem.findUnique({
          where: { id },
        });
        
        // Get the PO separately
        const po = currentItem ? await ctx.prisma.purchaseOrder.findFirst({
          where: { 
            id: currentItem.poId,
            organizationId: ctx.user.organizationId,
          },
        }) : null;

        if (!currentItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Purchase order item not found',
          });
        }

        if (!po || !['DRAFT', 'SUBMITTED'].includes(po.status)) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot update items in purchase order with ${po?.status || 'unknown'} status`,
          });
        }

        // Prevent reducing quantity below received
        if (data.qtyOrdered && data.qtyOrdered < currentItem.qtyReceived) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot reduce quantity below received amount (${currentItem.qtyReceived})`,
          });
        }

        // Update item and recalculate totals
        const result = await ctx.prisma.$transaction(async (tx) => {
          // Calculate new totals
          const qtyOrdered = data.qtyOrdered ?? currentItem.qtyOrdered;
          const unitCost = data.unitCost ?? Number(currentItem.unitCost);
          const taxRate = data.taxRate ?? Number(currentItem.taxRate);

          const lineTotal = qtyOrdered * unitCost;
          const taxAmount = lineTotal * (taxRate / 100);
          const totalCost = lineTotal + taxAmount;

          // Update PO item
          const updated = await tx.purchaseOrderItem.update({
            where: { id },
            data: {
              ...data,
              totalCost,
            },
          });

          // Update PO totals (subtract old, add new)
          const oldTotalCost = Number(currentItem.totalCost);
          const oldLineTotal = Number(currentItem.qtyOrdered) * Number(currentItem.unitCost);
          const oldTaxAmount = oldLineTotal * (Number(currentItem.taxRate) / 100);
          
          await tx.purchaseOrder.update({
            where: { id: currentItem.poId },
            data: {
              subtotal: {
                increment: lineTotal - oldLineTotal,
              },
              tax: {
                increment: taxAmount - oldTaxAmount,
              },
              total: {
                increment: totalCost - oldTotalCost,
              },
            },
          });

          // Activity log removed - purchaseOrderActivity model doesn't exist

          return updated;
        });

        return result;
      }),

    // Remove item from PO
    remove: organizationProcedure
      .input(z.object({ id: z.string().cuid() }))
      .mutation(async ({ ctx, input }) => {
        const item = await ctx.prisma.purchaseOrderItem.findUnique({
          where: { id: input.id },
        });
        
        // Get the PO separately
        const po = item ? await ctx.prisma.purchaseOrder.findFirst({
          where: { 
            id: item.poId,
            organizationId: ctx.user.organizationId,
          },
        }) : null;

        if (!item) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Purchase order item not found',
          });
        }

        if (!po || !['DRAFT', 'SUBMITTED'].includes(po.status)) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot remove items from purchase order in ${po?.status || 'unknown'} status`,
          });
        }

        if (item.qtyReceived > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Cannot remove item that has been partially received',
          });
        }

        // Remove item and update totals
        const result = await ctx.prisma.$transaction(async (tx) => {
          // Delete item
          await tx.purchaseOrderItem.delete({
            where: { id: input.id },
          });

          // Update PO totals
          const lineTotal = Number(item.qtyOrdered) * Number(item.unitCost);
          const taxAmount = lineTotal * (Number(item.taxRate) / 100);
          const totalCost = Number(item.totalCost);
          
          await tx.purchaseOrder.update({
            where: { id: item.poId },
            data: {
              subtotal: { decrement: lineTotal },
              tax: { decrement: taxAmount },
              total: { decrement: totalCost },
            },
          });

          // Activity log removed - purchaseOrderActivity model doesn't exist

          return { success: true };
        });

        return result;
      }),
  }),

  // Get PO performance metrics
  getPerformance: organizationProcedure
    .input(z.object({
      supplierId: z.string().cuid().optional(),
      dateFrom: z.date(),
      dateTo: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const { supplierId, dateFrom, dateTo } = input;

      const where: Prisma.PurchaseOrderWhereInput = {
        organizationId: ctx.user.organizationId,
        orderDate: {
          gte: dateFrom,
          lte: dateTo,
        },
        status: { in: ['APPROVED', 'RECEIVED'] },
      };

      if (supplierId) where.supplierId = supplierId;

      const purchaseOrders = await ctx.prisma.purchaseOrder.findMany({
        where,
        include: {
          items: true,
          receipts: true,
        },
      });

      // Calculate metrics
      const metrics = {
        summary: {
          totalOrders: purchaseOrders.length,
          totalValue: purchaseOrders.reduce((sum, po) => sum + Number(po.total || 0), 0),
          avgOrderValue: purchaseOrders.length > 0
            ? purchaseOrders.reduce((sum, po) => sum + Number(po.total || 0), 0) / purchaseOrders.length
            : 0,
        },
        delivery: {
          onTime: 0,
          late: 0,
          early: 0,
          avgLeadTime: 0,
        },
        quality: {
          perfectOrders: 0,
          ordersWithDiscrepancies: 0,
          discrepancyRate: 0,
        },
        status: {
          approved: purchaseOrders.filter(po => po.status === 'APPROVED').length,
          received: purchaseOrders.filter(po => po.status === 'RECEIVED').length,
        },
      };

      // Calculate delivery and quality metrics
      let totalLeadTime = 0;
      let deliveryCount = 0;

      for (const po of purchaseOrders) {
        // receivedDate doesn't exist on PurchaseOrder - check receipts instead
        if (po.receipts && po.receipts.length > 0 && po.expectedDate) {
          const firstReceivedDate = po.receipts[0].receivedDate;
          const daysDiff = Math.floor(
            (firstReceivedDate.getTime() - po.expectedDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysDiff <= 0) {
            metrics.delivery.onTime++;
          } else {
            metrics.delivery.late++;
          }

          // receivedDate doesn't exist on PurchaseOrder - skip lead time calculation
        }

        // hasDiscrepancies field doesn't exist in Receipt model
        const hasDiscrepancies = false;
        if (hasDiscrepancies) {
          metrics.quality.ordersWithDiscrepancies++;
        } else if (po.status === 'RECEIVED') {
          metrics.quality.perfectOrders++;
        }
      }

      if (deliveryCount > 0) {
        metrics.delivery.avgLeadTime = Math.round(totalLeadTime / deliveryCount);
      }

      if (purchaseOrders.length > 0) {
        metrics.quality.discrepancyRate = 
          (metrics.quality.ordersWithDiscrepancies / purchaseOrders.length) * 100;
      }

      // Get top items ordered
      const itemStats = new Map();
      
      for (const po of purchaseOrders) {
        for (const item of po.items) {
          const key = item.itemId;
          if (!itemStats.has(key)) {
            itemStats.set(key, {
              itemId: item.itemId,
              totalQty: 0,
              totalValue: 0,
              orderCount: 0,
            });
          }
          const stats = itemStats.get(key);
          stats.totalQty += item.qtyOrdered;
          stats.totalValue += Number(item.totalCost);
          stats.orderCount++;
        }
      }

      const topItems = Array.from(itemStats.values())
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10);

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
            ...item,
          };
        })
      );

      return {
        period: {
          from: dateFrom,
          to: dateTo,
        },
        metrics,
        topItems: topItemsWithDetails,
      };
    }),

  // Export POs
  export: organizationProcedure
    .input(z.object({
      filters: purchaseOrderFilterSchema,
      format: z.enum(['csv', 'excel']).default('csv'),
      includeItems: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const where = {
        ...input.filters,
        organizationId: ctx.user.organizationId,
      };
      
      const purchaseOrders = await ctx.prisma.purchaseOrder.findMany({
        where: where as any,
        include: {
          supplier: true,
          items: input.includeItems ? {
            include: {
              item: true,
            },
          } : false,
        },
        orderBy: { orderDate: 'desc' },
      });

      // Prepare export data
      const exportData = [];
      
      for (const po of purchaseOrders) {
        const baseData = {
          poNumber: po.poNumber,
          orderDate: po.orderDate.toISOString(),
          status: po.status,
          supplierCode: po.supplier.supplierCode,
          supplierName: po.supplier.name,
          subtotal: Number(po.subtotal),
          tax: Number(po.tax),
          total: Number(po.total),
          expectedDate: po.expectedDate?.toISOString() || '',
          // receivedDate doesn't exist on PurchaseOrder
        };

        if (input.includeItems && po.items) {
          for (const item of po.items) {
            exportData.push({
              ...baseData,
              itemSku: (item as any).item?.sku || '',
              itemName: (item as any).item?.name || '',
              qtyOrdered: item.qtyOrdered,
              qtyReceived: item.qtyReceived,
              unitCost: Number(item.unitCost),
              lineTotal: Number(item.totalCost),
            });
          }
        } else {
          exportData.push(baseData);
        }
      }

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          tableName: 'purchase_orders',
          recordPk: 'EXPORT',
          action: 'UPDATE', // Using UPDATE as closest match for export action
          userId: ctx.user.id,
          afterData: {
            format: input.format,
            recordCount: purchaseOrders.length,
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