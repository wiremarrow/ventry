import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@ventry/database';
import * as bcrypt from 'bcryptjs';
import { createTestConnections } from '../../test-utils/dual-connection.js';
import { withRLS, type RLSContext } from '../../lib/rls/index.js';

describe('End-to-End RLS Integration', () => {
  let adminPrisma: PrismaClient;
  let appPrisma: PrismaClient;
  let org1Id: string;
  let org2Id: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Create dual connections
    const connections = createTestConnections();
    adminPrisma = connections.adminPrisma;
    appPrisma = connections.appPrisma;

    // Clean up test data using admin connection (bypasses RLS)
    await adminPrisma.$executeRawUnsafe(`DELETE FROM items WHERE sku LIKE 'RLS-E2E-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organization_members WHERE organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'rls-e2e-%')`
    );
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
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(`DELETE FROM items WHERE sku LIKE 'RLS-E2E-%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM item_categories WHERE name LIKE 'RLS E2E%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM units_of_measure WHERE code LIKE 'RLS-E2E-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organization_members WHERE organization_id IN ($1, $2)`,
      org1Id,
      org2Id
    );
    await adminPrisma.$executeRawUnsafe(`DELETE FROM organizations WHERE slug LIKE 'rls-e2e-%'`);
    await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'rls-e2e-%'`);

    // Disconnect both connections
    await adminPrisma.$disconnect();
    await appPrisma.$disconnect();
  });

  it('should filter items based on user organization', async () => {
    // First, verify all items exist using admin connection (bypasses RLS)
    const allItems = await adminPrisma.item.findMany({
      where: { sku: { startsWith: 'RLS-E2E' } },
      orderBy: { sku: 'asc' },
    });
    expect(allItems).toHaveLength(2);

    // Now query with RLS context for org1
    const org1Context: RLSContext = {
      organizationId: org1Id,
      userId: user1Id,
      bypassRLS: false,
    };

    const org1Result = await withRLS(appPrisma, org1Context, async (tx) => {
      return await tx.item.findMany({
        where: { sku: { startsWith: 'RLS-E2E' } },
        orderBy: { sku: 'asc' },
      });
    });

    expect(org1Result.data).toHaveLength(1);
    expect(org1Result.data[0]?.sku).toBe('RLS-E2E-ITEM-1');
    expect(org1Result.data[0]?.organizationId).toBe(org1Id);
  });

  it('should prevent cross-organization access', async () => {
    // Query with RLS context for org2
    const org2Context: RLSContext = {
      organizationId: org2Id,
      userId: user2Id,
      bypassRLS: false,
    };

    const org2Result = await withRLS(appPrisma, org2Context, async (tx) => {
      return await tx.item.findMany({
        where: { sku: { startsWith: 'RLS-E2E' } },
        orderBy: { sku: 'asc' },
      });
    });

    // User2 should only see org2's items
    expect(org2Result.data).toHaveLength(1);
    expect(org2Result.data[0]?.sku).toBe('RLS-E2E-ITEM-2');
    expect(org2Result.data[0]?.organizationId).toBe(org2Id);
  });

  it('should verify RLS is properly enforced at database level', async () => {
    // Test that without RLS context, no items are visible
    const noContextResult = await appPrisma.item.findMany({
      where: { sku: { startsWith: 'RLS-E2E' } },
    });

    // Should see no items without RLS context set
    expect(noContextResult).toHaveLength(0);

    // Now test with RLS context
    const org1Context: RLSContext = {
      organizationId: org1Id,
      userId: user1Id,
      bypassRLS: false,
    };

    await withRLS(appPrisma, org1Context, async (tx) => {
      // Verify context was set in the database
      const ctxCheck = await tx.$queryRaw<Array<{ org_id: string | null; user_id: string | null }>>`
        SELECT current_organization_id() as org_id, current_user_id() as user_id
      `;
      expect(ctxCheck[0]?.org_id).toBe(org1Id);
      expect(ctxCheck[0]?.user_id).toBe(user1Id);

      // Test the policy directly with a raw query
      const rawItems = await tx.$queryRaw<Array<{ sku: string; organization_id: string }>>`
        SELECT sku, organization_id 
        FROM items 
        WHERE sku LIKE 'RLS-E2E-%'
        ORDER BY sku
      `;

      expect(rawItems).toHaveLength(1);
      expect(rawItems[0]?.sku).toBe('RLS-E2E-ITEM-1');
    });
  });
});
