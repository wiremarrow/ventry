import { publicProcedure } from './trpc.js';
import { createRLSProxy } from '../lib/rls/index.js';
import { prisma as basePrisma } from '@ventry/database';
import { RLS_BYPASS_REASONS } from '../lib/auth/constants.js';

/**
 * Authentication-specific procedure that bypasses RLS for auth operations.
 * 
 * This is necessary because during authentication (login/register), we need to:
 * 1. Query user data before we have an authenticated context
 * 2. Query organization memberships to establish the user's context
 * 3. Create new users and organizations during registration
 * 
 * All of these operations must bypass RLS since there's no authenticated
 * context yet. This follows enterprise patterns where authentication
 * operations use elevated privileges.
 */
export const authProcedure = publicProcedure.use(async ({ ctx, next }) => {
  // Create a special auth context with RLS bypass
  const authContext = {
    ...ctx,
    // Use base prisma with explicit RLS bypass for auth operations
    prisma: createRLSProxy(basePrisma, () => ({
      bypassRLS: true,
      bypassReason: RLS_BYPASS_REASONS.AUTH_VERIFICATION
    }))
  };
  
  return next({ ctx: authContext });
});