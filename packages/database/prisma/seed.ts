#!/usr/bin/env tsx
/**
 * Basic Database Seeder
 *
 * Creates a clean slate with:
 * - 4 users (admin, manager, employee, user)
 * - 1 empty organization (Ventry Corporation)
 * - Proper role assignments
 *
 * This is the minimal seed for development.
 * For comprehensive data, use seed-single-comprehensive or seed-multi-comprehensive.
 *
 * Run with: pnpm db:seed
 */

import { prisma } from '../index.js';
import bcrypt from 'bcryptjs';

async function clearDatabase() {
  console.log('🧹 Clearing entire database...');

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

  const password = await bcrypt.hash('password123', 10);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@ventry.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      password,
      role: 'ADMIN',
    },
  });

  // Create manager user
  const manager = await prisma.user.create({
    data: {
      email: 'manager@ventry.com',
      username: 'manager',
      firstName: 'Manager',
      lastName: 'User',
      password,
      role: 'MANAGER',
    },
  });

  // Create employee user
  const employee = await prisma.user.create({
    data: {
      email: 'employee@ventry.com',
      username: 'employee',
      firstName: 'Employee',
      lastName: 'User',
      password,
      role: 'EMPLOYEE',
    },
  });

  // Create regular user (no organization access)
  const user = await prisma.user.create({
    data: {
      email: 'user@ventry.com',
      username: 'user',
      firstName: 'Regular',
      lastName: 'User',
      password,
      role: 'USER',
    },
  });

  console.log('✅ Users created');
  return { admin, manager, employee, user };
}

async function seedOrganization(admin: any, manager: any, employee: any) {
  console.log('🏢 Creating organization...');

  // Create Ventry Corporation
  const organization = await prisma.organization.create({
    data: {
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
          },
          {
            userId: manager.id,
            role: 'ADMIN',
          },
          {
            userId: employee.id,
            role: 'MEMBER',
          },
        ],
      },
    },
  });

  console.log('✅ Organization created');
  return organization;
}

async function main() {
  console.log('🌱 Starting basic database seed...\n');

  try {
    // Clear entire database first
    await clearDatabase();

    // Create users
    const { admin, manager, employee, user } = await seedUsers();

    // Create organization with members
    const organization = await seedOrganization(admin, manager, employee);

    // Success summary
    console.log('\n✅ Basic seed completed successfully!\n');
    console.log('📊 Summary:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('👤 Users created:');
    console.log('  • admin@ventry.com / password123 (ADMIN role)');
    console.log('  • manager@ventry.com / password123 (MANAGER role)');
    console.log('  • employee@ventry.com / password123 (EMPLOYEE role)');
    console.log('  • user@ventry.com / password123 (USER role - no org access)');
    console.log('\n🏢 Organization: Ventry Corporation');
    console.log('👥 Organization members:');
    console.log('  • admin@ventry.com (OWNER)');
    console.log('  • manager@ventry.com (ADMIN)');
    console.log('  • employee@ventry.com (MEMBER)');
    console.log('\n🚫 user@ventry.com intentionally NOT in organization');
    console.log('   (for testing multi-tenant boundaries)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n💡 For comprehensive data, run:');
    console.log('   pnpm db:seed:single  - Single org with full data');
    console.log('   pnpm db:seed:multi   - Multiple orgs with full data');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
