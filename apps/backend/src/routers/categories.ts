import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';
import type { ItemCategory } from '@ventry/database';

// Input validation schemas
const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

const categoryUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

const categoryFilterSchema = z.object({
  search: z.string().optional(),
  parentId: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const categoriesRouter: ReturnType<typeof createTRPCRouter> = createTRPCRouter({
  // List categories with filtering and pagination
  list: organizationProcedure
    .input(categoryFilterSchema)
    .query(async ({ ctx, input }) => {
      const {
        search,
        parentId,
        page,
        limit,
        sortBy,
        sortOrder,
      } = input;

      const where: any = {
        organizationId: ctx.user.organizationId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (parentId !== undefined) {
        where.parentId = parentId;
      }

      // Remove isActive filter - field doesn't exist

      const [categories, total] = await Promise.all([
        ctx.prisma.itemCategory.findMany({
          where,
          include: {
            parent: true,
            children: {
              orderBy: { name: 'asc' },
            },
            _count: {
              select: { items: true },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.prisma.itemCategory.count({ where }),
      ]);

      return {
        categories,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get category tree (hierarchical view)
  tree: organizationProcedure.query(async ({ ctx }) => {
    const categories = await ctx.prisma.itemCategory.findMany({
      where: {
        organizationId: ctx.user.organizationId,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [
        { parentId: 'asc' },
        { name: 'asc' },
        { name: 'asc' },
      ],
    });

    // Build tree structure
    const buildTree = (
      categories: any[],
      parentId: string | null = null
    ): any[] => {
      return categories
        .filter(cat => cat.parentId === parentId)
        .map(cat => ({
          ...cat,
          children: buildTree(categories, cat.id),
        }));
    };

    return buildTree(categories);
  }),

  // Get single category by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.prisma.itemCategory.findFirst({
        where: {
          id: input.id,
        },
        include: {
          parent: true,
          children: {
            orderBy: { name: 'asc' },
          },
          items: {
            take: 10,
            orderBy: { name: 'asc' },
          },
          _count: {
            select: { items: true },
          },
        },
      });

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Category not found',
        });
      }

      return category;
    }),

  // Create new category
  create: organizationProcedure
    .input(categoryCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to create categories',
        });
      }

      // Validate parent if provided
      if (input.parentId) {
        const parent = await ctx.prisma.itemCategory.findFirst({
          where: {
            id: input.parentId,
            },
        });

        if (!parent) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Parent category not found',
          });
        }
      }

      // Create category
      const category = await ctx.prisma.itemCategory.create({
        data: {
          ...input,
          organizationId: ctx.user.organizationId,
        },
        include: {
          parent: true,
        },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          tableName: 'item_categories',
          recordPk: category.id,
          action: 'CREATE',
          userId: ctx.user.id,
          afterData: category,
        },
      });

      return category;
    }),

  // Update category
  update: organizationProcedure
    .input(categoryUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Check permissions
      if (!['ADMIN', 'MANAGER'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to update categories',
        });
      }

      // Get existing category
      const existing = await ctx.prisma.itemCategory.findFirst({
        where: {
          id,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Category not found',
        });
      }

      // Validate parent if being changed
      if (data.parentId !== undefined && data.parentId !== existing.parentId) {
        if (data.parentId === id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Category cannot be its own parent',
          });
        }

        if (data.parentId) {
          const parent = await ctx.prisma.itemCategory.findFirst({
            where: {
              id: data.parentId,
                },
          });

          if (!parent) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Parent category not found',
            });
          }

          // Check for circular reference
          let currentParent = parent;
          while (currentParent.parentId) {
            if (currentParent.parentId === id) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Circular reference detected',
              });
            }
            currentParent = await ctx.prisma.itemCategory.findUniqueOrThrow({
              where: { id: currentParent.parentId },
            });
          }
        }
      }

      // Update category
      const category = await ctx.prisma.itemCategory.update({
        where: { id },
        data,
        include: {
          parent: true,
          _count: {
            select: { items: true },
          },
        },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          tableName: 'item_categories',
          recordPk: input.id,
          action: 'UPDATE',
          userId: ctx.user.id,
          beforeData: existing,
          afterData: category,
        },
      });

      return category;
    }),

  // Delete category
  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      if (ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can delete categories',
        });
      }

      // Get category with counts
      const category = await ctx.prisma.itemCategory.findFirst({
        where: {
          id: input.id,
        },
        include: {
          _count: {
            select: {
              items: true,
              children: true,
            },
          },
        },
      });

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Category not found',
        });
      }

      // Check if category has items
      if (category._count.items > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete category with items',
        });
      }

      // Check if category has children
      if (category._count.children > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete category with subcategories',
        });
      }

      // Delete category
      await ctx.prisma.itemCategory.delete({
        where: { id: input.id },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          tableName: 'item_categories',
          recordPk: input.id,
          action: 'DELETE',
          userId: ctx.user.id,
          beforeData: category,
        },
      });

      return { success: true };
    }),

  // Reorder categories - NOT IMPLEMENTED
  // sortOrder field doesn't exist in ItemCategory schema
  // This feature would need to be added to the schema

  // Get category statistics
  stats: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.prisma.itemCategory.findFirst({
        where: {
          id: input.id,
        },
      });

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Category not found',
        });
      }

      // Get statistics
      const [
        totalItems,
        activeItems,
        totalValue,
        subcategories,
      ] = await Promise.all([
        ctx.prisma.item.count({
          where: {
            categoryId: input.id,
            },
        }),
        ctx.prisma.item.count({
          where: {
            categoryId: input.id,
            },
        }),
        ctx.prisma.inventory.aggregate({
          where: {
            item: {
              categoryId: input.id,
                },
          },
          _sum: {
            qtyOnHand: true,
          },
        }),
        ctx.prisma.itemCategory.count({
          where: {
            parentId: input.id,
          },
        }),
      ]);

      return {
        totalItems,
        activeItems,
        totalQuantity: totalValue._sum.qtyOnHand || 0,
        subcategories,
      };
    }),
});