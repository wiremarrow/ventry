import { createTRPCRouter } from '../trpc/trpc.js';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { productsRouter } from './products.js';
import { categoriesRouter } from './categories.js';
import { healthRouter } from './health.js';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  users: usersRouter,
  products: productsRouter,
  categories: categoriesRouter,
  health: healthRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;