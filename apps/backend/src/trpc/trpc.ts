import { TRPCError } from '@trpc/server';
import { createTRPCInstance } from './builder.js';
import { createMiddleware } from './middleware.js';
import { createProcedures } from './procedures.js';

// Create instances using the factory pattern
const t = createTRPCInstance();
const middleware = createMiddleware(t);
const procedures = createProcedures(t, middleware);

// Export router creation function
export const createTRPCRouter = t.router;

// Export all procedures
export const {
  publicProcedure,
  protectedProcedure,
  organizationProcedure,
  organizationAdminProcedure,
  organizationOwnerProcedure,
} = procedures;

// Legacy procedures for backward compatibility
// TODO: Remove these once all routers are updated
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }

  return next({ ctx });
});

// Export t for testing purposes only
export { t };
