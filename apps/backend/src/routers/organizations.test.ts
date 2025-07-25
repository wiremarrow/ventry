import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';
import { prisma as mockPrisma } from '@ventry/database';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock CookieService
vi.mock('../services/cookie-service.js', () => ({
  CookieService: {
    getActiveOrganization: vi.fn(),
    setActiveOrganization: vi.fn(),
  },
}));

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    organizationMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    item: {
      count: vi.fn(),
    },
    warehouse: {
      count: vi.fn(),
    },
    customer: {
      count: vi.fn(),
    },
    supplier: {
      count: vi.fn(),
    },
    order: {
      count: vi.fn(),
    },
    inventory: {
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  // Set up transaction mock
  mockPrisma.$transaction.mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  });

  return {
    prisma: mockPrisma,
    Prisma: {},
    OrganizationRole: {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    },
    UserRole: {
      ADMIN: 'ADMIN',
      MANAGER: 'MANAGER',
      EMPLOYEE: 'EMPLOYEE',
      USER: 'USER',
    },
  };
});

describe('Organizations Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;
  let mockReq: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset all mock implementations to avoid interference between tests
    mockPrisma.organizationMember.findUnique.mockReset();
    mockPrisma.organizationMember.findMany.mockReset();
    mockPrisma.organizationMember.count.mockReset();
    mockPrisma.organizationMember.create.mockReset();
    mockPrisma.organizationMember.update.mockReset();
    mockPrisma.organizationMember.delete.mockReset();
    mockPrisma.organization.findUnique.mockReset();
    mockPrisma.organization.create.mockReset();
    mockPrisma.organization.update.mockReset();
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.auditLog.create.mockReset();
    mockPrisma.item.count.mockReset();
    mockPrisma.warehouse.count.mockReset();
    mockPrisma.customer.count.mockReset();
    mockPrisma.supplier.count.mockReset();
    mockPrisma.order.count.mockReset();
    mockPrisma.inventory.aggregate.mockReset();

    // Create a proper mock request object
    mockReq = {
      cookies: {},
      headers: {},
    };

    // Create a proper mock response object
    mockRes = {
      setCookie: vi.fn(),
      clearCookie: vi.fn(),
      header: vi.fn(),
    };

    // Default authenticated user
    const authenticatedUser = {
      ...mockAuthenticatedUser,
      organizationId: testId('org'),
    };

    caller = await createDirectCaller({
      prisma: mockPrisma as any,
      req: mockReq,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list user organizations', async () => {
      const mockMemberships = [
        {
          userId: mockAuthenticatedUser.id,
          organizationId: testId('org1'),
          role: 'OWNER',
          joinedAt: new Date(),
          organization: {
            id: testId('org1'),
            name: 'Org 1',
            slug: 'org-1',
          },
        },
        {
          userId: mockAuthenticatedUser.id,
          organizationId: testId('org2'),
          role: 'MEMBER',
          joinedAt: new Date(),
          organization: {
            id: testId('org2'),
            name: 'Org 2',
            slug: 'org-2',
          },
        },
      ];

      mockPrisma.organizationMember.findMany.mockResolvedValue(mockMemberships);
      const { CookieService } = await import('../services/cookie-service.js');
      CookieService.getActiveOrganization.mockReturnValue(testId('org1'));

      const result = await caller.organizations.list();

      expect(result.organizations).toHaveLength(2);
      expect(result.organizations[0].role).toBe('OWNER');
      expect(result.activeOrganizationId).toBe(testId('org1'));
    });

    it('should return null activeOrganizationId when no cookie set', async () => {
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);
      const { CookieService } = await import('../services/cookie-service.js');
      CookieService.getActiveOrganization.mockReturnValue(null);

      const result = await caller.organizations.list();

      expect(result.activeOrganizationId).toBeNull();
    });

    it('should require authentication', async () => {
      const publicCaller = await createDirectCaller({
        prisma: mockPrisma as any,
        res: mockRes,
        user: null,
      });

      await expect(publicCaller.organizations.list()).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('get', () => {
    it('should get organization details', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'ADMIN',
        joinedAt: new Date(),
        organization: {
          id: testId('org1'),
          name: 'Test Org',
          slug: 'test-org',
          _count: {
            members: 5,
            items: 100,
            orders: 50,
            customers: 25,
            suppliers: 10,
          },
        },
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);

      const result = await caller.organizations.get({ id: testId('org1') });

      expect(result.id).toBe(testId('org1'));
      expect(result.name).toBe('Test Org');
      expect(result.role).toBe('ADMIN');
      expect(result._count.members).toBe(5);
    });

    it('should throw NOT_FOUND when not a member', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(caller.organizations.get({ id: testId('org1') })).rejects.toThrow(
        'Organization not found or you do not have access'
      );
    });
  });

  describe('create', () => {
    it('should create a new organization', async () => {
      const orgData = {
        name: 'New Org',
        slug: 'new-org',
        billingEmail: 'billing@neworg.com',
      };

      const newOrg = {
        id: testId('neworg'),
        ...orgData,
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [
          {
            userId: mockAuthenticatedUser.id,
            role: 'OWNER',
          },
        ],
      };

      mockPrisma.organization.findUnique.mockResolvedValue(null); // No existing org
      mockPrisma.organization.create.mockResolvedValue(newOrg);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await caller.organizations.create(orgData);

      expect(result.name).toBe('New Org');
      expect(result.slug).toBe('new-org');
      expect(mockPrisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ...orgData,
            members: expect.objectContaining({
              create: expect.objectContaining({
                userId: mockAuthenticatedUser.id,
                role: 'OWNER',
              }),
            }),
          }),
        })
      );
    });

    it('should throw CONFLICT for duplicate slug', async () => {
      const existingOrg = {
        id: testId('existing'),
        slug: 'existing-org',
      };

      mockPrisma.organization.findUnique.mockResolvedValue(existingOrg);

      await expect(
        caller.organizations.create({
          name: 'Another Org',
          slug: 'existing-org',
        })
      ).rejects.toThrow('An organization with this slug already exists');
    });

    it('should validate slug format', async () => {
      await expect(
        caller.organizations.create({
          name: 'Invalid Slug Org',
          slug: 'Invalid Slug!', // Contains uppercase and special char
        })
      ).rejects.toThrow('Slug must contain only lowercase letters, numbers, and hyphens');
    });
  });

  describe('update', () => {
    it('should update organization', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'OWNER',
      };

      const existingOrg = {
        id: testId('org1'),
        name: 'Old Name',
        slug: 'test-org',
      };

      const updatedOrg = {
        ...existingOrg,
        name: 'New Name',
        billingEmail: 'new@email.com',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organization.findUnique.mockResolvedValue(existingOrg);
      mockPrisma.organization.update.mockResolvedValue(updatedOrg);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await caller.organizations.update({
        id: testId('org1'),
        name: 'New Name',
        billingEmail: 'new@email.com',
      });

      expect(result.name).toBe('New Name');
      expect(result.billingEmail).toBe('new@email.com');
    });

    it('should require ADMIN or OWNER role', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'MEMBER',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        caller.organizations.update({
          id: testId('org1'),
          name: 'New Name',
        })
      ).rejects.toThrow('You do not have permission to perform this action');
    });

    it('should throw NOT_FOUND for non-existent org', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'OWNER',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        caller.organizations.update({
          id: testId('org1'),
          name: 'New Name',
        })
      ).rejects.toThrow('Organization not found');
    });
  });

  describe('getMembers', () => {
    it('should get organization members', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'ADMIN',
      };

      const mockMembers = [
        {
          userId: testId('user1'),
          organizationId: testId('org1'),
          role: 'OWNER',
          joinedAt: new Date(),
          user: {
            id: testId('user1'),
            email: 'owner@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
          invitedBy: null,
        },
        {
          userId: testId('user2'),
          organizationId: testId('org1'),
          role: 'MEMBER',
          joinedAt: new Date(),
          user: {
            id: testId('user2'),
            email: 'member@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
          },
          invitedBy: {
            id: testId('user1'),
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ];

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organizationMember.findMany.mockResolvedValue(mockMembers);

      const result = await caller.organizations.getMembers({
        organizationId: testId('org1'),
      });

      expect(result).toHaveLength(2);
      expect(result[0].user.email).toBe('owner@example.com');
      expect(result[1].invitedBy?.firstName).toBe('John');
    });

    it('should allow any member to view members', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'VIEWER',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organizationMember.findMany.mockResolvedValue([]);

      const result = await caller.organizations.getMembers({
        organizationId: testId('org1'),
      });

      expect(result).toEqual([]);
    });

    it('should throw FORBIDDEN for non-members', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        caller.organizations.getMembers({
          organizationId: testId('org1'),
        })
      ).rejects.toThrow('You are not a member of this organization');
    });
  });

  describe('inviteUser', () => {
    it('should invite user to organization', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'ADMIN',
      };

      const invitedUser = {
        id: testId('invited'),
        email: 'invite@example.com',
      };

      const newMember = {
        userId: invitedUser.id,
        organizationId: testId('org1'),
        role: 'MEMBER',
        invitedById: mockAuthenticatedUser.id,
        invitationToken: 'test-token',
        user: invitedUser,
      };

      mockPrisma.organizationMember.findUnique
        .mockResolvedValueOnce(mockMembership) // Permission check
        .mockResolvedValueOnce(null); // Not already member
      mockPrisma.user.findUnique.mockResolvedValue(invitedUser);
      mockPrisma.organizationMember.create.mockResolvedValue(newMember);

      const result = await caller.organizations.inviteUser({
        organizationId: testId('org1'),
        email: 'invite@example.com',
        role: 'MEMBER',
      });

      expect(result.user.email).toBe('invite@example.com');
      expect(result.role).toBe('MEMBER');
    });

    it('should throw NOT_FOUND for non-existent user', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'ADMIN',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        caller.organizations.inviteUser({
          organizationId: testId('org1'),
          email: 'nonexistent@example.com',
          role: 'MEMBER',
        })
      ).rejects.toThrow('User with this email does not exist');
    });

    it('should throw CONFLICT for existing member', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'ADMIN',
      };

      const existingUser = {
        id: testId('existing'),
        email: 'existing@example.com',
      };

      const existingMember = {
        userId: existingUser.id,
        organizationId: testId('org1'),
        role: 'MEMBER',
      };

      mockPrisma.organizationMember.findUnique
        .mockResolvedValueOnce(mockMembership) // Permission check
        .mockResolvedValueOnce(existingMember); // Already member
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        caller.organizations.inviteUser({
          organizationId: testId('org1'),
          email: 'existing@example.com',
          role: 'MEMBER',
        })
      ).rejects.toThrow('User is already a member of this organization');
    });

    it('should require ADMIN or OWNER role', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'MEMBER',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        caller.organizations.inviteUser({
          organizationId: testId('org1'),
          email: 'invite@example.com',
          role: 'MEMBER',
        })
      ).rejects.toThrow('You do not have permission to perform this action');
    });
  });

  describe('removeMember', () => {
    it('should remove member from organization', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'ADMIN',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organizationMember.delete.mockResolvedValue({});

      const result = await caller.organizations.removeMember({
        organizationId: testId('org1'),
        userId: testId('user2'),
      });

      expect(result.success).toBe(true);
    });

    it('should prevent removing last owner', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'OWNER',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organizationMember.count.mockResolvedValue(1); // Only 1 owner

      await expect(
        caller.organizations.removeMember({
          organizationId: testId('org1'),
          userId: mockAuthenticatedUser.id, // Removing self
        })
      ).rejects.toThrow('Cannot remove the last owner of an organization');
    });

    it('should allow removing self if not last owner', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'OWNER',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organizationMember.count.mockResolvedValue(2); // 2 owners
      mockPrisma.organizationMember.delete.mockResolvedValue({});

      const result = await caller.organizations.removeMember({
        organizationId: testId('org1'),
        userId: mockAuthenticatedUser.id,
      });

      expect(result.success).toBe(true);
    });

    it('should require ADMIN or OWNER role', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'MEMBER',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        caller.organizations.removeMember({
          organizationId: testId('org1'),
          userId: testId('user2'),
        })
      ).rejects.toThrow('You do not have permission to perform this action');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'OWNER',
      };

      const updatedMember = {
        userId: testId('user2'),
        organizationId: testId('org1'),
        role: 'ADMIN',
        user: {
          id: testId('user2'),
          email: 'user2@example.com',
          firstName: 'User',
          lastName: 'Two',
        },
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organizationMember.update.mockResolvedValue(updatedMember);

      const result = await caller.organizations.updateMemberRole({
        organizationId: testId('org1'),
        userId: testId('user2'),
        role: 'ADMIN',
      });

      expect(result.role).toBe('ADMIN');
    });

    it('should prevent removing owner role from last owner', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'OWNER',
      };

      mockPrisma.organizationMember.findUnique
        .mockResolvedValueOnce(mockMembership) // Permission check
        .mockResolvedValueOnce(mockMembership); // Current role check
      mockPrisma.organizationMember.count.mockResolvedValue(1); // Only 1 owner

      await expect(
        caller.organizations.updateMemberRole({
          organizationId: testId('org1'),
          userId: mockAuthenticatedUser.id,
          role: 'ADMIN', // Downgrading from OWNER
        })
      ).rejects.toThrow('Cannot remove owner role from the last owner');
    });

    it('should require OWNER role', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'ADMIN',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        caller.organizations.updateMemberRole({
          organizationId: testId('org1'),
          userId: testId('user2'),
          role: 'MEMBER',
        })
      ).rejects.toThrow('You do not have permission to perform this action');
    });
  });

  describe('getUsage', () => {
    it('should get organization usage stats', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'ADMIN',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      mockPrisma.organizationMember.count.mockResolvedValue(5);
      mockPrisma.item.count.mockResolvedValue(100);
      mockPrisma.warehouse.count.mockResolvedValue(2);
      mockPrisma.customer.count.mockResolvedValue(50);
      mockPrisma.supplier.count.mockResolvedValue(10);
      mockPrisma.order.count.mockResolvedValue(200);
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: { qtyOnHand: 5000 },
      });

      const result = await caller.organizations.getUsage({
        organizationId: testId('org1'),
      });

      expect(result.members).toBe(5);
      expect(result.items).toBe(100);
      expect(result.warehouses).toBe(2);
      expect(result.customers).toBe(50);
      expect(result.suppliers).toBe(10);
      expect(result.orders).toBe(200);
      expect(result.inventoryValue).toBe(5000);
      expect(result.limits).toBeDefined();
    });

    it('should require ADMIN or OWNER role', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org1'),
        role: 'MEMBER',
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        caller.organizations.getUsage({
          organizationId: testId('org1'),
        })
      ).rejects.toThrow('You do not have permission to perform this action');
    });
  });

  describe('switchOrganization', () => {
    it('should switch active organization', async () => {
      const mockMembership = {
        userId: mockAuthenticatedUser.id,
        organizationId: testId('org2'),
        role: 'MEMBER',
        organization: {
          id: testId('org2'),
          name: 'Org 2',
          slug: 'org-2',
        },
      };

      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMembership);
      const { CookieService } = await import('../services/cookie-service.js');

      const result = await caller.organizations.switchOrganization({
        organizationId: testId('org2'),
      });

      expect(result.success).toBe(true);
      expect(result.organization.id).toBe(testId('org2'));
      expect(result.role).toBe('MEMBER');
      expect(CookieService.setActiveOrganization).toHaveBeenCalledWith(mockRes, testId('org2'));
    });

    it('should throw FORBIDDEN for non-member', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        caller.organizations.switchOrganization({
          organizationId: testId('org2'),
        })
      ).rejects.toThrow('You do not have access to this organization');
    });
  });
});
