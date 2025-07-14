import { TRPCError } from '@trpc/server';
import type { createTRPCInstance } from './builder.js';

// Type for the tRPC instance
type TRPCInstance = ReturnType<typeof createTRPCInstance>;

/**
 * Factory function that creates all middleware.
 * This pattern avoids circular dependencies by accepting the tRPC instance as a parameter.
 */
export const createMiddleware = (t: TRPCInstance) => {
  const isAuthed = t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    return next({
      ctx: {
        user: ctx.user,
      },
    });
  });

  const hasOrganization = t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!ctx.user.organizationId) {
      throw new TRPCError({ 
        code: 'BAD_REQUEST',
        message: 'No organization selected. Please select an organization to continue.',
      });
    }

    return next({
      ctx: {
        user: ctx.user as typeof ctx.user & { organizationId: string; organizationRole: string },
      },
    });
  });

  const isOrganizationAdmin = t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!ctx.user.organizationId) {
      throw new TRPCError({ 
        code: 'BAD_REQUEST',
        message: 'No organization selected',
      });
    }

    if (!['OWNER', 'ADMIN'].includes(ctx.user.organizationRole || '')) {
      throw new TRPCError({ 
        code: 'FORBIDDEN',
        message: 'You must be an organization admin to perform this action',
      });
    }

    return next({
      ctx: {
        user: ctx.user as typeof ctx.user & { organizationId: string; organizationRole: 'OWNER' | 'ADMIN' },
      },
    });
  });

  const isOrganizationOwner = t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!ctx.user.organizationId) {
      throw new TRPCError({ 
        code: 'BAD_REQUEST',
        message: 'No organization selected',
      });
    }

    if (ctx.user.organizationRole !== 'OWNER') {
      throw new TRPCError({ 
        code: 'FORBIDDEN',
        message: 'You must be the organization owner to perform this action',
      });
    }

    return next({
      ctx: {
        user: ctx.user as typeof ctx.user & { organizationId: string; organizationRole: 'OWNER' },
      },
    });
  });

  return {
    isAuthed,
    hasOrganization,
    isOrganizationAdmin,
    isOrganizationOwner,
  };
};