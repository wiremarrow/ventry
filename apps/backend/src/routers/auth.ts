import { z } from 'zod';

import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc/trpc.js';
import { authProcedure } from '../trpc/auth-procedures.js';
import { createAuthService } from '../services/auth-service.js';

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
  login: authProcedure
    .input(loginSchema)
    .output(authResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const authService = createAuthService({ prisma: ctx.prisma });
      const result = await authService.login(input, ctx.res);

      // Remove the token from the response (it's only for testing)
      const { token: _token, ...authResult } = result;
      return authResult;
    }),

  register: authProcedure
    .input(registerSchema)
    .output(authResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const authService = createAuthService({ prisma: ctx.prisma });
      const result = await authService.register(input, ctx.res);

      // Remove the token from the response (it's only for testing)
      const { token: _token, ...authResult } = result;
      return authResult;
    }),

  me: protectedProcedure.output(userSchema).query(({ ctx }) => {
    return ctx.user;
  }),

  logout: publicProcedure.output(z.object({ success: z.boolean() })).mutation(async ({ ctx }) => {
    const authService = createAuthService({ prisma: ctx.prisma });
    await authService.logout(ctx.user?.id, ctx.res);

    return {
      success: true,
    };
  }),

  refreshToken: publicProcedure.input(refreshTokenSchema).mutation(async ({ ctx, input }) => {
    const authService = createAuthService({ prisma: ctx.prisma });
    const result = await authService.refreshToken(input.refreshToken, ctx.res);

    // Remove the token from the response (it's only for testing)
    const { token: _token, ...authResult } = result;
    return authResult;
  }),

  // Debug endpoint to check current context
  debug: protectedProcedure.query(({ ctx }) => {
    const req = ctx.req as any;
    return {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        organizationId: ctx.user.organizationId,
        organizationRole: ctx.user.organizationRole,
      },
      headers: {
        'x-organization-id': req.headers['x-organization-id'],
      },
      cookies: {
        'active-organization': req.cookies?.['active-organization'] || 'not found',
        'auth-token': req.cookies?.['auth-token'] ? 'present' : 'not found',
      },
    };
  }),
});
