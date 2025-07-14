import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context.js';
import { isAuthed, hasOrganization, isOrganizationAdmin, isOrganizationOwner } from './middleware.js';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // user is now guaranteed to exist
    },
  });
});

// Admin-only procedure
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  
  return next({ ctx });
});

// Organization-aware procedures
export const organizationProcedure = t.procedure.use(hasOrganization);
export const organizationAdminProcedure = t.procedure.use(isOrganizationAdmin);
export const organizationOwnerProcedure = t.procedure.use(isOrganizationOwner);

export { t };