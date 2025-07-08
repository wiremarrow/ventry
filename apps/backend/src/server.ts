import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { fastifyTRPCPlugin, FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify';
import { createContext } from './trpc/context.js';
import { appRouter, type AppRouter } from './routers/app.js';

// Create Fastify instance
const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV === 'development' 
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
  origin: process.env.FRONTEND_URL || 'http://localhost:6061',
  credentials: true,
});

await server.register(helmet, {
  contentSecurityPolicy: false, // Disable for API
});

await server.register(compress);

await server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await server.register(websocket);

// Register tRPC
await server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }) {
      // Log errors in production
      if (process.env.NODE_ENV === 'production') {
        console.error(`Error in tRPC handler on path '${path}':`, error);
      }
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
    const port = parseInt(process.env.PORT || '6060', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    console.log(`
🚀 Ventry tRPC Server running on Fastify
📍 URL: http://localhost:${port}
🔌 tRPC: http://localhost:${port}/trpc
🏥 Health: http://localhost:${port}/health
🌍 Environment: ${process.env.NODE_ENV || 'development'}
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    await server.close();
    process.exit(0);
  });
});

start();