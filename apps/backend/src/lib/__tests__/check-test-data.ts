import { prisma } from '@ventry/database';

async function checkTestData() {
  try {
    const items = await prisma.item.findMany({
      select: {
        id: true,
        sku: true,
        organizationId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Found ${items.length} items in test database:`);
    items.forEach((item) => {
      console.log(`- ${item.sku} (org: ${item.organizationId.substring(0, 8)}...)`);
    });

    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`\nFound ${orgs.length} organizations:`);
    orgs.forEach((org) => {
      console.log(`- ${org.name} (${org.id.substring(0, 8)}...)`);
    });
  } catch (error) {
    console.error('Error checking test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestData();
