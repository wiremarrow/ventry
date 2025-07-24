import { prisma } from '@ventry/database';

export async function seedTestInventory(organizationId: string) {
  // Get or create default unit of measure
  let unitOfMeasure = await prisma.unitOfMeasure.findFirst({
    where: { organizationId },
  });
  
  if (!unitOfMeasure) {
    unitOfMeasure = await prisma.unitOfMeasure.create({
      data: {
        code: 'EA',
        description: 'Each',
        isBase: true,
        conversionFactorToBase: 1,
        organizationId,
      },
    });
  }

  // Create categories
  const electronicsCategory = await prisma.itemCategory.create({
    data: {
      name: 'Electronics',
      description: 'Electronic devices and accessories',
      organizationId,
    },
  });

  const officeCategory = await prisma.itemCategory.create({
    data: {
      name: 'Office Supplies',
      description: 'Office equipment and supplies',
      organizationId,
    },
  });

  // Create warehouses
  const mainWarehouse = await prisma.warehouse.create({
    data: {
      code: 'MAIN',
      name: 'Main Warehouse',
      organizationId,
      line1: '123 Test St',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'US',
    },
  });

  const secondaryWarehouse = await prisma.warehouse.create({
    data: {
      code: 'SEC',
      name: 'Secondary Warehouse',
      organizationId,
      line1: '456 Test Ave',
      city: 'Test City',
      state: 'TS',
      postalCode: '12346',
      country: 'US',
    },
  });

  // Create locations
  const locations = [];
  for (const warehouse of [mainWarehouse, secondaryWarehouse]) {
    for (let aisle = 1; aisle <= 2; aisle++) {
      for (let shelf = 1; shelf <= 3; shelf++) {
        const location = await prisma.location.create({
          data: {
            code: `${warehouse.code}-A${aisle}-S${shelf}`,
            description: `Aisle ${aisle}, Shelf ${shelf}`,
            organizationId,
            warehouseId: warehouse.id,
            aisle: `A${aisle}`,
            shelf: `S${shelf}`,
          },
        });
        locations.push(location);
      }
    }
  }

  // Create items with inventory
  const items = [
    // Electronics - some with low stock
    {
      sku: 'LAPTOP-001',
      name: 'Business Laptop Pro',
      category: electronicsCategory.id,
      price: 1299.99,
      reorderPoint: 20,
      reorderQty: 50,
      stock: 15, // Low stock
    },
    {
      sku: 'LAPTOP-002',
      name: 'Developer Laptop Ultra',
      category: electronicsCategory.id,
      price: 1899.99,
      reorderPoint: 15,
      reorderQty: 30,
      stock: 45,
    },
    {
      sku: 'MOUSE-001',
      name: 'Wireless Mouse',
      category: electronicsCategory.id,
      price: 29.99,
      reorderPoint: 50,
      reorderQty: 100,
      stock: 35, // Low stock
    },
    {
      sku: 'KEYBOARD-001',
      name: 'Mechanical Keyboard',
      category: electronicsCategory.id,
      price: 89.99,
      reorderPoint: 30,
      reorderQty: 60,
      stock: 78,
    },
    // Office supplies
    {
      sku: 'PEN-001',
      name: 'Blue Ballpoint Pens (12 pack)',
      category: officeCategory.id,
      price: 5.99,
      reorderPoint: 100,
      reorderQty: 200,
      stock: 250,
    },
    {
      sku: 'PAPER-001',
      name: 'A4 Paper (500 sheets)',
      category: officeCategory.id,
      price: 8.99,
      reorderPoint: 50,
      reorderQty: 100,
      stock: 40, // Low stock
    },
    {
      sku: 'STAPLER-001',
      name: 'Heavy Duty Stapler',
      category: officeCategory.id,
      price: 15.99,
      reorderPoint: 20,
      reorderQty: 40,
      stock: 65,
    },
  ];

  // Create items and inventory
  for (let i = 0; i < items.length; i++) {
    const itemData = items[i];
    const location = locations[i % locations.length];

    const item = await prisma.item.create({
      data: {
        sku: itemData.sku,
        name: itemData.name,
        description: `Test description for ${itemData.name}`,
        categoryId: itemData.category,
        organizationId,
        uomId: unitOfMeasure.id,
        defaultCost: itemData.price * 0.6,
        defaultPrice: itemData.price,
        reorderPoint: itemData.reorderPoint,
        reorderQty: itemData.reorderQty,
        isActive: true,
      },
    });

    // Create inventory record
    const reserved = Math.floor(itemData.stock * 0.2); // 20% reserved
    await prisma.inventory.create({
      data: {
        itemId: item.id,
        locationId: location.id,
        qtyOnHand: itemData.stock,
        qtyReserved: reserved,
        organizationId,
        lastCountedAt: new Date(),
      },
    });

    // Get a system user for stock movements
    const systemUser = await prisma.user.findFirst({
      where: { email: 'admin@ventry.com' },
    });
    
    if (!systemUser) {
      throw new Error('System user not found');
    }

    // Create initial stock movement
    await prisma.stockMovement.create({
      data: {
        organizationId,
        itemId: item.id,
        toLocationId: location.id,
        qty: itemData.stock,
        movementType: 'ADJUSTMENT',
        notes: 'Initial stock for E2E testing',
        movedById: systemUser.id,
      },
    });
  }

  return {
    categories: [electronicsCategory, officeCategory],
    warehouses: [mainWarehouse, secondaryWarehouse],
    locations,
    itemCount: items.length,
  };
}