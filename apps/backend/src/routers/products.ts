import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { organizationProcedure, createTRPCRouter } from '../trpc/trpc.js';
import type { Prisma } from '@ventry/database';

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  sku: z.string().min(1).max(50),
  defaultPrice: z.number().positive().optional(),
  defaultCost: z.number().positive().optional(),
  categoryId: z.string(),
  uomId: z.string(),
  defaultSupplierId: z.string().optional(),
  reorderPoint: z.number().int().min(0).default(0),
  reorderQty: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const updateProductSchema = createProductSchema.partial().extend({
  uomId: z.string().optional(),
});

const productQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().optional(),
  limit: z.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
});

export const productsRouter = createTRPCRouter({
  list: organizationProcedure
    .input(productQuerySchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.ItemWhereInput = {
        organizationId: ctx.user.organizationId,
      };
      
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

      const products = await ctx.prisma.item.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        include: {
          category: true,
          unitOfMeasure: true,
          defaultSupplier: true,
          inventory: {
            select: {
              qtyOnHand: true,
              qtyReserved: true,
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

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.prisma.item.findFirst({
        where: { 
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          category: true,
          unitOfMeasure: true,
          defaultSupplier: true,
          inventory: {
            include: {
              location: true,
            },
          },
          images: true,
          priceHistory: {
            orderBy: { startDate: 'desc' },
            take: 10,
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      return product;
    }),

  create: organizationProcedure
    .input(createProductSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate SKU
      const existing = await ctx.prisma.item.findFirst({
        where: { 
          sku: input.sku,
          organizationId: ctx.user.organizationId,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Item with this SKU already exists',
        });
      }

      const product = await ctx.prisma.item.create({
        data: {
          organizationId: ctx.user.organizationId,
          name: input.name,
          description: input.description,
          sku: input.sku,
          defaultPrice: input.defaultPrice,
          defaultCost: input.defaultCost,
          categoryId: input.categoryId,
          uomId: input.uomId,
          defaultSupplierId: input.defaultSupplierId,
          reorderPoint: input.reorderPoint,
          reorderQty: input.reorderQty,
          isActive: input.isActive,
        },
        include: {
          category: true,
          unitOfMeasure: true,
        },
      });

      return product;
    }),

  update: organizationProcedure
    .input(z.object({
      id: z.string(),
      data: updateProductSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if product exists
      const existing = await ctx.prisma.item.findFirst({
        where: { 
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found',
        });
      }

      // Check SKU uniqueness if updating
      if (input.data.sku && input.data.sku !== existing.sku) {
        const duplicate = await ctx.prisma.item.findFirst({
          where: { 
            sku: input.data.sku,
            organizationId: ctx.user.organizationId,
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Item with this SKU already exists',
          });
        }
      }

      const product = await ctx.prisma.item.update({
        where: { id: input.id },
        data: {
          name: input.data.name,
          description: input.data.description,
          sku: input.data.sku,
          defaultPrice: input.data.defaultPrice,
          defaultCost: input.data.defaultCost,
          categoryId: input.data.categoryId,
          uomId: input.data.uomId,
          defaultSupplierId: input.data.defaultSupplierId,
          reorderPoint: input.data.reorderPoint,
          reorderQty: input.data.reorderQty,
          isActive: input.data.isActive,
        },
        include: {
          category: true,
          unitOfMeasure: true,
        },
      });

      return product;
    }),

  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete by setting isActive to false
      const product = await ctx.prisma.item.update({
        where: { id: input.id },
        data: {
          isActive: false,
        },
      });

      return { success: true, id: product.id };
    }),
});