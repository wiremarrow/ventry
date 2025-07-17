import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { withRLS, type RLSContext } from '../rls-middleware.js';
import { verifyRLSEnabled } from '../../test-utils/rls-test-helpers-minimal.js';
import { createTestConnections } from '../../test-utils/dual-connection.js';

describe('Simple RLS Test', () => {
  let org1Id: string;
  let org2Id: string;
  let user1Id: string;
  let user2Id: string;
  let cat1Id: string;
  let cat2Id: string;
  let uom1Id: string;
  let uom2Id: string;
  let adminPrisma: any;
  let appPrisma: any;
  
  beforeAll(async () => {
    // Create dual connections
    const connections = createTestConnections();
    adminPrisma = connections.adminPrisma;
    appPrisma = connections.appPrisma;
    
    // Clean up any existing data using admin connection
    await adminPrisma.item.deleteMany({});
    await adminPrisma.itemCategory.deleteMany({});
    await adminPrisma.unitOfMeasure.deleteMany({});
    await adminPrisma.organization.deleteMany({});
    
    // Verify RLS is enabled (should be enabled by migrations)
    const rlsEnabled = await verifyRLSEnabled(adminPrisma, 'items');
    if (!rlsEnabled) {
      console.warn('RLS is not enabled on items table. Tests may not work correctly.');
    }
    
    // Create test organizations using admin connection
    const org1 = await adminPrisma.organization.create({
      data: { name: 'Org 1', slug: 'org-1' },
    });
    org1Id = org1.id;
    
    const org2 = await adminPrisma.organization.create({
      data: { name: 'Org 2', slug: 'org-2' },
    });
    org2Id = org2.id;
    
    // Create users for each organization
    const user1 = await adminPrisma.user.create({
      data: {
        email: 'user1@test.com',
        username: 'user1',
        password: 'hashed_password',
        firstName: 'User',
        lastName: 'One',
      },
    });
    user1Id = user1.id;
    
    const user2 = await adminPrisma.user.create({
      data: {
        email: 'user2@test.com',
        username: 'user2',
        password: 'hashed_password',
        firstName: 'User',
        lastName: 'Two',
      },
    });
    user2Id = user2.id;
    
    // Create organization memberships
    await adminPrisma.organizationMember.create({
      data: {
        organizationId: org1Id,
        userId: user1Id,
        role: 'MEMBER',
      },
    });
    
    await adminPrisma.organizationMember.create({
      data: {
        organizationId: org2Id,
        userId: user2Id,
        role: 'MEMBER',
      },
    });
    
    // Create categories and UOMs using admin connection
    const cat1 = await adminPrisma.itemCategory.create({
      data: {
        organizationId: org1Id,
        name: 'Cat 1',
      },
    });
    cat1Id = cat1.id;
    
    const cat2 = await adminPrisma.itemCategory.create({
      data: {
        organizationId: org2Id,
        name: 'Cat 2',
      },
    });
    cat2Id = cat2.id;
    
    const uom1 = await adminPrisma.unitOfMeasure.create({
      data: {
        organizationId: org1Id,
        code: 'PC1',
        description: 'Piece 1',
      },
    });
    uom1Id = uom1.id;
    
    const uom2 = await adminPrisma.unitOfMeasure.create({
      data: {
        organizationId: org2Id,
        code: 'PC2',
        description: 'Piece 2',
      },
    });
    uom2Id = uom2.id;
    
    // Create items using admin connection
    await adminPrisma.item.createMany({
      data: [
        {
          organizationId: org1Id,
          sku: 'ITEM-1-1',
          name: 'Item 1-1',
          categoryId: cat1Id,
          uomId: uom1Id,
        },
        {
          organizationId: org1Id,
          sku: 'ITEM-1-2',
          name: 'Item 1-2',
          categoryId: cat1Id,
          uomId: uom1Id,
        },
        {
          organizationId: org2Id,
          sku: 'ITEM-2-1',
          name: 'Item 2-1',
          categoryId: cat2Id,
          uomId: uom2Id,
        },
      ],
    });
  });
  
  afterAll(async () => {
    // Clean up using admin connection
    await adminPrisma.item.deleteMany({});
    await adminPrisma.itemCategory.deleteMany({});
    await adminPrisma.unitOfMeasure.deleteMany({});
    await adminPrisma.organizationMember.deleteMany({});
    await adminPrisma.user.deleteMany({});
    await adminPrisma.organization.deleteMany({});
    
    // Disconnect both connections
    await adminPrisma.$disconnect();
    await appPrisma.$disconnect();
  });
  
  it('should enforce RLS when context is set', async () => {
    // First, verify all items exist using admin connection (bypasses RLS)
    const allItems = await adminPrisma.item.findMany({ orderBy: { sku: 'asc' } });
    console.log(`Total items in database: ${allItems.length}`);
    expect(allItems).toHaveLength(3);
    
    // Now query with RLS context for org1
    const org1Context: RLSContext = {
      organizationId: org1Id,
      userId: user1Id,
      bypassRLS: false,
    };
    
    const org1Result = await withRLS(appPrisma, org1Context, async (tx) => {
      const result = await tx.item.findMany({ orderBy: { sku: 'asc' } });
      console.log(`Items visible to org1: ${result.length}`);
      return result;
    });
    const org1Items = org1Result.data;
    
    expect(org1Items).toHaveLength(2);
    expect(org1Items[0].sku).toBe('ITEM-1-1');
    expect(org1Items[1].sku).toBe('ITEM-1-2');
    
    // Query with RLS context for org2
    const org2Context: RLSContext = {
      organizationId: org2Id,
      userId: user2Id,
      bypassRLS: false,
    };
    
    const org2Result = await withRLS(appPrisma, org2Context, async (tx) => {
      const result = await tx.item.findMany({ orderBy: { sku: 'asc' } });
      console.log(`Items visible to org2: ${result.length}`);
      return result;
    });
    const org2Items = org2Result.data;
    
    expect(org2Items).toHaveLength(1);
    expect(org2Items[0].sku).toBe('ITEM-2-1');
  });
  
  it('should verify RLS is actually enabled', async () => {
    // Check RLS status using app connection
    const rlsStatus = await appPrisma.$queryRaw`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'items'
    `;
    console.log('RLS status:', rlsStatus);
    
    // Check current user and if they're a superuser
    const userInfo = await appPrisma.$queryRaw`
      SELECT current_user, 
             usesuper 
      FROM pg_user 
      WHERE usename = current_user
    `;
    console.log('Current database user:', userInfo);
    
    // Check if RLS is being bypassed
    const rlsBypass = await appPrisma.$queryRaw`
      SELECT current_setting('row_security', true) as row_security_setting
    `;
    console.log('Row security setting:', rlsBypass);
    
    // Check if session variables are being set
    const org1Context: RLSContext = {
      organizationId: org1Id,
      userId: user1Id,
      bypassRLS: false,
    };
    
    await withRLS(appPrisma, org1Context, async (tx) => {
      const currentOrg = await tx.$queryRaw`SELECT current_organization_id() as org_id`;
      console.log('Current org in transaction:', currentOrg);
      
      // Test the policy directly with a raw query
      const rawItems = await tx.$queryRaw`
        SELECT sku, organization_id 
        FROM items 
        ORDER BY sku
      `;
      console.log('Raw query results:', rawItems);
      
      return currentOrg;
    });
  });
});