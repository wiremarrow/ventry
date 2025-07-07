import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Clear existing data in development/test environments only
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      console.log('🧹 Cleaning existing seed data for fresh start...');
      await prisma.inventoryMovement.deleteMany();
      await prisma.inventoryItem.deleteMany();
      await prisma.product.deleteMany();
      await prisma.category.deleteMany();
      await prisma.location.deleteMany();
      await prisma.user.deleteMany();
    }

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
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
    const manager = await prisma.user.create({
      data: {
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
    const user = await prisma.user.create({
      data: {
        email: 'user@ventry.com',
        username: 'user',
        firstName: 'Regular',
        lastName: 'User',
        password: userPassword,
        role: 'USER',
      },
    });

    // Create categories
    const electronicsCategory = await prisma.category.create({
      data: {
        name: 'Electronics',
        description: 'Electronic devices and components',
      },
    });

    const furnitureCategory = await prisma.category.create({
      data: {
        name: 'Furniture',
        description: 'Office and home furniture',
      },
    });

    const suppliesCategory = await prisma.category.create({
      data: {
        name: 'Office Supplies',
        description: 'General office supplies and stationery',
      },
    });

    // Create locations
    const warehouse = await prisma.location.create({
      data: {
        name: 'Main Warehouse',
        description: 'Primary storage facility',
        address: '123 Industrial Ave, Storage City, SC 12345',
      },
    });

    const showroom = await prisma.location.create({
      data: {
        name: 'Showroom',
        description: 'Customer display area',
        address: '456 Retail St, Display City, DC 67890',
      },
    });

    // Create products
    const laptop = await prisma.product.create({
      data: {
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

    const monitor = await prisma.product.create({
      data: {
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

    const chair = await prisma.product.create({
      data: {
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

    const desk = await prisma.product.create({
      data: {
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

    const pens = await prisma.product.create({
      data: {
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
    const laptopInventory = await prisma.inventoryItem.create({
      data: {
        productId: laptop.id,
        locationId: warehouse.id,
        quantity: 25,
        reorderPoint: 5,
        maxStock: 50,
      },
    });

    const monitorInventory = await prisma.inventoryItem.create({
      data: {
        productId: monitor.id,
        locationId: warehouse.id,
        quantity: 40,
        reorderPoint: 10,
        maxStock: 100,
      },
    });

    const chairInventory = await prisma.inventoryItem.create({
      data: {
        productId: chair.id,
        locationId: warehouse.id,
        quantity: 15,
        reorderPoint: 3,
        maxStock: 30,
      },
    });

    const deskInventory = await prisma.inventoryItem.create({
      data: {
        productId: desk.id,
        locationId: warehouse.id,
        quantity: 8,
        reorderPoint: 2,
        maxStock: 20,
      },
    });

    const pensInventory = await prisma.inventoryItem.create({
      data: {
        productId: pens.id,
        locationId: warehouse.id,
        quantity: 100,
        reorderPoint: 20,
        maxStock: 200,
      },
    });

    // Create some showroom inventory
    await prisma.inventoryItem.create({
      data: {
        productId: laptop.id,
        locationId: showroom.id,
        quantity: 3,
        reorderPoint: 1,
        maxStock: 5,
      },
    });

    await prisma.inventoryItem.create({
      data: {
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

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });