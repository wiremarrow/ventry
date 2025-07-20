#!/usr/bin/env tsx
/**
 * Multi-Organization Test Data Seeder
 * 
 * This script creates test data for multiple organizations to test:
 * - Row-Level Security (RLS) isolation
 * - Multi-tenant data separation
 * - Organization context switching
 * 
 * Run with: pnpm db:seed:multi-org
 */

import { prisma } from '../index.js';
import bcrypt from 'bcryptjs';

async function clearBusinessData() {
  console.log('🧹 Clearing existing business data (keeping core users and Ventry org)...');
  
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
  
  console.log('✅ Business data cleared\n');
}

async function main() {
  console.log('🔒 Creating multi-organization test data...\n');

  try {
    // Clear existing business data first
    await clearBusinessData();
    // Create password hash once for all users
    const password = await bcrypt.hash('password123', 10);

    // Create default unit of measure for both organizations
    const createDefaultUOM = async (organizationId: string) => {
      return await prisma.unitOfMeasure.upsert({
        where: {
          organizationId_code: {
            organizationId,
            code: 'EA',
          },
        },
        update: {},
        create: {
          organizationId,
          code: 'EA',
          description: 'Each',
          isBase: true,
        },
      });
    };

    // Organization 1: TechStart Inc
    console.log('🏢 Creating Organization 1: TechStart Inc.');
    
    const alice = await prisma.user.upsert({
      where: { email: 'alice@techstart.com' },
      update: {},
      create: {
        email: 'alice@techstart.com',
        username: 'alice',
        firstName: 'Alice',
        lastName: 'Anderson',
        password,
        role: 'ADMIN',
      },
    });

    const bob = await prisma.user.upsert({
      where: { email: 'bob@techstart.com' },
      update: {},
      create: {
        email: 'bob@techstart.com',
        username: 'bob',
        firstName: 'Bob',
        lastName: 'Brown',
        password,
        role: 'EMPLOYEE',
      },
    });

    const techStart = await prisma.organization.upsert({
      where: { slug: 'techstart-inc' },
      update: {},
      create: {
        name: 'TechStart Inc.',
        slug: 'techstart-inc',
        subscriptionTier: 'PRO',
        subscriptionStatus: 'ACTIVE',
        members: {
          create: [
            { userId: alice.id, role: 'OWNER' },
            { userId: bob.id, role: 'MEMBER' },
          ],
        },
      },
    });

    // Create TechStart UOM
    const techUOM = await createDefaultUOM(techStart.id);

    // Create TechStart warehouse and items
    const techWarehouse = await prisma.warehouse.create({
      data: {
        organizationId: techStart.id,
        code: 'TS-WH-01',
        name: 'TechStart Main Warehouse',
        line1: '123 Tech Street',
        city: 'San Jose',
        state: 'CA',
        postalCode: '95110',
        country: 'US',
      },
    });

    const techLocation = await prisma.location.create({
      data: {
        warehouseId: techWarehouse.id,
        code: 'TS-A-1-1',
        zone: 'A',
        aisle: '1',
        shelf: '1',
      },
    });

    const techCategory = await prisma.itemCategory.create({
      data: {
        organizationId: techStart.id,
        name: 'Tech Equipment',
        description: 'Technology equipment and accessories',
      },
    });

    const techItems = [
      { sku: 'TS-LAPTOP-001', name: 'TechStart Laptop Pro', defaultPrice: 1499.99, defaultCost: 999.99 },
      { sku: 'TS-MONITOR-001', name: 'TechStart UltraWide Monitor', defaultPrice: 599.99, defaultCost: 399.99 },
      { sku: 'TS-KEYBOARD-001', name: 'TechStart Mechanical Keyboard', defaultPrice: 149.99, defaultCost: 89.99 },
    ];

    for (const itemData of techItems) {
      const item = await prisma.item.create({
        data: {
          organizationId: techStart.id,
          categoryId: techCategory.id,
          uomId: techUOM.id,
          ...itemData,
          description: `High-quality ${itemData.name.toLowerCase()}`,
          isActive: true,
        },
      });

      const qtyOnHand = Math.floor(Math.random() * 50) + 10;
      const qtyReserved = Math.floor(Math.random() * 5);
      
      await prisma.inventory.create({
        data: {
          itemId: item.id,
          locationId: techLocation.id,
          qtyOnHand,
          qtyReserved,
        },
      });
    }

    // Organization 2: Global Retail Co
    console.log('🏢 Creating Organization 2: Global Retail Co.');
    
    const charlie = await prisma.user.upsert({
      where: { email: 'charlie@globalretail.com' },
      update: {},
      create: {
        email: 'charlie@globalretail.com',
        username: 'charlie',
        firstName: 'Charlie',
        lastName: 'Chen',
        password,
        role: 'ADMIN',
      },
    });

    const diana = await prisma.user.upsert({
      where: { email: 'diana@globalretail.com' },
      update: {},
      create: {
        email: 'diana@globalretail.com',
        username: 'diana',
        firstName: 'Diana',
        lastName: 'Davis',
        password,
        role: 'EMPLOYEE',
      },
    });

    const globalRetail = await prisma.organization.upsert({
      where: { slug: 'global-retail' },
      update: {},
      create: {
        name: 'Global Retail Co.',
        slug: 'global-retail',
        subscriptionTier: 'ENTERPRISE',
        subscriptionStatus: 'ACTIVE',
        members: {
          create: [
            { userId: charlie.id, role: 'OWNER' },
            { userId: diana.id, role: 'MEMBER' },
          ],
        },
      },
    });

    // Create Global Retail UOM
    const retailUOM = await createDefaultUOM(globalRetail.id);

    // Create Global Retail warehouse and items
    const retailWarehouse = await prisma.warehouse.create({
      data: {
        organizationId: globalRetail.id,
        code: 'GR-WH-01',
        name: 'Global Retail Distribution Center',
        line1: '456 Commerce Blvd',
        city: 'Dallas',
        state: 'TX',
        postalCode: '75201',
        country: 'US',
      },
    });

    const retailLocation = await prisma.location.create({
      data: {
        warehouseId: retailWarehouse.id,
        code: 'GR-B-2-1',
        zone: 'B',
        aisle: '2',
        shelf: '1',
      },
    });

    const retailCategory = await prisma.itemCategory.create({
      data: {
        organizationId: globalRetail.id,
        name: 'Consumer Goods',
        description: 'General consumer products',
      },
    });

    const retailItems = [
      { sku: 'GR-SHIRT-001', name: 'Premium Cotton T-Shirt', defaultPrice: 29.99, defaultCost: 12.99 },
      { sku: 'GR-JEANS-001', name: 'Classic Denim Jeans', defaultPrice: 79.99, defaultCost: 35.99 },
      { sku: 'GR-SHOES-001', name: 'Comfort Walking Shoes', defaultPrice: 89.99, defaultCost: 45.99 },
    ];

    for (const itemData of retailItems) {
      const item = await prisma.item.create({
        data: {
          organizationId: globalRetail.id,
          categoryId: retailCategory.id,
          uomId: retailUOM.id,
          ...itemData,
          description: `Quality ${itemData.name.toLowerCase()}`,
          isActive: true,
        },
      });

      const qtyOnHand = Math.floor(Math.random() * 100) + 50;
      const qtyReserved = Math.floor(Math.random() * 10);
      
      await prisma.inventory.create({
        data: {
          itemId: item.id,
          locationId: retailLocation.id,
          qtyOnHand,
          qtyReserved,
        },
      });
    }

    console.log('\n✅ RLS test data created successfully!\n');
    console.log('📊 Summary:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n🏢 Organization 1: TechStart Inc.');
    console.log('   Users: alice@techstart.com (admin), bob@techstart.com (employee)');
    console.log('   Warehouse: TS-WH-01 (San Jose, CA)');
    console.log('   Items: TS-LAPTOP-001, TS-MONITOR-001, TS-KEYBOARD-001');
    console.log('\n🏢 Organization 2: Global Retail Co.');
    console.log('   Users: charlie@globalretail.com (admin), diana@globalretail.com (employee)');
    console.log('   Warehouse: GR-WH-01 (Dallas, TX)');
    console.log('   Items: GR-SHIRT-001, GR-JEANS-001, GR-SHOES-001');
    console.log('\n🔐 All users password: password123');
    console.log('\n🧪 Testing RLS Isolation:');
    console.log('   1. Login as alice@techstart.com');
    console.log('      - Should see ONLY TechStart items (TS-*)');
    console.log('      - Should see ONLY TechStart warehouse (TS-WH-01)');
    console.log('   2. Login as charlie@globalretail.com');
    console.log('      - Should see ONLY Global Retail items (GR-*)');
    console.log('      - Should see ONLY Global Retail warehouse (GR-WH-01)');
    console.log('   3. Try to access other org\'s data via API - should fail');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error creating RLS test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });