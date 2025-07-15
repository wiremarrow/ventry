/**
 * Production-ready structured logging service
 * Replaces all console.log statements with proper logging
 */

import pino from 'pino';
import { randomUUID } from 'crypto';

// Define log levels
export const LOG_LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
} as const;

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
  errorKey: 'error',
  base: {
    env: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
    service: 'ventry-backend',
  },
  // Redact sensitive information
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
      'email',
      '*.password',
      '*.token',
      '*.authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
  // Serialize errors properly
  serializers: {
    error: pino.stdSerializers.err,
    request: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
      remoteAddress: req.ip,
    }),
    response: (res) => ({
      statusCode: res.statusCode,
      headers: res.getHeaders?.() || {},
    }),
  },
};

// Development configuration with pretty printing
const devConfig: pino.LoggerOptions = {
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
      messageFormat: '{message}',
      errorLikeObjectKeys: ['err', 'error'],
    },
  },
};

// Production configuration
const prodConfig: pino.LoggerOptions = {
  ...baseConfig,
  // Use faster integer levels in production
  formatters: {
    level: (label, number) => ({ level: number }),
  },
  // Add custom fields for production
  mixin: () => ({
    deploymentId: process.env.DEPLOYMENT_ID,
    instanceId: process.env.INSTANCE_ID || randomUUID(),
  }),
};

// Create the logger instance
export const logger = pino(
  process.env.NODE_ENV === 'production' ? prodConfig : devConfig
);

// Create child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};

// Utility function to log with context
export const logWithContext = (
  level: keyof typeof LOG_LEVELS,
  message: string,
  context?: Record<string, unknown>
) => {
  logger[level](context || {}, message);
};

// Express/Fastify request logger middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const requestId = req.id || randomUUID();
  
  // Attach request ID
  req.id = requestId;
  
  // Create child logger with request context
  req.log = logger.child({
    requestId,
    userId: req.user?.id,
    organizationId: req.user?.organizationId,
  });
  
  // Log request
  req.log.info({
    request: req,
  }, 'Request received');
  
  // Log response
  const originalSend = res.send;
  res.send = function(data: any) {
    res.send = originalSend;
    const duration = Date.now() - start;
    
    req.log.info({
      response: res,
      duration,
      responseSize: data?.length || 0,
    }, 'Request completed');
    
    return res.send(data);
  };
  
  next();
};

// Error logger
export const logError = (
  error: Error,
  context?: Record<string, unknown>
) => {
  logger.error({
    ...context,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
  }, error.message);
};

// Performance logger
export const logPerformance = (
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>
) => {
  const level = duration > 1000 ? 'warn' : 'debug';
  logger[level]({
    operation,
    duration,
    ...metadata,
  }, `Operation ${operation} took ${duration}ms`);
};

// Audit logger for security events
export const auditLog = (
  action: string,
  userId: string,
  metadata?: Record<string, unknown>
) => {
  logger.info({
    audit: true,
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...metadata,
  }, `Audit: ${action}`);
};

// Database query logger
export const logQuery = (
  query: string,
  params?: unknown[],
  duration?: number
) => {
  const level = duration && duration > 100 ? 'warn' : 'debug';
  logger[level]({
    database: {
      query: query.substring(0, 1000), // Truncate long queries
      params: process.env.LOG_SQL_PARAMS === 'true' ? params : undefined,
      duration,
    },
  }, 'Database query executed');
};

// Graceful shutdown logger
export const logShutdown = (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully');
};

// Export types
export type Logger = pino.Logger;
export type LogLevel = keyof typeof LOG_LEVELS;