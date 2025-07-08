import { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { prisma } from '@ventry/database';
import { verifyJWT } from '../auth/jwt.js';

export type AuthenticatedUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  isActive: boolean;
  createdAt: string; // ISO date string for JSON serialization
};

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  // Get token from Authorization header
  const authorization = req.headers.authorization;
  const token = authorization?.replace('Bearer ', '');
  
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
          user = {
            ...foundUser,
            createdAt: foundUser.createdAt.toISOString(),
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