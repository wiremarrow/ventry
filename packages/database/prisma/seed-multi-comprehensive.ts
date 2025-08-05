#!/usr/bin/env tsx
/**
 * Multi-Organization Comprehensive Seeder
 *
 * Creates 3 organizations with full comprehensive data:
 * - Ventry Corporation (default org)
 * - TechStart Inc.
 * - Global Retail Co.
 *
 * Each organization gets the same volume of data:
 * - 45 products across 3 categories
 * - 4 warehouses with 40+ locations each
 * - 25 customers with addresses
 * - 12 suppliers with contacts
 * - Purchase orders, sales orders, shipments, returns, etc.
 * - Full historical data for analytics
 *
 * Run with: pnpm db:seed:multi
 */

import { prisma } from '../index.js';
import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';
import { faker } from '@faker-js/faker';

// Set consistent seed for reproducible data
faker.seed(12345);

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

// Helper to create organization-prefixed data
function orgPrefix(orgSlug: string, value: string): string {
  if (orgSlug === 'ventry-corp') return value; // No prefix for Ventry
  if (orgSlug === 'techstart') return `TS-${value}`;
  if (orgSlug === 'global-retail') return `GR-${value}`;
  return value;
}

async function seedBasicDataForOrg(organizationId: string, orgSlug: string) {
  console.log(`  📏 Creating units of measure...`);

  const uomEach = await prisma.unitOfMeasure.create({
    data: {
      organizationId,
      code: 'EA',
      description: 'Each',
      isBase: true,
    },
  });

  const uomBox = await prisma.unitOfMeasure.create({
    data: {
      organizationId,
      code: 'BOX',
      description: 'Box',
      isBase: false,
      conversionFactorToBase: new Decimal(12),
    },
  });

  const uomCase = await prisma.unitOfMeasure.create({
    data: {
      organizationId,
      code: 'CASE',
      description: 'Case',
      isBase: false,
      conversionFactorToBase: new Decimal(24),
    },
  });

  console.log(`  📁 Creating item categories...`);

  const categories = await Promise.all([
    prisma.itemCategory.create({
      data: {
        organizationId,
        name:
          orgSlug === 'ventry-corp'
            ? 'Electronics'
            : orgSlug === 'techstart'
              ? 'Electronics'
              : 'Apparel',
        description:
          orgSlug === 'ventry-corp'
            ? 'Electronic devices and accessories'
            : orgSlug === 'techstart'
              ? 'Electronic devices and accessories'
              : 'Clothing and accessories',
      },
    }),
    prisma.itemCategory.create({
      data: {
        organizationId,
        name:
          orgSlug === 'ventry-corp'
            ? 'Office Supplies'
            : orgSlug === 'techstart'
              ? 'Computer Accessories'
              : 'Home & Garden',
        description:
          orgSlug === 'ventry-corp'
            ? 'Office supplies and stationery'
            : orgSlug === 'techstart'
              ? 'Keyboards, mice, cables, etc.'
              : 'Home decor and garden supplies',
      },
    }),
    prisma.itemCategory.create({
      data: {
        organizationId,
        name:
          orgSlug === 'ventry-corp'
            ? 'Furniture'
            : orgSlug === 'techstart'
              ? 'Office Equipment'
              : 'Sports & Outdoors',
        description:
          orgSlug === 'ventry-corp'
            ? 'Office and home furniture'
            : orgSlug === 'techstart'
              ? 'Printers, scanners, office supplies'
              : 'Sporting goods and outdoor equipment',
      },
    }),
  ]);

  return { uoms: [uomEach, uomBox, uomCase], categories };
}

async function seedComprehensiveDataForOrg(
  organizationId: string,
  orgSlug: string,
  basicData: any
) {
  const { uoms, categories } = basicData;
  const prefix = orgSlug === 'ventry-corp' ? '' : orgSlug === 'techstart' ? 'TS' : 'GR';

  console.log(`  🏭 Creating warehouses...`);

  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        organizationId,
        code: `${prefix}-WH-01`,
        name: `${orgSlug === 'techstart' ? 'TechStart' : 'Global Retail'} Main Warehouse`,
        line1: orgSlug === 'techstart' ? '100 Tech Way' : '200 Retail Blvd',
        city: orgSlug === 'techstart' ? 'San Jose' : 'Dallas',
        state: orgSlug === 'techstart' ? 'CA' : 'TX',
        postalCode: orgSlug === 'techstart' ? '95110' : '75201',
        country: 'USA',
        phone: orgSlug === 'techstart' ? '(408) 555-0100' : '(214) 555-0200',
      },
    }),
    prisma.warehouse.create({
      data: {
        organizationId,
        code: `${prefix}-WH-02`,
        name: `${orgSlug === 'techstart' ? 'TechStart' : 'Global Retail'} West Coast`,
        line1: orgSlug === 'techstart' ? '200 Pacific Ave' : '300 Sunset Dr',
        city: orgSlug === 'techstart' ? 'San Francisco' : 'Los Angeles',
        state: 'CA',
        postalCode: orgSlug === 'techstart' ? '94103' : '90001',
        country: 'USA',
        phone: orgSlug === 'techstart' ? '(415) 555-0200' : '(213) 555-0300',
      },
    }),
    prisma.warehouse.create({
      data: {
        organizationId,
        code: `${prefix}-WH-03`,
        name: `${orgSlug === 'techstart' ? 'TechStart' : 'Global Retail'} East Coast`,
        line1: orgSlug === 'techstart' ? '300 Atlantic Rd' : '400 Broadway',
        city: orgSlug === 'techstart' ? 'Boston' : 'New York',
        state: orgSlug === 'techstart' ? 'MA' : 'NY',
        postalCode: orgSlug === 'techstart' ? '02101' : '10001',
        country: 'USA',
        phone: orgSlug === 'techstart' ? '(617) 555-0300' : '(212) 555-0400',
      },
    }),
    prisma.warehouse.create({
      data: {
        organizationId,
        code: `${prefix}-WH-04`,
        name: `${orgSlug === 'techstart' ? 'TechStart' : 'Global Retail'} Central`,
        line1: orgSlug === 'techstart' ? '400 Central Pkwy' : '500 Main St',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'USA',
        phone: orgSlug === 'techstart' ? '(312) 555-0400' : '(312) 555-0500',
      },
    }),
  ]);

  console.log(`  📍 Creating warehouse locations...`);

  // Create 10 locations per warehouse
  const locations = [];
  for (const warehouse of warehouses) {
    for (let i = 1; i <= 10; i++) {
      const location = await prisma.location.create({
        data: {
          organizationId,
          warehouseId: warehouse.id,
          code: `${warehouse.code}-L${i.toString().padStart(2, '0')}`,
          aisle: String.fromCharCode(65 + Math.floor((i - 1) / 2)), // A, A, B, B, C, C...
          shelf: String(((i - 1) % 2) + 1),
          zone: i <= 2 ? 'RECEIVING' : i <= 8 ? 'STORAGE' : 'SHIPPING',
          isTempControlled: i % 3 === 0,
          description: `${warehouse.code} Location ${i}`,
          maxCapacity: 1000 + i * 100,
        },
      });
      locations.push(location);
    }
  }

  console.log(`  📦 Creating items...`);

  // Create 15 items per category
  const items = [];
  for (const category of categories) {
    for (let i = 1; i <= 15; i++) {
      let name, description, cost, price;

      if (orgSlug === 'techstart') {
        // TechStart items
        if (category.name === 'Electronics') {
          const types = ['Laptop', 'Monitor', 'Tablet', 'Phone', 'Smart Watch'];
          const type = types[(i - 1) % types.length];
          name = `${type} Model ${i}`;
          description = `High-performance ${type.toLowerCase()} with advanced features`;
          cost = 200 + i * 50;
          price = cost * 1.5;
        } else if (category.name === 'Computer Accessories') {
          const types = ['Keyboard', 'Mouse', 'USB Cable', 'HDMI Cable', 'Webcam'];
          const type = types[(i - 1) % types.length];
          name = `${type} Pro ${i}`;
          description = `Professional-grade ${type.toLowerCase()}`;
          cost = 20 + i * 5;
          price = cost * 2;
        } else {
          const types = ['Printer', 'Scanner', 'Paper Shredder', 'Desk Lamp', 'Monitor Stand'];
          const type = types[(i - 1) % types.length];
          name = `${type} ${i}`;
          description = `Office ${type.toLowerCase()} for productivity`;
          cost = 50 + i * 10;
          price = cost * 1.8;
        }
      } else {
        // Global Retail items
        if (category.name === 'Apparel') {
          const types = ['Shirt', 'Jeans', 'Dress', 'Jacket', 'Shoes'];
          const type = types[(i - 1) % types.length];
          name = `${type} Style ${i}`;
          description = `Fashionable ${type.toLowerCase()} in various colors`;
          cost = 15 + i * 3;
          price = cost * 2.5;
        } else if (category.name === 'Home & Garden') {
          const types = ['Planter', 'Vase', 'Lamp', 'Rug', 'Curtains'];
          const type = types[(i - 1) % types.length];
          name = `${type} Collection ${i}`;
          description = `Beautiful ${type.toLowerCase()} for your home`;
          cost = 25 + i * 5;
          price = cost * 2.2;
        } else {
          const types = ['Basketball', 'Tennis Racket', 'Yoga Mat', 'Camping Tent', 'Bicycle'];
          const type = types[(i - 1) % types.length];
          name = `${type} Pro ${i}`;
          description = `Professional ${type.toLowerCase()} for enthusiasts`;
          cost = 30 + i * 10;
          price = cost * 2;
        }
      }

      const item = await prisma.item.create({
        data: {
          organizationId,
          sku: `${prefix}-${category.name.slice(0, 3).toUpperCase()}-${i.toString().padStart(3, '0')}`,
          name,
          description,
          categoryId: category.id,
          uomId: uoms[0].id,
          defaultCost: new Decimal(cost),
          defaultPrice: new Decimal(price),
          reorderPoint: 50,
          reorderQty: 100,
          isActive: true,
        },
      });
      items.push(item);
    }
  }

  console.log(`  🧑‍💼 Creating suppliers...`);

  const suppliers = [];
  for (let i = 1; i <= 12; i++) {
    const supplier = await prisma.supplier.create({
      data: {
        organizationId,
        supplierCode: `${prefix}-SUP-${i.toString().padStart(3, '0')}`,
        name: faker.company.name(),
        line1: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'USA',
        phone: faker.phone.number(),
        email: faker.internet.email(),
        website: faker.internet.url(),
        paymentTerms: ['NET30', 'NET60', '2/10 NET30'][i % 3],
        leadTimeDays: 5 + (i % 10),
        contacts: {
          create: [
            {
              organizationId,
              firstName: faker.person.firstName(),
              lastName: faker.person.lastName(),
              role: 'Sales Representative',
              email: faker.internet.email(),
              phone: faker.phone.number(),
            },
            {
              organizationId,
              firstName: faker.person.firstName(),
              lastName: faker.person.lastName(),
              role: 'Account Manager',
              email: faker.internet.email(),
              phone: faker.phone.number(),
            },
          ],
        },
      },
      include: { contacts: true },
    });
    suppliers.push(supplier);
  }

  console.log(`  👥 Creating customers...`);

  const customers = [];
  for (let i = 1; i <= 25; i++) {
    const customer = await prisma.customer.create({
      data: {
        organizationId,
        customerCode: `${prefix}-CUST-${i.toString().padStart(3, '0')}`,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        companyName: i % 3 === 0 ? faker.company.name() : null,
        email: faker.internet.email(),
        phone: faker.phone.number(),
        taxId: i % 2 === 0 ? faker.string.alphanumeric(9) : null,
        defaultPaymentTerms: ['NET30', 'NET60', 'COD'][i % 3],
      },
    });
    customers.push(customer);
  }

  return {
    warehouses,
    locations,
    items,
    suppliers,
    customers,
    uoms,
    categories,
  };
}

async function seedInventoryAndOperationsForOrg(
  organizationId: string,
  orgSlug: string,
  data: any,
  adminUser: any
) {
  const { items, locations, customers, suppliers, warehouses } = data;
  const prefix = orgSlug === 'ventry-corp' ? '' : orgSlug === 'techstart' ? 'TS' : 'GR';

  console.log(`  📊 Creating inventory records...`);

  // Create inventory for each item in various locations
  const inventoryRecords = [];
  for (const item of items) {
    // Each item in 2-4 random locations
    const numLocations = 2 + Math.floor(Math.random() * 3);
    const selectedLocations = [...locations].sort(() => 0.5 - Math.random()).slice(0, numLocations);

    for (const location of selectedLocations) {
      const inventory = await prisma.inventory.create({
        data: {
          organizationId,
          itemId: item.id,
          locationId: location.id,
          qtyOnHand: Math.floor(Math.random() * 500) + 100,
          qtyReserved: Math.floor(Math.random() * 50),
          qtyInTransit: Math.floor(Math.random() * 100),
          lastCountedAt: faker.date.recent({ days: 30 }),
        },
      });
      inventoryRecords.push(inventory);
    }
  }

  // Create low-stock test scenarios for each organization
  console.log('  🚨 Creating low-stock test items...');

  // Critical stock items (first 5 items have 0-4 units)
  for (let i = 0; i < Math.min(5, items.length); i++) {
    const item = items[i];
    const location = locations[0];

    // Find existing inventory record
    const existingInventory = inventoryRecords.find(
      (inv) => inv.itemId === item.id && inv.locationId === location.id
    );

    if (existingInventory) {
      await prisma.inventory.update({
        where: { id: existingInventory.id },
        data: {
          qtyOnHand: Math.floor(Math.random() * 5), // 0-4 units
          qtyReserved: 0,
        },
      });
    }
  }

  // Below reorder point items (next 5 items)
  for (let i = 5; i < Math.min(10, items.length); i++) {
    const item = items[i];
    const location = locations[0];

    const existingInventory = inventoryRecords.find(
      (inv) => inv.itemId === item.id && inv.locationId === location.id
    );

    if (existingInventory && item.reorderPoint > 0) {
      const belowReorderQty = Math.max(1, item.reorderPoint - Math.floor(Math.random() * 5) - 1);
      await prisma.inventory.update({
        where: { id: existingInventory.id },
        data: {
          qtyOnHand: belowReorderQty,
          qtyReserved: 0,
        },
      });
    }
  }

  // Zero stock items (next 3 items)
  for (let i = 10; i < Math.min(13, items.length); i++) {
    const item = items[i];
    const location = locations[0];

    const existingInventory = inventoryRecords.find(
      (inv) => inv.itemId === item.id && inv.locationId === location.id
    );

    if (existingInventory) {
      await prisma.inventory.update({
        where: { id: existingInventory.id },
        data: {
          qtyOnHand: 0,
          qtyReserved: 0,
        },
      });
    }
  }

  console.log('    ✓ Items 1-5: Critical stock (0-4 units)');
  console.log('    ✓ Items 6-10: Below reorder point');
  console.log('    ✓ Items 11-13: Zero stock');

  console.log(`  📈 Creating stock movements...`);

  // Create historical stock movements
  for (let i = 0; i < 365; i++) {
    const inventory = inventoryRecords[Math.floor(Math.random() * inventoryRecords.length)];
    const movementType = ['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT'][
      Math.floor(Math.random() * 4)
    ];

    await prisma.stockMovement.create({
      data: {
        organizationId,
        movementType: movementType as any,
        itemId: inventory.itemId,
        fromLocationId: movementType === 'TRANSFER' ? inventory.locationId : null,
        toLocationId: movementType !== 'OUTBOUND' ? inventory.locationId : null,
        qty: Math.floor(Math.random() * 50) + 10,
        refType: ['ORDER', 'PURCHASE_ORDER', 'ADJUSTMENT', 'RETURN'][
          Math.floor(Math.random() * 4)
        ] as any,
        refId: faker.string.uuid(),
        notes: faker.lorem.sentence(),
        movedById: adminUser.id,
        movedAt: faker.date.recent({ days: 180 }),
      },
    });
  }

  console.log(`  📝 Creating sales orders...`);

  // Create orders
  const orders = [];
  for (let i = 0; i < 33; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const orderDate = faker.date.recent({ days: 90 });
    const orderItems = [];
    const numItems = Math.floor(Math.random() * 4) + 1;

    let subtotal = 0;
    for (let j = 0; j < numItems; j++) {
      const item = items[Math.floor(Math.random() * items.length)];
      const qty = Math.floor(Math.random() * 10) + 1;
      const price = item.defaultPrice;
      const lineTotal = price.mul(qty);
      subtotal += lineTotal.toNumber();

      orderItems.push({
        itemId: item.id,
        qtyOrdered: qty,
        unitPrice: price,
        discountPct: new Decimal(0),
        taxRate: new Decimal(8),
        totalPrice: lineTotal,
        description: faker.lorem.sentence(),
      });
    }

    const taxTotal = subtotal * 0.08;
    const grandTotal = subtotal + taxTotal;

    const order = await prisma.order.create({
      data: {
        organizationId,
        orderNumber: `${prefix}-ORD-${(i + 1).toString().padStart(4, '0')}`,
        customerId: customer.id,
        orderDate,
        requestedShipDate: faker.date.soon({ days: 14, refDate: orderDate }),
        status: ['PENDING', 'CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'][
          Math.floor(Math.random() * 6)
        ] as any,
        notes: faker.lorem.sentence(),
        subtotal: new Decimal(subtotal),
        discountTotal: new Decimal(0),
        taxTotal: new Decimal(taxTotal),
        shippingTotal: new Decimal(15),
        grandTotal: new Decimal(grandTotal + 15),
        createdById: adminUser.id,
        items: {
          create: orderItems.map((item) => ({
            ...item,
            organizationId,
          })),
        },
      },
      include: { items: true },
    });
    orders.push(order);
  }

  return { inventoryRecords, orders };
}

async function seedAllOtherDataForOrg(
  organizationId: string,
  orgSlug: string,
  data: any,
  adminUser: any
) {
  const { suppliers, items, warehouses, customers, orders } = data;
  const prefix = orgSlug === 'ventry-corp' ? '' : orgSlug === 'techstart' ? 'TS' : 'GR';

  console.log(`  🚚 Creating shipping and payment methods...`);

  // Create carriers
  const carriers = await Promise.all([
    prisma.carrier.create({
      data: {
        organizationId,
        name: `${prefix} UPS`,
        trackingUrlTpl: 'https://www.ups.com/track?tracknum=',
      },
    }),
    prisma.carrier.create({
      data: {
        organizationId,
        name: `${prefix} FedEx`,
        trackingUrlTpl: 'https://www.fedex.com/fedextrack/?tracknumbers=',
      },
    }),
    prisma.carrier.create({
      data: {
        organizationId,
        name: `${prefix} USPS`,
        trackingUrlTpl: 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=',
      },
    }),
  ]);

  // Create shipping methods
  await Promise.all([
    prisma.shippingMethod.create({
      data: {
        organizationId,
        carrierId: carriers[0].id,
        serviceName: 'UPS Ground',
        transitDays: 5,
        baseCost: new Decimal(10),
      },
    }),
    prisma.shippingMethod.create({
      data: {
        organizationId,
        carrierId: carriers[1].id,
        serviceName: 'FedEx 2Day',
        transitDays: 2,
        baseCost: new Decimal(25),
      },
    }),
    prisma.shippingMethod.create({
      data: {
        organizationId,
        carrierId: carriers[2].id,
        serviceName: 'USPS Priority Mail',
        transitDays: 3,
        baseCost: new Decimal(15),
      },
    }),
  ]);

  // Create payment methods
  await Promise.all([
    prisma.paymentMethod.create({
      data: {
        organizationId,
        methodName: 'Cash',
        provider: 'CASH',
        isActive: true,
      },
    }),
    prisma.paymentMethod.create({
      data: {
        organizationId,
        methodName: 'Credit Card',
        provider: 'STRIPE',
        isActive: true,
      },
    }),
    prisma.paymentMethod.create({
      data: {
        organizationId,
        methodName: 'Check',
        provider: 'CHECK',
        isActive: true,
      },
    }),
  ]);

  console.log(`  🏠 Creating customer addresses...`);

  // Add addresses for customers
  for (const customer of customers) {
    await prisma.address.create({
      data: {
        organizationId,
        customerId: customer.id,
        addressType: 'BILLING' as const,
        line1: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode(),
        country: 'USA',
        isDefault: true,
      },
    });

    // Some customers have shipping addresses too
    if (Math.random() > 0.5) {
      await prisma.address.create({
        data: {
          organizationId,
          customerId: customer.id,
          addressType: 'SHIPPING' as const,
          line1: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          postalCode: faker.location.zipCode(),
          country: 'USA',
          isDefault: false,
        },
      });
    }
  }

  console.log(`  📋 Creating purchase orders...`);

  // Create purchase orders
  const purchaseOrders = [];
  for (let i = 0; i < 15; i++) {
    const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
    const orderDate = faker.date.recent({ days: 60 });
    const poItems = [];
    const numItems = Math.floor(Math.random() * 5) + 2;

    let subtotal = 0;
    for (let j = 0; j < numItems; j++) {
      const item = items[Math.floor(Math.random() * items.length)];
      const qty = Math.floor(Math.random() * 100) + 50;
      const unitCost = item.defaultCost.mul(0.7); // Wholesale discount
      const lineTotal = unitCost.mul(qty);
      subtotal += lineTotal.toNumber();

      poItems.push({
        itemId: item.id,
        qtyOrdered: qty,
        unitCost,
        totalCost: lineTotal,
      });
    }

    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId,
        poNumber: `${prefix}-PO-${(i + 1).toString().padStart(5, '0')}`,
        supplierId: supplier.id,
        orderDate,
        expectedDate: faker.date.soon({ days: supplier.leadTimeDays, refDate: orderDate }),
        status: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'RECEIVED'][
          Math.floor(Math.random() * 5)
        ] as any,
        subtotal: new Decimal(subtotal),
        tax: new Decimal(tax),
        total: new Decimal(total),
        notes: faker.lorem.sentence(),
        createdById: adminUser.id,
        approvedById: Math.random() > 0.3 ? adminUser.id : null,
        items: {
          create: poItems.map((item) => ({
            ...item,
            organizationId,
          })),
        },
      },
      include: { items: true },
    });
    purchaseOrders.push(po);
  }

  console.log(`  📥 Creating receipts...`);

  // Create receipts for some POs
  for (const po of purchaseOrders) {
    if (['PARTIAL', 'RECEIVED'].includes(po.status)) {
      const receipt = await prisma.receipt.create({
        data: {
          organizationId,
          poId: po.id,
          reference: `${prefix}-REC-${faker.string.numeric(5)}`,
          receivedDate: faker.date.between({ from: po.orderDate, to: new Date() }),
          receivedById: adminUser.id,
          notes: faker.lorem.sentence(),
          items: {
            create: po.items.map((poItem) => ({
              organizationId,
              itemId: poItem.itemId,
              qtyReceived:
                po.status === 'RECEIVED' ? poItem.qtyOrdered : Math.floor(poItem.qtyOrdered * 0.7),
              unitCost: poItem.unitCost,
              locationId: data.locations[Math.floor(Math.random() * data.locations.length)].id,
            })),
          },
        },
      });
    }
  }

  console.log(`  📦 Creating shipments...`);

  // Create shipments for shipped/delivered orders
  for (const order of orders) {
    if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
      const carrier = carriers[Math.floor(Math.random() * carriers.length)];
      await prisma.shipment.create({
        data: {
          organizationId,
          shipmentNumber: `${prefix}-SHP-${faker.string.numeric(6)}`,
          orderId: order.id,
          carrierId: carrier.id,
          trackingNumber: faker.string.alphanumeric(20).toUpperCase(),
          shipDate: faker.date.between({ from: order.orderDate, to: new Date() }),
          expectedDelivery: faker.date.soon({ days: 5 }),
          shippedFromLocationId: data.locations[0].id,
          shippedById: adminUser.id,
          status: order.status === 'DELIVERED' ? 'DELIVERED' : ('IN_TRANSIT' as any),
          shippingCost: new Decimal(15 + Math.random() * 35),
          notes: faker.lorem.sentence(),
          items: {
            create: order.items.map((orderItem: any) => ({
              organizationId,
              orderItemId: orderItem.id,
              itemId: orderItem.itemId,
              qtyShipped: orderItem.qtyOrdered,
            })),
          },
        },
      });
    }
  }

  console.log(`  🔄 Creating returns...`);

  // Create some returns
  const deliveredOrders = orders.filter((o: any) => o.status === 'DELIVERED');
  for (let i = 0; i < Math.min(5, deliveredOrders.length); i++) {
    const order = deliveredOrders[i];
    const rmaNumber = `${prefix}-RMA-${faker.string.numeric(6)}`;

    await prisma.return.create({
      data: {
        organizationId,
        returnNumber: rmaNumber,
        orderId: order.id,
        customerId: order.customerId,
        returnDate: faker.date.recent({ days: 10 }),
        status: ['PENDING', 'APPROVED', 'RECEIVED', 'REFUNDED'][
          Math.floor(Math.random() * 4)
        ] as any,
        reason: ['DAMAGED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CHANGED_MIND'][
          Math.floor(Math.random() * 4)
        ],
        notes: faker.lorem.sentence(),
        refundAmount: order.grandTotal.mul(0.9),
        restockFee: order.grandTotal.mul(0.1),
        items: {
          create: order.items.slice(0, Math.min(2, order.items.length)).map((orderItem: any) => ({
            organizationId,
            orderItemId: orderItem.id,
            itemId: orderItem.itemId,
            qtyReturned: Math.min(
              orderItem.qtyOrdered,
              Math.floor(Math.random() * orderItem.qtyOrdered) + 1
            ),
            condition: ['NEW', 'OPENED', 'DAMAGED', 'DEFECTIVE'][
              Math.floor(Math.random() * 4)
            ] as any,
            refundAmount: orderItem.totalPrice.mul(0.9),
          })),
        },
      },
    });
  }

  console.log(`  🔍 Creating cycle counts and adjustments...`);

  // Create cycle counts
  for (const warehouse of warehouses) {
    for (let i = 0; i < 3; i++) {
      const cycleDate = faker.date.recent({ days: 90 });
      const locations = data.locations.filter((l: any) => l.warehouseId === warehouse.id);
      const selectedLocations = locations.slice(0, Math.min(5, locations.length));

      const location = selectedLocations[0];
      if (!location) continue;

      await prisma.cycleCount.create({
        data: {
          organizationId,
          locationId: location.id,
          countDate: cycleDate,
          countedById: adminUser.id,
          reviewedById: Math.random() > 0.5 ? adminUser.id : null,
          status: 'COMPLETED' as any,
          notes: faker.lorem.sentence(),
          items: {
            create: selectedLocations
              .map((location: any) => {
                const inventory = data.inventoryRecords.find(
                  (inv: any) => inv.locationId === location.id
                );
                if (!inventory) return null;

                const systemQty = inventory.qtyOnHand;
                const variance = Math.floor(Math.random() * 10) - 5;
                const countedQty = Math.max(0, systemQty + variance);

                return {
                  organizationId,
                  itemId: inventory.itemId,
                  qtyCounted: countedQty,
                  qtySystem: systemQty,
                  variance,
                };
              })
              .filter(Boolean),
          },
        },
      });
    }
  }

  // Create stock adjustments
  for (let i = 0; i < 10; i++) {
    const inventory =
      data.inventoryRecords[Math.floor(Math.random() * data.inventoryRecords.length)];
    const adjustmentQty = Math.floor(Math.random() * 20) - 10;

    await prisma.stockAdjustment.create({
      data: {
        organizationId,
        itemId: inventory.itemId,
        locationId: inventory.locationId,
        qtyBefore: inventory.qtyOnHand,
        qtyAfter: Math.max(0, inventory.qtyOnHand + adjustmentQty),
        reason: ['DAMAGED', 'LOST', 'FOUND', 'CORRECTION', 'OTHER'][Math.floor(Math.random() * 5)],
        adjustedById: adminUser.id,
        notes: faker.lorem.sentence(),
      },
    });
  }
}

async function createOrganizationWithFullData(
  orgName: string,
  orgSlug: string,
  users: { admin: any; employee: any }
) {
  console.log(`\n🏢 Creating ${orgName}...`);

  // Create organization
  const organization = await prisma.organization.create({
    data: {
      name: orgName,
      slug: orgSlug,
      subscriptionTier: 'ENTERPRISE',
      subscriptionStatus: 'ACTIVE',
      members: {
        create: [
          { userId: users.admin.id, role: 'OWNER' },
          { userId: users.employee.id, role: 'MEMBER' },
        ],
      },
    },
  });

  // Create basic data (UOMs, categories)
  const basicData = await seedBasicDataForOrg(organization.id, orgSlug);

  // Create comprehensive data (warehouses, items, suppliers, customers)
  const comprehensiveData = await seedComprehensiveDataForOrg(organization.id, orgSlug, basicData);

  // Create inventory and operations
  const opsData = await seedInventoryAndOperationsForOrg(
    organization.id,
    orgSlug,
    comprehensiveData,
    users.admin
  );

  // Create all other data (shipping, payments, POs, receipts, shipments, returns, etc.)
  await seedAllOtherDataForOrg(
    organization.id,
    orgSlug,
    { ...comprehensiveData, ...opsData },
    users.admin
  );

  return organization;
}

async function main() {
  console.log('🌱 Starting multi-organization comprehensive seed...\n');

  try {
    // Clear entire database first
    await clearDatabase();

    // Create password hash once for all users
    const password = await bcrypt.hash('password123', 10);

    // Create Ventry Corporation users
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

    // Create users for TechStart
    const alice = await prisma.user.create({
      data: {
        email: 'alice@techstart.com',
        username: 'alice',
        firstName: 'Alice',
        lastName: 'Anderson',
        password,
        role: 'ADMIN',
      },
    });

    const bob = await prisma.user.create({
      data: {
        email: 'bob@techstart.com',
        username: 'bob',
        firstName: 'Bob',
        lastName: 'Brown',
        password,
        role: 'EMPLOYEE',
      },
    });

    // Create users for Global Retail
    const charlie = await prisma.user.create({
      data: {
        email: 'charlie@globalretail.com',
        username: 'charlie',
        firstName: 'Charlie',
        lastName: 'Chen',
        password,
        role: 'ADMIN',
      },
    });

    const diana = await prisma.user.create({
      data: {
        email: 'diana@globalretail.com',
        username: 'diana',
        firstName: 'Diana',
        lastName: 'Davis',
        password,
        role: 'EMPLOYEE',
      },
    });

    // Create Ventry Corporation with full data
    await createOrganizationWithFullData('Ventry Corporation', 'ventry-corp', {
      admin,
      employee: manager,
    });

    // Add employee to Ventry org
    await prisma.organizationMember.create({
      data: {
        organizationId: (await prisma.organization.findFirst({ where: { slug: 'ventry-corp' } }))!
          .id,
        userId: employee.id,
        role: 'MEMBER',
      },
    });

    // Create TechStart with full data
    await createOrganizationWithFullData('TechStart Inc.', 'techstart', {
      admin: alice,
      employee: bob,
    });

    // Create Global Retail with full data
    await createOrganizationWithFullData('Global Retail Co.', 'global-retail', {
      admin: charlie,
      employee: diana,
    });

    console.log('\n✅ Multi-organization comprehensive seed completed!\n');
    console.log('📊 Summary:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('👤 Users:');
    console.log('  • admin@ventry.com / password123 (ADMIN role)');
    console.log('  • manager@ventry.com / password123 (MANAGER role)');
    console.log('  • employee@ventry.com / password123 (EMPLOYEE role)');
    console.log('  • user@ventry.com / password123 (USER role - no org access)');
    console.log('  • alice@techstart.com / password123 (ADMIN role)');
    console.log('  • bob@techstart.com / password123 (EMPLOYEE role)');
    console.log('  • charlie@globalretail.com / password123 (ADMIN role)');
    console.log('  • diana@globalretail.com / password123 (EMPLOYEE role)');

    console.log('\n🏢 Organization 1: Ventry Corporation');
    console.log('   Members: admin (OWNER), manager (ADMIN), employee (MEMBER)');
    console.log('   Data:');
    console.log('   - 45 items (Electronics, Office Supplies, Furniture)');
    console.log('   - 4 warehouses with 40+ locations');
    console.log('   - 25 customers, 12 suppliers');
    console.log('   - 35 sales orders, 20 purchase orders');
    console.log('   - Full inventory with movements, shipments, returns');
    console.log('   - NO prefix for SKUs/codes');

    console.log('\n🏢 Organization 2: TechStart Inc.');
    console.log('   Members: alice@techstart.com (OWNER), bob@techstart.com (MEMBER)');
    console.log('   Data:');
    console.log('   - 45 items (Electronics, Computer Accessories, Office Equipment)');
    console.log('   - 4 warehouses with 40 locations');
    console.log('   - 25 customers, 12 suppliers');
    console.log('   - 33 sales orders, 15 purchase orders');
    console.log('   - Full inventory with movements, shipments, returns');
    console.log('   - All items/codes prefixed with TS-');

    console.log('\n🏢 Organization 3: Global Retail Co.');
    console.log('   Members: charlie@globalretail.com (OWNER), diana@globalretail.com (MEMBER)');
    console.log('   Data:');
    console.log('   - 45 items (Apparel, Home & Garden, Sports & Outdoors)');
    console.log('   - 4 warehouses with 40 locations');
    console.log('   - 25 customers, 12 suppliers');
    console.log('   - 33 sales orders, 15 purchase orders');
    console.log('   - Full inventory with movements, shipments, returns');
    console.log('   - All items/codes prefixed with GR-');

    console.log('\n🧪 Testing Multi-Tenancy:');
    console.log('   1. Login as admin@ventry.com');
    console.log('      - Should see ONLY Ventry Corporation data');
    console.log('      - SKUs have no prefix');
    console.log('   2. Login as alice@techstart.com');
    console.log('      - Should see ONLY TechStart data');
    console.log('      - All SKUs start with TS-');
    console.log('   3. Login as charlie@globalretail.com');
    console.log('      - Should see ONLY Global Retail data');
    console.log('      - All SKUs start with GR-');
    console.log('   4. user@ventry.com has NO organization access');
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Execute the seeding
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
