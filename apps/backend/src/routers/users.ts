import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import {
  createTRPCRouter,
  organizationProcedure,
  organizationAdminProcedure,
  protectedProcedure,
} from '../trpc/trpc.js';

const userUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  username: z.string().min(3).max(20).optional(),
  password: z.string().min(6).optional(),
});

export const usersRouter = createTRPCRouter({
  list: organizationProcedure.query(async ({ ctx }) => {
    // Get all users in the current organization
    const orgMembers = await ctx.prisma.organizationMember.findMany({
      where: {
        organizationId: ctx.user.organizationId,
      },
      include: {
        user: {
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
        },
      },
      orderBy: {
        user: {
          createdAt: 'desc',
        },
      },
    });

    // Extract users from organization members
    return orgMembers.map((member) => member.user);
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check if user is in the organization
      const orgMember = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ctx.user.organizationId,
            userId: input.id,
          },
        },
        include: {
          user: {
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
          },
        },
      });

      if (!orgMember) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found in organization',
        });
      }

      return orgMember.user;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: userUpdateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Users can update their own profile
      if (ctx.user.id === input.id) {
        // Allow self-update
      } else {
        // For updating other users, check organization admin permissions
        if (
          !ctx.user.organizationId ||
          !['OWNER', 'ADMIN'].includes(ctx.user.organizationRole || '')
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only update your own profile',
          });
        }

        // Verify the target user is in the same organization
        const targetOrgMember = await ctx.prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: ctx.user.organizationId,
              userId: input.id,
            },
          },
        });

        if (!targetOrgMember) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found in your organization',
          });
        }
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

  deactivate: organizationAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify user is in the organization
      const orgMember = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ctx.user.organizationId,
            userId: input.id,
          },
        },
      });

      if (!orgMember) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found in your organization',
        });
      }

      // Don't allow deactivating organization owners
      if (orgMember.role === 'OWNER') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot deactivate organization owner',
        });
      }

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

  activate: organizationAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify user is in the organization
      const orgMember = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ctx.user.organizationId,
            userId: input.id,
          },
        },
      });

      if (!orgMember) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found in your organization',
        });
      }

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
