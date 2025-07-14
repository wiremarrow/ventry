import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context.js';

/**
 * Creates the tRPC instance with proper configuration.
 * This is isolated to prevent circular dependencies.
 */
export const createTRPCInstance = () => {
  return initTRPC.context<Context>().create({
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
};