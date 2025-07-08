import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, createTRPCRouter } from '../trpc/trpc.js';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

export const categoriesRouter = createTRPCRouter({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const categories = await ctx.prisma.category.findMany({
        include: {
          products: true,
        },
        orderBy: { name: 'asc' },
      });

      return categories;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.prisma.category.findUnique({
        where: { id: input.id },
        include: {
          products: {
            where: { isActive: true },
            take: 10,
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

  getTree: protectedProcedure
    .query(async ({ ctx }) => {
      const categories = await ctx.prisma.category.findMany({
        include: {
          products: true,
        },
        orderBy: { name: 'asc' },
      });

      return categories;
    }),

  create: protectedProcedure
    .input(createCategorySchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate name
      const existing = await ctx.prisma.category.findFirst({
        where: { 
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Category with this name already exists',
        });
      }

      const category = await ctx.prisma.category.create({
        data: {
          name: input.name,
          description: input.description,
        },
        include: {
          products: true,
        },
      });

      return category;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: updateCategorySchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if category exists
      const existing = await ctx.prisma.category.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Category not found',
        });
      }

      // Check name uniqueness if updating
      if (input.data.name && input.data.name !== existing.name) {
        const duplicate = await ctx.prisma.category.findFirst({
          where: {
            name: input.data.name,
            NOT: { id: input.id },
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Category with this name already exists',
          });
        }
      }

      const category = await ctx.prisma.category.update({
        where: { id: input.id },
        data: input.data,
        include: {
          products: true,
        },
      });

      return category;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if category has products
      const category = await ctx.prisma.category.findUnique({
        where: { id: input.id },
        include: {
          products: true,
        },
      });

      if (!category) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Category not found',
        });
      }

      if (category.products.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete category with products',
        });
      }

      await ctx.prisma.category.delete({
        where: { id: input.id },
      });

      return { success: true, id: input.id };
    }),
});