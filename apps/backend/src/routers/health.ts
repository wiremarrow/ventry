import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '../trpc/trpc.js';

const healthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  services: z.object({
    api: z.string(),
    database: z.object({
      status: z.string(),
      error: z.string().nullable(),
    }),
  }),
  version: z.string(),
  environment: z.string(),
});

export const healthRouter = createTRPCRouter({
  check: publicProcedure
    .output(healthResponseSchema)
    .query(async ({ ctx }) => {
      // Check database connection
      let dbStatus = 'disconnected';
      let dbError: string | undefined;
      
      try {
        await ctx.prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
      } catch (error) {
        dbError = error instanceof Error ? error.message : 'Unknown error';
      }

      return {
        status: 'operational',
        timestamp: new Date().toISOString(),
        services: {
          api: 'healthy',
          database: {
            status: dbStatus,
            error: dbError || null,
          },
        },
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      };
    }),
});