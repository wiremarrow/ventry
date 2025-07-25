import type { createTRPCInstance } from './builder.js';
import type { createMiddleware } from './middleware.js';

/**
 * Factory function that creates all base procedures.
 * This pattern allows for clean separation of concerns and avoids circular dependencies.
 */
export const createProcedures = (
  t: ReturnType<typeof createTRPCInstance>,
  middleware: ReturnType<typeof createMiddleware>
) => {
  return {
    publicProcedure: t.procedure,
    protectedProcedure: t.procedure.use(middleware.isAuthed),
    organizationProcedure: t.procedure.use(middleware.hasOrganization),
    organizationAdminProcedure: t.procedure.use(middleware.isOrganizationAdmin),
    organizationOwnerProcedure: t.procedure.use(middleware.isOrganizationOwner),
  };
};
