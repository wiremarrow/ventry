import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appRouter } from './app.js';
import { createIntegrationContext } from '../test-utils/trpc-test-client.js';
import { prisma } from '@ventry/database/client';
import { hash } from 'bcryptjs';

describe('Auth Router Integration', () => {
  beforeEach(async () => {
    // Clean up test data - handle foreign key constraints
    const testUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: 'integration.test'
        }
      }
    });
    
    for (const user of testUsers) {
      await prisma.auditLog.deleteMany({ where: { userId: user.id } });
      await prisma.organizationMember.deleteMany({ where: { userId: user.id } });
    }
    
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'integration.test'
        }
      }
    });
    
    // Clean up test organizations too (in case previous test failed)
    const testOrgs = await prisma.organization.findMany({
      where: {
        slug: {
          startsWith: 'test-org'
        }
      }
    });

    for (const org of testOrgs) {
      // Delete all related data first
      await prisma.inventory.deleteMany({ where: { item: { organizationId: org.id } } });
      await prisma.priceHistory.deleteMany({ where: { item: { organizationId: org.id } } });
      await prisma.item.deleteMany({ where: { organizationId: org.id } });
      await prisma.location.deleteMany({ where: { warehouse: { organizationId: org.id } } });
      await prisma.warehouse.deleteMany({ where: { organizationId: org.id } });
      await prisma.itemCategory.deleteMany({ where: { organizationId: org.id } });
      await prisma.unitOfMeasure.deleteMany({ where: { organizationId: org.id } });
      await prisma.supplier.deleteMany({ where: { organizationId: org.id } });
      await prisma.customer.deleteMany({ where: { organizationId: org.id } });
    }
    
    await prisma.organization.deleteMany({
      where: {
        slug: {
          startsWith: 'test-org'
        }
      }
    });
  });

  afterEach(async () => {
    // Clean up test data - handle foreign key constraints
    const testUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: 'integration.test'
        }
      }
    });
    
    for (const user of testUsers) {
      await prisma.auditLog.deleteMany({ where: { userId: user.id } });
      await prisma.organizationMember.deleteMany({ where: { userId: user.id } });
    }
    
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'integration.test'
        }
      }
    });

    // Clean up test organizations and their dependencies
    const testOrgs = await prisma.organization.findMany({
      where: {
        slug: {
          startsWith: 'test-org'
        }
      }
    });

    for (const org of testOrgs) {
      // Delete all related data first
      await prisma.inventory.deleteMany({ where: { item: { organizationId: org.id } } });
      await prisma.priceHistory.deleteMany({ where: { item: { organizationId: org.id } } });
      await prisma.item.deleteMany({ where: { organizationId: org.id } });
      await prisma.location.deleteMany({ where: { warehouse: { organizationId: org.id } } });
      await prisma.warehouse.deleteMany({ where: { organizationId: org.id } });
      await prisma.itemCategory.deleteMany({ where: { organizationId: org.id } });
      await prisma.unitOfMeasure.deleteMany({ where: { organizationId: org.id } });
      await prisma.supplier.deleteMany({ where: { organizationId: org.id } });
      await prisma.customer.deleteMany({ where: { organizationId: org.id } });
    }
    
    await prisma.organization.deleteMany({
      where: {
        slug: {
          startsWith: 'test-org'
        }
      }
    });
  });

  describe('register', () => {
    it('should register a new user in the database', async () => {
      const ctx = await createIntegrationContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.register({
        email: 'test@integration.test',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('user');
      expect(result.user).toMatchObject({
        email: 'test@integration.test',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
      });

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: 'test@integration.test' }
      });
      expect(user).toBeTruthy();
      expect(user?.email).toBe('test@integration.test');
    });

    it('should throw error for duplicate email', async () => {
      const ctx = await createIntegrationContext();
      const caller = appRouter.createCaller(ctx);

      // Create first user
      await prisma.user.create({
        data: {
          email: 'duplicate@integration.test',
          username: 'user1',
          firstName: 'First',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      // Try to create second user with same email
      await expect(caller.auth.register({
        email: 'duplicate@integration.test',
        username: 'user2',
        firstName: 'Second',
        lastName: 'User',
        password: 'password123',
      })).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const ctx = await createIntegrationContext();
      const caller = appRouter.createCaller(ctx);

      // Create test organization
      const org = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: `test-org-${Date.now()}`,
        }
      });

      // Create test user
      const user = await prisma.user.create({
        data: {
          email: 'login@integration.test',
          username: 'loginuser',
          firstName: 'Login',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      // Create organization membership
      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: 'MEMBER',
        }
      });

      const result = await caller.auth.login({
        email: 'login@integration.test',
        password: 'password123',
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('login@integration.test');
    });

    it('should throw error for invalid password', async () => {
      const ctx = await createIntegrationContext();
      const caller = appRouter.createCaller(ctx);

      // Create test organization
      const org = await prisma.organization.create({
        data: {
          name: 'Test Organization 2',
          slug: `test-org-2-${Date.now()}`,
        }
      });

      // Create test user
      const user = await prisma.user.create({
        data: {
          email: 'wrongpass@integration.test',
          username: 'wrongpass',
          firstName: 'Wrong',
          lastName: 'Pass',
          password: await hash('correctpassword', 10),
        }
      });

      // Create organization membership
      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: 'MEMBER',
        }
      });

      await expect(caller.auth.login({
        email: 'wrongpass@integration.test',
        password: 'wrongpassword',
      })).rejects.toThrow('Invalid credentials');
    });
  });
});