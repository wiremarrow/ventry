import { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { prisma } from '@ventry/database';
import { verifyJWT } from '../auth/jwt.js';

export type AuthenticatedUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'WAREHOUSE' | 'SALES';
  isActive: boolean;
  createdAt: string; // ISO date string for JSON serialization
  organizationId?: string; // Current active organization
  organizationRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'; // Role in current organization
};

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  // Get token from httpOnly cookie (primary) or Authorization header (fallback)
  const cookieToken = req.cookies?.['auth-token'];
  const authorization = req.headers.authorization;
  const headerToken = authorization?.replace('Bearer ', '');
  
  // Prefer cookie token for security, fallback to header for API clients
  const token = cookieToken || headerToken;
  
  let user: AuthenticatedUser | null = null;
  if (token) {
    try {
      const payload = verifyJWT(token);
      if (payload && payload.userId) {
        const foundUser = await prisma.user.findUnique({
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
          const orgId = req.headers['x-organization-id'] as string || 
                       req.cookies?.['active-organization'] || 
                       payload.organizationId;
          
          let organizationId: string | undefined;
          let organizationRole: AuthenticatedUser['organizationRole'] | undefined;
          
          if (orgId) {
            // Verify user has access to this organization
            const membership = await prisma.organizationMember.findUnique({
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
    }
  }

  return {
    req,
    res,
    user,
    prisma,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;