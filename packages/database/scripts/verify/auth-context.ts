import { PrismaClient } from '../../generated/client/client.js';
import type { GlobalOptions } from './types.js';

export async function createPrismaClient(options: GlobalOptions): Promise<PrismaClient> {
  // Determine which database URL to use
  const databaseUrl = options.user === 'admin' 
    ? process.env.DATABASE_ADMIN_URL 
    : process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(`${options.user === 'admin' ? 'DATABASE_ADMIN_URL' : 'DATABASE_URL'} not found in environment`);
  }

  // Create Prisma client with appropriate connection
  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl }
    },
    log: options.verbose ? ['query', 'info', 'warn', 'error'] : ['error']
  });

  // If using app user with auth, set up RLS context
  if (options.user === 'app' && options.auth) {
    await setupAuthContext(prisma, options.auth);
  }

  return prisma;
}

async function setupAuthContext(prisma: PrismaClient, email: string): Promise<void> {
  // Find the user and their organization
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organizations: {
        include: {
          organization: true
        }
      }
    }
  });

  if (!user) {
    throw new Error(`User '${email}' not found`);
  }

  if (user.organizations.length === 0) {
    throw new Error(`User '${email}' is not a member of any organization`);
  }

  // For simplicity, use the first organization
  const orgId = user.organizations[0].organization.id;
  const userId = user.id;

  // Set PostgreSQL session variables for RLS
  // These would be used by RLS policies to filter data
  // Use separate queries to avoid "cannot insert multiple commands" error
  await prisma.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`);
  await prisma.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${orgId}'`);

  if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
    console.log(`🔐 Auth context set: ${email} (${user.role}) in ${user.organizations[0].organization.name}`);
  }
}

export async function compareAccess(
  tableName: string,
  users: string[],
  options: Omit<GlobalOptions, 'auth'>
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};

  for (const userEmail of users) {
    const prisma = await createPrismaClient({ ...options, user: 'app', auth: userEmail });
    
    try {
      const tableInfo = (await import('./query-builder.js')).getTableInfo(tableName);
      const model = (prisma as any)[tableInfo.name];
      const count = await model.count();
      results[userEmail] = count;
    } finally {
      await prisma.$disconnect();
    }
  }

  return results;
}