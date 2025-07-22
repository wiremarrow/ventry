#!/usr/bin/env tsx
/**
 * Single Organization Comprehensive Seeder
 * 
 * Creates Ventry Corporation with full comprehensive data:
 * - 4 users (admin, manager, employee, user)
 * - 1 organization with full data
 * - 45+ products across 3 categories
 * - 4 warehouses with 40+ locations
 * - 12 suppliers with contacts
 * - 25 customers with addresses
 * - Purchase orders, sales orders, shipments, returns
 * - Stock movements, adjustments, cycle counts
 * - Full historical data for analytics
 * 
 * Run with: pnpm db:seed:single
 */

import { prisma } from '../index.js';
import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';
import { faker } from '@faker-js/faker';

// Set consistent seed for reproducible data
faker.seed(12345);

// Utility functions
function generateSKU(category: string, index: number): string {
  const prefix = category.substring(0, 3).toUpperCase();
  return `${prefix}-${String(index).padStart(4, '0')}`;
}

function generateLotNumber(date: Date, index: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000000);
  const timestamp = Date.now() % 10000;
  return `LOT-${year}${month}-${String(index).padStart(4, '0')}-${String(random).padStart(6, '0')}-${timestamp}`;
}

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
          }
        ]
      }
    }
  });

  console.log('✅ Organization created');
  return organization;
}

async function seedBasicData(organizationId: string) {
  console.log('📦 Creating basic data structures...');
  
  // Create units of measure
  const uomEach = await prisma.unitOfMeasure.create({
    data: {
      organizationId,
      code: 'EA',
      description: 'Each',
      isBase: true,
    }
  });

  const uomBox = await prisma.unitOfMeasure.create({
    data: {
      organizationId,
      code: 'BOX',
      description: 'Box',
      isBase: false,
      conversionFactorToBase: new Decimal(12),
    }
  });

  const uomCase = await prisma.unitOfMeasure.create({
    data: {
      organizationId,
      code: 'CASE',
      description: 'Case',
      isBase: false,
      conversionFactorToBase: new Decimal(24),
    }
  });

  // Create item categories
  const electronics = await prisma.itemCategory.create({
    data: {
      organizationId,
      name: 'Electronics',
      description: 'Electronic devices and accessories',
    }
  });

  const office = await prisma.itemCategory.create({
    data: {
      organizationId,
      name: 'Office Supplies',
      description: 'Office supplies and stationery',
    }
  });

  const furniture = await prisma.itemCategory.create({
    data: {
      organizationId,
      name: 'Furniture',
      description: 'Office and home furniture',
    }
  });

  // Create carriers
  const carriers = await Promise.all([
    prisma.carrier.create({
      data: {
        organizationId,
        name: 'United Parcel Service',
        phone: '1-800-742-5877',
        website: 'https://www.ups.com',
        trackingUrlTpl: 'https://www.ups.com/track?tracknum={tracking}',
      }
    }),
    prisma.carrier.create({
      data: {
        organizationId,
        name: 'FedEx',
        phone: '1-800-463-3339',
        website: 'https://www.fedex.com',
        trackingUrlTpl: 'https://www.fedex.com/tracking?tracknumber={tracking}',
      }
    }),
    prisma.carrier.create({
      data: {
        organizationId,
        name: 'United States Postal Service',
        phone: '1-800-275-8777',
        website: 'https://www.usps.com',
        trackingUrlTpl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}',
      }
    }),
  ]);

  // Create shipping methods
  const shippingMethods = await Promise.all([
    prisma.shippingMethod.create({
      data: {
        organizationId,
        carrierId: carriers[0].id,
        serviceName: 'UPS Ground',
        transitDays: 5,
        baseCost: new Decimal(12.99),
      }
    }),
    prisma.shippingMethod.create({
      data: {
        organizationId,
        carrierId: carriers[1].id,
        serviceName: 'FedEx 2Day',
        transitDays: 2,
        baseCost: new Decimal(29.99),
      }
    }),
    prisma.shippingMethod.create({
      data: {
        organizationId,
        carrierId: carriers[1].id,
        serviceName: 'FedEx Overnight',
        transitDays: 1,
        baseCost: new Decimal(49.99),
      }
    }),
  ]);

  // Create payment methods
  const paymentMethods = await Promise.all([
    prisma.paymentMethod.create({
      data: {
        organizationId,
        methodName: 'Net 30',
        provider: 'Invoice',
      }
    }),
    prisma.paymentMethod.create({
      data: {
        organizationId,
        methodName: 'Credit Card',
        provider: 'Stripe',
      }
    }),
    prisma.paymentMethod.create({
      data: {
        organizationId,
        methodName: 'ACH Transfer',
        provider: 'Bank',
      }
    }),
  ]);

  console.log('✅ Basic data created');
  
  return {
    units: { each: uomEach, box: uomBox, case: uomCase },
    categories: { electronics, office, furniture },
    carriers,
    shippingMethods,
    paymentMethods,
  };
}

async function seedWarehouses(organizationId: string) {
  console.log('🏭 Creating warehouses and locations...');
  
  const warehouses = await Promise.all([
    // Main warehouse
    prisma.warehouse.create({
      data: {
        organizationId,
        code: 'WH-MAIN',
        name: 'Main Distribution Center',
        line1: '100 Logistics Way',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'US',
      }
    }),
    // East coast warehouse
    prisma.warehouse.create({
      data: {
        organizationId,
        code: 'WH-EAST',
        name: 'East Coast Fulfillment',
        line1: '200 Commerce Drive',
        city: 'Newark',
        state: 'NJ',
        postalCode: '07102',
        country: 'US',
      }
    }),
    // Central warehouse
    prisma.warehouse.create({
      data: {
        organizationId,
        code: 'WH-CENTRAL',
        name: 'Central Distribution',
        line1: '300 Industrial Blvd',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'US',
      }
    }),
    // Returns warehouse
    prisma.warehouse.create({
      data: {
        organizationId,
        code: 'WH-RETURNS',
        name: 'Returns Processing Center',
        line1: '400 Return Lane',
        city: 'Las Vegas',
        state: 'NV',
        postalCode: '89101',
        country: 'US',
      }
    }),
  ]);

  // Create locations for each warehouse
  const allLocations = [];
  for (const warehouse of warehouses) {
    const zones = ['A', 'B', 'C'];
    const locations = [];
    
    for (const zone of zones) {
      for (let aisle = 1; aisle <= 4; aisle++) {
        for (let shelf = 1; shelf <= 3; shelf++) {
          const location = await prisma.location.create({
            data: {
              organizationId,
              warehouseId: warehouse.id,
              code: `${warehouse.code}-${zone}-${aisle}-${shelf}`,
              zone,
              aisle: aisle.toString(),
              shelf: shelf.toString(),
                  }
          });
          locations.push(location);
        }
      }
    }
    allLocations.push(...locations);
  }

  console.log(`✅ Created ${warehouses.length} warehouses with ${allLocations.length} locations`);
  return { warehouses, locations: allLocations };
}

async function seedSuppliers(organizationId: string) {
  console.log('🏭 Creating suppliers...');
  
  const suppliers = [
    {
      supplierCode: 'SUP-TECH-001',
      name: 'TechWorld Distributors',
      email: 'orders@techworld.com',
      phone: '(555) 123-4567',
      line1: '500 Technology Drive',
      city: 'San Jose',
      state: 'CA',
      postalCode: '95110',
      contacts: [
        { firstName: 'John', lastName: 'Tech', role: 'Account Manager', email: 'john@techworld.com', phone: '(555) 123-4567' },
        { firstName: 'Sarah', lastName: 'Sales', role: 'Sales Director', email: 'sarah@techworld.com', phone: '(555) 123-4568' },
      ]
    },
    {
      supplierCode: 'SUP-OFFICE-001',
      name: 'Office Essentials Inc',
      email: 'bulk@officeessentials.com',
      phone: '(555) 234-5678',
      line1: '600 Supply Street',
      city: 'Dallas',
      state: 'TX',
      postalCode: '75201',
      contacts: [
        { firstName: 'Mike', lastName: 'Manager', role: 'Procurement Lead', email: 'mike@officeessentials.com', phone: '(555) 234-5678' },
      ]
    },
    {
      supplierCode: 'SUP-FURN-001',
      name: 'Premium Furniture Co',
      email: 'sales@premiumfurniture.com',
      phone: '(555) 345-6789',
      line1: '700 Design Boulevard',
      city: 'Grand Rapids',
      state: 'MI',
      postalCode: '49501',
      contacts: [
        { firstName: 'Lisa', lastName: 'Designer', role: 'Sales Representative', email: 'lisa@premiumfurniture.com', phone: '(555) 345-6789' },
      ]
    },
  ];

  const createdSuppliers = [];
  for (const supplierData of suppliers) {
    const { contacts, ...supplierInfo } = supplierData;
    
    const supplier = await prisma.supplier.create({
      data: {
        organizationId,
        ...supplierInfo,
        country: 'US',
        paymentTerms: 'Net 30',
      }
    });

    // Create contacts
    for (const contact of contacts) {
      await prisma.supplierContact.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          ...contact,
        }
      });
    }

    createdSuppliers.push(supplier);
  }

  console.log(`✅ Created ${createdSuppliers.length} suppliers with contacts`);
  return createdSuppliers;
}

async function seedItems(organizationId: string, categories: any, units: any, suppliers: any[]) {
  console.log('📦 Creating items...');
  
  const items = [];

  // Electronics items
  const electronicsItems = [
    { name: 'Laptop Pro 15"', description: 'High-performance laptop with 15" display', price: 1299.99, cost: 899.99 },
    { name: 'Wireless Mouse', description: 'Ergonomic wireless mouse with precision tracking', price: 49.99, cost: 25.99 },
    { name: 'USB-C Hub', description: '7-in-1 USB-C hub with multiple ports', price: 79.99, cost: 35.99 },
    { name: '27" 4K Monitor', description: 'Professional 4K monitor with HDR', price: 599.99, cost: 399.99 },
    { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard with Cherry MX switches', price: 149.99, cost: 89.99 },
    { name: 'Webcam HD', description: '1080p HD webcam with auto-focus', price: 89.99, cost: 45.99 },
    { name: 'Wireless Headset', description: 'Noise-canceling wireless headset', price: 199.99, cost: 129.99 },
    { name: 'External SSD 1TB', description: 'Portable SSD with 1TB capacity', price: 179.99, cost: 119.99 },
    { name: 'Docking Station', description: 'Universal laptop docking station', price: 249.99, cost: 169.99 },
    { name: 'Surge Protector', description: '6-outlet surge protector with USB', price: 39.99, cost: 19.99 },
    { name: 'HDMI Cable 6ft', description: 'High-speed HDMI 2.1 cable', price: 24.99, cost: 9.99 },
    { name: 'Laptop Stand', description: 'Adjustable aluminum laptop stand', price: 59.99, cost: 29.99 },
    { name: 'Cable Management Kit', description: 'Complete cable organization solution', price: 34.99, cost: 14.99 },
    { name: 'Wireless Charger', description: 'Fast wireless charging pad', price: 44.99, cost: 22.99 },
    { name: 'USB Flash Drive 64GB', description: 'High-speed USB 3.0 flash drive', price: 29.99, cost: 12.99 },
  ];

  for (let i = 0; i < electronicsItems.length; i++) {
    const item = await prisma.item.create({
      data: {
        organizationId,
        sku: generateSKU('Electronics', i + 1),
        name: electronicsItems[i].name,
        description: electronicsItems[i].description,
        categoryId: categories.electronics.id,
        uomId: units.each.id,
        defaultSupplierId: suppliers[0].id,
        defaultPrice: new Decimal(electronicsItems[i].price),
        defaultCost: new Decimal(electronicsItems[i].cost),
        reorderPoint: Math.floor(Math.random() * 20) + 10,
        reorderQty: Math.floor(Math.random() * 50) + 50,
      }
    });
    items.push(item);
  }

  // Office supplies items
  const officeItems = [
    { name: 'Copy Paper A4 (500 sheets)', description: 'Premium white copy paper', price: 8.99, cost: 4.99 },
    { name: 'Gel Pens (12 pack)', description: 'Smooth writing gel pens in assorted colors', price: 14.99, cost: 7.99 },
    { name: 'Stapler Heavy Duty', description: 'Heavy-duty stapler with 100-sheet capacity', price: 29.99, cost: 16.99 },
    { name: 'File Folders (50 pack)', description: 'Manila file folders, letter size', price: 19.99, cost: 9.99 },
    { name: 'Desk Organizer', description: 'Multi-compartment desk organizer', price: 34.99, cost: 18.99 },
    { name: 'Whiteboard Markers (8 pack)', description: 'Dry erase markers in assorted colors', price: 12.99, cost: 6.99 },
    { name: 'Sticky Notes (12 pads)', description: '3x3 inch sticky notes, assorted colors', price: 16.99, cost: 8.99 },
    { name: 'Paper Clips (1000 count)', description: 'Standard paper clips in bulk', price: 9.99, cost: 4.99 },
    { name: 'Binder 3-Ring', description: '3-inch capacity 3-ring binder', price: 11.99, cost: 5.99 },
    { name: 'Calculator Desktop', description: '12-digit desktop calculator', price: 24.99, cost: 12.99 },
    { name: 'Tape Dispenser', description: 'Heavy base tape dispenser', price: 15.99, cost: 7.99 },
    { name: 'Scissors Professional', description: '8-inch professional scissors', price: 18.99, cost: 9.99 },
    { name: 'Notebook Spiral (5 pack)', description: 'College-ruled spiral notebooks', price: 22.99, cost: 11.99 },
    { name: 'Highlighters (6 pack)', description: 'Fluorescent highlighters', price: 8.99, cost: 3.99 },
    { name: 'Rubber Stamps Custom', description: 'Customizable rubber stamps', price: 19.99, cost: 10.99 },
  ];

  for (let i = 0; i < officeItems.length; i++) {
    const item = await prisma.item.create({
      data: {
        organizationId,
        sku: generateSKU('Office', i + 1),
        name: officeItems[i].name,
        description: officeItems[i].description,
        categoryId: categories.office.id,
        uomId: units.each.id,
        defaultSupplierId: suppliers[1].id,
        defaultPrice: new Decimal(officeItems[i].price),
        defaultCost: new Decimal(officeItems[i].cost),
        reorderPoint: Math.floor(Math.random() * 50) + 25,
        reorderQty: Math.floor(Math.random() * 100) + 100,
      }
    });
    items.push(item);
  }

  // Furniture items
  const furnitureItems = [
    { name: 'Executive Desk', description: 'L-shaped executive desk with storage', price: 899.99, cost: 599.99 },
    { name: 'Ergonomic Office Chair', description: 'High-back ergonomic chair with lumbar support', price: 599.99, cost: 399.99 },
    { name: 'Bookshelf 5-Tier', description: 'Modern 5-tier bookshelf', price: 249.99, cost: 149.99 },
    { name: 'Filing Cabinet 4-Drawer', description: 'Lockable 4-drawer filing cabinet', price: 399.99, cost: 249.99 },
    { name: 'Conference Table 8ft', description: '8-foot conference table with cable management', price: 1299.99, cost: 899.99 },
    { name: 'Guest Chair', description: 'Comfortable guest seating', price: 199.99, cost: 119.99 },
    { name: 'Standing Desk Converter', description: 'Adjustable desk converter for standing', price: 349.99, cost: 229.99 },
    { name: 'Storage Cabinet', description: 'Tall storage cabinet with shelves', price: 449.99, cost: 299.99 },
    { name: 'Reception Desk', description: 'Modern reception desk with counter', price: 1599.99, cost: 1099.99 },
    { name: 'Meeting Room Chairs (4)', description: 'Set of 4 meeting room chairs', price: 799.99, cost: 549.99 },
    { name: 'Whiteboard Mobile', description: 'Mobile whiteboard on wheels', price: 299.99, cost: 179.99 },
    { name: 'Coat Rack Stand', description: 'Freestanding coat rack', price: 149.99, cost: 89.99 },
    { name: 'Side Table', description: 'Modern side table with drawer', price: 179.99, cost: 109.99 },
    { name: 'Monitor Arm Dual', description: 'Dual monitor desk mount', price: 129.99, cost: 79.99 },
    { name: 'Desk Lamp LED', description: 'Adjustable LED desk lamp', price: 89.99, cost: 49.99 },
  ];

  for (let i = 0; i < furnitureItems.length; i++) {
    const item = await prisma.item.create({
      data: {
        organizationId,
        sku: generateSKU('Furniture', i + 1),
        name: furnitureItems[i].name,
        description: furnitureItems[i].description,
        categoryId: categories.furniture.id,
        uomId: units.each.id,
        defaultSupplierId: suppliers[2].id,
        defaultPrice: new Decimal(furnitureItems[i].price),
        defaultCost: new Decimal(furnitureItems[i].cost),
        reorderPoint: Math.floor(Math.random() * 10) + 5,
        reorderQty: Math.floor(Math.random() * 20) + 10,
      }
    });
    items.push(item);
  }

  console.log(`✅ Created ${items.length} items across ${Object.keys(categories).length} categories`);
  return items;
}

async function seedInventory(organizationId: string, items: any[], locations: any[]) {
  console.log('📊 Creating inventory records...');
  
  const inventoryRecords = [];
  
  // Distribute items across locations
  for (const item of items) {
    // Each item in 2-4 random locations
    const numLocations = Math.floor(Math.random() * 3) + 2;
    const selectedLocations = [...locations].sort(() => 0.5 - Math.random()).slice(0, numLocations);
    
    for (const location of selectedLocations) {
      const qtyOnHand = Math.floor(Math.random() * 200) + 50;
      const qtyReserved = Math.floor(Math.random() * Math.min(30, qtyOnHand));
      
      const inventory = await prisma.inventory.create({
        data: {
          organizationId,
          itemId: item.id,
          locationId: location.id,
          qtyOnHand,
          qtyReserved,
          qtyInTransit: 0,
          lastCountedAt: faker.date.recent({ days: 30 }),
        }
      });
      inventoryRecords.push(inventory);
    }
  }

  // Create some lots for traceable items
  const traceableItems = items.slice(0, 10); // First 10 items are lot-tracked
  for (const item of traceableItems) {
    for (let i = 0; i < 3; i++) {
      const expiryDate = faker.date.future({ years: 2 });
      const lot = await prisma.lot.create({
        data: {
          organizationId,
          itemId: item.id,
          lotNumber: generateLotNumber(new Date(), i + 1),
          expirationDate: expiryDate,
          manufactureDate: faker.date.recent({ days: 90 }),
          receivedDate: faker.date.recent({ days: 60 }),
          unitCost: item.defaultCost || new Decimal(100),
          qtyInitial: 100,
          qtyOnHand: Math.floor(Math.random() * 80) + 20,
        }
      });
    }
  }

  // Create low-stock test scenarios
  console.log('🚨 Creating low-stock test items...');
  
  // Critical stock items (first 5 items have 0-4 units)
  for (let i = 0; i < Math.min(5, items.length); i++) {
    const item = items[i];
    const location = locations[0];
    
    // Find existing inventory record
    const existingInventory = inventoryRecords.find(
      inv => inv.itemId === item.id && inv.locationId === location.id
    );
    
    if (existingInventory) {
      await prisma.inventory.update({
        where: { id: existingInventory.id },
        data: {
          qtyOnHand: Math.floor(Math.random() * 5), // 0-4 units
          qtyReserved: 0
        }
      });
    }
  }
  
  // Below reorder point items (next 5 items)
  for (let i = 5; i < Math.min(10, items.length); i++) {
    const item = items[i];
    const location = locations[0];
    
    const existingInventory = inventoryRecords.find(
      inv => inv.itemId === item.id && inv.locationId === location.id
    );
    
    if (existingInventory && item.reorderPoint > 0) {
      const belowReorderQty = Math.max(1, item.reorderPoint - Math.floor(Math.random() * 5) - 1);
      await prisma.inventory.update({
        where: { id: existingInventory.id },
        data: {
          qtyOnHand: belowReorderQty,
          qtyReserved: 0
        }
      });
    }
  }
  
  // Zero stock items (next 3 items)
  for (let i = 10; i < Math.min(13, items.length); i++) {
    const item = items[i];
    const location = locations[0];
    
    const existingInventory = inventoryRecords.find(
      inv => inv.itemId === item.id && inv.locationId === location.id
    );
    
    if (existingInventory) {
      await prisma.inventory.update({
        where: { id: existingInventory.id },
        data: {
          qtyOnHand: 0,
          qtyReserved: 0
        }
      });
    }
  }
  
  console.log('  ✓ Items 1-5: Critical stock (0-4 units)');
  console.log('  ✓ Items 6-10: Below reorder point');
  console.log('  ✓ Items 11-13: Zero stock');
  console.log(`✅ Created ${inventoryRecords.length} inventory records with test scenarios`);
  
  return inventoryRecords;
}

async function seedCustomers(organizationId: string) {
  console.log('👥 Creating customers...');
  
  const customers = [];
  
  for (let i = 0; i < 25; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const company = faker.company.name();
    
    const customer = await prisma.customer.create({
      data: {
        organizationId,
        customerCode: `CUST-${String(i + 1).padStart(4, '0')}`,
        companyName: company,
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        phone: faker.phone.number('(###) ###-####'),
        taxId: faker.string.numeric(9),
        defaultPaymentTerms: faker.helpers.arrayElement(['Net 30', 'Net 60', 'Due on Receipt']),
      }
    });

    // Create billing address
    await prisma.address.create({
      data: {
        organizationId,
        customerId: customer.id,
        addressType: 'BILLING',
        line1: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'US',
        isDefault: true,
      }
    });

    // Create shipping address (sometimes same as billing)
    if (Math.random() > 0.3) {
      await prisma.address.create({
        data: {
          organizationId,
          customerId: customer.id,
          addressType: 'SHIPPING',
          line1: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          postalCode: faker.location.zipCode(),
          country: 'US',
          isDefault: true,
        }
      });
    }

    customers.push(customer);
  }

  console.log(`✅ Created ${customers.length} customers with addresses`);
  return customers;
}

async function seedOrders(
  organizationId: string,
  customers: any[],
  items: any[],
  warehouses: any[],
  shippingMethods: any[],
  paymentMethods: any[],
  userId: string
) {
  console.log('🛒 Creating sales orders...');
  
  const orders = [];
  const statuses = ['PENDING', 'CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  
  for (let i = 0; i < 35; i++) {
    const customer = faker.helpers.arrayElement(customers);
    const orderDate = faker.date.recent({ days: 90 });
    const status = faker.helpers.arrayElement(statuses);
    
    const order = await prisma.order.create({
      data: {
        organizationId,
        orderNumber: `ORD-${new Date().getFullYear()}-${String(i + 1).padStart(5, '0')}`,
        customerId: customer.id,
        status,
        orderDate,
        requestedShipDate: faker.date.soon({ days: 7, refDate: orderDate }),
        subtotal: new Decimal(0),
        taxTotal: new Decimal(0),
        shippingTotal: new Decimal(faker.number.float({ min: 10, max: 50, precision: 0.01 })),
        grandTotal: new Decimal(0),
        notes: faker.helpers.maybe(() => faker.commerce.productDescription(), { probability: 0.3 }),
        createdById: userId,
      }
    });

    // Add 1-5 items to the order
    const numItems = Math.floor(Math.random() * 5) + 1;
    const orderItems = faker.helpers.arrayElements(items, numItems);
    let subtotal = new Decimal(0);

    for (const item of orderItems) {
      const quantity = Math.floor(Math.random() * 10) + 1;
      const unitPrice = item.defaultPrice;
      const lineTotal = unitPrice.mul(quantity);
      
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          itemId: item.id,
          qtyOrdered: quantity,
          qtyShipped: ['SHIPPED', 'DELIVERED'].includes(status) ? quantity : 0,
          unitPrice,
          totalPrice: lineTotal,
          organizationId,
        }
      });
      
      subtotal = subtotal.add(lineTotal);
    }

    // Update order totals
    const taxTotal = subtotal.mul(0.0875); // 8.75% tax
    const grandTotal = subtotal.add(taxTotal).add(order.shippingTotal);
    
    await prisma.order.update({
      where: { id: order.id },
      data: {
        subtotal,
        taxTotal,
        grandTotal,
      }
    });

    orders.push(order);
  }

  console.log(`✅ Created ${orders.length} sales orders`);
  return orders;
}

async function seedPurchaseOrders(
  organizationId: string,
  suppliers: any[],
  items: any[],
  warehouses: any[],
  userId: string
) {
  console.log('📦 Creating purchase orders...');
  
  const purchaseOrders = [];
  const statuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED'];
  
  for (let i = 0; i < 20; i++) {
    const supplier = faker.helpers.arrayElement(suppliers);
    const orderDate = faker.date.recent({ days: 60 });
    const status = faker.helpers.arrayElement(statuses);
    
    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId,
        poNumber: `PO-${new Date().getFullYear()}-${String(i + 1).padStart(5, '0')}`,
        supplierId: supplier.id,
        status,
        orderDate,
        expectedDate: faker.date.soon({ days: 14, refDate: orderDate }),
        subtotal: new Decimal(0),
        tax: new Decimal(0),
        total: new Decimal(0),
        notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
        createdById: userId,
      }
    });

    // Add items from this supplier
    const supplierItems = items.filter(item => item.defaultSupplierId === supplier.id);
    const numItems = Math.min(Math.floor(Math.random() * 5) + 1, supplierItems.length);
    const poItems = faker.helpers.arrayElements(supplierItems, numItems);
    let subtotal = new Decimal(0);

    for (const item of poItems) {
      const quantity = Math.floor(Math.random() * 100) + 10;
      const unitCost = item.defaultCost;
      const lineTotal = unitCost.mul(quantity);
      
      await prisma.purchaseOrderItem.create({
        data: {
          poId: po.id,
          itemId: item.id,
          qtyOrdered: quantity,
          qtyReceived: ['RECEIVED', 'PARTIAL'].includes(status) 
            ? Math.floor(quantity * (status === 'RECEIVED' ? 1 : 0.7))
            : 0,
          unitCost,
          totalCost: lineTotal,
          organizationId,
        }
      });
      
      subtotal = subtotal.add(lineTotal);
    }

    // Update PO totals
    const tax = subtotal.mul(0.0875);
    const total = subtotal.add(tax);
    
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        subtotal,
        tax,
        total,
      }
    });

    purchaseOrders.push(po);
  }

  console.log(`✅ Created ${purchaseOrders.length} purchase orders`);
  return purchaseOrders;
}

async function seedStockMovements(
  organizationId: string,
  inventoryRecords: any[],
  items: any[],
  userId: string
) {
  console.log('📈 Creating stock movements...');
  
  const movementTypes = ['INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'TRANSFER', 'RETURN', 'DAMAGE', 'LOSS'];
  const movements = [];
  
  // Create a map of item costs for quick lookup
  const itemCostMap = new Map(items.map(item => [item.id, item.defaultCost]));
  
  // Create historical movements for the last 90 days
  for (let i = 0; i < 200; i++) {
    const inventory = faker.helpers.arrayElement(inventoryRecords);
    const movementType = faker.helpers.arrayElement(movementTypes);
    const quantity = Math.floor(Math.random() * 50) + 1;
    const isPositive = ['INBOUND', 'RETURN', 'ADJUSTMENT'].includes(movementType) && Math.random() > 0.3;
    const unitCost = itemCostMap.get(inventory.itemId) || new Decimal(0);
    
    const movement = await prisma.stockMovement.create({
      data: {
        organizationId,
        itemId: inventory.itemId,
        fromLocationId: ['OUTBOUND', 'TRANSFER', 'DAMAGE', 'LOSS'].includes(movementType) ? inventory.locationId : undefined,
        toLocationId: ['INBOUND', 'TRANSFER', 'RETURN'].includes(movementType) ? inventory.locationId : undefined,
        movementType,
        qty: isPositive ? quantity : -quantity,
        refType: movementType === 'INBOUND' ? 'PURCHASE_ORDER' : 'ORDER',
        refId: faker.string.uuid(),
        notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
        movedAt: faker.date.recent({ days: 90 }),
        movedById: userId,
      }
    });
    movements.push(movement);
  }

  console.log(`✅ Created ${movements.length} stock movements`);
  return movements;
}

async function main() {
  console.log('🌱 Starting single organization comprehensive seed...\n');

  try {
    // Clear entire database first
    await clearDatabase();

    // Create users
    const { admin, manager, employee, user } = await seedUsers();

    // Create organization with members
    const organization = await seedOrganization(admin, manager, employee);

    // Create basic data structures
    const basicData = await seedBasicData(organization.id);

    // Create warehouses and locations
    const { warehouses, locations } = await seedWarehouses(organization.id);

    // Create suppliers
    const suppliers = await seedSuppliers(organization.id);

    // Create items
    const items = await seedItems(
      organization.id,
      basicData.categories,
      basicData.units,
      suppliers
    );

    // Create inventory
    const inventoryRecords = await seedInventory(organization.id, items, locations);

    // Create customers
    const customers = await seedCustomers(organization.id);

    // Create sales orders
    const orders = await seedOrders(
      organization.id,
      customers,
      items,
      warehouses,
      basicData.shippingMethods,
      basicData.paymentMethods,
      admin.id
    );

    // Create purchase orders
    const purchaseOrders = await seedPurchaseOrders(
      organization.id,
      suppliers,
      items,
      warehouses,
      admin.id
    );

    // Create stock movements
    await seedStockMovements(organization.id, inventoryRecords, items, admin.id);

    // Success summary
    console.log('\n✅ Single organization comprehensive seed completed!\n');
    console.log('📊 Summary:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('👤 Users:');
    console.log('  • admin@ventry.com / password123 (ADMIN role)');
    console.log('  • manager@ventry.com / password123 (MANAGER role)');
    console.log('  • employee@ventry.com / password123 (EMPLOYEE role)');
    console.log('  • user@ventry.com / password123 (USER role - no org access)');
    console.log('\n🏢 Organization: Ventry Corporation');
    console.log(`  • ${items.length} products across ${Object.keys(basicData.categories).length} categories`);
    console.log(`  • ${warehouses.length} warehouses with ${locations.length} locations`);
    console.log(`  • ${suppliers.length} suppliers with contacts`);
    console.log(`  • ${customers.length} customers with addresses`);
    console.log(`  • ${orders.length} sales orders`);
    console.log(`  • ${purchaseOrders.length} purchase orders`);
    console.log(`  • ${inventoryRecords.length} inventory records`);
    console.log('  • 200+ stock movements (90-day history)');
    console.log('  • Payment methods, shipping carriers, and more');
    console.log('═══════════════════════════════════════════════════════════════');

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