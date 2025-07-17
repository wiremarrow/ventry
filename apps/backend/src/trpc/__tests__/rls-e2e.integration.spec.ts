import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createContext } from '../context.js';
import { appRouter } from '../../routers/app.js';
import { PrismaClient } from '@ventry/database';
import * as bcrypt from 'bcryptjs';
import { signJWT } from '../../auth/jwt.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createTestConnections } from '../../test-utils/dual-connection.js';
import { createIntegrationContext } from '../../test-utils/trpc-test-client.js';

describe('End-to-End RLS Integration', () => {
  let adminPrisma: PrismaClient;
  let appPrisma: PrismaClient;
  let org1Id: string;
  let org2Id: string;
  let user1Id: string;
  let user1Token: string;
  let user2Id: string;
  let user2Token: string;

  beforeEach(async () => {
    // Create dual connections
    const connections = createTestConnections();
    adminPrisma = connections.adminPrisma;
    appPrisma = connections.appPrisma;

    // Clean up test data using admin connection (bypasses RLS)
    await adminPrisma.$executeRawUnsafe(`DELETE FROM items WHERE sku LIKE 'RLS-E2E-%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM organization_members WHERE organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'rls-e2e-%')`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE slug LIKE 'rls-e2e-%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'rls-e2e-%'`);

    // Create test organizations using admin connection
    const org1 = await adminPrisma.organization.create({
      data: {
        name: 'RLS E2E Org 1',
        slug: 'rls-e2e-org-1',
      },
    });
    org1Id = org1.id;

    const org2 = await adminPrisma.organization.create({
      data: {
        name: 'RLS E2E Org 2',
        slug: 'rls-e2e-org-2',
      },
    });
    org2Id = org2.id;

    // Create test users
    const hashedPassword = await bcrypt.hash('testpass123', 10);
    
    const user1 = await adminPrisma.user.create({
      data: {
        email: 'rls-e2e-user1@example.com',
        username: 'rlse2euser1',
        firstName: 'RLS',
        lastName: 'User1',
        password: hashedPassword,
      },
    });
    user1Id = user1.id;
    user1Token = signJWT({ 
      userId: user1Id, 
      email: user1.email,
      role: user1.role,
      organizationId: org1Id 
    });

    const user2 = await adminPrisma.user.create({
      data: {
        email: 'rls-e2e-user2@example.com',
        username: 'rlse2euser2',
        firstName: 'RLS',
        lastName: 'User2',
        password: hashedPassword,
      },
    });
    user2Id = user2.id;
    user2Token = signJWT({ 
      userId: user2Id, 
      email: user2.email,
      role: user2.role,
      organizationId: org2Id 
    });

    // Add users to their organizations
    await adminPrisma.organizationMember.create({
      data: {
        organizationId: org1Id,
        userId: user1Id,
        role: 'ADMIN',
      },
    });

    await adminPrisma.organizationMember.create({
      data: {
        organizationId: org2Id,
        userId: user2Id,
        role: 'ADMIN',
      },
    });

    // Create test data
    const category1 = await adminPrisma.itemCategory.create({
      data: {
        organizationId: org1Id,
        name: 'RLS E2E Category 1',
      },
    });

    const category2 = await adminPrisma.itemCategory.create({
      data: {
        organizationId: org2Id,
        name: 'RLS E2E Category 2',
      },
    });

    const uom1 = await adminPrisma.unitOfMeasure.create({
      data: {
        organizationId: org1Id,
        code: 'RLS-E2E-EA1',
        description: 'Each',
        isBase: true,
      },
    });

    const uom2 = await adminPrisma.unitOfMeasure.create({
      data: {
        organizationId: org2Id,
        code: 'RLS-E2E-EA2',
        description: 'Each',
        isBase: true,
      },
    });

    // Create items for each org
    await adminPrisma.item.create({
      data: {
        organizationId: org1Id,
        sku: 'RLS-E2E-ITEM-1',
        name: 'Org 1 Item',
        categoryId: category1.id,
        uomId: uom1.id,
        reorderPoint: 10,
        reorderQty: 50,
      },
    });

    await adminPrisma.item.create({
      data: {
        organizationId: org2Id,
        sku: 'RLS-E2E-ITEM-2',
        name: 'Org 2 Item',
        categoryId: category2.id,
        uomId: uom2.id,
        reorderPoint: 10,
        reorderQty: 50,
      },
    });

    // Disconnect admin connection to ensure data is committed
    await adminPrisma.$disconnect();
    
    // Reconnect for afterEach cleanup
    adminPrisma = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_ADMIN_URL || 'postgresql://ventry:ventry_dev_password@localhost:5487/ventry_integration_test' }
      }
    });
  });

  afterEach(async () => {
    await adminPrisma.$executeRawUnsafe(`DELETE FROM items WHERE sku LIKE 'RLS-E2E-%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM item_categories WHERE name LIKE 'RLS E2E%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM units_of_measure WHERE code LIKE 'RLS-E2E-%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, org1Id, org2Id);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE slug LIKE 'rls-e2e-%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'rls-e2e-%'`);
    
    // Disconnect both connections
    await adminPrisma.$disconnect();
    await appPrisma.$disconnect();
  });

  it('should filter items based on user organization via tRPC', async () => {
    // Import basePrisma to check what context sees
    const { prisma: basePrisma } = await import('@ventry/database');
    
    // Verify the user exists in DB first
    const userCheck = await adminPrisma.user.findUnique({
      where: { id: user1Id }
    });
    console.log('User exists in adminPrisma:', !!userCheck, userCheck?.email);
    
    // Check if basePrisma sees the user
    const userCheckBase = await basePrisma.user.findUnique({
      where: { id: user1Id }
    });
    console.log('User exists in basePrisma:', !!userCheckBase, userCheckBase?.email);
    console.log('User1 token:', user1Token);
    
    // Create context using the standard helper
    const ctx = await createIntegrationContext(user1Token);
    
    console.log('Context after creation:', {
      user: ctx.user,
      organizationId: ctx.organizationId,
      hasUser: !!ctx.user
    });
    
    // Override organizationId in context since it comes from header in real requests
    ctx.organizationId = org1Id;

    const caller = appRouter.createCaller(ctx);

    // User1 should only see their org's items
    const result = await caller.items.list({
      search: 'RLS-E2E',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sku).toBe('RLS-E2E-ITEM-1');
    expect(result.items[0]?.organizationId).toBe(org1Id);
  });

  it('should prevent cross-organization access via tRPC', async () => {
    // Create context using the standard helper
    const ctx = await createIntegrationContext(user2Token);
    
    // Override organizationId in context
    ctx.organizationId = org2Id;

    const caller = appRouter.createCaller(ctx);

    // User2 should NOT see org1's items
    const result = await caller.items.list({
      search: 'RLS-E2E-ITEM-1',
    });

    expect(result.items).toHaveLength(0);
  });

  it('should verify RLS works at application level', async () => {
    // Create context using the standard helper
    const ctx = await createIntegrationContext(user1Token);
    
    // Override organizationId in context
    ctx.organizationId = org1Id;

    // Explicit DB-level RLS: prove the policy works
    await ctx.prisma.$transaction(async (tx) => {
      // Check current user and privileges
      const userInfo = await tx.$queryRaw<Array<{ current_user: string; is_superuser: boolean; bypass_rls: boolean }>>`
        SELECT current_user, 
               current_setting('is_superuser')::boolean as is_superuser,
               rolbypassrls as bypass_rls
        FROM pg_roles 
        WHERE rolname = current_user
      `;
      console.log('Database user info:', userInfo[0]);

      // set org + user in the DB session (what the proxy should do)
      await tx.$executeRaw`SELECT set_rls_context(${org1Id}, ${user1Id})`;
      
      // Verify context was set
      const ctxCheck = await tx.$queryRaw<Array<{ org_id: string | null; user_id: string | null }>>`
        SELECT current_organization_id() as org_id, current_user_id() as user_id
      `;
      console.log('Context after set_rls_context:', ctxCheck[0]);

      const items = await tx.item.findMany({
        where: { sku: { startsWith: 'RLS-E2E' } },
      });
      
      console.log('Items found in transaction:', items.map(i => ({ sku: i.sku, orgId: i.organizationId })));

      expect(items).toHaveLength(1);
      expect(items[0]?.sku).toBe('RLS-E2E-ITEM-1');
      expect(items[0]?.organizationId).toBe(org1Id);
    });

    // Verify context object we built
    expect(ctx.user?.id).toBe(user1Id);
    expect(ctx.user?.organizationId).toBe(org1Id);
  });
});