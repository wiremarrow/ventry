import { PrismaClient } from '@ventry/database';
import { hash } from 'bcryptjs';

/**
 * Test Database Helpers
 *
 * Simple, direct functions for creating test data using the dual-connection pattern.
 *
 * IMPORTANT: Always use adminPrisma for creating test data to bypass RLS.
 * Use appPrisma with withRLS for testing RLS enforcement.
 */

/**
 * Creates a test organization with a unique slug
 */
export async function createTestOrg(adminPrisma: PrismaClient, name?: string) {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);

  return await adminPrisma.organization.create({
    data: {
      name: name || 'Test Organization',
      slug: `test-org-${timestamp}-${randomSuffix}`,
    },
  });
}

/**
 * Creates a test user with hashed password and unique identifiers
 */
export async function createTestUser(
  adminPrisma: PrismaClient,
  data?: Partial<{
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    role: 'SUPERADMIN' | 'ADMIN' | 'USER';
    isActive: boolean;
  }>
) {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);

  return await adminPrisma.user.create({
    data: {
      email: data?.email || `test-${timestamp}-${randomSuffix}@test.com`,
      username: data?.username || `testuser-${timestamp}-${randomSuffix}`,
      firstName: data?.firstName || 'Test',
      lastName: data?.lastName || 'User',
      password: data?.password ? await hash(data.password, 10) : await hash('password123', 10),
      role: data?.role || 'USER',
      isActive: data?.isActive ?? true,
    },
  });
}

/**
 * Links a user to an organization with the specified role
 */
export async function linkUserToOrg(
  adminPrisma: PrismaClient,
  userId: string,
  organizationId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER'
) {
  return await adminPrisma.organizationMember.create({
    data: {
      userId,
      organizationId,
      role,
    },
  });
}

/**
 * Creates a complete test setup with org, user, and membership
 * Returns all created entities for easy cleanup
 */
export async function createTestSetup(
  adminPrisma: PrismaClient,
  options?: {
    orgName?: string;
    userEmail?: string;
    userRole?: 'SUPERADMIN' | 'ADMIN' | 'USER';
    memberRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  }
) {
  const org = await createTestOrg(adminPrisma, options?.orgName);
  const user = await createTestUser(adminPrisma, {
    email: options?.userEmail,
    role: options?.userRole || 'ADMIN', // Default to ADMIN for tests
  });
  const membership = await linkUserToOrg(
    adminPrisma,
    user.id,
    org.id,
    options?.memberRole || 'MEMBER'
  );

  return {
    org,
    user,
    membership,
    // Helper cleanup function
    cleanup: async () => {
      await adminPrisma.organizationMember.delete({
        where: { id: membership.id },
      });
      await adminPrisma.user.delete({
        where: { id: user.id },
      });
      await adminPrisma.organization.delete({
        where: { id: org.id },
      });
    },
  };
}

/**
 * Creates test items with required relationships
 */
export async function createTestItem(
  adminPrisma: PrismaClient,
  organizationId: string,
  data?: Partial<{
    sku: string;
    name: string;
    description: string;
  }>
) {
  const timestamp = Date.now();

  // Create required category if not exists
  const category = await adminPrisma.itemCategory.upsert({
    where: {
      organizationId_name: {
        organizationId,
        name: 'Test Category',
      },
    },
    update: {},
    create: {
      organizationId,
      name: 'Test Category',
    },
  });

  // Create required UOM if not exists
  const uom = await adminPrisma.unitOfMeasure.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: 'EA',
      },
    },
    update: {},
    create: {
      organizationId,
      code: 'EA',
      description: 'Each',
    },
  });

  return await adminPrisma.item.create({
    data: {
      organizationId,
      sku: data?.sku || `TEST-${timestamp}`,
      name: data?.name || `Test Item ${timestamp}`,
      description: data?.description,
      categoryId: category.id,
      uomId: uom.id,
      reorderPoint: 10,
      reorderQty: 50,
    },
  });
}
