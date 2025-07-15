import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc/trpc.js';

const userUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  username: z.string().min(3).max(20).optional(),
  password: z.string().min(6).optional(),
});

export const usersRouter = createTRPCRouter({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return user;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: userUpdateSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Users can only update their own profile unless they're admin
      if (ctx.user.id !== input.id && ctx.user.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own profile',
        });
      }

      const updateData: {
        firstName?: string;
        lastName?: string;
        username?: string;
        password?: string;
      } = { ...input.data };
      
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      // Check username uniqueness if updating
      if (updateData.username) {
        const existing = await ctx.prisma.user.findFirst({
          where: { 
            username: updateData.username,
            NOT: { id: input.id },
          },
        });
        
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Username already taken',
          });
        }
      }

      return ctx.prisma.user.update({
        where: { id: input.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      });
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });
    }),

  activate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.id },
        data: { isActive: true },
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });
    }),
});