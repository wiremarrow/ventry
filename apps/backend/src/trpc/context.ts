import { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma as basePrisma } from '@ventry/database';
import { verifyJwt } from '../auth/jwt.js';
import { createRLSProxy, type RLSContext } from '../lib/rls/index.js';
import { createLogger } from '../lib/logger.js';
import { getRawToken } from '../lib/auth/token-extractor.js';
import { RLS_BYPASS_REASONS } from '../lib/auth/constants.js';
import { AuthError } from '../lib/auth/auth-error.js';
import { CookieService } from '../services/cookie-service.js';

const logger = createLogger('trpc-context');

export type AuthenticatedUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'EMPLOYEE' | 'WAREHOUSE' | 'SALES';
  isActive: boolean;
  createdAt: string; // ISO date string for JSON serialization
  organizationId?: string; // Current active organization
  organizationRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'; // Role in current organization
};

// Type for Fastify request with cookies plugin
interface FastifyRequestWithCookies extends FastifyRequest {
  cookies: { [cookieName: string]: string | undefined };
  unsignCookie: (value: string) =>
    | {
        valid: true;
        renew: boolean;
        value: string;
      }
    | {
        valid: false;
        renew: false;
        value: null;
      };
}

/**
 * Safely extract organization ID from signed cookie
 */
function getOrganizationFromCookie(request: FastifyRequestWithCookies): string | undefined {
  return CookieService.getActiveOrganization(request as FastifyRequest);
}

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  // The cookies plugin adds the cookies property to the request
  const request = req as FastifyRequestWithCookies;

  // Use the new token extractor to safely get the token
  const token = getRawToken(request);

  let user: AuthenticatedUser | null = null;
  let rlsContext: RLSContext = {
    bypassRLS: true,
    bypassReason: RLS_BYPASS_REASONS.PUBLIC_ENDPOINT,
  }; // Default to bypass for non-authenticated requests

  if (token) {
    try {
      // Use the new verifyJwt function that throws specific errors
      const jwtResult = verifyJwt(token);

      if (jwtResult && jwtResult.userId) {
        // Use base prisma for auth queries (bypass RLS)
        const foundUser = await basePrisma.user.findUnique({
          where: { id: jwtResult.userId },
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

        if (foundUser && foundUser.isActive) {
          // RLS context is set by the RLS proxy per-transaction, no need to set it here

          // Get active organization from header, cookie, or JWT payload
          const orgId =
            (request.headers['x-organization-id'] as string) ||
            getOrganizationFromCookie(request) ||
            jwtResult.organizationId;

          // Debug logging
          logger.debug(
            {
              headerOrgId: request.headers['x-organization-id'],
              cookieOrgId: getOrganizationFromCookie(request),
              jwtOrgId: jwtResult.organizationId,
              finalOrgId: orgId,
            },
            'Organization ID sources'
          );

          let organizationId: string | undefined;
          let organizationRole: AuthenticatedUser['organizationRole'] | undefined;

          // Set basic RLS context for authenticated user
          rlsContext = {
            userId: foundUser.id,
            bypassRLS: false,
          };

          if (orgId) {
            // Verify user has access to this organization (bypass RLS for this check)
            const membership = await basePrisma.organizationMember.findUnique({
              where: {
                organizationId_userId: {
                  organizationId: orgId,
                  userId: foundUser.id,
                },
              },
            });

            if (membership) {
              organizationId = orgId;
              organizationRole = membership.role as AuthenticatedUser['organizationRole'];

              // Update RLS context with organization
              rlsContext = {
                userId: foundUser.id,
                organizationId: orgId,
                bypassRLS: false,
              };

              logger.debug(
                {
                  userId: foundUser.id,
                  organizationId: orgId,
                  organizationRole: membership.role,
                },
                'RLS context configured for authenticated user with organization'
              );
            } else {
              logger.warn(
                {
                  userId: foundUser.id,
                  attemptedOrgId: orgId,
                },
                'User does not have membership in requested organization'
              );
            }
          }

          user = {
            ...foundUser,
            createdAt: foundUser.createdAt.toISOString(),
            organizationId,
            organizationRole,
          };
        }
      }
    } catch (error) {
      // Handle specific auth errors
      if (error instanceof AuthError) {
        if (error.message === 'EXPIRED') {
          // Set response header to indicate token expiration
          res.header('X-Auth-Error', 'TOKEN_EXPIRED');
        }
      }

      // Token invalid, user remains null
      logger.warn({ error, token: token?.substring(0, 20) + '...' }, 'Invalid token in request');
    }
  }

  // Create RLS-enabled Prisma client
  const prisma = createRLSProxy(basePrisma, () => rlsContext);

  return {
    req,
    res,
    user,
    prisma,
    organizationId: user?.organizationId, // Convenience property for routers
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
