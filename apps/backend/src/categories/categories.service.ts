import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Category } from '@ventry/database';
import { CategoryRequest } from '@ventry/shared';

@Injectable()
export class CategoriesService {
  constructor(private database: DatabaseService) {}

  async create(data: CategoryRequest): Promise<Category> {
    try {
      return await this.database.category.create({
        data,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Category name already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<Category[]> {
    return this.database.category.findMany({
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string): Promise<Category | null> {
    const category = await this.database.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, data: CategoryRequest): Promise<Category> {
    const category = await this.findById(id);
    
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    try {
      return await this.database.category.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Category name already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Category> {
    const category = await this.findById(id);
    
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const productCount = await this.database.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new ConflictException('Cannot delete category with existing products');
    }

    return this.database.category.delete({
      where: { id },
    });
  }
}