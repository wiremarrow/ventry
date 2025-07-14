import { prisma } from '../index.js';

async function main() {
  console.log('🌱 Creating organization and related data...');

  try {
    // Get the admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@ventry.com' }
    });

    if (!adminUser) {
      throw new Error('Admin user not found. Run pnpm db:seed first.');
    }

    // Create organization
    const organization = await prisma.organization.upsert({
      where: { slug: 'ventry-corp' },
      update: {},
      create: {
        name: 'Ventry Corporation',
        slug: 'ventry-corp',
        settings: {},
        subscriptionTier: 'ENTERPRISE',
        subscriptionStatus: 'ACTIVE',
        members: {
          create: [
            {
              userId: adminUser.id,
              role: 'OWNER',
            }
          ]
        }
      }
    });

    // Get or create other users and add them to the organization
    const managerUser = await prisma.user.findUnique({
      where: { email: 'manager@ventry.com' }
    });

    const regularUser = await prisma.user.findUnique({
      where: { email: 'user@ventry.com' }
    });

    if (managerUser) {
      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: managerUser.id
          }
        },
        update: {},
        create: {
          organizationId: organization.id,
          userId: managerUser.id,
          role: 'ADMIN'
        }
      });
    }

    if (regularUser) {
      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: regularUser.id
          }
        },
        update: {},
        create: {
          organizationId: organization.id,
          userId: regularUser.id,
          role: 'MEMBER'
        }
      });
    }

    // Create basic units of measure
    const units = [
      { code: 'EA', description: 'Each unit', isBase: true },
      { code: 'CS', description: 'Case', isBase: false, conversionFactorToBase: 12 },
      { code: 'BOX', description: 'Box', isBase: false, conversionFactorToBase: 24 }
    ];

    for (const unit of units) {
      await prisma.unitOfMeasure.upsert({
        where: {
          organizationId_code: {
            organizationId: organization.id,
            code: unit.code
          }
        },
        update: {},
        create: {
          organizationId: organization.id,
          ...unit
        }
      });
    }

    // Create basic categories
    const categories = [
      { name: 'Electronics', description: 'Electronic products' },
      { name: 'Office Supplies', description: 'Office supplies and stationery' },
      { name: 'Furniture', description: 'Office and warehouse furniture' }
    ];

    for (const category of categories) {
      await prisma.itemCategory.upsert({
        where: {
          organizationId_name: {
            organizationId: organization.id,
            name: category.name
          }
        },
        update: {},
        create: {
          organizationId: organization.id,
          ...category
        }
      });
    }

    // Create a warehouse and location
    const warehouse = await prisma.warehouse.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: 'MAIN'
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        code: 'MAIN',
        name: 'Main Warehouse',
        line1: '123 Main Street',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'US'
      }
    });

    await prisma.location.upsert({
      where: {
        code: 'A-1-1'
      },
      update: {},
      create: {
        warehouseId: warehouse.id,
        code: 'A-1-1',
        description: 'Aisle A, Rack 1, Shelf 1',
        zone: 'A',
        aisle: '1',
        shelf: '1'
      }
    });

    console.log('✅ Organization and basic data created successfully!');
    console.log(`🏢 Organization: ${organization.name} (${organization.slug})`);
    console.log('👥 Members: 3 users added to organization');
    console.log('📏 Units of Measure: 3 created');
    console.log('📁 Categories: 3 created');
    console.log('🏭 Warehouse: Main Warehouse created with 1 location');
    
  } catch (error) {
    console.error('❌ Error during organization seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });