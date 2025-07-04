import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
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
  const managerPassword = await bcrypt.hash('manager123', 10);
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

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 10);
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

  // Create categories
  const electronicsCategory = await prisma.category.upsert({
    where: { name: 'Electronics' },
    update: {},
    create: {
      name: 'Electronics',
      description: 'Electronic devices and components',
    },
  });

  const furnitureCategory = await prisma.category.upsert({
    where: { name: 'Furniture' },
    update: {},
    create: {
      name: 'Furniture',
      description: 'Office and home furniture',
    },
  });

  const suppliesCategory = await prisma.category.upsert({
    where: { name: 'Office Supplies' },
    update: {},
    create: {
      name: 'Office Supplies',
      description: 'General office supplies and stationery',
    },
  });

  // Create locations
  const warehouse = await prisma.location.upsert({
    where: { name: 'Main Warehouse' },
    update: {},
    create: {
      name: 'Main Warehouse',
      description: 'Primary storage facility',
      address: '123 Industrial Ave, Storage City, SC 12345',
    },
  });

  const showroom = await prisma.location.upsert({
    where: { name: 'Showroom' },
    update: {},
    create: {
      name: 'Showroom',
      description: 'Customer display area',
      address: '456 Retail St, Display City, DC 67890',
    },
  });

  // Create products
  const laptop = await prisma.product.upsert({
    where: { sku: 'LAP-001' },
    update: {},
    create: {
      sku: 'LAP-001',
      name: 'Business Laptop',
      description: 'High-performance laptop for business use',
      categoryId: electronicsCategory.id,
      unitPrice: 999.99,
      cost: 750.00,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  const monitor = await prisma.product.upsert({
    where: { sku: 'MON-001' },
    update: {},
    create: {
      sku: 'MON-001',
      name: '24" Monitor',
      description: '24-inch LED monitor with 1080p resolution',
      categoryId: electronicsCategory.id,
      unitPrice: 299.99,
      cost: 200.00,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  const chair = await prisma.product.upsert({
    where: { sku: 'CHR-001' },
    update: {},
    create: {
      sku: 'CHR-001',
      name: 'Office Chair',
      description: 'Ergonomic office chair with lumbar support',
      categoryId: furnitureCategory.id,
      unitPrice: 249.99,
      cost: 150.00,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  const desk = await prisma.product.upsert({
    where: { sku: 'DSK-001' },
    update: {},
    create: {
      sku: 'DSK-001',
      name: 'Standing Desk',
      description: 'Adjustable height standing desk',
      categoryId: furnitureCategory.id,
      unitPrice: 599.99,
      cost: 400.00,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  const pens = await prisma.product.upsert({
    where: { sku: 'PEN-001' },
    update: {},
    create: {
      sku: 'PEN-001',
      name: 'Ballpoint Pens (Pack of 12)',
      description: 'Blue ballpoint pens, pack of 12',
      categoryId: suppliesCategory.id,
      unitPrice: 9.99,
      cost: 5.00,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  // Create inventory items
  const laptopInventory = await prisma.inventoryItem.upsert({
    where: { 
      productId_locationId: {
        productId: laptop.id,
        locationId: warehouse.id,
      }
    },
    update: {},
    create: {
      productId: laptop.id,
      locationId: warehouse.id,
      quantity: 25,
      reorderPoint: 5,
      maxStock: 50,
    },
  });

  const monitorInventory = await prisma.inventoryItem.upsert({
    where: { 
      productId_locationId: {
        productId: monitor.id,
        locationId: warehouse.id,
      }
    },
    update: {},
    create: {
      productId: monitor.id,
      locationId: warehouse.id,
      quantity: 40,
      reorderPoint: 10,
      maxStock: 100,
    },
  });

  const chairInventory = await prisma.inventoryItem.upsert({
    where: { 
      productId_locationId: {
        productId: chair.id,
        locationId: warehouse.id,
      }
    },
    update: {},
    create: {
      productId: chair.id,
      locationId: warehouse.id,
      quantity: 15,
      reorderPoint: 3,
      maxStock: 30,
    },
  });

  const deskInventory = await prisma.inventoryItem.upsert({
    where: { 
      productId_locationId: {
        productId: desk.id,
        locationId: warehouse.id,
      }
    },
    update: {},
    create: {
      productId: desk.id,
      locationId: warehouse.id,
      quantity: 8,
      reorderPoint: 2,
      maxStock: 20,
    },
  });

  const pensInventory = await prisma.inventoryItem.upsert({
    where: { 
      productId_locationId: {
        productId: pens.id,
        locationId: warehouse.id,
      }
    },
    update: {},
    create: {
      productId: pens.id,
      locationId: warehouse.id,
      quantity: 100,
      reorderPoint: 20,
      maxStock: 200,
    },
  });

  // Create some showroom inventory
  await prisma.inventoryItem.upsert({
    where: { 
      productId_locationId: {
        productId: laptop.id,
        locationId: showroom.id,
      }
    },
    update: {},
    create: {
      productId: laptop.id,
      locationId: showroom.id,
      quantity: 3,
      reorderPoint: 1,
      maxStock: 5,
    },
  });

  await prisma.inventoryItem.upsert({
    where: { 
      productId_locationId: {
        productId: monitor.id,
        locationId: showroom.id,
      }
    },
    update: {},
    create: {
      productId: monitor.id,
      locationId: showroom.id,
      quantity: 5,
      reorderPoint: 2,
      maxStock: 10,
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('👤 Test users created:');
  console.log('   - admin@ventry.com / admin123 (ADMIN)');
  console.log('   - manager@ventry.com / manager123 (MANAGER)');
  console.log('   - user@ventry.com / user123 (USER)');
  console.log('🏢 Locations: Main Warehouse, Showroom');
  console.log('📦 Products: 5 products across 3 categories');
  console.log('📊 Inventory: Stock levels set for all products');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });