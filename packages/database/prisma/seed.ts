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
      organizationId,
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
          organizationId,
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
  
  // Get admin user for created by fields
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@ventry.com' }
  });

  if (!adminUser) {
    console.log('⚠️ Admin user not found, skipping inventory operations');
    return;
  }
  
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
          organizationId,
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
          organizationId,
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
        organizationId,
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
        organizationId,
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
        taxTotal: tax,
        grandTotal: subtotal + tax,
        notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        createdById: adminUser.id,
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

async function seedShippingAndPaymentMethods(organizationId: string) {
  if (!isComprehensive) return;
  
  console.log('💳 Creating payment methods and shipping options...');
  
  // Create payment methods
  const paymentMethods = [
    { methodName: 'Credit Card', provider: 'Stripe', detailsJson: { acceptedCards: ['Visa', 'MasterCard', 'AMEX'] }, isActive: true },
    { methodName: 'Wire Transfer', provider: 'Bank', detailsJson: { type: 'wire' }, isActive: true },
    { methodName: 'ACH Transfer', provider: 'Bank', detailsJson: { type: 'ach' }, isActive: true },
    { methodName: 'Check', provider: null, detailsJson: null, isActive: true },
    { methodName: 'Cash', provider: null, detailsJson: null, isActive: true },
    { methodName: 'Net 30', provider: null, detailsJson: { terms: 30 }, isActive: true },
    { methodName: 'Net 60', provider: null, detailsJson: { terms: 60 }, isActive: true },
  ];

  const createdPaymentMethods = [];
  for (const method of paymentMethods) {
    const created = await prisma.paymentMethod.create({
      data: {
        organizationId,
        ...method
      }
    });
    createdPaymentMethods.push(created);
  }
  
  // Create carriers
  const carriers = [
    { name: 'FedEx', website: 'https://www.fedex.com', trackingUrlTpl: 'https://www.fedex.com/fedextrack/?tracknumbers={tracking}' },
    { name: 'UPS', website: 'https://www.ups.com', trackingUrlTpl: 'https://www.ups.com/track?tracknum={tracking}' },
    { name: 'USPS', website: 'https://www.usps.com', trackingUrlTpl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}' },
    { name: 'DHL Express', website: 'https://www.dhl.com', trackingUrlTpl: 'https://www.dhl.com/en/express/tracking.html?AWB={tracking}' },
    { name: 'Local Delivery', website: null, trackingUrlTpl: null },
  ];

  const createdCarriers = [];
  for (const carrier of carriers) {
    const existing = await prisma.carrier.findFirst({
      where: { name: carrier.name }
    });
    
    if (!existing) {
      const created = await prisma.carrier.create({
        data: {
          organizationId,
          ...carrier
        }
      });
      createdCarriers.push(created);
    } else {
      createdCarriers.push(existing);
    }
  }
  
  // Create shipping methods
  const shippingMethods = [
    { serviceName: 'Standard Shipping', carrierId: createdCarriers[0].id, transitDays: 7, baseCost: 9.99 },
    { serviceName: 'Express Shipping', carrierId: createdCarriers[0].id, transitDays: 3, baseCost: 19.99 },
    { serviceName: 'Overnight Shipping', carrierId: createdCarriers[0].id, transitDays: 1, baseCost: 39.99 },
    { serviceName: 'Ground Shipping', carrierId: createdCarriers[1].id, transitDays: 5, baseCost: 12.99 },
    { serviceName: 'Priority Mail', carrierId: createdCarriers[2].id, transitDays: 3, baseCost: 8.99 },
    { serviceName: 'Local Delivery', carrierId: createdCarriers[4].id, transitDays: 0, baseCost: 15.00 },
  ];

  const createdShippingMethods = [];
  for (const method of shippingMethods) {
    const created = await prisma.shippingMethod.create({
      data: {
        organizationId,
        ...method
      }
    });
    createdShippingMethods.push(created);
  }
  
  console.log(`💳 Created ${createdPaymentMethods.length} payment methods`);
  console.log(`🚚 Created ${createdCarriers.length} carriers`);
  console.log(`📦 Created ${createdShippingMethods.length} shipping methods`);
  
  return { paymentMethods: createdPaymentMethods, carriers: createdCarriers, shippingMethods: createdShippingMethods };
}

async function seedCustomerAddresses(organizationId: string, customers: any[]) {
  if (!isComprehensive || !customers) return;
  
  console.log('🏠 Creating customer addresses...');
  
  let addressCount = 0;
  for (const customer of customers) {
    // Create billing address
    const billingAddress = await prisma.address.create({
      data: {
        organizationId,
        customerId: customer.id,
        addressType: 'BILLING',
        isDefault: true,
        line1: faker.location.streetAddress(),
        line2: faker.datatype.boolean(0.3) ? faker.location.secondaryAddress() : null,
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'US',
        phone: customer.phone,
        attention: `${customer.firstName} ${customer.lastName}`,
      }
    });
    addressCount++;
    
    // 70% chance of having a different shipping address
    if (faker.datatype.boolean(0.7)) {
      await prisma.address.create({
        data: {
          organizationId,
          customerId: customer.id,
          addressType: 'SHIPPING',
          isDefault: false,
          line1: faker.location.streetAddress(),
          line2: faker.datatype.boolean(0.3) ? faker.location.secondaryAddress() : null,
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          postalCode: faker.location.zipCode(),
          country: 'US',
          phone: customer.phone,
          attention: `${customer.firstName} ${customer.lastName}`,
        }
      });
      addressCount++;
    }
  }
  
  console.log(`🏠 Created ${addressCount} customer addresses`);
}

async function seedPurchaseOrders(organizationId: string, suppliers: any[], items: any[], adminUser: any) {
  if (!isComprehensive || !suppliers || !items || !adminUser) return;
  
  console.log('📋 Creating purchase orders...');
  
  const purchaseOrders = [];
  const poCount = faker.number.int({ min: 15, max: 25 });
  
  for (let i = 1; i <= poCount; i++) {
    const supplier = faker.helpers.arrayElement(suppliers);
    const orderDate = faker.date.recent({ days: 90 });
    const status = faker.helpers.arrayElement(['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED']);
    
    // Create PO items
    const itemCount = faker.number.int({ min: 2, max: 8 });
    const poItems = [];
    let subtotal = 0;
    
    // Select random items, preferring items from this supplier
    const availableItems = items.filter(item => 
      item.defaultSupplierId === supplier.id || faker.datatype.boolean(0.3)
    );
    
    const selectedItems = faker.helpers.arrayElements(availableItems, { min: itemCount, max: itemCount });
    
    for (const item of selectedItems) {
      const qtyOrdered = faker.number.int({ min: 10, max: 200 });
      const unitCost = parseFloat(item.defaultCost) || faker.number.float({ min: 5, max: 500, fractionDigits: 2 });
      const lineTotal = qtyOrdered * unitCost;
      
      let qtyReceived = 0;
      if (status === 'RECEIVED') {
        qtyReceived = qtyOrdered;
      } else if (status === 'PARTIAL') {
        qtyReceived = faker.number.int({ min: 1, max: qtyOrdered - 1 });
      }
      
      poItems.push({
        organizationId,
        itemId: item.id,
        qtyOrdered,
        qtyReceived,
        unitCost,
        totalCost: lineTotal,
        description: item.name
      });
      
      subtotal += lineTotal;
    }
    
    const tax = subtotal * 0.0875; // 8.75% tax
    const total = subtotal + tax;
    
    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId,
        poNumber: `PO-${String(i).padStart(5, '0')}`,
        supplierId: supplier.id,
        status,
        orderDate,
        expectedDate: faker.date.soon({ days: 30, refDate: orderDate }),
        subtotal,
        tax: tax,
        total: total,
        notes: faker.datatype.boolean(0.4) ? faker.lorem.sentence() : null,
        createdById: adminUser.id,
        approvedById: ['APPROVED', 'PARTIAL', 'RECEIVED'].includes(status) ? adminUser.id : null,
        items: {
          create: poItems
        }
      }
    });
    
    purchaseOrders.push(po);
  }
  
  console.log(`📋 Created ${purchaseOrders.length} purchase orders`);
  return purchaseOrders;
}

async function seedReceipts(organizationId: string, purchaseOrders: any[], warehouses: any[], adminUser: any) {
  if (!isComprehensive || !purchaseOrders || !warehouses || !adminUser) return;
  
  console.log('📥 Creating receipts...');
  
  const receipts = [];
  const receivablePOs = purchaseOrders.filter(po => 
    ['APPROVED', 'PARTIAL', 'RECEIVED'].includes(po.status)
  );
  
  for (const po of receivablePOs) {
    // Get PO with items
    const poWithItems = await prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: { items: true }
    });
    
    if (!poWithItems) continue;
    
    // Create one or more receipts for this PO
    const receiptCount = po.status === 'PARTIAL' ? faker.number.int({ min: 1, max: 3 }) : 1;
    
    for (let r = 0; r < receiptCount; r++) {
      const receiptDate = faker.date.between({ 
        from: po.orderDate, 
        to: new Date() 
      });
      
      const warehouse = faker.helpers.arrayElement(warehouses);
      
      // Get locations for this warehouse
      const locations = await prisma.location.findMany({
        where: { warehouseId: warehouse.id },
        take: 5
      });
      
      if (locations.length === 0) continue;
      
      // Create receipt items
      const receiptItems = [];
      for (const poItem of poWithItems.items) {
        const remainingQty = poItem.qtyOrdered - poItem.qtyReceived;
        if (remainingQty > 0) {
          const qtyToReceive = po.status === 'PARTIAL' 
            ? faker.number.int({ min: 1, max: Math.min(remainingQty, 50) })
            : remainingQty;
            
          receiptItems.push({
            organizationId,
            itemId: poItem.itemId,
            qtyReceived: qtyToReceive,
            unitCost: poItem.unitCost,
            locationId: faker.helpers.arrayElement(locations).id,
            expirationDate: faker.datatype.boolean(0.1) ? faker.date.future({ years: 2 }) : null
          });
        }
      }
      
      if (receiptItems.length > 0) {
        const receipt = await prisma.receipt.create({
          data: {
            organizationId,
            poId: po.id,
            receivedDate: receiptDate,
            receivedById: adminUser.id,
            reference: `REC-${faker.string.numeric(5)}`,
            notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
            items: {
              create: receiptItems
            }
          }
        });
        
        receipts.push(receipt);
      }
    }
  }
  
  console.log(`📥 Created ${receipts.length} receipts`);
  return receipts;
}

async function seedShipments(organizationId: string, orders: any[], warehouses: any[], adminUser: any) {
  if (!isComprehensive || !orders || !warehouses || !adminUser) return;
  
  console.log('📤 Creating shipments...');
  
  const shipments = [];
  const shippableOrders = orders.filter(order => 
    ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)
  );
  
  // Get shipping methods
  const shippingMethods = await prisma.shippingMethod.findMany({
    where: { organizationId },
    include: { carrier: true }
  });
  
  for (const order of shippableOrders) {
    // Get order with items
    const orderWithItems = await prisma.order.findUnique({
      where: { id: order.id },
      include: { 
        items: true,
        customer: {
          include: {
            addresses: {
              where: { addressType: 'SHIPPING' }
            }
          }
        }
      }
    });
    
    if (!orderWithItems || orderWithItems.items.length === 0) continue;
    
    const shippingAddress = orderWithItems.customer.addresses[0];
    if (!shippingAddress) continue;
    
    const warehouse = faker.helpers.arrayElement(warehouses);
    const shippingMethod = faker.helpers.arrayElement(shippingMethods);
    
    // Determine shipment status based on order status
    let shipmentStatus = 'PENDING';
    if (order.status === 'DELIVERED') {
      shipmentStatus = 'DELIVERED';
    } else if (order.status === 'SHIPPED') {
      shipmentStatus = faker.helpers.arrayElement(['SHIPPED', 'IN_TRANSIT']);
    } else {
      shipmentStatus = faker.helpers.arrayElement(['PENDING', 'PICKED', 'PACKED']);
    }
    
    // Create shipment items
    const shipmentItems = orderWithItems.items.map(item => ({
      organizationId,
      orderItemId: item.id,
      itemId: item.itemId,
      qtyShipped: item.qtyShipped,
      lotId: null,
      serialId: null
    }));
    
    // Get locations from warehouse for shipping from
    const warehouseLocations = await prisma.location.findMany({
      where: { warehouseId: warehouse.id },
      take: 1
    });
    
    if (warehouseLocations.length === 0) continue;
    
    const shipment = await prisma.shipment.create({
      data: {
        organizationId,
        shipmentNumber: `SHIP-${faker.string.numeric(5)}`,
        orderId: order.id,
        shippedFromLocationId: warehouseLocations[0].id,
        status: shipmentStatus,
        carrierId: shippingMethod.carrier?.id || null,
        carrierService: shippingMethod.serviceName,
        trackingNumber: ['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(shipmentStatus) 
          ? faker.string.alphanumeric(15).toUpperCase() 
          : null,
        shippingCost: shippingMethod.baseCost,
        shipDate: ['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(shipmentStatus)
          ? faker.date.between({ from: order.orderDate, to: new Date() })
          : null,
        expectedDelivery: ['SHIPPED', 'IN_TRANSIT'].includes(shipmentStatus)
          ? faker.date.soon({ days: shippingMethod.transitDays || 3 })
          : shipmentStatus === 'DELIVERED' ? faker.date.recent({ days: 7 }) : null,
        weightKg: faker.number.float({ min: 0.5, max: 50, fractionDigits: 2 }),
        notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        shippedById: adminUser.id,
        items: {
          create: shipmentItems
        }
      }
    });
    
    shipments.push(shipment);
  }
  
  console.log(`📤 Created ${shipments.length} shipments`);
  return shipments;
}

async function seedReturns(organizationId: string, orders: any[], warehouses: any[], adminUser: any) {
  if (!isComprehensive || !orders || !warehouses || !adminUser) return;
  
  console.log('↩️ Creating returns...');
  
  const returns = [];
  const deliveredOrders = orders.filter(order => order.status === 'DELIVERED');
  
  // Create returns for 15% of delivered orders
  const ordersToReturn = faker.helpers.arrayElements(
    deliveredOrders, 
    { min: Math.floor(deliveredOrders.length * 0.1), max: Math.floor(deliveredOrders.length * 0.2) }
  );
  
  for (const order of ordersToReturn) {
    // Get order with items
    const orderWithItems = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true }
    });
    
    if (!orderWithItems || orderWithItems.items.length === 0) continue;
    
    const returnDate = faker.date.between({ from: order.orderDate, to: new Date() });
    const warehouse = faker.helpers.arrayElement(warehouses);
    const status = faker.helpers.arrayElement(['PENDING', 'APPROVED', 'RECEIVED', 'PROCESSED', 'REJECTED']);
    
    // Select items to return (1-3 items)
    const itemsToReturn = faker.helpers.arrayElements(
      orderWithItems.items,
      { min: 1, max: Math.min(3, orderWithItems.items.length) }
    );
    
    const returnItems = itemsToReturn.map(item => {
      const qtyToReturn = faker.number.int({ min: 1, max: item.qtyShipped });
      return {
        organizationId,
        orderItemId: item.id,
        itemId: item.itemId,
        qtyReturned: qtyToReturn,
        reason: faker.helpers.arrayElement(['DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'DAMAGED', 'OTHER']),
        condition: faker.helpers.arrayElement(['NEW', 'OPENED', 'USED', 'DAMAGED']),
        refundAmount: qtyToReturn * parseFloat(item.unitPrice.toString()),
        notes: faker.datatype.boolean(0.5) ? faker.lorem.sentence() : null
      };
    });
    
    const subtotal = returnItems.reduce((sum, item) => sum + item.refundAmount, 0);
    const tax = subtotal * 0.0875;
    
    const returnOrder = await prisma.return.create({
      data: {
        organizationId,
        returnNumber: `RET-${faker.string.numeric(5)}`,
        orderId: order.id,
        customerId: order.customerId,
        status,
        returnDate,
        warehouseId: warehouse.id,
        reason: faker.helpers.arrayElement(['DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CUSTOMER_CHANGED_MIND', 'OTHER']),
        subtotal,
        taxRefund: tax,
        shippingRefund: faker.datatype.boolean(0.3) ? faker.number.float({ min: 5, max: 20, fractionDigits: 2 }) : 0,
        totalRefund: subtotal + tax,
        notes: faker.datatype.boolean(0.4) ? faker.lorem.sentence() : null,
        processedById: ['PROCESSED', 'REJECTED'].includes(status) ? adminUser.id : null,
        processedAt: ['PROCESSED', 'REJECTED'].includes(status) ? faker.date.recent({ days: 7 }) : null,
        items: {
          create: returnItems
        }
      }
    });
    
    returns.push(returnOrder);
  }
  
  console.log(`↩️ Created ${returns.length} returns`);
  return returns;
}

async function seedCycleCountsAndAdjustments(organizationId: string, warehouses: any[], inventory: any[], adminUser: any) {
  if (!isComprehensive || !warehouses || !inventory || !adminUser) return;
  
  console.log('📊 Creating cycle counts and stock adjustments...');
  
  // Create cycle counts
  const cycleCounts = [];
  const cycleCountNum = faker.number.int({ min: 5, max: 10 });
  
  for (let i = 0; i < cycleCountNum; i++) {
    const warehouse = faker.helpers.arrayElement(warehouses);
    const status = faker.helpers.arrayElement(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
    const countDate = faker.date.recent({ days: 60 });
    
    // Get some locations from this warehouse
    const locations = await prisma.location.findMany({
      where: { warehouseId: warehouse.id },
      take: faker.number.int({ min: 3, max: 8 })
    });
    
    if (locations.length === 0) continue;
    
    // Get inventory for these locations
    const locationIds = locations.map(l => l.id);
    const inventoryToCount = await prisma.inventory.findMany({
      where: { 
        locationId: { in: locationIds },
        qtyOnHand: { gt: 0 }
      },
      take: faker.number.int({ min: 5, max: 15 })
    });
    
    if (inventoryToCount.length === 0) continue;
    
    // Create a cycle count for each location
    for (const location of locations) {
      // Get inventory for this specific location
      const locationInventory = inventoryToCount.filter(inv => inv.locationId === location.id);
      if (locationInventory.length === 0) continue;
      
      // Create cycle count items for this location
      const locationCountItems = locationInventory.map(inv => {
        const variance = faker.number.int({ min: -5, max: 5 });
        const countedQty = Math.max(0, inv.qtyOnHand + variance);
        
        return {
          organizationId,
          itemId: inv.itemId,
          qtyCounted: countedQty,
          qtySystem: inv.qtyOnHand,
          variance
        };
      });
      
      const cycleCount = await prisma.cycleCount.create({
        data: {
          organizationId,
          locationId: location.id,
          countDate,
          countedById: adminUser.id,
          status,
          reviewedById: status === 'COMPLETED' ? adminUser.id : null,
          notes: faker.datatype.boolean(0.4) ? faker.lorem.sentence() : null,
          items: {
            create: locationCountItems
          }
        }
      });
      
      cycleCounts.push(cycleCount);
    }
  }
  
  // Create stock adjustments
  const adjustments = [];
  const adjustmentNum = faker.number.int({ min: 10, max: 20 });
  
  // Select random inventory records to adjust
  const inventoryToAdjust = faker.helpers.arrayElements(inventory, { min: adjustmentNum, max: adjustmentNum });
  
  for (const inv of inventoryToAdjust) {
    const adjustmentQty = faker.number.int({ min: -10, max: 10 });
    if (adjustmentQty === 0) continue;
    
    const newQty = Math.max(0, inv.qtyOnHand + adjustmentQty);
    
    const adjustment = await prisma.stockAdjustment.create({
      data: {
        organizationId,
        itemId: inv.itemId,
        locationId: inv.locationId,
        lotId: inv.lotId || null,
        qtyBefore: inv.qtyOnHand,
        qtyAfter: newQty,
        reason: faker.helpers.arrayElement([
          'Cycle count variance',
          'Damaged goods',
          'Lost inventory',
          'Found inventory',
          'Expired product',
          'Quality issue',
          'Administrative adjustment'
        ]),
        notes: faker.lorem.sentence(),
        adjustedById: adminUser.id,
        adjustedAt: faker.date.recent({ days: 30 })
      }
    });
    
    adjustments.push(adjustment);
  }
  
  console.log(`📊 Created ${cycleCounts.length} cycle counts`);
  console.log(`📊 Created ${adjustments.length} stock adjustments`);
  
  return { cycleCounts, adjustments };
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
        
        if (isComprehensive && comprehensiveData) {
          // Create additional comprehensive data for all pages
          await seedShippingAndPaymentMethods(organization.id);
          
          // Get customers to add addresses
          const customers = await prisma.customer.findMany({
            where: { organizationId: organization.id }
          });
          await seedCustomerAddresses(organization.id, customers);
          
          // Create purchase orders
          const purchaseOrders = await seedPurchaseOrders(
            organization.id, 
            comprehensiveData.suppliers, 
            comprehensiveData.items,
            admin
          );
          
          // Create receipts for purchase orders
          await seedReceipts(
            organization.id,
            purchaseOrders,
            comprehensiveData.warehouses,
            admin
          );
          
          // Get orders to create shipments
          const orders = await prisma.order.findMany({
            where: { organizationId: organization.id }
          });
          await seedShipments(
            organization.id,
            orders,
            comprehensiveData.warehouses,
            admin
          );
          
          // Create returns
          await seedReturns(
            organization.id,
            orders,
            comprehensiveData.warehouses,
            admin
          );
          
          // Get inventory for cycle counts
          const inventory = await prisma.inventory.findMany({
            where: { organizationId: organization.id }
          });
          await seedCycleCountsAndAdjustments(
            organization.id,
            comprehensiveData.warehouses,
            inventory,
            admin
          );
        }
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
        console.log('  • 540+ inventory records across multiple locations');
        console.log('  • 365+ historical stock movements (last 90 days)');
        console.log('  • 25+ customers with complete billing/shipping addresses');
        console.log('  • 33+ sales orders across various statuses');
        console.log('  • 15-25 purchase orders with receipts');
        console.log('  • Shipments with tracking for delivered orders');
        console.log('  • Customer returns for quality testing');
        console.log('  • Cycle counts and stock adjustments');
        console.log('  • Payment methods and shipping carriers');
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