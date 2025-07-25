import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { OrganizationRole } from '@ventry/database';

import { createTRPCRouter, protectedProcedure } from '../trpc/trpc.js';

// Input validation schemas
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  domain: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  billingEmail: z.string().email().optional(),
});

const updateOrganizationSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  domain: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  billingEmail: z.string().email().optional(),
  settings: z.record(z.any()).optional(),
});

const inviteUserSchema = z.object({
  organizationId: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(OrganizationRole),
});

const updateMemberRoleSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  role: z.nativeEnum(OrganizationRole),
});

// Helper to check if user has permission in organization
async function checkOrgPermission(
  ctx: any,
  organizationId: string,
  requiredRole: OrganizationRole[] = ['ADMIN', 'OWNER']
) {
  const membership = await ctx.prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: ctx.user.id,
      },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not a member of this organization',
    });
  }

  if (!requiredRole.includes(membership.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action',
    });
  }

  return membership;
}

export const organizationsRouter = createTRPCRouter({
  // Get current user's organizations
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.organizationMember.findMany({
      where: {
        userId: ctx.user.id,
      },
      include: {
        organization: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    // Get active organization from cookie
    const { CookieService } = await import('../services/cookie-service.js');
    const activeOrgId = CookieService.getActiveOrganization(ctx.req);

    return {
      organizations: memberships.map((m) => ({
        ...m.organization,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      activeOrganizationId: activeOrgId || null,
    };
  }),

  // Get organization details
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const membership = await ctx.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.id,
          userId: ctx.user.id,
        },
      },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                items: true,
                orders: true,
                customers: true,
                suppliers: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Organization not found or you do not have access',
      });
    }

    return {
      ...membership.organization,
      role: membership.role,
      joinedAt: membership.joinedAt,
    };
  }),

  // Create new organization
  create: protectedProcedure.input(createOrganizationSchema).mutation(async ({ ctx, input }) => {
    // Check if slug is already taken
    const existing = await ctx.prisma.organization.findUnique({
      where: { slug: input.slug },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'An organization with this slug already exists',
      });
    }

    // Create organization with the current user as owner
    const organization = await ctx.prisma.organization.create({
      data: {
        ...input,
        members: {
          create: {
            userId: ctx.user.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          where: {
            userId: ctx.user.id,
          },
        },
      },
    });

    // Log creation
    await ctx.prisma.auditLog.create({
      data: {
        tableName: 'organizations',
        recordPk: organization.id,
        action: 'CREATE',
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId!,
        afterData: organization,
      },
    });

    return organization;
  }),

  // Update organization
  update: protectedProcedure.input(updateOrganizationSchema).mutation(async ({ ctx, input }) => {
    const { id, ...updateData } = input;

    // Check permissions
    await checkOrgPermission(ctx, id, ['ADMIN', 'OWNER']);

    // Get current data for audit log
    const before = await ctx.prisma.organization.findUnique({
      where: { id },
    });

    if (!before) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Organization not found',
      });
    }

    // Update organization
    const organization = await ctx.prisma.organization.update({
      where: { id },
      data: updateData,
    });

    // Log update
    await ctx.prisma.auditLog.create({
      data: {
        tableName: 'organizations',
        recordPk: id,
        action: 'UPDATE',
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId!,
        beforeData: before,
        afterData: organization,
      },
    });

    return organization;
  }),

  // Get organization members
  getMembers: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check if user is member
      await checkOrgPermission(ctx, input.organizationId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);

      const members = await ctx.prisma.organizationMember.findMany({
        where: {
          organizationId: input.organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              username: true,
              lastLoginAt: true,
            },
          },
          invitedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          joinedAt: 'desc',
        },
      });

      return members;
    }),

  // Invite user to organization
  inviteUser: protectedProcedure.input(inviteUserSchema).mutation(async ({ ctx, input }) => {
    // Check permissions
    await checkOrgPermission(ctx, input.organizationId, ['ADMIN', 'OWNER']);

    // Check if user exists
    const user = await ctx.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User with this email does not exist',
      });
    }

    // Check if already member
    const existing = await ctx.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: user.id,
        },
      },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'User is already a member of this organization',
      });
    }

    // Create invitation token
    const invitationToken = crypto.randomUUID();

    // Add member
    const member = await ctx.prisma.organizationMember.create({
      data: {
        organizationId: input.organizationId,
        userId: user.id,
        role: input.role,
        invitedById: ctx.user.id,
        invitationToken,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // TODO: Send invitation email

    return member;
  }),

  // Remove member from organization
  removeMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      const membership = await checkOrgPermission(ctx, input.organizationId, ['ADMIN', 'OWNER']);

      // Can't remove yourself if you're the only owner
      if (input.userId === ctx.user.id && membership.role === 'OWNER') {
        const ownerCount = await ctx.prisma.organizationMember.count({
          where: {
            organizationId: input.organizationId,
            role: 'OWNER',
          },
        });

        if (ownerCount === 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot remove the last owner of an organization',
          });
        }
      }

      // Remove member
      await ctx.prisma.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });

      return { success: true };
    }),

  // Update member role
  updateMemberRole: protectedProcedure
    .input(updateMemberRoleSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permissions - only owners can change roles
      await checkOrgPermission(ctx, input.organizationId, ['OWNER']);

      // Can't change your own role if you're the only owner
      if (input.userId === ctx.user.id) {
        const member = await ctx.prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: input.organizationId,
              userId: input.userId,
            },
          },
        });

        if (member?.role === 'OWNER' && input.role !== 'OWNER') {
          const ownerCount = await ctx.prisma.organizationMember.count({
            where: {
              organizationId: input.organizationId,
              role: 'OWNER',
            },
          });

          if (ownerCount === 1) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Cannot remove owner role from the last owner',
            });
          }
        }
      }

      // Update role
      const member = await ctx.prisma.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
        data: {
          role: input.role,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return member;
    }),

  // Get organization usage stats
  getUsage: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check permissions
      await checkOrgPermission(ctx, input.organizationId, ['OWNER', 'ADMIN']);

      const [
        memberCount,
        itemCount,
        warehouseCount,
        customerCount,
        supplierCount,
        orderCount,
        inventoryValue,
      ] = await Promise.all([
        ctx.prisma.organizationMember.count({
          where: { organizationId: input.organizationId },
        }),
        ctx.prisma.item.count({
          where: { organizationId: input.organizationId },
        }),
        ctx.prisma.warehouse.count({
          where: { organizationId: input.organizationId },
        }),
        ctx.prisma.customer.count({
          where: { organizationId: input.organizationId },
        }),
        ctx.prisma.supplier.count({
          where: { organizationId: input.organizationId },
        }),
        ctx.prisma.order.count({
          where: { organizationId: input.organizationId },
        }),
        // Calculate total inventory value
        ctx.prisma.inventory.aggregate({
          where: {
            item: {
              organizationId: input.organizationId,
            },
          },
          _sum: {
            qtyOnHand: true,
          },
        }),
      ]);

      return {
        members: memberCount,
        items: itemCount,
        warehouses: warehouseCount,
        customers: customerCount,
        suppliers: supplierCount,
        orders: orderCount,
        inventoryValue: inventoryValue._sum.qtyOnHand || 0,
        // Add subscription limits based on tier
        limits: {
          members: 100, // TODO: Get from subscription tier
          items: 10000,
          warehouses: 10,
          orders: 5000,
        },
      };
    }),

  // Switch active organization
  switchOrganization: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this organization
      const membership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: ctx.user.id,
          },
        },
        include: {
          organization: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this organization',
        });
      }

      // Set the active organization cookie
      const { CookieService } = await import('../services/cookie-service.js');
      CookieService.setActiveOrganization(ctx.res, input.organizationId);

      return {
        success: true,
        organization: membership.organization,
        role: membership.role,
      };
    }),
});
