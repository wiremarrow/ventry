import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Utility function to generate realistic SKUs
function generateSKU(category: string, index: number): string {
  const prefix = category.substring(0, 3).toUpperCase();
  return `${prefix}-${String(index).padStart(4, '0')}`;
}

// Utility function to generate realistic lot numbers
function generateLotNumber(date: Date, index: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `LOT-${year}${month}-${String(index).padStart(4, '0')}`;
}

async function clearDatabase() {
  console.log('🧹 Clearing existing data...');
  
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
  await prisma.userRole.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shippingMethod.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.paymentMethod.deleteMany();
  
  console.log('✅ Database cleared');
}

async function seedUsers() {
  console.log('👤 Seeding users...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const users = [
    {
      email: 'admin@ventry.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      password: hashedPassword,
      role: 'ADMIN' as const,
      isActive: true,
    },
    {
      email: 'manager@ventry.com',
      username: 'manager',
      firstName: 'Manager',
      lastName: 'User',
      password: hashedPassword,
      role: 'MANAGER' as const,
      isActive: true,
    },
    {
      email: 'warehouse@ventry.com',
      username: 'warehouse',
      firstName: 'Warehouse',
      lastName: 'User',
      password: hashedPassword,
      role: 'WAREHOUSE' as const,
      isActive: true,
    },
    {
      email: 'sales@ventry.com',
      username: 'sales',
      firstName: 'Sales',
      lastName: 'User',
      password: hashedPassword,
      role: 'SALES' as const,
      isActive: true,
    },
  ];

  const createdUsers = [];
  for (const userData of users) {
    const user = await prisma.user.create({ data: userData });
    createdUsers.push(user);
    
    // Create employee record
    await prisma.employee.create({
      data: {
        userId: user.id,
        hireDate: faker.date.past({ years: 5 }),
        status: 'ACTIVE',
        salary: faker.number.int({ min: 40000, max: 120000 }),
      },
    });
  }
  
  console.log(`✅ Created ${createdUsers.length} users with employee records`);
  return createdUsers;
}

async function seedUnitsOfMeasure() {
  console.log('📏 Seeding units of measure...');
  
  const units = [
    { code: 'EA', description: 'Each', isBase: true, conversionFactorToBase: 1 },
    { code: 'BOX', description: 'Box', isBase: false, conversionFactorToBase: 12 },
    { code: 'CASE', description: 'Case', isBase: false, conversionFactorToBase: 24 },
    { code: 'PALLET', description: 'Pallet', isBase: false, conversionFactorToBase: 1000 },
    { code: 'KG', description: 'Kilogram', isBase: true, conversionFactorToBase: 1 },
    { code: 'LB', description: 'Pound', isBase: false, conversionFactorToBase: 0.453592 },
    { code: 'L', description: 'Liter', isBase: true, conversionFactorToBase: 1 },
    { code: 'GAL', description: 'Gallon', isBase: false, conversionFactorToBase: 3.78541 },
  ];
  
  const createdUnits = [];
  for (const unit of units) {
    const created = await prisma.unitOfMeasure.create({ data: unit });
    createdUnits.push(created);
  }
  
  console.log(`✅ Created ${createdUnits.length} units of measure`);
  return createdUnits;
}

async function seedCategories() {
  console.log('📁 Seeding categories...');
  
  const categories = [
    { name: 'Electronics', description: 'Electronic devices and components' },
    { name: 'Office Supplies', description: 'General office supplies and stationery' },
    { name: 'Furniture', description: 'Office and warehouse furniture' },
    { name: 'Safety Equipment', description: 'Personal protective equipment and safety gear' },
    { name: 'Packaging', description: 'Boxes, tape, and packaging materials' },
    { name: 'Tools', description: 'Hand and power tools' },
    { name: 'Cleaning', description: 'Cleaning supplies and equipment' },
    { name: 'Food & Beverage', description: 'Consumable food and drink items' },
  ];
  
  const createdCategories = [];
  for (const category of categories) {
    const created = await prisma.itemCategory.create({ data: category });
    createdCategories.push(created);
    
    // Create subcategories
    const subcategories = [
      { name: `${category.name} - Premium`, parentId: created.id },
      { name: `${category.name} - Standard`, parentId: created.id },
    ];
    
    for (const sub of subcategories) {
      await prisma.itemCategory.create({ data: sub });
    }
  }
  
  console.log(`✅ Created ${createdCategories.length} main categories with subcategories`);
  return createdCategories;
}

async function seedWarehouses() {
  console.log('🏭 Seeding warehouses...');
  
  const warehouses = [
    {
      code: 'WH-MAIN',
      name: 'Main Distribution Center',
      phone: faker.phone.number(),
      line1: '100 Logistics Way',
      line2: 'Building A',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'USA',
      notes: 'Primary distribution hub with automated sorting',
    },
    {
      code: 'WH-EAST',
      name: 'East Coast Warehouse',
      phone: faker.phone.number(),
      line1: '200 Harbor Drive',
      city: 'Newark',
      state: 'NJ',
      postalCode: '07102',
      country: 'USA',
      notes: 'Serves Northeast region',
    },
    {
      code: 'WH-WEST',
      name: 'West Coast Warehouse',
      phone: faker.phone.number(),
      line1: '300 Pacific Boulevard',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'USA',
      notes: 'Import receiving and West Coast distribution',
    },
  ];
  
  const createdWarehouses = [];
  for (const warehouse of warehouses) {
    const created = await prisma.warehouse.create({ data: warehouse });
    createdWarehouses.push(created);
    
    // Create locations for each warehouse
    const zones = ['A', 'B', 'C', 'D'];
    for (const zone of zones) {
      for (let aisle = 1; aisle <= 5; aisle++) {
        for (let shelf = 1; shelf <= 4; shelf++) {
          for (let bin = 1; bin <= 3; bin++) {
            await prisma.location.create({
              data: {
                warehouseId: created.id,
                code: `${warehouse.code}-${zone}${aisle}${shelf}${bin}`,
                description: `Zone ${zone}, Aisle ${aisle}, Shelf ${shelf}, Bin ${bin}`,
                zone,
                aisle: String(aisle),
                shelf: String(shelf),
                bin: String(bin),
                maxCapacity: faker.number.int({ min: 100, max: 1000 }),
                isTempControlled: zone === 'D', // Zone D is temperature controlled
              },
            });
          }
        }
      }
    }
  }
  
  console.log(`✅ Created ${createdWarehouses.length} warehouses with locations`);
  return createdWarehouses;
}

async function seedSuppliers() {
  console.log('🏢 Seeding suppliers...');
  
  const suppliers = [];
  for (let i = 1; i <= 20; i++) {
    const supplier = await prisma.supplier.create({
      data: {
        supplierCode: `SUP-${String(i).padStart(4, '0')}`,
        name: faker.company.name(),
        phone: faker.phone.number(),
        email: faker.internet.email(),
        website: faker.internet.url(),
        currencyId: 'USD',
        paymentTerms: faker.helpers.arrayElement(['Net 30', 'Net 45', 'Net 60', '2/10 Net 30']),
        leadTimeDays: faker.number.int({ min: 3, max: 30 }),
        line1: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'USA',
        notes: faker.lorem.sentence(),
      },
    });
    suppliers.push(supplier);
    
    // Create supplier contacts
    const contactCount = faker.number.int({ min: 1, max: 3 });
    for (let j = 0; j < contactCount; j++) {
      await prisma.supplierContact.create({
        data: {
          supplierId: supplier.id,
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: faker.internet.email(),
          phone: faker.phone.number(),
          role: faker.helpers.arrayElement(['Sales Rep', 'Account Manager', 'Technical Support']),
        },
      });
    }
  }
  
  console.log(`✅ Created ${suppliers.length} suppliers with contacts`);
  return suppliers;
}

async function seedItems(categories: any[], units: any[], suppliers: any[]) {
  console.log('📦 Seeding items...');
  
  const items = [];
  let itemIndex = 1;
  
  for (const category of categories) {
    // Create 10-20 items per category
    const itemCount = faker.number.int({ min: 10, max: 20 });
    
    for (let i = 0; i < itemCount; i++) {
      const item = await prisma.item.create({
        data: {
          sku: generateSKU(category.name, itemIndex++),
          upc: faker.string.numeric(12),
          name: `${faker.commerce.productName()} - ${category.name}`,
          description: faker.commerce.productDescription(),
          categoryId: category.id,
          uomId: faker.helpers.arrayElement(units).id,
          defaultSupplierId: faker.helpers.arrayElement(suppliers).id,
          defaultCost: parseFloat(faker.commerce.price({ min: 10, max: 500 })),
          defaultPrice: parseFloat(faker.commerce.price({ min: 20, max: 1000 })),
          weightKg: faker.number.float({ min: 0.1, max: 50, precision: 0.01 }),
          lengthCm: faker.number.float({ min: 5, max: 100, precision: 0.1 }),
          widthCm: faker.number.float({ min: 5, max: 100, precision: 0.1 }),
          heightCm: faker.number.float({ min: 5, max: 100, precision: 0.1 }),
          reorderPoint: faker.number.int({ min: 10, max: 100 }),
          reorderQty: faker.number.int({ min: 50, max: 500 }),
          isActive: true,
        },
      });
      items.push(item);
      
      // Create item images
      const imageCount = faker.number.int({ min: 1, max: 3 });
      for (let j = 0; j < imageCount; j++) {
        await prisma.itemImage.create({
          data: {
            itemId: item.id,
            url: faker.image.url(),
            altText: `${item.name} - Image ${j + 1}`,
            isPrimary: j === 0,
          },
        });
      }
      
      // Create price history
      await prisma.priceHistory.create({
        data: {
          itemId: item.id,
          priceType: 'RETAIL',
          price: item.defaultPrice || 0,
          currencyId: 'USD',
          startDate: new Date(),
        },
      });
    }
  }
  
  console.log(`✅ Created ${items.length} items with images and price history`);
  return items;
}

async function seedInventory(items: any[], warehouses: any[], users: any[]) {
  console.log('📊 Seeding inventory...');
  
  const locations = await prisma.location.findMany();
  let lotIndex = 1;
  let serialIndex = 1;
  let inventoryCount = 0;
  
  for (const item of items) {
    // Create 1-3 lots per item
    const lotCount = faker.number.int({ min: 1, max: 3 });
    
    for (let i = 0; i < lotCount; i++) {
      const receivedDate = faker.date.past({ years: 1 });
      const lot = await prisma.lot.create({
        data: {
          itemId: item.id,
          lotNumber: generateLotNumber(receivedDate, lotIndex++),
          manufactureDate: faker.date.past({ years: 2, refDate: receivedDate }),
          expirationDate: item.categoryId.includes('Food') ? faker.date.future({ years: 2 }) : null,
          receivedDate,
          supplierId: item.defaultSupplierId,
          unitCost: item.defaultCost || 0,
          qtyInitial: faker.number.int({ min: 100, max: 1000 }),
          qtyOnHand: faker.number.int({ min: 50, max: 900 }),
          status: 'AVAILABLE',
        },
      });
      
      // Create serial numbers for high-value items
      if (item.defaultPrice && item.defaultPrice > 500) {
        const serialCount = faker.number.int({ min: 5, max: 20 });
        for (let j = 0; j < serialCount; j++) {
          await prisma.serialNumber.create({
            data: {
              itemId: item.id,
              serialNumber: `SN-${String(serialIndex++).padStart(8, '0')}`,
              lotId: lot.id,
              purchaseDate: lot.receivedDate,
              warrantyExpiration: faker.date.future({ years: 2 }),
              status: 'AVAILABLE',
              locationId: faker.helpers.arrayElement(locations).id,
            },
          });
        }
      }
      
      // Distribute inventory across locations
      const locationCount = faker.number.int({ min: 1, max: 5 });
      const selectedLocations = faker.helpers.arrayElements(locations, locationCount);
      
      for (const location of selectedLocations) {
        const inventory = await prisma.inventory.create({
          data: {
            itemId: item.id,
            lotId: lot.id,
            locationId: location.id,
            qtyOnHand: faker.number.int({ min: 10, max: 200 }),
            qtyReserved: faker.number.int({ min: 0, max: 20 }),
            qtyInTransit: faker.number.int({ min: 0, max: 10 }),
            lastCountedAt: faker.date.recent({ days: 30 }),
          },
        });
        inventoryCount++;
        
        // Create stock movements
        const movementCount = faker.number.int({ min: 2, max: 5 });
        for (let k = 0; k < movementCount; k++) {
          await prisma.stockMovement.create({
            data: {
              itemId: item.id,
              lotId: lot.id,
              fromLocationId: k === 0 ? null : location.id,
              toLocationId: k === 0 ? location.id : null,
              qty: faker.number.int({ min: 5, max: 50 }),
              movementType: faker.helpers.arrayElement(['INBOUND', 'OUTBOUND', 'TRANSFER']),
              movedById: faker.helpers.arrayElement(users).id,
              movedAt: faker.date.recent({ days: 30 }),
              notes: faker.lorem.sentence(),
            },
          });
        }
      }
    }
  }
  
  console.log(`✅ Created ${inventoryCount} inventory records with movements`);
}

async function seedCustomers() {
  console.log('👥 Seeding customers...');
  
  const customers = [];
  for (let i = 1; i <= 50; i++) {
    const customer = await prisma.customer.create({
      data: {
        customerCode: `CUST-${String(i).padStart(5, '0')}`,
        companyName: faker.company.name(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        taxId: faker.string.alphanumeric(10),
        currencyId: 'USD',
        defaultPaymentTerms: faker.helpers.arrayElement(['Net 30', 'Net 45', 'Due on Receipt']),
        website: faker.internet.url(),
      },
    });
    customers.push(customer);
    
    // Create addresses
    const addressCount = faker.number.int({ min: 1, max: 3 });
    for (let j = 0; j < addressCount; j++) {
      await prisma.address.create({
        data: {
          customerId: customer.id,
          addressType: j === 0 ? 'BOTH' : faker.helpers.arrayElement(['BILLING', 'SHIPPING']),
          line1: faker.location.streetAddress(),
          line2: faker.location.secondaryAddress(),
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          postalCode: faker.location.zipCode(),
          country: 'USA',
          phone: faker.phone.number(),
          isDefault: j === 0,
        },
      });
    }
  }
  
  console.log(`✅ Created ${customers.length} customers with addresses`);
  return customers;
}

async function seedOrdersAndShipments(customers: any[], items: any[], users: any[]) {
  console.log('📋 Seeding orders and shipments...');
  
  const paymentMethods = await seedPaymentMethods();
  const carriers = await seedCarriers();
  const locations = await prisma.location.findMany({ take: 10 });
  
  let orderCount = 0;
  let shipmentCount = 0;
  
  for (const customer of customers.slice(0, 30)) { // Create orders for 30 customers
    const orderNum = faker.number.int({ min: 1, max: 3 });
    
    for (let i = 0; i < orderNum; i++) {
      const order = await prisma.order.create({
        data: {
          customerId: customer.id,
          orderNumber: `ORD-${faker.string.alphanumeric(8).toUpperCase()}`,
          status: faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED']),
          orderDate: faker.date.recent({ days: 90 }),
          requestedShipDate: faker.date.future({ years: 0.1 }),
          currencyId: 'USD',
          createdById: faker.helpers.arrayElement(users.filter(u => u.role === 'SALES')).id,
          notes: faker.lorem.sentence(),
        },
      });
      orderCount++;
      
      // Create order items
      const itemCount = faker.number.int({ min: 1, max: 5 });
      const selectedItems = faker.helpers.arrayElements(items, itemCount);
      let subtotal = 0;
      
      for (const item of selectedItems) {
        const qty = faker.number.int({ min: 1, max: 10 });
        const unitPrice = item.defaultPrice || 100;
        const totalPrice = qty * unitPrice;
        subtotal += totalPrice;
        
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            itemId: item.id,
            description: item.name,
            qtyOrdered: qty,
            qtyAllocated: order.status !== 'PENDING' ? qty : 0,
            qtyShipped: ['SHIPPED', 'DELIVERED'].includes(order.status) ? qty : 0,
            unitPrice,
            discountPct: faker.number.float({ min: 0, max: 15, precision: 0.01 }),
            taxRate: 0.08,
            totalPrice,
          },
        });
      }
      
      // Update order totals
      const taxTotal = subtotal * 0.08;
      const grandTotal = subtotal + taxTotal;
      
      await prisma.order.update({
        where: { id: order.id },
        data: {
          subtotal,
          taxTotal,
          grandTotal,
        },
      });
      
      // Create payment if order is confirmed or beyond
      if (['CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            paymentMethodId: faker.helpers.arrayElement(paymentMethods).id,
            amount: grandTotal,
            currencyId: 'USD',
            paymentDate: faker.date.recent({ days: 30 }),
            transactionRef: faker.string.alphanumeric(16),
            status: 'COMPLETED',
            processedById: faker.helpers.arrayElement(users).id,
          },
        });
      }
      
      // Create shipment if order is shipped or delivered
      if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
        const shipment = await prisma.shipment.create({
          data: {
            orderId: order.id,
            shipmentNumber: `SHP-${faker.string.alphanumeric(8).toUpperCase()}`,
            carrierId: faker.helpers.arrayElement(carriers).id,
            carrierService: faker.helpers.arrayElement(['Ground', 'Express', '2-Day', 'Overnight']),
            trackingNumber: faker.string.numeric(20),
            shipDate: faker.date.recent({ days: 20 }),
            expectedDelivery: faker.date.future({ years: 0.02 }),
            shippedFromLocationId: faker.helpers.arrayElement(locations).id,
            shippedById: faker.helpers.arrayElement(users.filter(u => u.role === 'WAREHOUSE')).id,
            status: order.status === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
            weightKg: faker.number.float({ min: 1, max: 50, precision: 0.1 }),
            shippingCost: faker.number.float({ min: 10, max: 100, precision: 0.01 }),
          },
        });
        shipmentCount++;
      }
    }
  }
  
  console.log(`✅ Created ${orderCount} orders with ${shipmentCount} shipments`);
}

async function seedPaymentMethods() {
  console.log('💳 Seeding payment methods...');
  
  const methods = [
    { methodName: 'Credit Card', provider: 'Stripe', isActive: true },
    { methodName: 'ACH Transfer', provider: 'Plaid', isActive: true },
    { methodName: 'Wire Transfer', provider: 'Bank', isActive: true },
    { methodName: 'Check', provider: 'Manual', isActive: true },
    { methodName: 'PayPal', provider: 'PayPal', isActive: true },
  ];
  
  const created = [];
  for (const method of methods) {
    const pm = await prisma.paymentMethod.create({ data: method });
    created.push(pm);
  }
  
  return created;
}

async function seedCarriers() {
  console.log('🚚 Seeding carriers...');
  
  const carriers = [
    {
      name: 'FedEx',
      phone: '1-800-FEDEX',
      website: 'https://www.fedex.com',
      trackingUrlTpl: 'https://www.fedex.com/fedextrack/?tracknumbers={tracking}',
    },
    {
      name: 'UPS',
      phone: '1-800-PICK-UPS',
      website: 'https://www.ups.com',
      trackingUrlTpl: 'https://www.ups.com/track?tracknum={tracking}',
    },
    {
      name: 'USPS',
      phone: '1-800-ASK-USPS',
      website: 'https://www.usps.com',
      trackingUrlTpl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}',
    },
    {
      name: 'DHL',
      phone: '1-800-CALL-DHL',
      website: 'https://www.dhl.com',
      trackingUrlTpl: 'https://www.dhl.com/en/express/tracking.html?AWB={tracking}',
    },
  ];
  
  const created = [];
  for (const carrier of carriers) {
    const c = await prisma.carrier.create({ data: carrier });
    created.push(c);
    
    // Create shipping methods
    const methods = ['Ground', 'Express', '2-Day', 'Overnight'];
    for (const method of methods) {
      await prisma.shippingMethod.create({
        data: {
          carrierId: c.id,
          serviceName: `${carrier.name} ${method}`,
          transitDays: method === 'Ground' ? 5 : method === 'Express' ? 3 : method === '2-Day' ? 2 : 1,
          baseCost: method === 'Ground' ? 10 : method === 'Express' ? 25 : method === '2-Day' ? 35 : 50,
        },
      });
    }
  }
  
  return created;
}

async function seedPurchaseOrders(suppliers: any[], items: any[], users: any[]) {
  console.log('📄 Seeding purchase orders...');
  
  let poCount = 0;
  
  for (const supplier of suppliers.slice(0, 15)) { // Create POs for 15 suppliers
    const poNum = faker.number.int({ min: 1, max: 3 });
    
    for (let i = 0; i < poNum; i++) {
      const po = await prisma.purchaseOrder.create({
        data: {
          supplierId: supplier.id,
          poNumber: `PO-${faker.string.alphanumeric(8).toUpperCase()}`,
          status: faker.helpers.arrayElement(['DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED']),
          orderDate: faker.date.recent({ days: 60 }),
          expectedDate: faker.date.future({ years: 0.1 }),
          currencyId: 'USD',
          createdById: faker.helpers.arrayElement(users.filter(u => ['MANAGER', 'WAREHOUSE'].includes(u.role))).id,
          approvedById: faker.helpers.arrayElement([null, users.find(u => u.role === 'MANAGER')?.id]),
          notes: faker.lorem.sentence(),
        },
      });
      poCount++;
      
      // Create PO items
      const supplierItems = items.filter(item => item.defaultSupplierId === supplier.id);
      const itemCount = Math.min(faker.number.int({ min: 1, max: 5 }), supplierItems.length);
      
      if (itemCount > 0) {
        const selectedItems = faker.helpers.arrayElements(supplierItems, itemCount);
        let subtotal = 0;
        
        for (const item of selectedItems) {
          const qty = faker.number.int({ min: 10, max: 100 });
          const unitCost = item.defaultCost || 50;
          const totalCost = qty * unitCost;
          subtotal += totalCost;
          
          await prisma.purchaseOrderItem.create({
            data: {
              poId: po.id,
              itemId: item.id,
              description: item.name,
              qtyOrdered: qty,
              qtyReceived: po.status === 'RECEIVED' ? qty : 0,
              unitCost,
              taxRate: 0.08,
              totalCost,
            },
          });
        }
        
        // Update PO totals
        await prisma.purchaseOrder.update({
          where: { id: po.id },
          data: {
            subtotal,
            tax: subtotal * 0.08,
            total: subtotal * 1.08,
          },
        });
      }
    }
  }
  
  console.log(`✅ Created ${poCount} purchase orders`);
}

async function seedDiscounts() {
  console.log('🏷️ Seeding discounts...');
  
  const discounts = [
    {
      code: 'WELCOME10',
      description: '10% off for new customers',
      discountType: 'PERCENTAGE' as const,
      value: 10,
      startDate: new Date(),
      endDate: faker.date.future({ years: 1 }),
      minOrderValue: 50,
      maxUses: 1000,
      uses: faker.number.int({ min: 0, max: 200 }),
      isActive: true,
    },
    {
      code: 'BULK20',
      description: '$20 off orders over $200',
      discountType: 'FIXED_AMOUNT' as const,
      value: 20,
      startDate: new Date(),
      endDate: faker.date.future({ years: 1 }),
      minOrderValue: 200,
      isActive: true,
    },
    {
      code: 'SEASONAL15',
      description: '15% off seasonal items',
      discountType: 'PERCENTAGE' as const,
      value: 15,
      startDate: new Date(),
      endDate: faker.date.future({ years: 0.5 }),
      isActive: true,
    },
  ];
  
  for (const discount of discounts) {
    await prisma.discount.create({ data: discount });
  }
  
  console.log(`✅ Created ${discounts.length} discount codes`);
}

async function main() {
  try {
    console.log('🌱 Starting comprehensive database seeding...\n');
    
    // Clear existing data
    await clearDatabase();
    
    // Seed in dependency order
    const users = await seedUsers();
    const units = await seedUnitsOfMeasure();
    const categories = await seedCategories();
    const warehouses = await seedWarehouses();
    const suppliers = await seedSuppliers();
    const items = await seedItems(categories, units, suppliers);
    await seedInventory(items, warehouses, users);
    const customers = await seedCustomers();
    await seedOrdersAndShipments(customers, items, users);
    await seedPurchaseOrders(suppliers, items, users);
    await seedDiscounts();
    
    console.log('\n✅ Seeding completed successfully!');
    console.log('📊 Database is now populated with comprehensive test data');
    
    // Print summary
    const summary = {
      users: await prisma.user.count(),
      categories: await prisma.itemCategory.count(),
      items: await prisma.item.count(),
      warehouses: await prisma.warehouse.count(),
      locations: await prisma.location.count(),
      inventory: await prisma.inventory.count(),
      suppliers: await prisma.supplier.count(),
      customers: await prisma.customer.count(),
      orders: await prisma.order.count(),
      purchaseOrders: await prisma.purchaseOrder.count(),
    };
    
    console.log('\n📈 Summary:');
    console.table(summary);
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute seeding
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });