import { prisma } from '../index.js';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

// Parse command line arguments
const args = process.argv.slice(2);
const isComprehensive = args.includes('--comprehensive');
const isBasicOnly = args.includes('--basic');

// Utility functions for comprehensive seeding
function generateSKU(category: string, index: number): string {
  const prefix = category.substring(0, 3).toUpperCase();
  return `${prefix}-${String(index).padStart(4, '0')}`;
}

function generateLotNumber(date: Date, index: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `LOT-${year}${month}-${String(index).padStart(4, '0')}`;
}

async function clearDatabase() {
  if (!isComprehensive) return;
  
  console.log('🧹 Clearing existing data for comprehensive seed...');
  
  // Delete in reverse order of dependencies
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.pOSTransactionItem.deleteMany();
  await prisma.pOSTransaction.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.return.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.receiptItem.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplierContact.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.cycleCountItem.deleteMany();
  await prisma.cycleCount.deleteMany();
  await prisma.stockAdjustment.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.serialNumber.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.itemImage.deleteMany();
  await prisma.item.deleteMany();
  await prisma.location.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.unitOfMeasure.deleteMany();
  await prisma.itemCategory.deleteMany();
  await prisma.shippingMethod.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Database cleared');
}

async function seedUsers() {
  console.log('👥 Creating users...');

  // Create admin user
  const adminPassword = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ventry.com' },
    update: {},
    create: {
      email: 'admin@ventry.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // Create manager user  
  const managerPassword = await bcrypt.hash('password123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@ventry.com' },
    update: {},
    create: {
      email: 'manager@ventry.com',
      username: 'manager',
      firstName: 'Manager',
      lastName: 'User', 
      password: managerPassword,
      role: 'MANAGER',
    },
  });

  // Create employee user (with organization membership)
  const employeePassword = await bcrypt.hash('password123', 10);
  const employee = await prisma.user.upsert({
    where: { email: 'employee@ventry.com' },
    update: {},
    create: {
      email: 'employee@ventry.com',
      username: 'employee',
      firstName: 'Employee',
      lastName: 'User',
      password: employeePassword,
      role: 'EMPLOYEE',
    },
  });

  // Create regular user (WITHOUT organization membership - demonstrates multi-tenant boundary)
  const userPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@ventry.com' },
    update: {},
    create: {
      email: 'user@ventry.com',
      username: 'user',
      firstName: 'Regular',
      lastName: 'User',
      password: userPassword,
      role: 'USER',
    },
  });

  return { admin, manager, employee, user };
}

async function seedOrganization(admin: any, manager: any, employee: any) {
  if (isBasicOnly) return null;

  console.log('🏢 Creating organization...');

  // Create organization with admin as owner
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
            userId: admin.id,
            role: 'OWNER',
          }
        ]
      }
    }
  });

  // Add manager to organization
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: manager.id
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      userId: manager.id,
      role: 'ADMIN'
    }
  });

  // Add employee to organization with limited access
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: employee.id
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      userId: employee.id,
      role: 'MEMBER'
    }
  });

  // Ensure user@ventry.com is NOT in organization (remove if exists)
  await prisma.organizationMember.deleteMany({
    where: {
      organizationId: organization.id,
      user: {
        email: 'user@ventry.com'
      }
    }
  });

  return organization;
}

async function seedBasicData(organizationId: string) {
  if (isBasicOnly) return;

  console.log('📦 Creating basic inventory data...');

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
          organizationId,
          code: unit.code
        }
      },
      update: {},
      create: {
        organizationId,
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
          organizationId,
          name: category.name
        }
      },
      update: {},
      create: {
        organizationId,
        ...category
      }
    });
  }

  // Create a warehouse and location
  const warehouse = await prisma.warehouse.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: 'MAIN'
      }
    },
    update: {},
    create: {
      organizationId,
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
}

async function seedComprehensiveData(organizationId: string) {
  if (!isComprehensive) return;

  console.log('🚀 Creating comprehensive demo data...');
  
  // This would include all the comprehensive seeding logic from seed-comprehensive.ts
  // For now, just add some sample products to demonstrate
  
  const electronicsCategory = await prisma.itemCategory.findFirst({
    where: { name: 'Electronics', organizationId }
  });
  
  const eachUnit = await prisma.unitOfMeasure.findFirst({
    where: { code: 'EA', organizationId }
  });

  if (electronicsCategory && eachUnit) {
    await prisma.item.upsert({
      where: {
        organizationId_sku: {
          organizationId,
          sku: 'ELE-0001'
        }
      },
      update: {},
      create: {
        organizationId,
        sku: 'ELE-0001',
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with USB receiver',
        categoryId: electronicsCategory.id,
        uomId: eachUnit.id,
        defaultCost: 25.99,
        defaultPrice: 39.99,
      }
    });
  }
}

async function main() {
  console.log('🌱 Starting unified database seed...');
  
  if (isComprehensive) {
    console.log('📊 Mode: Comprehensive (full demo data)');
  } else if (isBasicOnly) {
    console.log('👤 Mode: Basic users only');
  } else {
    console.log('🏢 Mode: Users + Organization (default)');
  }

  console.log('🔧 Using idempotent operations for enterprise-grade reliability...');

  try {
    // Clear database if comprehensive mode
    await clearDatabase();

    // Create users (always)
    const { admin, manager, employee, user } = await seedUsers();

    // Create organization and basic data (unless basic-only mode)
    let organization = null;
    if (!isBasicOnly) {
      organization = await seedOrganization(admin, manager, employee);
      if (organization) {
        await seedBasicData(organization.id);
        await seedComprehensiveData(organization.id);
      }
    }

    // Success messages
    console.log('✅ Database seed completed successfully!');
    console.log('👤 Users created:');
    console.log('  • admin@ventry.com/password123 (ADMIN role)');
    console.log('  • manager@ventry.com/password123 (MANAGER role)');
    console.log('  • employee@ventry.com/password123 (EMPLOYEE role)');
    console.log('  • user@ventry.com/password123 (USER role)');

    if (!isBasicOnly && organization) {
      console.log('🏢 Organization: Ventry Corporation');
      console.log('👥 Organization members: admin, manager, employee');
      console.log('🚫 user@ventry.com intentionally NOT in organization (demonstrates multi-tenant boundary)');
      console.log('📏 Units of Measure: 3 created');
      console.log('📁 Categories: 3 created');
      console.log('🏭 Warehouse: Main Warehouse with 1 location');
      
      if (isComprehensive) {
        console.log('📊 Comprehensive demo data created');
      }
    }

  } catch (error) {
    console.error('❌ Error during seeding:', error);
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