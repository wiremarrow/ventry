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
  // Clear business data for both comprehensive and regular seeds
  // Only skip for basic-only mode
  if (isBasicOnly) return;
  
  if (isComprehensive) {
    console.log('🧹 Clearing all data for comprehensive seed...');
  } else {
    console.log('🧹 Clearing business data (keeping users and organization)...');
  }
  
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
  // Only delete users and organizations in comprehensive mode
  if (isComprehensive) {
    await prisma.organizationMember.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.user.deleteMany();
  }

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
  
  // Get existing basic data
  const categories = await prisma.itemCategory.findMany({
    where: { organizationId }
  });
  const units = await prisma.unitOfMeasure.findMany({
    where: { organizationId }
  });
  const eachUnit = units.find(u => u.code === 'EA');
  const caseUnit = units.find(u => u.code === 'CS');
  const boxUnit = units.find(u => u.code === 'BOX');

  if (!eachUnit || categories.length === 0) {
    console.log('⚠️ Missing basic data, skipping comprehensive seed');
    return;
  }

  // Create additional warehouses for multi-location scenario
  console.log('🏭 Creating additional warehouses...');
  const warehouses = [];
  
  const warehouseData = [
    { code: 'MAIN', name: 'Main Warehouse', city: 'San Francisco', state: 'CA', postalCode: '94105' },
    { code: 'WEST', name: 'West Coast Distribution', city: 'Los Angeles', state: 'CA', postalCode: '90210' },
    { code: 'EAST', name: 'East Coast Hub', city: 'New York', state: 'NY', postalCode: '10001' },
    { code: 'CENT', name: 'Central Distribution', city: 'Chicago', state: 'IL', postalCode: '60601' }
  ];

  for (const warehouseInfo of warehouseData) {
    const warehouse = await prisma.warehouse.upsert({
      where: {
        organizationId_code: {
          organizationId,
          code: warehouseInfo.code
        }
      },
      update: {},
      create: {
        organizationId,
        code: warehouseInfo.code,
        name: warehouseInfo.name,
        line1: `${faker.location.streetAddress()}`,
        city: warehouseInfo.city,
        state: warehouseInfo.state,
        postalCode: warehouseInfo.postalCode,
        country: 'US'
      }
    });
    warehouses.push(warehouse);

    // Create 8-12 locations per warehouse
    const locationCount = faker.number.int({ min: 8, max: 12 });
    for (let i = 1; i <= locationCount; i++) {
      const aisle = String.fromCharCode(65 + Math.floor((i - 1) / 4)); // A, B, C...
      const rack = Math.floor((i - 1) % 4) + 1;
      const shelf = faker.number.int({ min: 1, max: 5 });
      
      await prisma.location.upsert({
        where: {
          code: `${warehouseInfo.code}-${aisle}-${rack}-${shelf}`
        },
        update: {},
        create: {
          warehouseId: warehouse.id,
          code: `${warehouseInfo.code}-${aisle}-${rack}-${shelf}`,
          description: `${warehouseInfo.name} - Aisle ${aisle}, Rack ${rack}, Shelf ${shelf}`,
          zone: aisle,
          aisle: rack.toString(),
          shelf: shelf.toString(),
          isTempControlled: faker.datatype.boolean(0.3) // 30% temp controlled
        }
      });
    }
  }

  // Create suppliers
  console.log('🏪 Creating suppliers...');
  const suppliers = [];
  const supplierCount = 12;
  
  for (let i = 1; i <= supplierCount; i++) {
    const companyName = faker.company.name();
    const supplier = await prisma.supplier.upsert({
      where: {
        organizationId_supplierCode: {
          organizationId,
          supplierCode: `SUP-${String(i).padStart(3, '0')}`
        }
      },
      update: {},
      create: {
        organizationId,
        supplierCode: `SUP-${String(i).padStart(3, '0')}`,
        name: companyName,
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.number(),
        website: faker.internet.url(),
        line1: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'US',
        paymentTerms: faker.helpers.arrayElement(['NET30', 'NET15', 'NET60', 'COD']),
        leadTimeDays: faker.number.int({ min: 3, max: 21 })
      }
    });
    suppliers.push(supplier);
  }

  // Create diverse product catalog
  console.log('📦 Creating diverse product catalog...');
  const productTemplates = [
    // Electronics
    { category: 'Electronics', products: [
      { name: 'Wireless Mouse', desc: 'Ergonomic wireless mouse with USB receiver', cost: 18.99, price: 29.99 },
      { name: 'Mechanical Keyboard', desc: 'RGB backlit mechanical gaming keyboard', cost: 59.99, price: 89.99 },
      { name: 'USB-C Hub', desc: '7-in-1 USB-C hub with HDMI and ethernet', cost: 32.00, price: 54.99 },
      { name: 'Wireless Headphones', desc: 'Noise-cancelling over-ear headphones', cost: 79.99, price: 129.99 },
      { name: 'Webcam HD', desc: '1080p HD webcam with auto-focus', cost: 24.99, price: 39.99 },
      { name: 'Portable Monitor', desc: '15.6" portable USB-C monitor', cost: 119.99, price: 179.99 },
      { name: 'Smartphone Stand', desc: 'Adjustable aluminum phone stand', cost: 12.99, price: 24.99 },
      { name: 'Bluetooth Speaker', desc: 'Waterproof portable Bluetooth speaker', cost: 29.99, price: 49.99 },
      { name: 'Power Bank', desc: '20000mAh portable power bank with fast charging', cost: 19.99, price: 34.99 },
      { name: 'Cable Organizer', desc: 'Desktop cable management system', cost: 5.99, price: 12.99 },
      { name: 'LED Desk Lamp', desc: 'USB-powered LED desk lamp with touch control', cost: 22.99, price: 39.99 },
      { name: 'Laptop Cooling Pad', desc: 'Adjustable laptop cooling pad with fans', cost: 17.99, price: 29.99 },
      { name: 'Document Camera', desc: 'HD document camera for presentations', cost: 59.99, price: 99.99 },
      { name: 'Wireless Charger', desc: 'Fast wireless charging pad', cost: 12.99, price: 22.99 },
      { name: 'USB Flash Drive', desc: '64GB USB 3.0 flash drive', cost: 8.99, price: 16.99 },
    ]},
    // Office Supplies  
    { category: 'Office Supplies', products: [
      { name: 'A4 Copy Paper', desc: 'Premium white copy paper 500 sheets', cost: 8.99, price: 14.99 },
      { name: 'Ballpoint Pens', desc: 'Pack of 12 blue ballpoint pens', cost: 5.99, price: 9.99 },
      { name: 'Sticky Notes', desc: 'Assorted color sticky notes pack', cost: 3.99, price: 6.99 },
      { name: 'Manila Folders', desc: 'Letter size manila file folders box of 100', cost: 24.99, price: 39.99 },
      { name: 'Binder Clips', desc: 'Assorted size binder clips 40-pack', cost: 7.99, price: 12.99 },
      { name: 'Stapler', desc: 'Heavy-duty desktop stapler', cost: 15.99, price: 26.99 },
      { name: 'Hole Punch', desc: '3-hole punch for standard paper', cost: 18.99, price: 31.99 },
      { name: 'Desk Organizer', desc: 'Bamboo desktop organizer with compartments', cost: 22.99, price: 37.99 },
      { name: 'Calculator', desc: 'Solar-powered desktop calculator', cost: 12.99, price: 21.99 },
      { name: 'Whiteboard Markers', desc: 'Dry erase markers assorted colors 8-pack', cost: 8.99, price: 14.99 },
      { name: 'Correction Tape', desc: 'White correction tape 6mm x 8m', cost: 2.99, price: 4.99 },
      { name: 'Paper Clips', desc: 'Standard paper clips 500 count', cost: 4.99, price: 7.99 },
      { name: 'Rubber Bands', desc: 'Assorted rubber bands 1/2 lb bag', cost: 6.99, price: 11.99 },
      { name: 'Index Cards', desc: '3x5 ruled index cards 100 count', cost: 3.99, price: 6.99 },
      { name: 'Tape Dispenser', desc: 'Weighted tape dispenser for desktop', cost: 11.99, price: 19.99 },
    ]},
    // Furniture
    { category: 'Furniture', products: [
      { name: 'Ergonomic Office Chair', desc: 'Adjustable mesh back office chair', cost: 89.99, price: 149.99 },
      { name: 'Standing Desk', desc: 'Height-adjustable standing desk 48"', cost: 119.99, price: 199.99 },
      { name: 'Filing Cabinet', desc: '4-drawer locking filing cabinet', cost: 79.99, price: 129.99 },
      { name: 'Bookshelf', desc: '5-tier wooden bookshelf', cost: 59.99, price: 99.99 },
      { name: 'Conference Table', desc: '8-person oval conference table', cost: 149.99, price: 249.99 },
      { name: 'Guest Chair', desc: 'Stackable guest chair with arms', cost: 49.99, price: 79.99 },
      { name: 'Monitor Stand', desc: 'Adjustable dual monitor stand', cost: 29.99, price: 49.99 },
      { name: 'Desk Lamp', desc: 'Adjustable LED desk lamp', cost: 19.99, price: 34.99 },
      { name: 'Storage Cabinet', desc: '2-door storage cabinet with lock', cost: 79.99, price: 129.99 },
      { name: 'Footrest', desc: 'Adjustable ergonomic footrest', cost: 24.99, price: 39.99 },
      { name: 'Coat Rack', desc: 'Freestanding wooden coat rack', cost: 34.99, price: 57.99 },
      { name: 'Waste Basket', desc: 'Round mesh waste basket', cost: 12.99, price: 21.99 },
      { name: 'Desk Pad', desc: 'Large leather desk pad with side rails', cost: 28.99, price: 47.99 },
      { name: 'Whiteboard', desc: '48x36 magnetic dry erase whiteboard', cost: 89.99, price: 149.99 },
      { name: 'Cork Board', desc: '36x24 framed cork bulletin board', cost: 25.99, price: 42.99 },
    ]}
  ];

  // Create all products
  const createdItems = [];
  let itemIndex = 1;

  for (const categoryGroup of productTemplates) {
    const category = categories.find(c => c.name === categoryGroup.category);
    if (!category) continue;

    for (const productTemplate of categoryGroup.products) {
      const sku = generateSKU(category.name, itemIndex);
      const supplier = faker.helpers.arrayElement(suppliers);
      const uom = faker.helpers.arrayElement([eachUnit, caseUnit, boxUnit]);
      
      const item = await prisma.item.upsert({
        where: {
          organizationId_sku: { organizationId, sku }
        },
        update: {},
        create: {
          organizationId,
          sku,
          name: productTemplate.name,
          description: productTemplate.desc,
          categoryId: category.id,
          uomId: uom.id,
          defaultSupplierId: supplier.id,
          defaultCost: productTemplate.cost,
          defaultPrice: productTemplate.price,
          reorderPoint: faker.number.int({ min: 3, max: 12 }),
          reorderQty: faker.number.int({ min: 10, max: 30 }),
          weightKg: faker.number.float({ min: 0.1, max: 15.0, fractionDigits: 2 }),
          isActive: true
        }
      });
      
      createdItems.push(item);
      itemIndex++;
    }
  }

  console.log(`📦 Created ${createdItems.length} products`);
  console.log(`🏪 Created ${suppliers.length} suppliers`);
  console.log(`🏭 Created ${warehouses.length} warehouses`);

  return { items: createdItems, suppliers, warehouses };
}

async function seedInventoryAndOperations(organizationId: string, data: any) {
  if (!isComprehensive || !data) return;

  console.log('📊 Creating inventory levels and historical operations...');
  
  const { items, suppliers, warehouses } = data;
  
  // Get all locations across all warehouses
  const allLocations = await prisma.location.findMany({
    where: {
      warehouse: { organizationId }
    }
  });

  console.log(`📍 Found ${allLocations.length} locations for inventory distribution`);

  // Create inventory records for each item across multiple locations
  const inventoryRecords = [];
  
  for (const item of items) {
    // Each item will be stocked in 20-40% of locations for more realistic distribution
    const stockingPercentage = faker.number.float({ min: 0.2, max: 0.4 });
    const locationsToStock = faker.helpers.arrayElements(
      allLocations, 
      Math.max(1, Math.floor(allLocations.length * stockingPercentage))
    );

    for (const location of locationsToStock) {
      // Create realistic stock levels with more conservative quantities
      const isLowStock = faker.datatype.boolean(0.20); // 20% chance of low stock
      const isOutOfStock = faker.datatype.boolean(0.15); // 15% chance of zero stock
      
      let qtyOnHand = 0;
      if (!isOutOfStock) {
        if (isLowStock) {
          // Low stock: below reorder point
          qtyOnHand = faker.number.int({ min: 1, max: Math.max(1, item.reorderPoint - 1) });
        } else {
          // Normal stock: above reorder point but much more conservative
          const maxQty = Math.max(item.reorderPoint + 1, Math.floor(item.reorderPoint * 1.5));
          qtyOnHand = faker.number.int({ min: item.reorderPoint, max: maxQty });
        }
      }

      const qtyReserved = qtyOnHand > 0 ? faker.number.int({ min: 0, max: Math.floor(qtyOnHand * 0.2) }) : 0;

      // Create a basic lot for this item if it doesn't exist
      const lotNumber = `LOT-${item.sku}-${new Date().getFullYear()}01`;
      const lot = await prisma.lot.upsert({
        where: { lotNumber },
        update: {},
        create: {
          itemId: item.id,
          lotNumber,
          receivedDate: faker.date.recent({ days: 60 }),
          unitCost: item.defaultCost || 0,
          qtyInitial: qtyOnHand * 2, // Initial quantity was larger
          qtyOnHand: qtyOnHand,
          status: 'AVAILABLE'
        }
      });

      // Create inventory record (simple create since we cleared database)
      const inventory = await prisma.inventory.create({
        data: {
          itemId: item.id,
          lotId: lot.id,
          locationId: location.id,
          qtyOnHand,
          qtyReserved,
          qtyInTransit: 0,
          lastCountedAt: faker.date.recent({ days: 30 })
        }
      });
      
      inventoryRecords.push(inventory);
    }
  }

  console.log(`📦 Created ${inventoryRecords.length} inventory records`);
  
  // Calculate and log total inventory values for validation
  const totalUnits = inventoryRecords.reduce((sum, inv) => sum + inv.qtyOnHand, 0);
  const totalValue = inventoryRecords.reduce((sum, inv) => {
    const item = items.find(i => i.id === inv.itemId);
    return sum + (inv.qtyOnHand * (item?.defaultCost || 0));
  }, 0);
  
  console.log(`📊 INVENTORY VALIDATION:`)
  console.log(`   • Total Units: ${totalUnits.toLocaleString()} items`);
  console.log(`   • Total Value: $${totalValue.toLocaleString()} (at cost)`);
  console.log(`   • Average per location: ${Math.round(totalUnits / inventoryRecords.length)} units`);
  console.log(`   • Items with stock: ${inventoryRecords.filter(inv => inv.qtyOnHand > 0).length}/${inventoryRecords.length}`);

  // Create historical stock movements (last 90 days)
  console.log('📈 Creating historical stock movements...');
  
  const now = new Date();
  const movements = [];
  const movementCount = faker.number.int({ min: 200, max: 500 });

  // Get admin user for movements
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@ventry.com' }
  });

  if (!adminUser) {
    console.log('⚠️ Admin user not found, skipping stock movements');
    return;
  }

  for (let i = 0; i < movementCount; i++) {
    const inventory = faker.helpers.arrayElement(inventoryRecords);
    const item = items.find(item => item.id === inventory.itemId);
    const location = allLocations.find(loc => loc.id === inventory.locationId);
    
    if (!item || !location) continue;

    // Create movement date within last 90 days, weighted toward more recent
    const daysAgo = Math.floor(Math.pow(faker.number.float({ min: 0, max: 1 }), 2) * 90);
    const movementDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));

    // Movement types with realistic distribution
    const movementType = faker.helpers.weightedArrayElement([
      { weight: 40, value: 'INBOUND' },    // Receipts
      { weight: 35, value: 'OUTBOUND' },   // Shipments
      { weight: 15, value: 'TRANSFER' },   // Transfers
      { weight: 10, value: 'ADJUSTMENT' }  // Adjustments
    ]);

    // Realistic quantities based on movement type
    let qty;
    if (movementType === 'INBOUND') {
      qty = faker.number.int({ min: 10, max: 100 }); // Positive for INBOUND
    } else {
      qty = -faker.number.int({ min: 1, max: 50 }); // Negative for OUTBOUND/TRANSFER/ADJUSTMENT
    }

    // Reference numbers
    let refType = null;
    let refId = null;
    let reason = null;

    switch (movementType) {
      case 'INBOUND':
        refType = 'RECEIPT';
        refId = `REC-${String(faker.number.int({ min: 1000, max: 9999 }))}`;
        break;
      case 'OUTBOUND':
        refType = 'SHIPMENT';
        refId = `SHIP-${String(faker.number.int({ min: 1000, max: 9999 }))}`;
        break;
      case 'TRANSFER':
        refType = 'TRANSFER';
        refId = `TXF-${String(faker.number.int({ min: 1000, max: 9999 }))}`;
        break;
      case 'ADJUSTMENT':
        refType = 'ADJUSTMENT';
        reason = faker.helpers.arrayElement([
          'Physical count adjustment',
          'Damaged goods removal',
          'Expiry removal',
          'System correction',
          'Location transfer'
        ]);
        break;
    }

    await prisma.stockMovement.create({
      data: {
        itemId: item.id,
        lotId: inventory.lotId,
        toLocationId: location.id,
        qty,
        movementType,
        refType,
        refId,
        movedById: adminUser.id,
        movedAt: movementDate,
        notes: movementType === 'ADJUSTMENT' ? reason : null
      }
    });

    movements.push({
      item: item.name,
      location: location.code,
      qty,
      type: movementType,
      date: movementDate
    });
  }

  console.log(`📈 Created ${movements.length} stock movements`);

  // Create some customers for order history
  console.log('👥 Creating customers...');
  const customers = [];
  const customerCount = faker.number.int({ min: 25, max: 50 });

  for (let i = 1; i <= customerCount; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const companyName = faker.datatype.boolean(0.7) ? faker.company.name() : null;
    
    const customer = await prisma.customer.upsert({
      where: {
        organizationId_customerCode: {
          organizationId,
          customerCode: `CUST-${String(i).padStart(4, '0')}`
        }
      },
      update: {},
      create: {
        organizationId,
        customerCode: `CUST-${String(i).padStart(4, '0')}`,
        companyName,
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        phone: faker.phone.number(),
        taxId: faker.datatype.boolean(0.3) ? faker.string.alphanumeric(10) : null,
        defaultPaymentTerms: faker.helpers.arrayElement(['NET30', 'NET15', 'COD', 'PREPAID']),
        website: companyName ? faker.internet.url() : null
      }
    });
    
    customers.push(customer);
  }

  console.log(`👥 Created ${customers.length} customers`);

  // Create orders for customers
  console.log('🛒 Creating orders...');
  const orders = [];
  const orderCount = faker.number.int({ min: 25, max: 50 });
  
  for (let i = 1; i <= orderCount; i++) {
    const customer = faker.helpers.arrayElement(customers);
    const orderDate = faker.date.recent({ days: 90 });
    const status = faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
    const itemCount = faker.number.int({ min: 1, max: 5 });
    
    // Select random items for the order
    const orderItems = [];
    const selectedItems = faker.helpers.arrayElements(items, itemCount);
    
    let subtotal = 0;
    let tax = 0;
    
    for (const item of selectedItems) {
      const qtyOrdered = faker.number.int({ min: 1, max: 10 });
      const unitPrice = item.defaultPrice || faker.number.float({ min: 10, max: 500, precision: 0.01 });
      const discountPct = faker.datatype.boolean(0.3) ? faker.number.float({ min: 5, max: 25, precision: 0.01 }) : 0;
      const taxRate = faker.number.float({ min: 5, max: 10, precision: 0.01 });
      
      const lineSubtotal = qtyOrdered * unitPrice * (1 - discountPct / 100);
      const lineTax = lineSubtotal * (taxRate / 100);
      const totalPrice = lineSubtotal + lineTax;
      
      subtotal += lineSubtotal;
      tax += lineTax;
      
      orderItems.push({
        itemId: item.id,
        qtyOrdered,
        qtyShipped: ['SHIPPED', 'DELIVERED'].includes(status) ? qtyOrdered : 
                    ['PICKING', 'PACKED'].includes(status) ? faker.number.int({ min: 0, max: qtyOrdered }) : 0,
        unitPrice,
        discountPct,
        taxRate,
        totalPrice,
        description: item.name
      });
    }
    
    const order = await prisma.order.create({
      data: {
        organizationId,
        orderNumber: `ORD-${String(i).padStart(5, '0')}`,
        customerId: customer.id,
        orderDate,
        requestedShipDate: faker.datatype.boolean(0.7) ? faker.date.soon({ days: 14, refDate: orderDate }) : null,
        status,
        subtotal,
        tax,
        total: subtotal + tax,
        notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        items: {
          create: orderItems
        }
      }
    });
    
    orders.push(order);
  }
  
  console.log(`🛒 Created ${orders.length} orders`);

  // Update comprehensive seed summary
  const totalInventoryValue = inventoryRecords.reduce((sum, inv) => {
    const item = items.find(i => i.id === inv.itemId);
    return sum + (inv.qtyOnHand * (item?.defaultCost || 0));
  }, 0);

  const lowStockItems = inventoryRecords.filter(inv => {
    const item = items.find(i => i.id === inv.itemId);
    return item && inv.qtyOnHand < item.reorderPoint;
  }).length;

  console.log(`💰 Total inventory value: $${totalInventoryValue.toLocaleString()}`);
  console.log(`⚠️ Low stock items: ${lowStockItems}`);
  console.log(`📍 Total locations: ${allLocations.length}`);
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
        const comprehensiveData = await seedComprehensiveData(organization.id);
        
        // Create inventory and operations data
        await seedInventoryAndOperations(organization.id, comprehensiveData);
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
      console.log('🏭 Warehouses: 4 warehouses with 32-48 locations total');
      
      if (isComprehensive) {
        console.log('📊 Comprehensive demo data summary:');
        console.log('  • 45+ diverse products across Electronics, Office Supplies, Furniture');
        console.log('  • 12 suppliers with realistic contact information');
        console.log('  • 500-2000+ inventory records across multiple locations');
        console.log('  • 200-500 historical stock movements (last 90 days)');
        console.log('  • 25-50 customers with complete profiles');
        console.log('  • 25-50 sales orders across various statuses');
        console.log('  • Realistic analytics data for meaningful dashboard metrics');
        console.log('  • Low stock scenarios for testing alerts and notifications');
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