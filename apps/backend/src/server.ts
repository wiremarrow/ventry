import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
// import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import { fastifyTRPCPlugin, FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify';
import { createContext } from './trpc/context.js';
import { appRouter, type AppRouter } from './routers/app.js';
import { env, isProduction } from './config/env.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger('server');

// Create Fastify instance
const server = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: !isProduction
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
  maxParamLength: 5000,
});

// Register plugins
await server.register(cors, {
  origin: env.FRONTEND_URL,
  credentials: true,
});

await server.register(helmet, {
  contentSecurityPolicy: false, // Disable for API
});

// Temporarily disable compression to fix Response object serialization issue
// await server.register(compress);

await server.register(rateLimit, {
  max: 500, // Increased from 100 to accommodate frontend needs
  timeWindow: '1 minute',
  // TODO: Implement per-user rate limiting with different limits for authenticated users
});

await server.register(websocket);

// Register cookie plugin for authentication
await server.register(cookie, {
  secret: env.COOKIE_SECRET,
  parseOptions: {},
});

// Register tRPC
await server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }) {
      // Log tRPC errors with structured logging
      logger.error(
        {
          path,
          code: error.code,
          message: error.message,
          cause: error.cause,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        `tRPC Error on path '${path}'`
      );
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
});

// Health check endpoint (outside of tRPC for simplicity)
server.get('/health', async (_request, _reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
});

// Root endpoint
server.get('/', async (_request, _reply) => {
  return {
    name: 'Ventry API',
    version: '1.0.0',
    description: 'Inventory Management System API',
    docs: '/trpc/panel', // If you add tRPC panel
  };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(env.PORT, 10);
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });

    logger.info(
      {
        port,
        host,
        trpcEndpoint: `http://localhost:${port}/trpc`,
        healthEndpoint: `http://localhost:${port}/health`,
        environment: env.NODE_ENV,
      },
      `Ventry tRPC Server started successfully`
    );
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info({ signal }, 'Shutdown signal received, closing server gracefully');
    await server.close();
    process.exit(0);
  });
});

start();
