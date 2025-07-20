# Multi-Organization Support

Comprehensive guide to Ventry's multi-tenant architecture, organization management, and data isolation features.

## Overview

Ventry is built from the ground up as a multi-tenant SaaS platform, allowing multiple organizations to operate independently within the same system while ensuring complete data isolation and security.

### Key Features

- **Complete Data Isolation**: Row-Level Security (RLS) ensures data privacy
- **Organization Switching**: Seamless context switching for multi-org users
- **Hierarchical Permissions**: Organization-specific roles and permissions
- **Resource Sharing**: Controlled sharing between organizations
- **White-Label Support**: Custom branding per organization
- **Usage Tracking**: Per-organization metrics and billing

## Architecture

### Data Model

```typescript
interface Organization {
  id: string;
  name: string;
  slug: string; // Unique identifier for URLs
  
  // Details
  description?: string;
  website?: string;
  industry?: string;
  size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
  
  // Branding
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  
  // Settings
  timezone: string;
  currency: string;
  locale: string;
  fiscalYearStart?: number; // Month (1-12)
  
  // Features
  features: OrganizationFeature[];
  
  // Billing
  subscription?: Subscription;
  billingEmail?: string;
  
  // Status
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  
  // Role within organization
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  
  // Permissions
  permissions: Permission[];
  
  // Status
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt?: Date;
}
```

### Security Architecture

```typescript
// Row-Level Security implementation
export class RLSContext {
  static async setContext(
    prisma: PrismaClient,
    userId: string,
    organizationId: string
  ) {
    await prisma.$executeRawUnsafe(
      'SELECT set_rls_context($1, $2)',
      userId,
      organizationId
    );
  }
  
  static async clearContext(prisma: PrismaClient) {
    await prisma.$executeRawUnsafe('SELECT clear_rls_context()');
  }
}

// Middleware to set RLS context
export const organizationMiddleware = async (req, res, next) => {
  const { userId, organizationId } = req.auth;
  
  if (userId && organizationId) {
    await RLSContext.setContext(prisma, userId, organizationId);
    
    // Clear context after request
    res.on('finish', async () => {
      await RLSContext.clearContext(prisma);
    });
  }
  
  next();
};
```

## Organization Management

### 1. Creating Organizations

```typescript
// POST /api/organizations/create
const createOrganization = async (data: CreateOrganizationInput) => {
  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create organization
    const org = await tx.organization.create({
      data: {
        name: data.name,
        slug: generateSlug(data.name),
        timezone: data.timezone || 'UTC',
        currency: data.currency || 'USD',
        locale: data.locale || 'en-US',
      },
    });
    
    // Add creator as owner
    await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: data.creatorId,
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    
    // Create default settings
    await createDefaultSettings(tx, org.id);
    
    // Create default locations
    await tx.location.create({
      data: {
        organizationId: org.id,
        name: 'Main Warehouse',
        type: 'WAREHOUSE',
        isDefault: true,
      },
    });
    
    // Set up features based on plan
    await setupOrganizationFeatures(tx, org.id, data.plan);
    
    return org;
  });
  
  // Send welcome email
  await sendWelcomeEmail(result);
  
  return result;
};

// Organization setup wizard
const setupOrganization = async (orgId: string, setup: SetupData) => {
  const updates = await prisma.$transaction([
    // Update organization details
    prisma.organization.update({
      where: { id: orgId },
      data: {
        industry: setup.industry,
        size: setup.size,
        website: setup.website,
      },
    }),
    
    // Create initial categories
    ...setup.categories.map(cat =>
      prisma.category.create({
        data: { ...cat, organizationId: orgId },
      })
    ),
    
    // Create tax rules
    ...setup.taxRules.map(rule =>
      prisma.taxRule.create({
        data: { ...rule, organizationId: orgId },
      })
    ),
    
    // Import initial data if requested
    setup.importData && importInitialData(orgId, setup.importData),
  ]);
  
  return updates;
};
```

### 2. Member Management

```typescript
// Invite members
const inviteMembers = async (
  orgId: string,
  invites: InviteInput[]
) => {
  const invitations = await Promise.all(
    invites.map(async (invite) => {
      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email: invite.email },
      });
      
      if (!user) {
        // Create pending user
        user = await prisma.user.create({
          data: {
            email: invite.email,
            status: 'INVITED',
          },
        });
      }
      
      // Create invitation
      const member = await prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: invite.role,
          status: 'INVITED',
          invitedBy: getCurrentUserId(),
          invitedAt: new Date(),
        },
      });
      
      // Send invitation email
      await sendInvitationEmail({
        email: invite.email,
        organization: orgId,
        role: invite.role,
        inviteCode: generateInviteCode(member.id),
      });
      
      return member;
    })
  );
  
  return invitations;
};

// Accept invitation
const acceptInvitation = async (inviteCode: string) => {
  const invite = await decodeInviteCode(inviteCode);
  
  // Update member status
  const member = await prisma.organizationMember.update({
    where: { id: invite.memberId },
    data: {
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });
  
  // Log activity
  await logActivity({
    organizationId: member.organizationId,
    userId: member.userId,
    action: 'JOINED_ORGANIZATION',
  });
  
  return member;
};

// Manage permissions
const updateMemberPermissions = async (
  memberId: string,
  permissions: Permission[]
) => {
  // Validate permissions for role
  const member = await prisma.organizationMember.findUnique({
    where: { id: memberId },
  });
  
  const allowedPermissions = getPermissionsForRole(member.role);
  const validPermissions = permissions.filter(p =>
    allowedPermissions.includes(p)
  );
  
  // Update permissions
  await prisma.organizationMember.update({
    where: { id: memberId },
    data: {
      permissions: validPermissions,
    },
  });
  
  // Clear permission cache
  await clearPermissionCache(member.userId);
};
```

### 3. Organization Switching

```typescript
// Switch active organization
const switchOrganization = async (
  userId: string,
  organizationId: string
) => {
  // Verify membership
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      status: 'ACTIVE',
    },
  });
  
  if (!membership) {
    throw new Error('Not a member of this organization');
  }
  
  // Update user's active organization
  await prisma.user.update({
    where: { id: userId },
    data: { activeOrganizationId: organizationId },
  });
  
  // Generate new JWT with organization context
  const token = generateToken({
    userId,
    organizationId,
    role: membership.role,
  });
  
  // Set cookies
  setCookie('active-organization', organizationId);
  setCookie('auth-token', token);
  
  // Log switch
  await logActivity({
    userId,
    organizationId,
    action: 'SWITCHED_ORGANIZATION',
  });
  
  return { token, organization: organizationId };
};

// Get user's organizations
const getUserOrganizations = async (userId: string) => {
  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    include: {
      organization: true,
    },
    orderBy: {
      joinedAt: 'desc',
    },
  });
  
  return memberships.map(m => ({
    ...m.organization,
    role: m.role,
    permissions: m.permissions,
    joinedAt: m.joinedAt,
  }));
};
```

## Data Isolation

### 1. Row-Level Security Policies

```sql
-- Organization isolation policy
CREATE POLICY organization_isolation ON organizations
  USING (id = current_organization_id());

-- Items scoped to organization
CREATE POLICY items_organization ON items
  USING (organization_id = current_organization_id());

-- Orders scoped to organization
CREATE POLICY orders_organization ON orders
  USING (organization_id = current_organization_id());

-- Members can only see their organization's members
CREATE POLICY members_organization ON organization_members
  USING (organization_id = current_organization_id());
```

### 2. Query Scoping

```typescript
// Automatically scope queries
export const organizationScope = <T extends { organizationId: string }>(
  query: Prisma.Args<T, 'findMany'>
) => {
  const orgId = getCurrentOrganizationId();
  
  return {
    ...query,
    where: {
      ...query.where,
      organizationId: orgId,
    },
  };
};

// Usage
const items = await prisma.item.findMany(
  organizationScope({
    where: { status: 'ACTIVE' },
    include: { category: true },
  })
);

// Middleware to enforce organization scope
export const enforceOrganizationScope = async (params, next) => {
  // Add organizationId to creates
  if (params.action === 'create') {
    params.args.data.organizationId = getCurrentOrganizationId();
  }
  
  // Add organizationId to queries
  if (['findMany', 'findFirst', 'findUnique'].includes(params.action)) {
    params.args.where = {
      ...params.args.where,
      organizationId: getCurrentOrganizationId(),
    };
  }
  
  return next(params);
};
```

### 3. Cross-Organization Features

```typescript
// Share data between organizations
const shareWithOrganization = async (
  resourceId: string,
  resourceType: 'ITEM' | 'REPORT' | 'TEMPLATE',
  targetOrgId: string,
  permissions: SharePermission[]
) => {
  // Verify ownership
  const resource = await getResource(resourceType, resourceId);
  if (resource.organizationId !== getCurrentOrganizationId()) {
    throw new Error('Cannot share resources you do not own');
  }
  
  // Create share record
  const share = await prisma.organizationShare.create({
    data: {
      fromOrganizationId: getCurrentOrganizationId(),
      toOrganizationId: targetOrgId,
      resourceType,
      resourceId,
      permissions,
      expiresAt: calculateExpiry(),
    },
  });
  
  // Notify target organization
  await notifyOrganization(targetOrgId, {
    type: 'RESOURCE_SHARED',
    from: getCurrentOrganizationId(),
    resource: resourceType,
  });
  
  return share;
};

// Access shared resources
const getSharedResources = async () => {
  const shares = await prisma.organizationShare.findMany({
    where: {
      toOrganizationId: getCurrentOrganizationId(),
      expiresAt: { gt: new Date() },
      status: 'ACTIVE',
    },
    include: {
      fromOrganization: true,
    },
  });
  
  // Fetch actual resources
  const resources = await Promise.all(
    shares.map(async (share) => {
      const resource = await getResourceWithContext(
        share.resourceType,
        share.resourceId,
        share.fromOrganizationId
      );
      
      return {
        ...resource,
        sharedBy: share.fromOrganization,
        permissions: share.permissions,
      };
    })
  );
  
  return resources;
};
```

## Features & Billing

### 1. Feature Management

```typescript
// Organization features
interface OrganizationFeature {
  id: string;
  organizationId: string;
  feature: FeatureType;
  enabled: boolean;
  limit?: number;
  usage?: number;
  
  // Configuration
  config?: Record<string, any>;
  
  // Billing
  billingType: 'INCLUDED' | 'METERED' | 'FLAT_FEE';
  price?: number;
}

// Check feature availability
const checkFeature = async (
  orgId: string,
  feature: FeatureType
): Promise<FeatureCheck> => {
  const orgFeature = await prisma.organizationFeature.findFirst({
    where: {
      organizationId: orgId,
      feature,
      enabled: true,
    },
  });
  
  if (!orgFeature) {
    return { available: false, reason: 'Feature not enabled' };
  }
  
  // Check limits
  if (orgFeature.limit && orgFeature.usage >= orgFeature.limit) {
    return { 
      available: false, 
      reason: 'Feature limit reached',
      limit: orgFeature.limit,
      usage: orgFeature.usage,
    };
  }
  
  return { available: true, config: orgFeature.config };
};

// Track feature usage
const trackFeatureUsage = async (
  orgId: string,
  feature: FeatureType,
  usage: number = 1
) => {
  await prisma.organizationFeature.update({
    where: {
      organizationId_feature: {
        organizationId: orgId,
        feature,
      },
    },
    data: {
      usage: { increment: usage },
      lastUsedAt: new Date(),
    },
  });
  
  // Check if approaching limit
  const updated = await prisma.organizationFeature.findFirst({
    where: { organizationId: orgId, feature },
  });
  
  if (updated.limit && updated.usage > updated.limit * 0.8) {
    await sendUsageAlert(orgId, feature, updated);
  }
};
```

### 2. Subscription Management

```typescript
// Subscription plans
interface Subscription {
  id: string;
  organizationId: string;
  plan: PlanType;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  
  // Billing
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  
  // Pricing
  basePrice: number;
  addons: SubscriptionAddon[];
  discount?: number;
  
  // Limits
  userLimit: number;
  itemLimit: number;
  warehouseLimit: number;
  apiCallLimit: number;
  
  // Payment
  paymentMethod?: PaymentMethod;
  nextBillingDate: Date;
  cancelAtPeriodEnd: boolean;
}

// Upgrade/downgrade subscription
const changeSubscription = async (
  orgId: string,
  newPlan: PlanType
) => {
  const current = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
  });
  
  // Calculate proration
  const proration = calculateProration(current, newPlan);
  
  // Update subscription
  const updated = await prisma.subscription.update({
    where: { organizationId: orgId },
    data: {
      plan: newPlan,
      ...getPlanLimits(newPlan),
      changeEffectiveDate: proration.immediate 
        ? new Date() 
        : current.currentPeriodEnd,
    },
  });
  
  // Update features
  await updateOrganizationFeatures(orgId, newPlan);
  
  // Process payment if upgrade
  if (proration.amount > 0) {
    await processPayment(orgId, proration.amount, 'PLAN_UPGRADE');
  }
  
  // Send confirmation
  await sendPlanChangeConfirmation(orgId, current.plan, newPlan);
  
  return updated;
};
```

## White-Label Support

### 1. Custom Branding

```typescript
// Apply organization branding
const getOrganizationBranding = async (orgId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      logo: true,
      primaryColor: true,
      secondaryColor: true,
      customDomain: true,
      favicon: true,
      emailLogo: true,
    },
  });
  
  return {
    ...org,
    theme: generateTheme(org),
    emailTemplate: generateEmailTemplate(org),
  };
};

// Generate custom theme
const generateTheme = (branding: Branding) => {
  return {
    colors: {
      primary: branding.primaryColor || '#0066CC',
      secondary: branding.secondaryColor || '#00AA55',
      ...generateColorPalette(branding.primaryColor),
    },
    logo: {
      light: branding.logo || '/default-logo.svg',
      dark: branding.logoDark || branding.logo,
    },
    favicon: branding.favicon || '/favicon.ico',
  };
};

// Custom domain support
const setupCustomDomain = async (
  orgId: string,
  domain: string
) => {
  // Verify domain ownership
  const verification = await verifyDomain(domain);
  if (!verification.verified) {
    return {
      error: 'Domain verification failed',
      instructions: verification.instructions,
    };
  }
  
  // Update organization
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      customDomain: domain,
      domainVerified: true,
      domainVerifiedAt: new Date(),
    },
  });
  
  // Configure SSL
  await configureSSL(domain);
  
  // Update routing
  await updateDomainRouting(domain, orgId);
  
  return { success: true, domain };
};
```

## Analytics & Reporting

### 1. Organization Metrics

```typescript
// Get organization analytics
const getOrganizationAnalytics = async (orgId: string) => {
  const [
    userMetrics,
    usageMetrics,
    performanceMetrics,
    growthMetrics,
  ] = await Promise.all([
    getUserMetrics(orgId),
    getUsageMetrics(orgId),
    getPerformanceMetrics(orgId),
    getGrowthMetrics(orgId),
  ]);
  
  return {
    users: userMetrics,
    usage: usageMetrics,
    performance: performanceMetrics,
    growth: growthMetrics,
    health: calculateHealthScore(orgId),
  };
};

// Usage tracking
const getUsageMetrics = async (orgId: string) => {
  const period = getLast30Days();
  
  const metrics = await prisma.$queryRaw`
    SELECT 
      COUNT(DISTINCT o.id) as orders,
      COUNT(DISTINCT i.id) as items,
      COUNT(DISTINCT sm.id) as movements,
      COUNT(DISTINCT u.id) as active_users,
      SUM(o.total_amount) as revenue
    FROM organizations org
    LEFT JOIN orders o ON o.organization_id = org.id 
      AND o.created_at >= ${period.start}
    LEFT JOIN items i ON i.organization_id = org.id
    LEFT JOIN stock_movements sm ON sm.organization_id = org.id
      AND sm.created_at >= ${period.start}
    LEFT JOIN audit_logs al ON al.organization_id = org.id
      AND al.created_at >= ${period.start}
    LEFT JOIN users u ON u.id = al.user_id
    WHERE org.id = ${orgId}
    GROUP BY org.id
  `;
  
  return metrics[0];
};
```

### 2. Multi-Org Reporting

```typescript
// Cross-organization reports (for enterprise)
const getEnterpriseReport = async (
  parentOrgId: string,
  childOrgIds: string[]
) => {
  // Verify parent-child relationship
  const verified = await verifyOrganizationHierarchy(
    parentOrgId,
    childOrgIds
  );
  
  if (!verified) {
    throw new Error('Invalid organization hierarchy');
  }
  
  // Aggregate data across organizations
  const report = await prisma.$queryRaw`
    WITH org_metrics AS (
      SELECT 
        o.id,
        o.name,
        COUNT(DISTINCT ord.id) as total_orders,
        SUM(ord.total_amount) as total_revenue,
        COUNT(DISTINCT i.id) as total_items,
        COUNT(DISTINCT om.user_id) as total_users
      FROM organizations o
      LEFT JOIN orders ord ON ord.organization_id = o.id
      LEFT JOIN items i ON i.organization_id = o.id
      LEFT JOIN organization_members om ON om.organization_id = o.id
      WHERE o.id = ANY(${childOrgIds})
      GROUP BY o.id, o.name
    )
    SELECT 
      *,
      SUM(total_revenue) OVER () as grand_total_revenue,
      AVG(total_revenue) OVER () as avg_revenue_per_org
    FROM org_metrics
    ORDER BY total_revenue DESC
  `;
  
  return {
    summary: calculateSummaryStats(report),
    organizations: report,
    trends: await calculateTrends(childOrgIds),
    recommendations: await generateRecommendations(report),
  };
};
```

## Best Practices

### 1. Organization Setup

- **Unique Slugs**: Ensure URL-friendly unique identifiers
- **Default Settings**: Create sensible defaults
- **Onboarding Flow**: Guide new organizations
- **Sample Data**: Optionally provide demo data
- **Feature Education**: Explain available features

### 2. Security

```typescript
// Always verify organization context
const verifyOrganizationAccess = async (
  userId: string,
  organizationId: string,
  requiredRole?: Role
) => {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      status: 'ACTIVE',
    },
  });
  
  if (!membership) {
    throw new Error('Access denied: Not a member');
  }
  
  if (requiredRole && !hasRole(membership.role, requiredRole)) {
    throw new Error('Access denied: Insufficient permissions');
  }
  
  return membership;
};

// Audit organization actions
const auditOrganizationAction = async (
  action: AuditAction,
  details: any
) => {
  await prisma.auditLog.create({
    data: {
      organizationId: getCurrentOrganizationId(),
      userId: getCurrentUserId(),
      action,
      details,
      ip: getClientIP(),
      userAgent: getUserAgent(),
    },
  });
};
```

### 3. Performance

```typescript
// Cache organization data
const cacheOrganization = async (orgId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      features: true,
      subscription: true,
    },
  });
  
  await redis.setex(
    `org:${orgId}`,
    3600, // 1 hour
    JSON.stringify(org)
  );
  
  return org;
};

// Batch operations for multiple organizations
const batchUpdateOrganizations = async (
  updates: OrganizationUpdate[]
) => {
  const promises = updates.map(update =>
    prisma.organization.update({
      where: { id: update.id },
      data: update.data,
    })
  );
  
  return Promise.all(promises);
};
```

## Troubleshooting

### Common Issues

1. **Wrong Organization Context**
   - Verify JWT contains correct organizationId
   - Check RLS context is set
   - Ensure cookies are properly signed

2. **Permission Denied**
   - Check organization membership
   - Verify role permissions
   - Review feature availability

3. **Data Not Showing**
   - Confirm organization_id in database
   - Check RLS policies
   - Verify query includes organization filter

### Diagnostic Queries

```sql
-- Check user's organizations
SELECT 
  om.*,
  o.name,
  o.status
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
WHERE om.user_id = 'user-id-here';

-- Verify RLS context
SELECT 
  current_setting('app.current_user_id', true) as user_id,
  current_setting('app.current_organization_id', true) as org_id;

-- Check data visibility
SET LOCAL app.current_organization_id = 'org-id';
SELECT COUNT(*) FROM items; -- Should only show org's items
```

## Next Steps

1. Set up [Organization Onboarding](#creating-organizations)
2. Configure [Feature Flags](#feature-management)
3. Implement [Custom Branding](#white-label-support)
4. Enable [Cross-Org Sharing](#cross-organization-features)