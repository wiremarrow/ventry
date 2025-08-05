import { NextResponse } from 'next/server';

/**
 * Health check endpoint for E2E tests
 *
 * Verifies that:
 * 1. Next.js server is running
 * 2. tRPC client can reach backend
 */
export async function GET() {
  const services: Record<string, string> = {
    frontend: 'healthy',
  };

  // Check backend connectivity
  try {
    // Direct backend health check URL
    const healthUrl = 'http://localhost:6060/health';

    const response = await fetch(healthUrl, {
      method: 'GET',
      // Short timeout to avoid blocking
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      services.backend = data.status || 'healthy';
    } else {
      services.backend = 'unhealthy';
    }
  } catch (_error) {
    services.backend = 'unreachable';
  }

  const allHealthy = Object.values(services).every((status) => status === 'healthy');

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services,
    environment: process.env.NODE_ENV || 'development',
  });
}
