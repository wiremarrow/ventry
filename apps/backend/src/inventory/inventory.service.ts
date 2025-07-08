import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { InventoryItem, InventoryMovement, Prisma } from '@ventry/database';
import { InventoryItemRequest, InventoryMovementRequest, InventoryAdjustmentRequest, InventoryTransferRequest } from '@ventry/shared';

@Injectable()
export class InventoryService {
  constructor(private database: DatabaseService) {}

  async create(data: InventoryItemRequest): Promise<InventoryItem> {
    try {
      return await this.database.inventoryItem.create({
        data,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Inventory item already exists for this product and location');
      }
      throw error;
    }
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.InventoryItemWhereInput;
    orderBy?: Prisma.InventoryItemOrderByWithRelationInput;
  }): Promise<InventoryItem[]> {
    const { skip, take, where, orderBy } = params || {};

    return this.database.inventoryItem.findMany({
      skip,
      take,
      where,
      orderBy,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        location: true,
      },
    });
  }

  async findById(id: string): Promise<InventoryItem | null> {
    const item = await this.database.inventoryItem.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        location: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return item;
  }

  async findByProductAndLocation(productId: string, locationId: string): Promise<InventoryItem | null> {
    return this.database.inventoryItem.findUnique({
      where: {
        productId_locationId: {
          productId,
          locationId,
        },
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        location: true,
      },
    });
  }

  async update(id: string, data: Partial<InventoryItemRequest>): Promise<InventoryItem> {
    const item = await this.findById(id);
    
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return this.database.inventoryItem.update({
      where: { id },
      data,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        location: true,
      },
    });
  }

  async remove(id: string): Promise<InventoryItem> {
    const item = await this.findById(id);
    
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return this.database.inventoryItem.delete({
      where: { id },
    });
  }

  async createMovement(data: InventoryMovementRequest, userId: string): Promise<InventoryMovement> {
    return this.database.$transaction(async (prisma) => {
      const inventoryItem = await prisma.inventoryItem.findUnique({
        where: { id: data.inventoryItemId },
      });

      if (!inventoryItem) {
        throw new NotFoundException('Inventory item not found');
      }

      const previousQty = inventoryItem.quantity;
      let newQty: number;

      switch (data.type) {
        case 'INBOUND':
          newQty = previousQty + data.quantity;
          break;
        case 'OUTBOUND':
          if (previousQty < data.quantity) {
            throw new BadRequestException('Insufficient stock');
          }
          newQty = previousQty - data.quantity;
          break;
        case 'ADJUSTMENT':
          newQty = data.quantity;
          break;
        case 'TRANSFER':
          if (previousQty < data.quantity) {
            throw new BadRequestException('Insufficient stock');
          }
          newQty = previousQty - data.quantity;
          break;
        case 'RETURN':
          newQty = previousQty + data.quantity;
          break;
        default:
          throw new BadRequestException('Invalid movement type');
      }

      await prisma.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: { quantity: newQty },
      });

      return prisma.inventoryMovement.create({
        data: {
          ...data,
          previousQty,
          newQty,
          createdById: userId,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          inventoryItem: {
            include: {
              location: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }

  async getMovements(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.InventoryMovementWhereInput;
    orderBy?: Prisma.InventoryMovementOrderByWithRelationInput;
  }): Promise<InventoryMovement[]> {
    const { skip, take, where, orderBy } = params || {};

    return this.database.inventoryMovement.findMany({
      skip,
      take,
      where,
      orderBy,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        inventoryItem: {
          include: {
            location: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async adjustInventory(data: InventoryAdjustmentRequest, userId: string): Promise<InventoryMovement> {
    return this.database.$transaction(async (prisma) => {
      const inventoryItem = await prisma.inventoryItem.findUnique({
        where: { id: data.inventoryItemId },
      });

      if (!inventoryItem) {
        throw new NotFoundException('Inventory item not found');
      }

      const previousQty = inventoryItem.quantity;
      const adjustmentQty = data.newQuantity - previousQty;

      await prisma.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: { quantity: data.newQuantity },
      });

      return prisma.inventoryMovement.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          productId: inventoryItem.productId,
          type: 'ADJUSTMENT',
          quantity: Math.abs(adjustmentQty),
          previousQty,
          newQty: data.newQuantity,
          reference: data.reason,
          notes: data.notes,
          createdById: userId,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          inventoryItem: {
            include: {
              location: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }

  async transferInventory(data: InventoryTransferRequest, userId: string): Promise<InventoryMovement[]> {
    return this.database.$transaction(async (prisma) => {
      const fromItem = await prisma.inventoryItem.findUnique({
        where: {
          productId_locationId: {
            productId: data.productId,
            locationId: data.fromLocationId,
          },
        },
      });

      if (!fromItem) {
        throw new NotFoundException('Source inventory item not found');
      }

      if (fromItem.quantity < data.quantity) {
        throw new BadRequestException('Insufficient stock in source location');
      }

      let toItem = await prisma.inventoryItem.findUnique({
        where: {
          productId_locationId: {
            productId: data.productId,
            locationId: data.toLocationId,
          },
        },
      });

      if (!toItem) {
        toItem = await prisma.inventoryItem.create({
          data: {
            productId: data.productId,
            locationId: data.toLocationId,
            quantity: 0,
            reorderPoint: 0,
          },
        });
      }

      const fromPreviousQty = fromItem.quantity;
      const toPreviousQty = toItem.quantity;

      await prisma.inventoryItem.update({
        where: { id: fromItem.id },
        data: { quantity: fromPreviousQty - data.quantity },
      });

      await prisma.inventoryItem.update({
        where: { id: toItem.id },
        data: { quantity: toPreviousQty + data.quantity },
      });

      const outboundMovement = await prisma.inventoryMovement.create({
        data: {
          inventoryItemId: fromItem.id,
          productId: data.productId,
          type: 'TRANSFER',
          quantity: data.quantity,
          previousQty: fromPreviousQty,
          newQty: fromPreviousQty - data.quantity,
          reference: `Transfer to ${data.toLocationId}`,
          notes: data.notes,
          createdById: userId,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          inventoryItem: {
            include: {
              location: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const inboundMovement = await prisma.inventoryMovement.create({
        data: {
          inventoryItemId: toItem.id,
          productId: data.productId,
          type: 'INBOUND',
          quantity: data.quantity,
          previousQty: toPreviousQty,
          newQty: toPreviousQty + data.quantity,
          reference: `Transfer from ${data.fromLocationId}`,
          notes: data.notes,
          createdById: userId,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          inventoryItem: {
            include: {
              location: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return [outboundMovement, inboundMovement];
    });
  }

  async getStats() {
    const [
      totalProducts,
      totalLocations,
      totalItems,
      totalValue,
      lowStockItems,
      recentMovements,
    ] = await Promise.all([
      this.database.product.count({ where: { isActive: true } }),
      this.database.location.count({ where: { isActive: true } }),
      this.database.inventoryItem.count(),
      this.database.inventoryItem.aggregate({
        _sum: {
          quantity: true,
        },
      }),
      this.database.inventoryItem.count({
        where: {
          quantity: {
            lte: this.database.inventoryItem.fields.reorderPoint,
          },
        },
      }),
      this.database.inventoryMovement.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalProducts,
      totalLocations,
      totalItems,
      totalValue: totalValue._sum.quantity || 0,
      lowStockItems,
      overStockItems: 0,
      recentMovements,
    };
  }
}