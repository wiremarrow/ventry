// Re-export all tRPC utilities from the trpc directory
export {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  organizationProcedure,
  organizationAdminProcedure,
  organizationOwnerProcedure,
  t,
} from './trpc/trpc.js';

export { createContext } from './trpc/context.js';
export type { Context, AuthenticatedUser } from './trpc/context.js';

// Convenience re-exports
import { createTRPCRouter as _createTRPCRouter } from './trpc/trpc.js';
export const router = _createTRPCRouter;
export { createTRPCRouter as createRouter } from './trpc/trpc.js';