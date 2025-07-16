import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@ventry/database';
import { createRLSProxy } from '../index.js';
import type { RLSContext } from '../types.js';

describe('Database-Level RLS Integration Tests', () => {
  let prisma: PrismaClient;
  let testOrg1Id: string;
  let testOrg2Id: string;
  let testUser1Id: string;
  let testUser2Id: string;
  let testCategory1Id: string;
  let testCategory2Id: string;
  let testUom1Id: string;
  let testUom2Id: string;

  beforeEach(async () => {
    // Create a fresh Prisma client for each test
    prisma = new PrismaClient();
    
    // Clean up test data first
    await prisma.$executeRawUnsafe(`DELETE FROM items WHERE sku LIKE 'RLS-TEST-%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM item_categories WHERE name LIKE 'RLS Test%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM units_of_measure WHERE code LIKE 'RLS-TEST-%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE slug LIKE 'rls-test-%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'rls-test-%'`);
    
    // Create test organizations
    const org1 = await prisma.organization.create({
      data: {
        name: 'RLS Test Org 1',
        slug: 'rls-test-org-1',
      },
    });
    testOrg1Id = org1.id;

    const org2 = await prisma.organization.create({
      data: {
        name: 'RLS Test Org 2',
        slug: 'rls-test-org-2',
      },
    });
    testOrg2Id = org2.id;

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: 'rls-test-user1@example.com',
        username: 'rls-test-user1',
        firstName: 'RLS',
        lastName: 'User1',
        password: 'hashed-password',
      },
    });
    testUser1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'rls-test-user2@example.com',
        username: 'rls-test-user2',
        firstName: 'RLS',
        lastName: 'User2',
        password: 'hashed-password',
      },
    });
    testUser2Id = user2.id;

    // Add users to their respective organizations
    await prisma.organizationMember.create({
      data: {
        organizationId: testOrg1Id,
        userId: testUser1Id,
        role: 'ADMIN',
      },
    });

    await prisma.organizationMember.create({
      data: {
        organizationId: testOrg2Id,
        userId: testUser2Id,
        role: 'ADMIN',
      },
    });

    // Create test categories for each organization
    const category1 = await prisma.itemCategory.create({
      data: {
        organizationId: testOrg1Id,
        name: 'RLS Test Category 1',
        description: 'Test category for org 1',
      },
    });
    testCategory1Id = category1.id;

    const category2 = await prisma.itemCategory.create({
      data: {
        organizationId: testOrg2Id,
        name: 'RLS Test Category 2',
        description: 'Test category for org 2',
      },
    });
    testCategory2Id = category2.id;

    // Create test units of measure for each organization
    const uom1 = await prisma.unitOfMeasure.create({
      data: {
        organizationId: testOrg1Id,
        code: 'RLS-TEST-EA1',
        description: 'Each (Test 1)',
        isBase: true,
      },
    });
    testUom1Id = uom1.id;

    const uom2 = await prisma.unitOfMeasure.create({
      data: {
        organizationId: testOrg2Id,
        code: 'RLS-TEST-EA2',
        description: 'Each (Test 2)',
        isBase: true,
      },
    });
    testUom2Id = uom2.id;

    // Create test items for each organization
    await prisma.item.create({
      data: {
        organizationId: testOrg1Id,
        sku: 'RLS-TEST-ITEM-1',
        name: 'Test Item Org 1',
        categoryId: testCategory1Id,
        uomId: testUom1Id,
        reorderPoint: 10,
        reorderQty: 50,
      },
    });

    await prisma.item.create({
      data: {
        organizationId: testOrg2Id,
        sku: 'RLS-TEST-ITEM-2',
        name: 'Test Item Org 2',
        categoryId: testCategory2Id,
        uomId: testUom2Id,
        reorderPoint: 10,
        reorderQty: 50,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.$executeRawUnsafe(`DELETE FROM items WHERE sku LIKE 'RLS-TEST-%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM item_categories WHERE name LIKE 'RLS Test%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM units_of_measure WHERE code LIKE 'RLS-TEST-%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, testOrg1Id, testOrg2Id);
    await prisma.$executeRawUnsafe(`DELETE FROM organizations WHERE slug LIKE 'rls-test-%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'rls-test-%'`);
    await prisma.$disconnect();
  });

  it('should filter items based on organization context', async () => {
    // Create RLS context for user1 in org1
    const rlsContext: RLSContext = {
      organizationId: testOrg1Id,
      userId: testUser1Id,
      bypassRLS: false,
    };

    const rlsPrisma = createRLSProxy(prisma, () => rlsContext);

    // First, let's check what the database sees as the current context
    const contextCheck = await prisma.$queryRaw`
      SELECT current_organization_id() as org_id, current_user_id() as user_id
    `;
    console.log('Database context before RLS query:', contextCheck);

    // User1 should only see items from org1
    const items = await rlsPrisma.item.findMany({
      where: { sku: { startsWith: 'RLS-TEST-' } },
    });

    console.log('Items found:', items.length);
    console.log('Item org IDs:', items.map(i => ({ sku: i.sku, orgId: i.organizationId })));

    expect(items).toHaveLength(1);
    expect(items[0]?.sku).toBe('RLS-TEST-ITEM-1');
    expect(items[0]?.organizationId).toBe(testOrg1Id);
  });

  it('should prevent cross-organization data access', async () => {
    // Create RLS context for user2 in org2
    const rlsContext: RLSContext = {
      organizationId: testOrg2Id,
      userId: testUser2Id,
      bypassRLS: false,
    };

    const rlsPrisma = createRLSProxy(prisma, () => rlsContext);

    // User2 should NOT see items from org1
    const org1Item = await rlsPrisma.item.findFirst({
      where: { sku: 'RLS-TEST-ITEM-1' },
    });

    expect(org1Item).toBeNull();

    // User2 should see items from org2
    const org2Item = await rlsPrisma.item.findFirst({
      where: { sku: 'RLS-TEST-ITEM-2' },
    });

    expect(org2Item).not.toBeNull();
    expect(org2Item?.organizationId).toBe(testOrg2Id);
  });

  it('should allow users to see their own user record', async () => {
    const rlsContext: RLSContext = {
      organizationId: testOrg1Id,
      userId: testUser1Id,
      bypassRLS: false,
    };

    const rlsPrisma = createRLSProxy(prisma, () => rlsContext);

    // User should be able to see their own record
    const ownUser = await rlsPrisma.user.findUnique({
      where: { id: testUser1Id },
    });

    expect(ownUser).not.toBeNull();
    expect(ownUser?.id).toBe(testUser1Id);
  });

  it('should allow users to see organization members in same org', async () => {
    // Add user2 to org1 as well
    await prisma.organizationMember.create({
      data: {
        organizationId: testOrg1Id,
        userId: testUser2Id,
        role: 'MEMBER',
      },
    });

    const rlsContext: RLSContext = {
      organizationId: testOrg1Id,
      userId: testUser1Id,
      bypassRLS: false,
    };

    const rlsPrisma = createRLSProxy(prisma, () => rlsContext);

    // User1 should see user2 since they're in the same org
    const user2 = await rlsPrisma.user.findUnique({
      where: { id: testUser2Id },
    });

    expect(user2).not.toBeNull();
    expect(user2?.id).toBe(testUser2Id);
  });

  it('should filter organization members correctly', async () => {
    const rlsContext: RLSContext = {
      organizationId: testOrg1Id,
      userId: testUser1Id,
      bypassRLS: false,
    };

    const rlsPrisma = createRLSProxy(prisma, () => rlsContext);

    // User should only see their own memberships
    const memberships = await rlsPrisma.organizationMember.findMany({
      where: { organizationId: { in: [testOrg1Id, testOrg2Id] } },
    });

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.userId).toBe(testUser1Id);
    expect(memberships[0]?.organizationId).toBe(testOrg1Id);
  });

  it('should bypass RLS when bypassRLS is true', async () => {
    const rlsContext: RLSContext = {
      bypassRLS: true,
      bypassReason: 'Admin operation - testing RLS bypass',
    };

    const rlsPrisma = createRLSProxy(prisma, () => rlsContext);

    // With RLS bypassed, should see all items
    const items = await rlsPrisma.item.findMany({
      where: { sku: { startsWith: 'RLS-TEST-' } },
      orderBy: { sku: 'asc' },
    });

    expect(items).toHaveLength(2);
    expect(items[0]?.sku).toBe('RLS-TEST-ITEM-1');
    expect(items[1]?.sku).toBe('RLS-TEST-ITEM-2');
  });

  it('should handle operations without organization context', async () => {
    // Context with only userId (no organization)
    const rlsContext: RLSContext = {
      userId: testUser1Id,
      bypassRLS: false,
    };

    const rlsPrisma = createRLSProxy(prisma, () => rlsContext);

    // Should not see any items without organization context
    const items = await rlsPrisma.item.findMany({
      where: { sku: { startsWith: 'RLS-TEST-' } },
    });

    expect(items).toHaveLength(0);

    // But should still see own user record
    const ownUser = await rlsPrisma.user.findUnique({
      where: { id: testUser1Id },
    });

    expect(ownUser).not.toBeNull();
  });
});