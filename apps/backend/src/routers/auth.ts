import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { signJWT } from '../auth/jwt.js';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc/trpc.js';

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

      // Diagnostic: Check what methods are available on ctx.res
      console.log('ctx.res type:', typeof ctx.res);
      console.log('Has header method?', typeof ctx.res.header);
      console.log('Has setCookie?', typeof (ctx.res as any).setCookie);
      
      // Set httpOnly cookie using Fastify's header method
      if (typeof ctx.res.header === 'function') {
        // Use Fastify's header method to set cookie - no Domain needed for proxy setup
        const cookieValue = `auth-token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
        ctx.res.header('Set-Cookie', cookieValue);
        console.log('Set cookie using header method (proxied setup)');
        
        // Verify the header was set
        const headers = ctx.res.getHeaders ? ctx.res.getHeaders() : 'No getHeaders method';
        console.log('Response headers after setting cookie:', headers);
      } else if (typeof (ctx.res as any).setCookie === 'function') {
        // Fallback to setCookie if header method doesn't exist
        (ctx.res as any).setCookie('auth-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/',
        });
        console.log('Set cookie using setCookie method (proxied setup)');
      } else {
        console.error('No method available to set cookies on ctx.res!');
        console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.res)));
      }
      
      // Add logging to verify cookie is being set
      console.log('Setting auth cookie for user:', user.email);

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

      // Diagnostic: Check what methods are available on ctx.res
      console.log('ctx.res type:', typeof ctx.res);
      console.log('Has header method?', typeof ctx.res.header);
      console.log('Has setCookie?', typeof (ctx.res as any).setCookie);
      
      // Set httpOnly cookie using Fastify's header method
      if (typeof ctx.res.header === 'function') {
        // Use Fastify's header method to set cookie - no Domain needed for proxy setup
        const cookieValue = `auth-token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
        ctx.res.header('Set-Cookie', cookieValue);
        console.log('Set cookie using header method (proxied setup)');
        
        // Verify the header was set
        const headers = ctx.res.getHeaders ? ctx.res.getHeaders() : 'No getHeaders method';
        console.log('Response headers after setting cookie:', headers);
      } else if (typeof (ctx.res as any).setCookie === 'function') {
        // Fallback to setCookie if header method doesn't exist
        (ctx.res as any).setCookie('auth-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/',
        });
        console.log('Set cookie using setCookie method (proxied setup)');
      } else {
        console.error('No method available to set cookies on ctx.res!');
        console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.res)));
      }
      
      // Add logging to verify cookie is being set
      console.log('Setting auth cookie for user:', user.email);

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