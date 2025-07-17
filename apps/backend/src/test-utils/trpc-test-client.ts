import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../routers/app.js';
import { createContext } from '../trpc/context.js';

// Create a test client that bypasses HTTP
export function createTestTRPCClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'http://localhost:6060/trpc',
        transformer: superjson,
        headers: async () => {
          return {};
        },
      }),
    ],
  });
}

// Create a direct caller for unit tests (bypasses HTTP)
export async function createDirectCaller(contextOverride?: Partial<Awaited<ReturnType<typeof createContext>>>) {
  const { appRouter } = await import('../routers/app.js');
  
  const defaultContext = {
    req: {} as any,
    res: {} as any,
    user: null,
    prisma: (await import('@ventry/database')).prisma,
  };

  const ctx = { ...defaultContext, ...contextOverride };
  
  return appRouter.createCaller(ctx);
}

// Helper to create authenticated context
export async function createAuthenticatedContext(user: { id: string; email: string; role: string }) {
  return {
    user,
    prisma: (await import('@ventry/database')).prisma,
    req: {} as any,
    res: {} as any,
  };
}

// Helper for integration tests - creates proper context with mock request/response
export async function createIntegrationContext(authToken?: string) {
  const mockReq = {
    headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
    cookies: {},
    // Mock unsignCookie for cookie handling
    unsignCookie: (value: string) => ({ valid: true, value })
  };
  const mockRes = {
    // Mock header method for response
    header: () => {}
  };
  
  return await createContext({ 
    req: mockReq as any, 
    res: mockRes as any,
    info: {} as any
  });
}

// Helper for integration tests that need an authenticated user
export async function createAuthenticatedIntegrationContext() {
  const { prisma } = await import('@ventry/database');
  const { hash } = await import('bcryptjs');
  const { signJWT } = await import('../auth/jwt.js');
  
  // Create test organization with unique slug
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const org = await prisma.organization.create({
    data: {
      name: 'Test Organization',
      slug: `test-org-${timestamp}-${randomSuffix}`,
    }
  });
  
  // Create test user with unique identifiers
  const userTimestamp = Date.now();
  const userRandomSuffix = Math.random().toString(36).substring(7);
  const user = await prisma.user.create({
    data: {
      email: `test-${userTimestamp}-${userRandomSuffix}@integration.test`,
      username: `testuser-${userTimestamp}-${userRandomSuffix}`,
      firstName: 'Test',
      lastName: 'User',
      password: await hash('password123', 10),
      role: 'ADMIN',
      isActive: true,
    }
  });
  
  // Create organization membership
  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      role: 'ADMIN',
    }
  });
  
  // Create JWT token with minimal required fields
  const token = signJWT({ 
    userId: user.id, 
    organizationId: org.id,
    email: user.email,  // Optional but included for test coverage
    role: user.role     // Optional but included for test coverage
  });
  
  // Create context with auth token
  const ctx = await createIntegrationContext(token);
  
  // Return context with cleanup function
  return {
    ctx,
    user,
    organization: org,
    cleanup: async () => {
      // Delete in correct order to respect foreign key constraints
      await prisma.auditLog.deleteMany({ where: { userId: user.id } });
      await prisma.organizationMember.deleteMany({ where: { userId: user.id } });
      
      // Delete all organization data first
      await prisma.inventory.deleteMany({ where: { item: { organizationId: org.id } } });
      await prisma.priceHistory.deleteMany({ where: { item: { organizationId: org.id } } });
      await prisma.item.deleteMany({ where: { organizationId: org.id } });
      await prisma.location.deleteMany({ where: { warehouse: { organizationId: org.id } } });
      await prisma.warehouse.deleteMany({ where: { organizationId: org.id } });
      await prisma.itemCategory.deleteMany({ where: { organizationId: org.id } });
      await prisma.unitOfMeasure.deleteMany({ where: { organizationId: org.id } });
      await prisma.supplier.deleteMany({ where: { organizationId: org.id } });
      await prisma.customer.deleteMany({ where: { organizationId: org.id } });
      
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  };
}