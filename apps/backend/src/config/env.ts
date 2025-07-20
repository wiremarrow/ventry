/**
 * Environment variable validation and configuration
 * Ensures all required environment variables are set before application starts
 */

import { z } from 'zod';
import { createLogger } from '../lib/logger.js';

// Define environment schema
const envSchema = z.object({
  // Required environment variables
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('6060'),
  
  // Security - Required in production
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
  
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:6061'),
  
  // Optional services
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  
  // Feature flags
  ENABLE_SWAGGER: z.string().transform(val => val === 'true').default('false'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

// Type for validated environment
export type Env = z.infer<typeof envSchema>;

// Create logger for this module
const logger = createLogger('config/env');

// Validate environment variables
function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ errors: error.errors }, '❌ Invalid environment variables');
      error.errors.forEach(err => {
        logger.error({ path: err.path, message: err.message }, `  - ${err.path.join('.')}: ${err.message}`);
      });
      
      // In production, fail fast
      if (process.env.NODE_ENV === 'production') {
        logger.fatal('\n🛑 Application startup aborted due to missing required environment variables.');
        process.exit(1);
      } else {
        // In development, show warning but continue with defaults where possible
        logger.warn('\n⚠️  Running in development mode with missing environment variables.');
        logger.warn('   Some features may not work correctly. Please check your .env file.');
        
        // For critical security variables, still fail in development
        const criticalMissing = error.errors.filter(err => 
          ['JWT_SECRET', 'COOKIE_SECRET', 'DATABASE_URL'].includes(err.path[0] as string)
        );
        
        if (criticalMissing.length > 0) {
          logger.fatal({ missing: criticalMissing.map(err => err.path.join('.')) }, '\n🛑 Critical environment variables are missing');
          criticalMissing.forEach(err => {
            logger.error({ path: err.path }, `  - ${err.path.join('.')}`);
          });
          logger.fatal('\nPlease set these variables in your .env file.');
          process.exit(1);
        }
      }
    }
    throw error;
  }
}

// Export validated environment
export const env = validateEnv();

// Helper to check if running in production
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';