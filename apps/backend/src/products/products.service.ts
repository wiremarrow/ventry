import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Product, Prisma } from '@ventry/database';
import { ProductRequest } from '@ventry/shared';

@Injectable()
export class ProductsService {
  constructor(private database: DatabaseService) {}

  async create(data: ProductRequest, userId: string): Promise<Product> {
    try {
      return await this.database.product.create({
        data: {
          ...data,
          createdById: userId,
          updatedById: userId,
        },
        include: {
          category: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Product SKU already exists');
      }
      throw error;
    }
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ProductWhereUniqueInput;
    where?: Prisma.ProductWhereInput;
    orderBy?: Prisma.ProductOrderByWithRelationInput;
  }): Promise<Product[]> {
    const { skip, take, cursor, where, orderBy } = params || {};

    return this.database.product.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            inventoryItems: true,
          },
        },
      },
    });
  }

  async findById(id: string): Promise<Product | null> {
    const product = await this.database.product.findUnique({
      where: { id },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            inventoryItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const product = await this.database.product.findUnique({
      where: { sku },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            inventoryItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, data: ProductRequest, userId: string): Promise<Product> {
    const product = await this.findById(id);
    
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    try {
      return await this.database.product.update({
        where: { id },
        data: {
          ...data,
          updatedById: userId,
        },
        include: {
          category: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Product SKU already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Product> {
    const product = await this.findById(id);
    
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const inventoryCount = await this.database.inventoryItem.count({
      where: { productId: id },
    });

    if (inventoryCount > 0) {
      throw new ConflictException('Cannot delete product with existing inventory');
    }

    return this.database.product.delete({
      where: { id },
    });
  }
}