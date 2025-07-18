import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

// Input validation schemas
const itemCategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

const itemCategoryUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

const itemCategoryListSchema = z.object({
  search: z.string().optional(),
  parentId: z.string().optional().nullable(),
  includeChildren: z.boolean().optional().default(false),
});

export const itemCategoriesRouter = createTRPCRouter({
  // List all categories for the organization
  list: organizationProcedure
    .input(itemCategoryListSchema)
    .query(async ({ ctx, input }) => {
      const where: any = {
        organizationId: ctx.user.organizationId,
      };

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      if (input.parentId !== undefined) {
        where.parentId = input.parentId;
      }

      const categories = await ctx.prisma.itemCategory.findMany({
        where,
        include: {
          parent: true,
          children: input.includeChildren,
          _count: {
            select: { items: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Add audit log for data access
      await ctx.prisma.auditLog.create({
        data: {
          action: 'CREATE', // Using CREATE as a proxy for LIST action
          tableName: 'item_categories',
          recordPk: 'LIST',
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          afterData: { count: categories.length },
        },
      });

      return categories;
    }),

  // Get a single category by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.prisma.itemCategory.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          parent: true,
          children: true,
          items: {
            select: {
              id: true,
              name: true,
              sku: true,
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

      return category;
    }),

  // Create a new category
  create: organizationProcedure
    .input(itemCategoryCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // If parentId is provided, verify it belongs to the organization
      if (input.parentId) {
        const parentCategory = await ctx.prisma.itemCategory.findFirst({
          where: {
            id: input.parentId,
            organizationId: ctx.user.organizationId,
          },
        });

        if (!parentCategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent category not found',
          });
        }
      }

      const category = await ctx.prisma.itemCategory.create({
        data: {
          ...input,
          organizationId: ctx.user.organizationId!,
        },
        include: {
          parent: true,
        },
      });

      // Add audit log
      await ctx.prisma.auditLog.create({
        data: {
          action: 'CREATE',
          tableName: 'item_categories',
          recordPk: category.id,
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          afterData: input,
        },
      });

      return category;
    }),

  // Update a category
  update: organizationProcedure
    .input(itemCategoryUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify category exists and belongs to organization
      const existing = await ctx.prisma.itemCategory.findFirst({
        where: {
          id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Category not found',
        });
      }

      // If parentId is being updated, verify the new parent
      if (data.parentId !== undefined && data.parentId !== null) {
        // Prevent circular reference
        if (data.parentId === id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Category cannot be its own parent',
          });
        }

        const parentCategory = await ctx.prisma.itemCategory.findFirst({
          where: {
            id: data.parentId,
            organizationId: ctx.user.organizationId,
          },
        });

        if (!parentCategory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent category not found',
          });
        }

        // Check for circular dependency
        let currentParent = parentCategory;
        while (currentParent.parentId) {
          if (currentParent.parentId === id) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Circular dependency detected',
            });
          }
          const nextParent = await ctx.prisma.itemCategory.findFirst({
            where: { id: currentParent.parentId },
          });
          if (!nextParent) break;
          currentParent = nextParent;
        }
      }

      const category = await ctx.prisma.itemCategory.update({
        where: { id },
        data,
        include: {
          parent: true,
        },
      });

      // Add audit log
      await ctx.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          tableName: 'item_categories',
          recordPk: category.id,
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          beforeData: existing,
          afterData: data,
        },
      });

      return category;
    }),

  // Delete a category
  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify category exists and belongs to organization
      const category = await ctx.prisma.itemCategory.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.user.organizationId,
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

      // Prevent deletion if category has items
      if (category._count.items > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot delete category with associated items',
        });
      }

      // Prevent deletion if category has children
      if (category._count.children > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot delete category with subcategories',
        });
      }

      await ctx.prisma.itemCategory.delete({
        where: { id: input.id },
      });

      // Add audit log
      await ctx.prisma.auditLog.create({
        data: {
          action: 'DELETE',
          tableName: 'item_categories',
          recordPk: input.id,
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          beforeData: { name: category.name },
        },
      });

      return { success: true };
    }),
});