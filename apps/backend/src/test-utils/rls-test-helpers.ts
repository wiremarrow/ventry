import { PrismaClient, Prisma } from '@ventry/database';
import { randomUUID } from 'crypto';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('rls-test-helpers');

/**
 * Test data factory for creating consistent test entities
 */
export class TestDataFactory {
  private readonly organizationCounter = new Map<string, number>();
  
  createOrganization(prefix = 'test-org') {
    const count = (this.organizationCounter.get(prefix) || 0) + 1;
    this.organizationCounter.set(prefix, count);
    
    return {
      id: randomUUID(),
      name: `${prefix}-${count}`,
      slug: `${prefix}-${count}`.toLowerCase(),
    };
  }
  
  createUser(prefix = 'test-user') {
    const uuid = randomUUID();
    const shortId = uuid.split('-')[0];
    
    return {
      id: uuid,
      email: `${prefix}-${shortId}@test.local`,
      username: `${prefix}${shortId}`,
      firstName: 'Test',
      lastName: `User ${shortId}`,
      password: 'hashed-test-password',
      role: 'USER' as const,
    };
  }
  
  createItemCategory(organizationId: string, name = 'Test Category') {
    return {
      id: randomUUID(),
      organizationId,
      name: `${name} ${Date.now()}`,
    };
  }
  
  createUnitOfMeasure(organizationId: string, code = 'PC') {
    return {
      id: randomUUID(),
      organizationId,
      code: `${code}-${Date.now()}`,
      description: `${code} Description`,
    };
  }
  
  createItem(organizationId: string, categoryId: string, uomId: string, sku?: string) {
    const uuid = randomUUID();
    const shortId = uuid.split('-')[0];
    
    return {
      id: uuid,
      organizationId,
      sku: sku || `SKU-${shortId}`,
      name: `Test Item ${shortId}`,
      categoryId,
      uomId,
    };
  }
}

/**
 * RLS test context that ensures proper cleanup
 */
export class RLSTestContext {
  private readonly prisma: PrismaClient;
  private readonly factory: TestDataFactory;
  private readonly createdIds = {
    organizations: new Set<string>(),
    users: new Set<string>(),
    items: new Set<string>(),
    categories: new Set<string>(),
    uoms: new Set<string>(),
  };
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.factory = new TestDataFactory();
  }
  
  /**
   * Creates test organizations and tracks them for cleanup
   */
  async createOrganizations(count = 2) {
    const orgs = Array.from({ length: count }, () => this.factory.createOrganization());
    
    await this.prisma.organization.createMany({ data: orgs });
    orgs.forEach(org => this.createdIds.organizations.add(org.id));
    
    return orgs;
  }
  
  /**
   * Creates test users and tracks them for cleanup
   */
  async createUsers(count = 2) {
    const users = Array.from({ length: count }, () => this.factory.createUser());
    
    await this.prisma.user.createMany({ data: users });
    users.forEach(user => this.createdIds.users.add(user.id));
    
    return users;
  }
  
  /**
   * Creates organization memberships
   */
  async createMemberships(assignments: Array<{ userId: string; organizationId: string; role?: string }>) {
    const data = assignments.map(({ userId, organizationId, role = 'MEMBER' }) => ({
      userId,
      organizationId,
      role: role as any,
    }));
    
    await this.prisma.organizationMember.createMany({ data });
  }
  
  /**
   * Creates test items with all required dependencies
   */
  async createItemsWithDependencies(organizationId: string, count = 2) {
    // Create category
    const category = this.factory.createItemCategory(organizationId);
    await this.prisma.itemCategory.create({ data: category });
    this.createdIds.categories.add(category.id);
    
    // Create UOM
    const uom = this.factory.createUnitOfMeasure(organizationId);
    await this.prisma.unitOfMeasure.create({ data: uom });
    this.createdIds.uoms.add(uom.id);
    
    // Create items
    const items = Array.from({ length: count }, (_, i) => 
      this.factory.createItem(organizationId, category.id, uom.id, `ORG-${organizationId.slice(0, 8)}-ITEM-${i + 1}`)
    );
    
    await this.prisma.item.createMany({ data: items });
    items.forEach(item => this.createdIds.items.add(item.id));
    
    return { category, uom, items };
  }
  
  /**
   * Cleans up all created test data
   */
  async cleanup() {
    try {
      // First, delete ALL items (not just the ones we created) that belong to our test orgs
      // This handles items created during tests that we don't track
      if (this.createdIds.organizations.size > 0) {
        await this.prisma.item.deleteMany({
          where: { 
            organizationId: { in: Array.from(this.createdIds.organizations) } 
          },
        });
      }
      
      // Then delete categories and UOMs
      if (this.createdIds.categories.size > 0) {
        await this.prisma.itemCategory.deleteMany({
          where: { id: { in: Array.from(this.createdIds.categories) } },
        });
      }
      
      if (this.createdIds.uoms.size > 0) {
        await this.prisma.unitOfMeasure.deleteMany({
          where: { id: { in: Array.from(this.createdIds.uoms) } },
        });
      }
      
      // Delete organizations (memberships cascade)
      if (this.createdIds.organizations.size > 0) {
        await this.prisma.organization.deleteMany({
          where: { id: { in: Array.from(this.createdIds.organizations) } },
        });
      }
      
      // Finally delete users
      if (this.createdIds.users.size > 0) {
        await this.prisma.user.deleteMany({
          where: { id: { in: Array.from(this.createdIds.users) } },
        });
      }
      
      logger.debug('Test data cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup test data');
      // Don't throw in cleanup - tests should still be marked as pass/fail
      // based on their actual results, not cleanup failures
    }
  }
}

/**
 * RLS assertion helpers
 */
export class RLSAssertions {
  /**
   * Asserts that a query result only contains items from the expected organization
   */
  static assertOrganizationIsolation<T extends { organizationId: string }>(
    items: T[],
    expectedOrgId: string,
    message = 'Items should only be from the expected organization'
  ) {
    const wrongOrgItems = items.filter(item => item.organizationId !== expectedOrgId);
    if (wrongOrgItems.length > 0) {
      throw new Error(`${message}. Found ${wrongOrgItems.length} items from other organizations.`);
    }
  }
  
  /**
   * Asserts that a query returned no results (for cross-org access tests)
   */
  static assertNoAccess<T>(
    items: T[],
    message = 'Should not have access to any items'
  ) {
    if (items.length > 0) {
      throw new Error(`${message}. Found ${items.length} items.`);
    }
  }
  
  /**
   * Asserts that an operation affected no rows (for cross-org mutation tests)
   */
  static assertNoMutation(
    result: { count: number } | number,
    message = 'Should not be able to mutate items from other organizations'
  ) {
    const count = typeof result === 'number' ? result : result.count;
    if (count > 0) {
      throw new Error(`${message}. Affected ${count} rows.`);
    }
  }
}

/**
 * Sets up RLS functions in the database
 * This is idempotent and safe to run multiple times
 */
export async function setupRLSFunctions(prisma: PrismaClient) {
  try {
    // Drop existing functions if they exist (CASCADE to handle dependencies)
    await prisma.$executeRaw`DROP FUNCTION IF EXISTS current_organization_id() CASCADE`;
    await prisma.$executeRaw`DROP FUNCTION IF EXISTS current_user_id() CASCADE`;
    
    // Create the RLS helper functions
    await prisma.$executeRaw`
      CREATE FUNCTION current_organization_id() RETURNS text AS $$
      BEGIN
        RETURN current_setting('app.current_organization_id', true);
      EXCEPTION
        WHEN OTHERS THEN
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `;
    
    await prisma.$executeRaw`
      CREATE FUNCTION current_user_id() RETURNS text AS $$
      BEGIN
        RETURN current_setting('app.current_user_id', true);
      EXCEPTION
        WHEN OTHERS THEN
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `;
    
    logger.debug('RLS functions set up successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to setup RLS functions');
    throw error;
  }
}

/**
 * Enables RLS on specified tables with tenant isolation policy
 */
export async function enableRLSForTable(
  prisma: PrismaClient,
  tableName: string,
  policyName = 'tenant_isolation_policy'
) {
  try {
    // Drop existing policy if it exists
    await prisma.$executeRawUnsafe(
      `DROP POLICY IF EXISTS "${policyName}" ON ${tableName}`
    );
    
    // Enable RLS on the table
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`
    );
    
    // Create the tenant isolation policy
    await prisma.$executeRawUnsafe(`
      CREATE POLICY "${policyName}" ON ${tableName}
      FOR ALL
      USING (organization_id = current_organization_id())
    `);
    
    logger.debug({ tableName, policyName }, 'RLS enabled for table');
  } catch (error) {
    logger.error({ error, tableName }, 'Failed to enable RLS for table');
    throw error;
  }
}

/**
 * Disables RLS on specified tables (for cleanup)
 */
export async function disableRLSForTable(
  prisma: PrismaClient,
  tableName: string
) {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE ${tableName} DISABLE ROW LEVEL SECURITY`
    );
    
    logger.debug({ tableName }, 'RLS disabled for table');
  } catch (error) {
    // Ignore errors during cleanup
    logger.warn({ error, tableName }, 'Failed to disable RLS for table (may not exist)');
  }
}