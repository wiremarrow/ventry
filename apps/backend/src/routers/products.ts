import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, createTRPCRouter } from '../trpc/trpc.js';

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  sku: z.string().min(1).max(50),
  unitPrice: z.number().positive(),
  cost: z.number().positive().optional(),
  categoryId: z.string(),
  isActive: z.boolean().default(true),
});

const updateProductSchema = createProductSchema.partial();

const productQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
});

export const productsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(productQuerySchema)
    .query(async ({ ctx, input }) => {
      const where: import('@prisma/client').Prisma.ProductWhereInput = {};
      
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { sku: { contains: input.search, mode: 'insensitive' } },
        ];
      }
      
      if (input.categoryId) {
        where.categoryId = input.categoryId;
      }
      
      if (input.isActive !== undefined) {
        where.isActive = input.isActive;
      }

      const products = await ctx.prisma.product.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        include: {
          category: true,
          inventoryItems: {
            select: {
              quantity: true,
              locationId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined = undefined;
      if (products.length > input.limit) {
        const nextItem = products.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: products,
        nextCursor,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.prisma.product.findUnique({
        where: { id: input.id },
        include: {
          category: true,
          inventoryItems: {
            include: {
              location: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      return product;
    }),

  create: protectedProcedure
    .input(createProductSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate SKU
      const existing = await ctx.prisma.product.findUnique({
        where: { sku: input.sku },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Product with this SKU already exists',
        });
      }

      const product = await ctx.prisma.product.create({
        data: {
          name: input.name,
          description: input.description,
          sku: input.sku,
          unitPrice: input.unitPrice,
          cost: input.cost,
          categoryId: input.categoryId,
          isActive: input.isActive,
          createdById: ctx.user.id,
          updatedById: ctx.user.id,
        },
        include: {
          category: true,
        },
      });

      return product;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: updateProductSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if product exists
      const existing = await ctx.prisma.product.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found',
        });
      }

      // Check SKU uniqueness if updating
      if (input.data.sku && input.data.sku !== existing.sku) {
        const duplicate = await ctx.prisma.product.findUnique({
          where: { sku: input.data.sku },
        });

        if (duplicate) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Product with this SKU already exists',
          });
        }
      }

      const product = await ctx.prisma.product.update({
        where: { id: input.id },
        data: {
          name: input.data.name,
          description: input.data.description,
          sku: input.data.sku,
          unitPrice: input.data.unitPrice,
          cost: input.data.cost,
          categoryId: input.data.categoryId,
          isActive: input.data.isActive,
          updatedById: ctx.user.id,
        },
        include: {
          category: true,
        },
      });

      return product;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete by setting isActive to false
      const product = await ctx.prisma.product.update({
        where: { id: input.id },
        data: {
          isActive: false,
          updatedById: ctx.user.id,
        },
      });

      return { success: true, id: product.id };
    }),
});