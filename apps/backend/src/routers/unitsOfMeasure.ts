import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, organizationProcedure } from '../trpc/trpc.js';

// Input validation schemas
const unitOfMeasureCreateSchema = z.object({
  code: z.string().min(1).max(10),
  description: z.string().min(1).max(100),
  isBase: z.boolean().optional().default(false),
  conversionFactorToBase: z.number().positive().optional().default(1),
});

const unitOfMeasureUpdateSchema = z.object({
  id: z.string().cuid(),
  code: z.string().min(1).max(10).optional(),
  description: z.string().min(1).max(100).optional(),
  isBase: z.boolean().optional(),
  conversionFactorToBase: z.number().positive().optional(),
});

const unitOfMeasureListSchema = z.object({
  search: z.string().optional(),
  isBase: z.boolean().optional(),
});

export const unitsOfMeasureRouter = createTRPCRouter({
  // List all units of measure for the organization
  list: organizationProcedure
    .input(unitOfMeasureListSchema)
    .query(async ({ ctx, input }) => {
      const where: any = {
        organizationId: ctx.user.organizationId,
      };

      if (input.search) {
        where.OR = [
          { code: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      if (input.isBase !== undefined) {
        where.isBase = input.isBase;
      }

      const units = await ctx.prisma.unitOfMeasure.findMany({
        where,
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: [
          { isBase: 'desc' }, // Base units first
          { code: 'asc' },
        ],
      });

      // Add audit log for data access
      await ctx.prisma.auditLog.create({
        data: {
          action: 'CREATE', // Using CREATE as a proxy for LIST action
          tableName: 'units_of_measure',
          recordPk: 'LIST',
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          afterData: { count: units.length },
        },
      });

      return units;
    }),

  // Get a single unit of measure by ID
  getById: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const unit = await ctx.prisma.unitOfMeasure.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          items: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      });

      if (!unit) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Unit of measure not found',
        });
      }

      return unit;
    }),

  // Create a new unit of measure
  create: organizationProcedure
    .input(unitOfMeasureCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if code already exists for this organization
      const existing = await ctx.prisma.unitOfMeasure.findUnique({
        where: {
          organizationId_code: {
            organizationId: ctx.user.organizationId!,
            code: input.code,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Unit code already exists',
        });
      }

      // If this is marked as base unit, ensure no other base unit exists
      if (input.isBase) {
        const existingBase = await ctx.prisma.unitOfMeasure.findFirst({
          where: {
            organizationId: ctx.user.organizationId,
            isBase: true,
          },
        });

        if (existingBase) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A base unit already exists. Only one base unit is allowed.',
          });
        }
      }

      // Base units must have conversion factor of 1
      if (input.isBase && input.conversionFactorToBase !== 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Base unit must have conversion factor of 1',
        });
      }

      const unit = await ctx.prisma.unitOfMeasure.create({
        data: {
          ...input,
          organizationId: ctx.user.organizationId!,
        },
      });

      // Add audit log
      await ctx.prisma.auditLog.create({
        data: {
          action: 'CREATE',
          tableName: 'units_of_measure',
          recordPk: unit.id,
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          afterData: input,
        },
      });

      return unit;
    }),

  // Update a unit of measure
  update: organizationProcedure
    .input(unitOfMeasureUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify unit exists and belongs to organization
      const existing = await ctx.prisma.unitOfMeasure.findFirst({
        where: {
          id,
          organizationId: ctx.user.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Unit of measure not found',
        });
      }

      // If updating code, check for duplicates
      if (data.code && data.code !== existing.code) {
        const duplicate = await ctx.prisma.unitOfMeasure.findUnique({
          where: {
            organizationId_code: {
              organizationId: ctx.user.organizationId!,
              code: data.code,
            },
          },
        });

        if (duplicate) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Unit code already exists',
          });
        }
      }

      // If changing to base unit, ensure no other base unit exists
      if (data.isBase === true && !existing.isBase) {
        const existingBase = await ctx.prisma.unitOfMeasure.findFirst({
          where: {
            organizationId: ctx.user.organizationId,
            isBase: true,
            NOT: { id },
          },
        });

        if (existingBase) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A base unit already exists. Only one base unit is allowed.',
          });
        }
      }

      // Base units must have conversion factor of 1
      if ((data.isBase === true || (existing.isBase && data.isBase !== false)) && 
          data.conversionFactorToBase && data.conversionFactorToBase !== 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Base unit must have conversion factor of 1',
        });
      }

      const unit = await ctx.prisma.unitOfMeasure.update({
        where: { id },
        data,
      });

      // Add audit log
      await ctx.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          tableName: 'units_of_measure',
          recordPk: unit.id,
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          beforeData: existing,
          afterData: data,
        },
      });

      return unit;
    }),

  // Delete a unit of measure
  delete: organizationProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify unit exists and belongs to organization
      const unit = await ctx.prisma.unitOfMeasure.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.user.organizationId,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      if (!unit) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Unit of measure not found',
        });
      }

      // Prevent deletion if unit is used by items
      if (unit._count.items > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot delete unit of measure that is in use',
        });
      }

      // Prevent deletion of base unit if other units exist
      if (unit.isBase) {
        const otherUnits = await ctx.prisma.unitOfMeasure.count({
          where: {
            organizationId: ctx.user.organizationId,
            NOT: { id: input.id },
          },
        });

        if (otherUnits > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Cannot delete base unit while other units exist',
          });
        }
      }

      await ctx.prisma.unitOfMeasure.delete({
        where: { id: input.id },
      });

      // Add audit log
      await ctx.prisma.auditLog.create({
        data: {
          action: 'DELETE',
          tableName: 'units_of_measure',
          recordPk: input.id,
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId!,
          beforeData: { code: unit.code, description: unit.description },
        },
      });

      return { success: true };
    }),
});