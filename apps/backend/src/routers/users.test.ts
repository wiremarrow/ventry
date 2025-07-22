import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockImplementation((password) => `hashed_${password}`),
  },
}));

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  
  return { 
    prisma: mockPrisma,
    OrganizationRole: {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    }
  };
});

// Access the mocked prisma for tests
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  organizationMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
};

describe('Users Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create a proper mock response object
    mockRes = {
      setCookie: vi.fn(),
      clearCookie: vi.fn(),
      header: vi.fn(),
    };
    
    // Default authenticated user with organization context
    const authenticatedUser = {
      ...mockAuthenticatedUser,
      organizationId: 'org-123',
      organizationRole: 'ADMIN',
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list all users in the organization', async () => {
      const mockOrgMembers = [
        {
          id: 'mem1',
          userId: 'user1',
          organizationId: 'org-123',
          role: 'MEMBER',
          user: {
            id: 'user1',
            email: 'user1@example.com',
            username: 'user1',
            firstName: 'User',
            lastName: 'One',
            role: 'USER',
            isActive: true,
            createdAt: new Date(),
            lastLoginAt: null,
          },
        },
        {
          id: 'mem2',
          userId: 'user2',
          organizationId: 'org-123',
          role: 'ADMIN',
          user: {
            id: 'user2',
            email: 'user2@example.com',
            username: 'user2',
            firstName: 'User',
            lastName: 'Two',
            role: 'ADMIN',
            isActive: true,
            createdAt: new Date(),
            lastLoginAt: new Date(),
          },
        },
      ];

      mockPrisma.organizationMember.findMany.mockResolvedValue(mockOrgMembers);

      const result = await caller.users.list();

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('user1@example.com');
      expect(result[1].email).toBe('user2@example.com');
      expect(mockPrisma.organizationMember.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        include: {
          user: {
            select: expect.any(Object),
          },
        },
        orderBy: {
          user: { createdAt: 'desc' },
        },
      });
    });

    it('should require organization context', async () => {
      // Create caller without organization context
      const noOrgCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: undefined },
      });

      await expect(noOrgCaller.users.list()).rejects.toThrow('No organization selected');
    });
  });

  describe('getById', () => {
    it('should get user by id when in organization', async () => {
      const mockOrgMember = {
        id: 'mem1',
        userId: 'user1',
        organizationId: 'org-123',
        role: 'MEMBER',
        user: {
          id: 'user1',
          email: 'user1@example.com',
          username: 'user1',
          firstName: 'User',
          lastName: 'One',
          role: 'USER',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        },
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockOrgMember);

      const result = await caller.users.getById({ id: 'user1' });

      expect(result.id).toBe('user1');
      expect(result.email).toBe('user1@example.com');
      expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-123',
            userId: 'user1',
          },
        },
        include: {
          user: {
            select: expect.any(Object),
          },
        },
      });
    });

    it('should throw NOT_FOUND when user not in organization', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        caller.users.getById({ id: 'user-not-in-org' })
      ).rejects.toThrow('User not found in organization');
    });
  });

  describe('update', () => {
    it('should allow user to update their own profile', async () => {
      const selfUser = {
        id: mockAuthenticatedUser.id,
        email: mockAuthenticatedUser.email,
        username: 'updated-username',
        firstName: 'Updated',
        lastName: 'Name',
        role: 'USER',
        isActive: true,
      };

      mockPrisma.user.findFirst.mockResolvedValue(null); // No username conflict
      mockPrisma.user.update.mockResolvedValue(selfUser);

      const result = await caller.users.update({
        id: mockAuthenticatedUser.id,
        data: {
          firstName: 'Updated',
          lastName: 'Name',
          username: 'updated-username',
        },
      });

      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
      expect(result.username).toBe('updated-username');
    });

    it('should allow admin to update other users in organization', async () => {
      const targetUser = {
        id: 'target-user',
        email: 'target@example.com',
        username: 'targetuser',
        firstName: 'Target',
        lastName: 'User',
        role: 'USER',
        isActive: true,
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'mem1',
        userId: 'target-user',
        organizationId: 'org-123',
        role: 'MEMBER',
      });
      mockPrisma.user.findFirst.mockResolvedValue(null); // No username conflict
      mockPrisma.user.update.mockResolvedValue(targetUser);

      const result = await caller.users.update({
        id: 'target-user',
        data: {
          firstName: 'Target',
          lastName: 'User',
        },
      });

      expect(result.id).toBe('target-user');
      expect(result.firstName).toBe('Target');
    });

    it('should hash password when updating', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({
        id: mockAuthenticatedUser.id,
        email: mockAuthenticatedUser.email,
        username: mockAuthenticatedUser.username,
        firstName: mockAuthenticatedUser.firstName,
        lastName: mockAuthenticatedUser.lastName,
        role: 'USER',
        isActive: true,
      });

      await caller.users.update({
        id: mockAuthenticatedUser.id,
        data: {
          password: 'newpassword123',
        },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockAuthenticatedUser.id },
        data: expect.objectContaining({
          password: 'hashed_newpassword123',
        }),
        select: expect.any(Object),
      });
    });

    it('should throw error for duplicate username', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'other-user',
        username: 'taken-username',
      });

      await expect(
        caller.users.update({
          id: mockAuthenticatedUser.id,
          data: {
            username: 'taken-username',
          },
        })
      ).rejects.toThrow('Username already taken');
    });

    it('should throw FORBIDDEN when non-admin tries to update other user', async () => {
      // Create caller as regular member
      const memberCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: {
          ...mockAuthenticatedUser,
          organizationId: 'org-123',
          organizationRole: 'MEMBER',
        },
      });

      await expect(
        memberCaller.users.update({
          id: 'other-user',
          data: {
            firstName: 'Hacker',
          },
        })
      ).rejects.toThrow('You can only update your own profile');
    });

    it('should throw NOT_FOUND when admin tries to update user not in organization', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        caller.users.update({
          id: 'user-not-in-org',
          data: {
            firstName: 'Should',
            lastName: 'Fail',
          },
        })
      ).rejects.toThrow('User not found in your organization');
    });
  });

  describe('deactivate', () => {
    it('should deactivate user when called by admin', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'mem1',
        userId: 'user-to-deactivate',
        organizationId: 'org-123',
        role: 'MEMBER',
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-to-deactivate',
        email: 'deactivated@example.com',
        isActive: false,
      });

      const result = await caller.users.deactivate({ id: 'user-to-deactivate' });

      expect(result.isActive).toBe(false);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-to-deactivate' },
        data: { isActive: false },
        select: expect.any(Object),
      });
    });

    it('should prevent deactivating organization owner', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'mem1',
        userId: 'owner-user',
        organizationId: 'org-123',
        role: 'OWNER',
      });

      await expect(
        caller.users.deactivate({ id: 'owner-user' })
      ).rejects.toThrow('Cannot deactivate organization owner');
    });

    it('should throw NOT_FOUND when user not in organization', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        caller.users.deactivate({ id: 'user-not-in-org' })
      ).rejects.toThrow('User not found in your organization');
    });

    it('should require admin role', async () => {
      // Create caller as regular member
      const memberCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: {
          ...mockAuthenticatedUser,
          organizationId: 'org-123',
          organizationRole: 'MEMBER',
        },
      });

      await expect(
        memberCaller.users.deactivate({ id: 'some-user' })
      ).rejects.toThrow('You must be an organization admin to perform this action');
    });
  });

  describe('activate', () => {
    it('should activate user when called by admin', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        id: 'mem1',
        userId: 'user-to-activate',
        organizationId: 'org-123',
        role: 'MEMBER',
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-to-activate',
        email: 'activated@example.com',
        isActive: true,
      });

      const result = await caller.users.activate({ id: 'user-to-activate' });

      expect(result.isActive).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-to-activate' },
        data: { isActive: true },
        select: expect.any(Object),
      });
    });

    it('should throw NOT_FOUND when user not in organization', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        caller.users.activate({ id: 'user-not-in-org' })
      ).rejects.toThrow('User not found in your organization');
    });

    it('should require admin role', async () => {
      // Create caller as regular member
      const memberCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: {
          ...mockAuthenticatedUser,
          organizationId: 'org-123',
          organizationRole: 'MEMBER',
        },
      });

      await expect(
        memberCaller.users.activate({ id: 'some-user' })
      ).rejects.toThrow('You must be an organization admin to perform this action');
    });
  });
});