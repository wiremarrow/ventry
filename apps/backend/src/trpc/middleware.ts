import { TRPCError } from '@trpc/server';
import { t } from './trpc.js';

export const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const hasOrganization = t.middleware(({ ctx, next }) => {
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

export const isOrganizationAdmin = t.middleware(({ ctx, next }) => {
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

export const isOrganizationOwner = t.middleware(({ ctx, next }) => {
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