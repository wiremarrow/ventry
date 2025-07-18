import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

import type { Prisma } from '@ventry/database';

// Input validation schemas
const receiptCreateSchema = z.object({
  purchaseOrderId: z.string().cuid(),
  receivedDate: z.date().default(() => new Date()),
  notes: z.string().optional(),
  items: z.array(z.object({
    poItemId: z.string().cuid(),
    qtyReceived: z.number().int().min(0),
    qtyRejected: z.number().int().min(0).default(0),
    locationId: z.string().cuid(),
    lotNumber: z.string().optional(),
    expirationDate: z.date().optional(),
    serialNumbers: z.array(z.string()).optional(),
    rejectionReason: z.string().optional(),
    notes: z.string().optional(),
  })).min(1),
});

const receiptFilterSchema = z.object({
  search: z.string().optional(),
  purchaseOrderId: z.string().cuid().optional(),
  supplierId: z.string().cuid().optional(),
  warehouseId: z.string().cuid().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
  hasDiscrepancies: z.boolean().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['receiptNumber', 'receivedDate', 'supplier', 'status']).default('receivedDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const receiptItemSchema = z.object({
  receiptId: z.string().cuid(),
  poItemId: z.string().cuid(),
  qtyReceived: z.number().int().min(0),
  qtyRejected: z.number().int().min(0).default(0),
  locationId: z.string().cuid(),
  lotNumber: z.string().optional(),
  expirationDate: z.date().optional(),
  serialNumbers: z.array(z.string()).optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});

const discrepancyReportSchema = z.object({
  receiptId: z.string().cuid(),
  reportType: z.enum(['SUMMARY', 'DETAILED']).default('SUMMARY'),
  includeResolutions: z.boolean().default(true),
});

export const receiptsRouter = createTRPCRouter({
  // List receipts with filtering
  list: organizationProcedure
    .input(receiptFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        search,
        purchaseOrderId,
        supplierId,
        warehouseId,
        status,
        hasDiscrepancies,
        dateFrom,
        dateTo,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: Prisma.ReceiptWhereInput = {
        purchaseOrder: {
          organizationId: ctx.user.organizationId,
        },
      };

      // Search filter
      if (search) {
        where.OR = [
          { reference: { contains: search, mode: 'insensitive' } },
          { purchaseOrder: { poNumber: { contains: search, mode: 'insensitive' } } },
          { notes: { contains: search, mode: 'insensitive' } },
        ];
      }

      // PO filter
      if (purchaseOrderId) {
        where.poId = purchaseOrderId;
      }

      // Supplier filter
      if (supplierId) {
        where.purchaseOrder = {
          ...where.purchaseOrder as any,
          supplierId,
        };
      }

      // Warehouse filter - Note: PurchaseOrder doesn't have warehouseId in new schema
      // TODO: Consider adding warehouse relation to PurchaseOrder if needed
      /*
      if (warehouseId) {
        where.purchaseOrder = {
          ...where.purchaseOrder as any,
          warehouseId,
        };
      }
      */

      // Status filter - Note: Receipt doesn't have status field in new schema
      // TODO: Consider filtering by PurchaseOrder status or adding status to Receipt
      /*
      if (status) {
        where.status = status;
      }
      */

      // Discrepancies filter - Note: Receipt doesn't have hasDiscrepancies field
      // TODO: Implement discrepancy detection logic post-query
      /*
      if (hasDiscrepancies !== undefined) {
        where.hasDiscrepancies = hasDiscrepancies;
      }
      */

      // Date filters
      if (dateFrom || dateTo) {
        where.receivedDate = {};
        if (dateFrom) where.receivedDate.gte = dateFrom;
        if (dateTo) where.receivedDate.lte = dateTo;
      }

      // Execute queries
      const [receipts, total] = await Promise.all([
        ctx.prisma.receipt.findMany({
          where,
          include: {
            purchaseOrder: {
              include: {
                supplier: {
                  select: {
                    id: true,
                    name: true,
                    supplierCode: true,
                  },
                },
                // Note: PurchaseOrder doesn't have warehouse relation in new schema
              },
            },
            receivedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                items: true,
              },
            },
            items: {
              select: {
                id: true,
                qtyReceived: true,
                // qtyRejected: true, // Not in schema
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: sortBy === 'supplier'
            ? { purchaseOrder: { supplier: { name: sortOrder } } }
            : sortBy === 'receiptNumber'
            ? { reference: sortOrder } // Receipt doesn't have receiptNumber, using reference
            : sortBy === 'status'
            ? { receivedDate: sortOrder } // No status field, using receivedDate as fallback
            : { [sortBy]: sortOrder },
        }),
        ctx.prisma.receipt.count({ where }),
      ]);

      // Calculate metrics
      const receiptsWithMetrics = receipts.map(receipt => ({
        ...receipt,
        itemCount: receipt._count?.items || 0,
        totalReceived: receipt.items?.reduce((sum: number, item: any) => sum + item.qtyReceived, 0) || 0,
        totalRejected: 0, // qtyRejected not in schema
        rejectionRate: 0, // Cannot calculate without qtyRejected
      }));

      return {
        receipts: receiptsWithMetrics,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get single receipt with full details
  get: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const receipt = await ctx.prisma.receipt.findFirst({
        where: { 
          id: input.id,
          purchaseOrder: {
            organizationId: ctx.user.organizationId,
          },
        },
        include: {
          purchaseOrder: {
            include: {
              supplier: {
                include: {
                  contacts: true, // isPrimary field doesn't exist
                },
              },
              // warehouse: true, // PurchaseOrder doesn't have warehouse
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
              lot: true,
              // serialNumbers: true, // ReceiptItem has serialNumber (singular) not serialNumbers
              location: {
                include: {
                  warehouse: true,
                },
              },
            },
          },
          receivedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          // activities: { // Receipt doesn't have activities relation
          //   include: {
          //     user: {
          //       select: {
          //         id: true,
          //         firstName: true,
          //         lastName: true,
          //         email: true,
          //       },
          //     },
          //   },
          //   orderBy: { activityDate: 'desc' },
          //   take: 20,
          // },
        },
      });

      if (!receipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Receipt not found',
        });
      }

      // Calculate discrepancies
      const discrepancies: any[] = [];
      const receiptWithRelations = receipt as typeof receipt & { 
        items?: any[]; 
        purchaseOrder?: { items?: any[] } 
      };
      if (receiptWithRelations.items) {
        for (const item of receiptWithRelations.items) {
        // Find corresponding PO item by itemId
        const poItem = receiptWithRelations.purchaseOrder?.items?.find((poi: any) => poi.itemId === item.itemId);
        if (poItem) {
          const expectedQty = poItem.qtyOrdered - poItem.qtyReceived + item.qtyReceived;
          const actualQty = item.qtyReceived; // No qtyRejected in schema
          
          if (actualQty !== expectedQty) {
            discrepancies.push({
              item: poItem.item,
              expectedQty,
              actualQty,
              variance: actualQty - expectedQty,
              variancePercentage: expectedQty > 0 ? ((actualQty - expectedQty) / expectedQty) * 100 : 0,
            });
          }
        }
      }
      }

      // Calculate metrics
      const metrics = {
        itemCount: receiptWithRelations.items?.length || 0,
        totalReceived: receiptWithRelations.items?.reduce((sum: number, item: any) => sum + item.qtyReceived, 0) || 0,
        totalRejected: 0, // qtyRejected not in schema
        rejectionRate: 0, // Cannot calculate without qtyRejected
        discrepancyCount: discrepancies.length,
      };

      return {
        ...receipt,
        metrics,
        discrepancies,
      };
    }),

  // Create receipt
  create: organizationProcedure
    .input(receiptCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { purchaseOrderId, receivedDate, notes, items } = input;

      // Check permissions
      if (!['ADMIN', 'MANAGER', 'WAREHOUSE'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to create receipts',
        });
      }

      // Validate PO
      const purchaseOrder = await ctx.prisma.purchaseOrder.findFirst({
        where: { 
          id: purchaseOrderId,
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
      let hasDiscrepancies = false;
      for (const receiptItem of items) {
        // Note: input schema has poItemId but we need to match by itemId
        const poItem = purchaseOrder.items.find(item => item.id === receiptItem.poItemId);
        
        if (!poItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Purchase order item not found',
          });
        }

        const remainingToReceive = poItem.qtyOrdered - poItem.qtyReceived;
        if (receiptItem.qtyReceived > remainingToReceive) {
          hasDiscrepancies = true;
        }

        // Note: qtyRejected in input but not in schema
        if (receiptItem.qtyRejected && receiptItem.qtyRejected > 0) {
          hasDiscrepancies = true;
        }
      }

      // Create receipt in transaction
      const receipt = await ctx.prisma.$transaction(async (tx) => {
        // Generate receipt number
        const receiptCount = await tx.receipt.count({
          where: {
            receivedDate: {
              gte: new Date(new Date().getFullYear(), 0, 1),
            },
          },
        });

        const reference = `REC-${new Date().getFullYear()}-${String(receiptCount + 1).padStart(6, '0')}`;

        // Create receipt
        const newReceipt = await tx.receipt.create({
          data: {
            poId: purchaseOrderId,
            reference,
            receivedDate,
            receivedById: ctx.user.id,
            // status: 'PENDING', // Receipt doesn't have status field
            // hasDiscrepancies, // Receipt doesn't have hasDiscrepancies field
            notes,
          },
        });

        // Process items
        for (const item of items) {
          const poItem = purchaseOrder.items.find(poi => poi.id === item.poItemId);
          if (!poItem) continue;

          // Create lot if needed
          let lotId = null;
          if (item.lotNumber) {
            const lot = await tx.lot.create({
              data: {
                lotNumber: item.lotNumber,
                itemId: poItem.itemId,
                supplierId: purchaseOrder.supplierId,
                receivedDate,
                expirationDate: item.expirationDate,
                qtyInitial: item.qtyReceived,
                qtyOnHand: item.qtyReceived,
                unitCost: poItem.unitCost,
              },
            });
            lotId = lot.id;
          }

          // Create receipt item
          const receiptItem = await tx.receiptItem.create({
            data: {
              receiptId: newReceipt.id,
              itemId: poItem.itemId, // Use itemId from PO item
              qtyReceived: item.qtyReceived,
              // qtyRejected: item.qtyRejected, // Not in schema
              lotId,
              locationId: item.locationId,
              unitCost: poItem.unitCost,
              expirationDate: item.expirationDate,
              serialNumber: item.serialNumbers?.[0], // Store first serial number if provided
              // rejectionReason: item.rejectionReason, // Not in schema
              // notes: item.notes, // Not in ReceiptItem schema
            },
          });

          // Handle serial numbers
          if (item.serialNumbers && item.serialNumbers.length > 0) {
            for (const serialNumber of item.serialNumbers) {
              const sn = await tx.serialNumber.create({
                data: {
                  serialNumber,
                  itemId: poItem.itemId,
                  locationId: item.locationId,
                  lotId,
                  status: 'AVAILABLE',
                  // receivedDate, // Not in SerialNumber schema
                  purchaseDate: receivedDate,
                },
              });

              // Note: receiptSerialNumber table doesn't exist in schema
            }
          }

          // Update inventory
          if (item.qtyReceived > 0) {
            const existingInventory = await tx.inventory.findFirst({
              where: {
                itemId: poItem.itemId,
                locationId: item.locationId,
                lotId,
              },
            });

            if (existingInventory) {
              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  qtyOnHand: {
                    increment: item.qtyReceived,
                  },
                },
              });
            } else {
              await tx.inventory.create({
                data: {
                  itemId: poItem.itemId,
                  locationId: item.locationId,
                  lotId,
                  qtyOnHand: item.qtyReceived,
                  qtyReserved: 0,
                  qtyInTransit: 0,
                },
              });
            }

            // Create stock movement
            await tx.stockMovement.create({
              data: {
                itemId: poItem.itemId,
                toLocationId: item.locationId,
                qty: item.qtyReceived,
                movementType: 'INBOUND',
                refType: 'PO',
                refId: purchaseOrderId,
                movedById: ctx.user.id,
                movedAt: receivedDate,
                notes: `Receipt ${reference}`,
                lotId,
              },
            });
          }

          // Update PO item
          await tx.purchaseOrderItem.update({
            where: { id: item.poItemId },
            data: {
              qtyReceived: {
                increment: item.qtyReceived,
              },
            },
          });
        }

        // TODO: Create audit log when needed
        // Note: receiptActivity model doesn't exist in schema

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'receipts',
            recordPk: newReceipt.id,
            action: 'CREATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            afterData: newReceipt,
          },
        });

        return newReceipt;
      });

      return receipt;
    }),

  // Add items to receipt
  addItems: organizationProcedure
    .input(z.object({
      receiptId: z.string().cuid(),
      items: z.array(receiptItemSchema.omit({ receiptId: true })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { receiptId, items } = input;

      const receipt = await ctx.prisma.receipt.findUnique({
        where: { id: receiptId },
        include: {
          purchaseOrder: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!receipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Receipt not found',
        });
      }

      // Note: Receipt doesn't have status field in schema
      // if (receipt.status !== 'PENDING') {
      //   throw new TRPCError({
      //     code: 'PRECONDITION_FAILED',
      //     message: 'Can only add items to pending receipts',
      //   });
      // }

      // Add items in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        const addedItems = [];
        let hasDiscrepancies = false; // Receipt doesn't have hasDiscrepancies field

        for (const item of items) {
          const poItem = receipt.purchaseOrder?.items.find((poi: any) => poi.id === item.poItemId);
          if (!poItem) continue;

          // Check for existing receipt item
          const existing = await tx.receiptItem.findFirst({
            where: {
              receiptId,
              itemId: poItem?.itemId, // Use itemId from PO item
            },
          });

          if (existing) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Item already exists in receipt',
            });
          }

          // Check for discrepancies
          const remainingToReceive = poItem.qtyOrdered - poItem.qtyReceived;
          if (item.qtyReceived > remainingToReceive || (item.qtyRejected && item.qtyRejected > 0)) {
            hasDiscrepancies = true;
          }

          // Create lot if needed
          let lotId = null;
          if (item.lotNumber) {
            const lot = await tx.lot.create({
              data: {
                lotNumber: item.lotNumber,
                itemId: poItem.itemId,
                supplierId: receipt.purchaseOrder?.supplierId,
                receivedDate: receipt.receivedDate,
                expirationDate: item.expirationDate,
                qtyInitial: item.qtyReceived,
                qtyOnHand: item.qtyReceived,
                unitCost: poItem.unitCost,
              },
            });
            lotId = lot.id;
          }

          // Create receipt item
          const receiptItem = await tx.receiptItem.create({
            data: {
              receiptId,
              itemId: poItem?.itemId, // Use itemId from PO item
              qtyReceived: item.qtyReceived,
              // qtyRejected: item.qtyRejected, // Not in schema
              lotId,
              locationId: item.locationId,
              unitCost: poItem?.unitCost || 0,
              expirationDate: item.expirationDate,
              serialNumber: item.serialNumbers?.[0], // Store first serial number if provided
              // rejectionReason: item.rejectionReason, // Not in schema
              // notes: item.notes, // Not in ReceiptItem schema
            },
          });

          // Update inventory and create movements
          if (item.qtyReceived > 0) {
            const existingInventory = await tx.inventory.findFirst({
              where: {
                itemId: poItem.itemId,
                locationId: item.locationId,
                lotId,
              },
            });

            if (existingInventory) {
              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  qtyOnHand: {
                    increment: item.qtyReceived,
                  },
                },
              });
            } else {
              await tx.inventory.create({
                data: {
                  itemId: poItem.itemId,
                  locationId: item.locationId,
                  lotId,
                  qtyOnHand: item.qtyReceived,
                  qtyReserved: 0,
                  qtyInTransit: 0,
                },
              });
            }

            // Create stock movement
            await tx.stockMovement.create({
              data: {
                itemId: poItem.itemId,
                toLocationId: item.locationId,
                qty: item.qtyReceived,
                movementType: 'INBOUND',
                refType: 'PO',
                refId: receipt.poId || '',
                movedById: ctx.user.id,
                movedAt: receipt.receivedDate,
                notes: `Receipt ${receipt.reference || 'N/A'}`,
                lotId,
              },
            });
          }

          // Update PO item
          await tx.purchaseOrderItem.update({
            where: { id: item.poItemId },
            data: {
              qtyReceived: {
                increment: item.qtyReceived,
              },
            },
          });

          addedItems.push(receiptItem);
        }

        // Note: Receipt doesn't have hasDiscrepancies field
        // if (hasDiscrepancies !== receipt.hasDiscrepancies) {
          // Note: Receipt doesn't have hasDiscrepancies field
          // await tx.receipt.update({
          //   where: { id: receiptId },
          //   data: { hasDiscrepancies },
          // });
        // }

        // TODO: Create audit log when needed
        // Note: receiptActivity model doesn't exist in schema

        return {
          addedItems,
          totalItems: addedItems.length,
        };
      });

      return result;
    }),

  // Update receipt items
  updateItems: organizationProcedure
    .input(z.object({
      items: z.array(z.object({
        id: z.string().cuid(),
        qtyReceived: z.number().int().min(0).optional(),
        qtyRejected: z.number().int().min(0).optional(),
        locationId: z.string().cuid().optional(),
        rejectionReason: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { items } = input;

      // Update items in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        const updatedItems = [];

        for (const item of items) {
          const currentItem = await tx.receiptItem.findUnique({
            where: { id: item.id },
            include: {
              receipt: {
                include: {
                  purchaseOrder: true,
                },
              },
              item: true,
            },
          });

          if (!currentItem) continue;

          // Note: Receipt doesn't have status field
          // if (currentItem.receipt.status !== 'PENDING') {
          //   throw new TRPCError({
          //     code: 'PRECONDITION_FAILED',
          //     message: 'Can only update items in pending receipts',
          //   });
          // }

          // Calculate quantity changes
          const qtyReceivedDiff = (item.qtyReceived ?? currentItem.qtyReceived) - currentItem.qtyReceived;
          // Note: qtyRejected not in schema
          const qtyRejectedDiff = 0; // (item.qtyRejected ?? currentItem.qtyRejected) - currentItem.qtyRejected;

          // Update receipt item
          const updated = await tx.receiptItem.update({
            where: { id: item.id },
            data: {
              qtyReceived: item.qtyReceived,
              // qtyRejected: item.qtyRejected, // Not in schema
              locationId: item.locationId,
              // rejectionReason: item.rejectionReason, // Not in schema
              // notes: item.notes, // Not in ReceiptItem schema
            },
          });

          // Update inventory if quantities changed
          if (qtyReceivedDiff !== 0) {
            const inventory = await tx.inventory.findFirst({
              where: {
                itemId: currentItem.itemId, // ReceiptItem has direct itemId
                locationId: item.locationId || currentItem.locationId,
                lotId: currentItem.lotId,
              },
            });

            if (inventory) {
              await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                  qtyOnHand: {
                    increment: qtyReceivedDiff,
                  },
                },
              });
            }

            // Update PO item - need to find it by itemId
            const poItem = await tx.purchaseOrderItem.findFirst({
              where: {
                purchaseOrder: { id: currentItem.receipt.poId! },
                itemId: currentItem.itemId,
              },
            });
            if (poItem) {
              await tx.purchaseOrderItem.update({
                where: { id: poItem.id },
              data: {
                qtyReceived: {
                  increment: qtyReceivedDiff,
                },
              },
              });
            }
          }

          updatedItems.push(updated);
        }

        // Check for discrepancies
        const receiptIds = [...new Set(updatedItems.map(item => item.receiptId))];
        for (const receiptId of receiptIds) {
          const receiptItems = await tx.receiptItem.findMany({
            where: { receiptId },
            include: {
              item: true,
            },
          });

          let hasDiscrepancies = false;
          for (const item of receiptItems) {
            // Note: qtyRejected not in schema, poItem relation not available
            // if (item.qtyRejected > 0 || item.qtyReceived !== item.poItem.qtyOrdered) {
            //   hasDiscrepancies = true;
            //   break;
            // }
          }

          // Note: Receipt doesn't have hasDiscrepancies field
          // await tx.receipt.update({
          //   where: { id: receiptId },
          //   data: { hasDiscrepancies },
          // });

          // TODO: Create audit log when needed
          // Note: receiptActivity model doesn't exist in schema
        }

        return {
          updatedItems,
          totalUpdated: updatedItems.length,
        };
      });

      return result;
    }),

  // Complete receipt
  complete: organizationProcedure
    .input(z.object({
      id: z.string().cuid(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, notes } = input;

      const receipt = await ctx.prisma.receipt.findFirst({
        where: { 
          id,
          purchaseOrder: {
            organizationId: ctx.user.organizationId,
          },
        },
        include: {
          purchaseOrder: {
            include: {
              items: true,
            },
          },
          items: true,
        },
      });

      if (!receipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Receipt not found',
        });
      }

      // Note: Receipt doesn't have status field
      // if (receipt.status !== 'PENDING') {
      //   throw new TRPCError({
      //     code: 'PRECONDITION_FAILED',
      //     message: 'Receipt is already completed',
      //   });
      // }

      if (!receipt.items || receipt.items.length === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot complete receipt without items',
        });
      }

      // Complete receipt in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Update receipt status
        const updated = await tx.receipt.update({
          where: { id },
          data: {
            // status: 'COMPLETED', // Receipt doesn't have status field
            // completedDate: new Date(), // Receipt doesn't have completedDate field
            notes: notes || receipt.notes, // Update notes if provided
          },
        });

        // Check if PO is fully received
        const updatedPO = await tx.purchaseOrder.findUnique({
          where: { id: receipt.poId! },
          include: { items: true },
        });

        const fullyReceived = updatedPO?.items.every(
          item => item.qtyReceived >= item.qtyOrdered
        );

        if (fullyReceived) {
          await tx.purchaseOrder.update({
            where: { id: receipt.poId! },
            data: {
              status: 'RECEIVED',
              // receivedDate: new Date(), // PurchaseOrder doesn't have receivedDate field
            },
          });

          // TODO: Create audit log when needed
          // Note: purchaseOrderActivity model doesn't exist in schema
        }

        // TODO: Create audit log when needed
        // Note: receiptActivity model doesn't exist in schema

        // Create audit log
        await tx.auditLog.create({
          data: {
            tableName: 'receipts',
            recordPk: id,
            action: 'UPDATE',
            userId: ctx.user.id,
            organizationId: ctx.user.organizationId!,
            beforeData: { status: 'PENDING' },
            afterData: { status: 'COMPLETED' },
          },
        });

        return {
          receipt: updated,
          poFullyReceived: fullyReceived,
        };
      });

      return result;
    }),

  // Get discrepancies
  getDiscrepancies: organizationProcedure
    .input(discrepancyReportSchema)
    .query(async ({ ctx, input }) => {
      const { receiptId, reportType, includeResolutions } = input;

      const receipt = await ctx.prisma.receipt.findFirst({
        where: { 
          id: receiptId,
          purchaseOrder: {
            organizationId: ctx.user.organizationId,
          },
        },
        include: {
          purchaseOrder: {
            include: {
              supplier: true,
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
              lot: true,
              location: true,
            },
          },
        },
      });

      if (!receipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Receipt not found',
        });
      }

      const discrepancies = {
        summary: {
          totalItems: receipt.items.length,
          itemsWithDiscrepancies: 0,
          totalExpected: 0,
          totalReceived: 0,
          totalRejected: 0,
          totalVariance: 0,
        },
        details: [] as any[],
        resolutions: [] as any[],
      };

      // Analyze each item
      for (const item of receipt.items) {
        const poItem = receipt.purchaseOrder?.items.find((poi: any) => poi.itemId === item.itemId);
        if (!poItem) continue;

        const expectedQty = poItem.qtyOrdered;
        const receivedQty = item.qtyReceived;
        const rejectedQty = 0; // qtyRejected not in schema
        const totalQty = receivedQty + rejectedQty;
        const variance = totalQty - expectedQty;

        discrepancies.summary.totalExpected += expectedQty;
        discrepancies.summary.totalReceived += receivedQty;
        discrepancies.summary.totalRejected += rejectedQty;

        if (variance !== 0 || rejectedQty > 0) {
          discrepancies.summary.itemsWithDiscrepancies++;
          discrepancies.summary.totalVariance += Math.abs(variance);

          const detail = {
            item: {
              id: poItem.id,
              itemId: poItem.itemId,
              qtyOrdered: poItem.qtyOrdered,
              unitCost: poItem.unitCost,
            },
            receipt: {
              qtyReceived: receivedQty,
              qtyRejected: rejectedQty,
              // rejectionReason: item.rejectionReason, // Not in schema
              location: item.location,
              lot: item.lot,
            },
            discrepancy: {
              type: variance > 0 ? 'OVER_RECEIPT' : variance < 0 ? 'UNDER_RECEIPT' : 'REJECTION_ONLY',
              expectedQty,
              actualQty: totalQty,
              variance,
              variancePercentage: expectedQty > 0 ? (variance / expectedQty) * 100 : 0,
              costImpact: variance * Number(poItem.unitCost),
            },
          };

          if (reportType === 'DETAILED') {
            // detail.notes = item.notes; // Not in ReceiptItem schema
            // Note: receiptSerialNumber model doesn't exist
            // detail.serialNumbers = await ctx.prisma.receiptSerialNumber.findMany({
            //   where: {
            //     receiptId,
            //     serialNumber: {
            //       itemId: poItem.itemId,
            //     },
            //   },
            //   include: {
            //     serialNumber: true,
            //   },
            // });
          }

          discrepancies.details.push(detail);
        }
      }

      // Get resolution suggestions if requested
      if (includeResolutions && discrepancies.details.length > 0) {
        for (const detail of discrepancies.details) {
          const resolution = {
            item: detail.item,
            discrepancyType: detail.discrepancy.type,
            suggestions: [] as string[],
          };

          if (detail.discrepancy.type === 'OVER_RECEIPT') {
            resolution.suggestions.push('Return excess quantity to supplier');
            resolution.suggestions.push('Negotiate credit for additional items');
            resolution.suggestions.push('Update purchase order to match receipt');
          } else if (detail.discrepancy.type === 'UNDER_RECEIPT') {
            resolution.suggestions.push('Contact supplier for missing items');
            resolution.suggestions.push('Create backorder for remaining quantity');
            resolution.suggestions.push('Request expedited shipment');
          }

          if (detail.receipt.qtyRejected > 0) {
            resolution.suggestions.push('Create return authorization for rejected items');
            resolution.suggestions.push('Document quality issues with photos');
            resolution.suggestions.push('Request replacement or credit');
          }

          discrepancies.resolutions.push(resolution);
        }
      }

      return discrepancies;
    }),

  // Export receipts
  export: organizationProcedure
    .input(z.object({
      filters: receiptFilterSchema,
      format: z.enum(['csv', 'excel']).default('csv'),
      includeItems: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const receipts = await ctx.prisma.receipt.findMany({
        where: {
          ...(input.filters as any),
          purchaseOrder: {
            organizationId: ctx.user.organizationId,
          },
        },
        include: {
          purchaseOrder: {
            include: {
              supplier: true,
              // warehouse: true, // PurchaseOrder doesn't have warehouse
            },
          },
          receivedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          items: input.includeItems ? {
            include: {
              item: true,
              location: true,
              lot: true,
            },
          } : false,
        },
        orderBy: { receivedDate: 'desc' },
      });

      // Prepare export data
      const exportData = [];
      
      for (const receipt of receipts) {
        const baseData = {
          reference: receipt.reference || '',
          receivedDate: receipt.receivedDate.toISOString(),
          // status: receipt.status, // Receipt doesn't have status
          poNumber: receipt.purchaseOrder?.poNumber || '',
          supplierCode: receipt.purchaseOrder?.supplier?.supplierCode || '',
          supplierName: receipt.purchaseOrder?.supplier?.name || '',
          // warehouse: receipt.purchaseOrder.warehouse.name, // PO doesn't have warehouse
          receivedBy: receipt.receivedBy ? `${receipt.receivedBy.firstName} ${receipt.receivedBy.lastName}` : '',
          // hasDiscrepancies: receipt.hasDiscrepancies, // Not in schema
        };

        if (input.includeItems && receipt.items && Array.isArray(receipt.items)) {
          for (const item of receipt.items) {
            const itemData = item as any; // Type assertion since includes are conditional
            exportData.push({
              ...baseData,
              itemSku: itemData.item?.sku || '',
              itemName: itemData.item?.name || '',
              qtyReceived: itemData.qtyReceived,
              // qtyRejected: item.qtyRejected, // Not in schema
              location: itemData.location?.code || '',
              lotNumber: itemData.lot?.lotNumber || '',
              // rejectionReason: item.rejectionReason || '', // Not in schema
            });
          }
        } else {
          exportData.push(baseData);
        }
      }

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          tableName: 'receipts',
          recordPk: 'EXPORT',
          action: 'CREATE', // Use CREATE since EXPORT is not in AuditAction enum
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          afterData: {
            format: input.format,
            recordCount: receipts.length,
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