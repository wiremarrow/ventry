import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma as basePrisma } from '@ventry/database';
import { withRLS, type RLSContext } from '../rls-middleware-v2.js';
import { setupRLSFunctions, enableRLSForTable } from '../../test-utils/rls-test-helpers.js';

describe('Simple RLS Test', () => {
  const org1Id = '11111111-1111-1111-1111-111111111111';
  const org2Id = '22222222-2222-2222-2222-222222222222';
  
  beforeAll(async () => {
    // Clean up any existing data
    await basePrisma.item.deleteMany({});
    await basePrisma.itemCategory.deleteMany({});
    await basePrisma.unitOfMeasure.deleteMany({});
    await basePrisma.organization.deleteMany({});
    
    // Set up RLS
    await setupRLSFunctions(basePrisma);
    await enableRLSForTable(basePrisma, 'items');
    
    // Create test organizations
    await basePrisma.organization.createMany({
      data: [
        { id: org1Id, name: 'Org 1', slug: 'org-1' },
        { id: org2Id, name: 'Org 2', slug: 'org-2' },
      ],
    });
    
    // Create categories and UOMs
    const cat1 = await basePrisma.itemCategory.create({
      data: {
        id: '11111111-1111-1111-1111-111111111112',
        organizationId: org1Id,
        name: 'Cat 1',
      },
    });
    
    const cat2 = await basePrisma.itemCategory.create({
      data: {
        id: '22222222-2222-2222-2222-222222222223',
        organizationId: org2Id,
        name: 'Cat 2',
      },
    });
    
    const uom1 = await basePrisma.unitOfMeasure.create({
      data: {
        id: '11111111-1111-1111-1111-111111111113',
        organizationId: org1Id,
        code: 'PC1',
        description: 'Piece 1',
      },
    });
    
    const uom2 = await basePrisma.unitOfMeasure.create({
      data: {
        id: '22222222-2222-2222-2222-222222222224',
        organizationId: org2Id,
        code: 'PC2',
        description: 'Piece 2',
      },
    });
    
    // Create items
    await basePrisma.item.createMany({
      data: [
        {
          organizationId: org1Id,
          sku: 'ITEM-1-1',
          name: 'Item 1-1',
          categoryId: cat1.id,
          uomId: uom1.id,
        },
        {
          organizationId: org1Id,
          sku: 'ITEM-1-2',
          name: 'Item 1-2',
          categoryId: cat1.id,
          uomId: uom1.id,
        },
        {
          organizationId: org2Id,
          sku: 'ITEM-2-1',
          name: 'Item 2-1',
          categoryId: cat2.id,
          uomId: uom2.id,
        },
      ],
    });
  });
  
  afterAll(async () => {
    await basePrisma.item.deleteMany({});
    await basePrisma.itemCategory.deleteMany({});
    await basePrisma.unitOfMeasure.deleteMany({});
    await basePrisma.organization.deleteMany({});
  });
  
  it('should enforce RLS when context is set', async () => {
    // First, verify all items exist without RLS
    const allItems = await basePrisma.item.findMany({ orderBy: { sku: 'asc' } });
    console.log(`Total items in database: ${allItems.length}`);
    expect(allItems).toHaveLength(3);
    
    // Now query with RLS context for org1
    const org1Context: RLSContext = {
      organizationId: org1Id,
    };
    
    const org1Items = await withRLS(basePrisma, org1Context, async (tx) => {
      const result = await tx.item.findMany({ orderBy: { sku: 'asc' } });
      console.log(`Items visible to org1: ${result.length}`);
      return result;
    });
    
    expect(org1Items).toHaveLength(2);
    expect(org1Items[0].sku).toBe('ITEM-1-1');
    expect(org1Items[1].sku).toBe('ITEM-1-2');
    
    // Query with RLS context for org2
    const org2Context: RLSContext = {
      organizationId: org2Id,
    };
    
    const org2Items = await withRLS(basePrisma, org2Context, async (tx) => {
      const result = await tx.item.findMany({ orderBy: { sku: 'asc' } });
      console.log(`Items visible to org2: ${result.length}`);
      return result;
    });
    
    expect(org2Items).toHaveLength(1);
    expect(org2Items[0].sku).toBe('ITEM-2-1');
  });
  
  it('should verify RLS is actually enabled', async () => {
    // Check RLS status
    const rlsStatus = await basePrisma.$queryRaw`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'items'
    `;
    console.log('RLS status:', rlsStatus);
    
    // Check current user and if they're a superuser
    const userInfo = await basePrisma.$queryRaw`
      SELECT current_user, 
             usesuper 
      FROM pg_user 
      WHERE usename = current_user
    `;
    console.log('Current database user:', userInfo);
    
    // Check if RLS is being bypassed
    const rlsBypass = await basePrisma.$queryRaw`
      SELECT current_setting('row_security', true) as row_security_setting
    `;
    console.log('Row security setting:', rlsBypass);
    
    // Check if session variables are being set
    const org1Context: RLSContext = {
      organizationId: org1Id,
    };
    
    await withRLS(basePrisma, org1Context, async (tx) => {
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