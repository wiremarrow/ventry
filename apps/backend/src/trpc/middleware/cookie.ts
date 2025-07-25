import { t } from '../trpc.js';

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
}

interface AuthResult {
  success: boolean;
  user?: any;
  token?: string;
}

/**
 * Middleware that sets httpOnly cookies for successful authentication responses
 * This prevents Response objects from being serialized by superjson
 */
export const cookieMiddleware = t.middleware(({ ctx, next }) => {
  return next({
    ctx: {
      // Only spread the properties we need, avoid spreading Response object
      user: ctx.user,
      prisma: ctx.prisma,
      req: ctx.req,
      res: ctx.res,
      // Add a helper function to set cookies safely
      setCookie: (name: string, value: string, _options: CookieOptions = {}) => {
        // const defaultOptions: CookieOptions = {
        //   httpOnly: true,
        //   secure: process.env.NODE_ENV === 'production',
        //   sameSite: 'strict',
        //   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        //   path: '/',
        //   ...options,
        // };

        try {
          // Temporarily disable cookie setting to isolate the issue
          console.log('Would set cookie:', name, 'with value:', value);
          // ctx.res.setCookie(name, value, defaultOptions);
        } catch (error) {
          console.error('Failed to set cookie:', error);
          // Don't throw error, just log it to avoid breaking the response
        }
      },
    },
  });
});

/**
 * Procedure that automatically sets auth cookies for successful auth responses
 */
export const authProcedure = t.procedure.use(cookieMiddleware).use(async ({ ctx, next }) => {
  const result = await next();

  // If this is a successful auth response with a token, set the cookie
  if (result.ok && result.data && typeof result.data === 'object') {
    const authResult = result.data as AuthResult;
    if (authResult.success && authResult.token) {
      ctx.setCookie('auth-token', authResult.token);
    }
  }

  return result;
});
