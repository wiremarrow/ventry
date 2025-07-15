import { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma as basePrisma } from '@ventry/database';
import { verifyJWT } from '../auth/jwt.js';
import { createRLSProxy, type RLSContext } from '../lib/rls-middleware.js';
import { createLogger } from '../lib/logger.js';

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
}

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  // The cookies plugin adds the cookies property to the request
  const request = req as FastifyRequestWithCookies;
  
  // Get token from httpOnly cookie (primary) or Authorization header (fallback)
  const cookieToken = request.cookies['auth-token'];
  const authorization = request.headers.authorization;
  const headerToken = authorization?.replace('Bearer ', '');
  
  // Prefer cookie token for security, fallback to header for API clients
  const token = cookieToken || headerToken;
  
  let user: AuthenticatedUser | null = null;
  let rlsContext: RLSContext = { bypassRLS: true }; // Default to bypass for non-authenticated requests
  
  if (token) {
    try {
      const payload = verifyJWT(token);
      if (payload && payload.userId) {
        // Use base prisma for auth queries (bypass RLS)
        const foundUser = await basePrisma.user.findUnique({
          where: { id: payload.userId },
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
          // Get active organization from header, cookie, or JWT payload
          const orgId = request.headers['x-organization-id'] as string || 
                       request.cookies['active-organization'] || 
                       payload.organizationId;
          
          let organizationId: string | undefined;
          let organizationRole: AuthenticatedUser['organizationRole'] | undefined;
          
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
              
              // Set RLS context
              rlsContext = {
                userId: foundUser.id,
                organizationId: orgId,
                bypassRLS: false,
              };
              
              logger.debug({
                userId: foundUser.id,
                organizationId: orgId,
                organizationRole: membership.role,
              }, 'RLS context configured for authenticated user');
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
      // Token invalid, user remains null
      logger.warn({ error }, 'Invalid token in request');
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