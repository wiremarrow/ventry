import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { publicProcedure, createTRPCRouter, protectedProcedure } from '../trpc/trpc.js';
import { signJWT } from '../auth/jwt.js';

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
  role: z.enum(['ADMIN', 'MANAGER', 'USER']),
  isActive: z.boolean(),
  createdAt: z.string(), // ISO date string for JSON serialization
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

      const token = signJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Set httpOnly cookie directly (compression disabled, so no conflict)
      ctx.res.cookie('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

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

      // Set httpOnly cookie directly (compression disabled, so no conflict)
      ctx.res.cookie('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

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
    .mutation(async ({ ctx: _ctx }) => {
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