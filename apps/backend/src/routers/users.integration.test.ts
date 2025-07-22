import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appRouter } from './app.js';
import { createIntegrationContext, createAuthenticatedIntegrationContext } from '../test-utils/trpc-test-client.js';
import { prisma } from '@ventry/database/client';
import { hash } from 'bcryptjs';
import { signJWT } from '../auth/jwt.js';

describe('Users Router Integration', () => {
  let cleanupFn: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanupFn) {
      await cleanupFn();
      cleanupFn = null;
    }
    
    // Additional cleanup for any test data that might have been created
    await prisma.user.deleteMany({
      where: { email: { contains: 'users.integration.test' } }
    });
  });

  describe('list', () => {
    it('should list all users in the organization', async () => {
      const { ctx, organization, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      // Create additional users in the organization
      const user2 = await prisma.user.create({
        data: {
          email: 'user2@users.integration.test',
          username: 'user2test',
          firstName: 'User',
          lastName: 'Two',
          password: await hash('password123', 10),
        }
      });
      
      const user3 = await prisma.user.create({
        data: {
          email: 'user3@users.integration.test',
          username: 'user3test',
          firstName: 'User',
          lastName: 'Three',
          password: await hash('password123', 10),
        }
      });

      await prisma.organizationMember.createMany({
        data: [
          { organizationId: organization.id, userId: user2.id, role: 'MEMBER' },
          { organizationId: organization.id, userId: user3.id, role: 'VIEWER' },
        ]
      });

      const result = await caller.users.list();

      expect(result).toHaveLength(3); // Test user + 2 additional users
      const emails = result.map(u => u.email);
      expect(emails).toContain(ctx.user!.email);
      expect(emails).toContain('user2@users.integration.test');
      expect(emails).toContain('user3@users.integration.test');
    });

    it('should only show users from the current organization', async () => {
      const { ctx, organization, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      // Create another organization and user
      const otherOrg = await prisma.organization.create({
        data: {
          name: 'Other Organization',
          slug: `other-org-${Date.now()}`,
        }
      });

      const otherUser = await prisma.user.create({
        data: {
          email: 'other@users.integration.test',
          username: 'otheruser',
          firstName: 'Other',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: otherOrg.id,
          userId: otherUser.id,
          role: 'MEMBER',
        }
      });

      const result = await caller.users.list();

      // Should only see users from the authenticated user's organization
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe(ctx.user!.email);
      
      // Clean up other org
      await prisma.organizationMember.deleteMany({ where: { organizationId: otherOrg.id } });
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    });
  });

  describe('getById', () => {
    it('should get user details when user is in organization', async () => {
      const { ctx, organization, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      const targetUser = await prisma.user.create({
        data: {
          email: 'target@users.integration.test',
          username: 'targetuser',
          firstName: 'Target',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: targetUser.id,
          role: 'MEMBER',
        }
      });

      const result = await caller.users.getById({ id: targetUser.id });

      expect(result.id).toBe(targetUser.id);
      expect(result.email).toBe('target@users.integration.test');
      expect(result.firstName).toBe('Target');
      expect(result.lastName).toBe('User');
    });

    it('should throw NOT_FOUND for user not in organization', async () => {
      const { ctx, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      // Create user not in the organization
      const outsideUser = await prisma.user.create({
        data: {
          email: 'outside@users.integration.test',
          username: 'outsideuser',
          firstName: 'Outside',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      await expect(
        caller.users.getById({ id: outsideUser.id })
      ).rejects.toThrow('User not found in organization');
    });
  });

  describe('update', () => {
    it('should allow user to update their own profile', async () => {
      const { ctx, user, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      const result = await caller.users.update({
        id: user.id,
        data: {
          firstName: 'Updated',
          lastName: 'Name',
          username: `upd${Date.now()}`.slice(0, 20), // Ensure max 20 chars
        }
      });

      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
      expect(result.username).toContain('upd');
    });

    it('should hash password when updating', async () => {
      const { ctx, user, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      await caller.users.update({
        id: user.id,
        data: {
          password: 'newpassword123',
        }
      });

      // Verify password was hashed
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id }
      });
      expect(updatedUser?.password).not.toBe('newpassword123');
      expect(updatedUser?.password).toContain('$2a$'); // bcrypt hash prefix
    });

    it('should allow admin to update other users in organization', async () => {
      const { ctx, organization, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      const targetUser = await prisma.user.create({
        data: {
          email: 'target@users.integration.test',
          username: 'targetuser',
          firstName: 'Target',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: targetUser.id,
          role: 'MEMBER',
        }
      });

      const result = await caller.users.update({
        id: targetUser.id,
        data: {
          firstName: 'Modified',
          lastName: 'ByAdmin',
        }
      });

      expect(result.firstName).toBe('Modified');
      expect(result.lastName).toBe('ByAdmin');
    });

    it('should throw error for duplicate username', async () => {
      const { ctx, organization, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      // Create another user with a username
      const existingUser = await prisma.user.create({
        data: {
          email: 'existing@users.integration.test',
          username: 'existingusername',
          firstName: 'Existing',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      await expect(
        caller.users.update({
          id: ctx.user!.id,
          data: {
            username: 'existingusername',
          }
        })
      ).rejects.toThrow('Username already taken');
    });
  });

  describe('deactivate', () => {
    it('should deactivate user when called by admin', async () => {
      const { ctx, organization, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      const targetUser = await prisma.user.create({
        data: {
          email: 'deactivate@users.integration.test',
          username: 'deactivateuser',
          firstName: 'Deactivate',
          lastName: 'User',
          password: await hash('password123', 10),
          isActive: true,
        }
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: targetUser.id,
          role: 'MEMBER',
        }
      });

      const result = await caller.users.deactivate({ id: targetUser.id });

      expect(result.isActive).toBe(false);
      
      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: targetUser.id }
      });
      expect(updatedUser?.isActive).toBe(false);
    });

    it('should prevent deactivating organization owner', async () => {
      const { ctx, organization, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      const ownerUser = await prisma.user.create({
        data: {
          email: 'owner@users.integration.test',
          username: 'owneruser',
          firstName: 'Owner',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: ownerUser.id,
          role: 'OWNER',
        }
      });

      await expect(
        caller.users.deactivate({ id: ownerUser.id })
      ).rejects.toThrow('Cannot deactivate organization owner');
    });
  });

  describe('activate', () => {
    it('should activate user when called by admin', async () => {
      const { ctx, organization, cleanup } = await createAuthenticatedIntegrationContext();
      cleanupFn = cleanup;
      const caller = appRouter.createCaller(ctx);

      const targetUser = await prisma.user.create({
        data: {
          email: 'activate@users.integration.test',
          username: 'activateuser',
          firstName: 'Activate',
          lastName: 'User',
          password: await hash('password123', 10),
          isActive: false,
        }
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: targetUser.id,
          role: 'MEMBER',
        }
      });

      const result = await caller.users.activate({ id: targetUser.id });

      expect(result.isActive).toBe(true);
      
      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: targetUser.id }
      });
      expect(updatedUser?.isActive).toBe(true);
    });
  });

  describe('authorization', () => {
    it('should require organization context for all operations', async () => {
      const ctx = await createIntegrationContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.users.list()).rejects.toThrow('UNAUTHORIZED');
      await expect(caller.users.getById({ id: 'any-id' })).rejects.toThrow('UNAUTHORIZED');
      await expect(caller.users.update({ id: 'any-id', data: {} })).rejects.toThrow('UNAUTHORIZED');
      await expect(caller.users.deactivate({ id: 'any-id' })).rejects.toThrow('UNAUTHORIZED');
      await expect(caller.users.activate({ id: 'any-id' })).rejects.toThrow('UNAUTHORIZED');
    });

    it('should require admin role for deactivate and activate', async () => {
      // Create a member user (not admin)
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org Member',
          slug: `test-org-member-${Date.now()}`,
        }
      });

      const memberUser = await prisma.user.create({
        data: {
          email: 'member@users.integration.test',
          username: 'memberuser',
          firstName: 'Member',
          lastName: 'User',
          password: await hash('password123', 10),
          role: 'USER',
        }
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: memberUser.id,
          role: 'MEMBER', // Not admin
        }
      });

      const token = signJWT({ 
        userId: memberUser.id, 
        organizationId: org.id,
        email: memberUser.email,
        role: memberUser.role
      });

      const ctx = await createIntegrationContext(token);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.users.deactivate({ id: 'any-id' })
      ).rejects.toThrow('You must be an organization admin to perform this action');

      await expect(
        caller.users.activate({ id: 'any-id' })
      ).rejects.toThrow('You must be an organization admin to perform this action');

      // Cleanup
      await prisma.organizationMember.deleteMany({ where: { organizationId: org.id } });
      await prisma.user.delete({ where: { id: memberUser.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    });
  });
});