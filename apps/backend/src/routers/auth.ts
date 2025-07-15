import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { signJWT } from '../auth/jwt.js';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc/trpc.js';
import { createLogger } from '../lib/logger.js';
import { setCookie, clearCookie, COOKIE_NAMES } from '../lib/cookies.js';

const logger = createLogger('auth');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(6),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Output schemas for type safety
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['ADMIN', 'MANAGER', 'USER', 'EMPLOYEE', 'WAREHOUSE', 'SALES']),
  isActive: z.boolean(),
  createdAt: z.string(), // ISO date string for JSON serialization
  organizationId: z.string().optional(),
  organizationRole: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).optional(),
});

const authResponseSchema = z.object({
  user: userSchema,
  success: z.boolean(),
});

export const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(loginSchema)
    .output(authResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user || !(await bcrypt.compare(input.password, user.password))) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      if (!user.isActive) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Account is deactivated',
        });
      }

      // Update last login
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Get user's first organization
      const membership = await ctx.prisma.organizationMember.findFirst({
        where: { userId: user.id },
        include: { organization: true },
        orderBy: { joinedAt: 'asc' },
      });

      // Require organization membership for access
      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied: User is not a member of any organization',
        });
      }

      const token = signJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: membership.organizationId,
      });

      // Set authentication cookie
      setCookie(ctx.res, COOKIE_NAMES.AUTH_TOKEN, token);
      
      // Log successful authentication
      logger.info({ userId: user.id, email: user.email }, 'User authenticated successfully');

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          organizationId: membership.organizationId,
          organizationRole: membership.role,
        },
      };
    }),

  register: publicProcedure
    .input(registerSchema)
    .output(authResponseSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user already exists
      const existingUser = await ctx.prisma.user.findFirst({
        where: {
          OR: [
            { email: input.email },
            { username: input.username },
          ],
        },
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: existingUser.email === input.email 
            ? 'Email already registered' 
            : 'Username already taken',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create user
      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      const token = signJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Set authentication cookie
      setCookie(ctx.res, COOKIE_NAMES.AUTH_TOKEN, token);
      
      // Log successful authentication
      logger.info({ userId: user.id, email: user.email }, 'User authenticated successfully');

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
        },
      };
    }),

  me: protectedProcedure
    .output(userSchema)
    .query(({ ctx }) => {
      return ctx.user;
    }),

  logout: publicProcedure
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      // Clear authentication cookie
      clearCookie(ctx.res, COOKIE_NAMES.AUTH_TOKEN);
      
      logger.info({ userId: ctx.user?.id }, 'User logged out');
      
      return { 
        success: true
      };
    }),

  refreshToken: publicProcedure
    .input(refreshTokenSchema)
    .mutation(async ({ ctx: _ctx, input: _input }) => {
      // In a real app, you'd verify the refresh token
      // For now, let's just decode and create a new access token
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Refresh token not implemented yet',
      });
    }),
});