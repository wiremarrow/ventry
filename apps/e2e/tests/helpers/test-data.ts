import { PrismaClient } from '@ventry/database';

const prisma = new PrismaClient();

// Store created test items for cleanup
const testItemIds: string[] = [];

export async function createTestItem(data: {
  sku: string;
  name: string;
  description?: string;
  isActive?: boolean;
  defaultPrice?: number;
  reorderPoint?: number;
}) {
  // Get the first organization (assuming test setup creates one)
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error('No organization found for testing');
  }

  // Get or create category
  let category = await prisma.itemCategory.findFirst({
    where: { organizationId: organization.id },
  });
  if (!category) {
    category = await prisma.itemCategory.create({
      data: {
        name: 'Test Category',
        organizationId: organization.id,
      },
    });
  }

  // Get or create unit of measure
  let uom = await prisma.unitOfMeasure.findFirst({
    where: { organizationId: organization.id },
  });
  if (!uom) {
    uom = await prisma.unitOfMeasure.create({
      data: {
        code: 'EA',
        name: 'Each',
        description: 'Each unit',
        isBase: true,
        conversionFactorToBase: 1,
        organizationId: organization.id,
      },
    });
  }

  // Create the item
  const item = await prisma.item.create({
    data: {
      sku: data.sku,
      name: data.name,
      description: data.description,
      categoryId: category.id,
      uomId: uom.id,
      isActive: data.isActive ?? true,
      defaultPrice: data.defaultPrice,
      reorderPoint: data.reorderPoint ?? 0,
      reorderQty: 1,
      organizationId: organization.id,
    },
  });

  // Track for cleanup
  testItemIds.push(item.id);

  return item;
}

export async function deleteTestItems() {
  if (testItemIds.length === 0) return;

  try {
    await prisma.item.deleteMany({
      where: {
        id: { in: testItemIds },
      },
    });
  } catch (error) {
    console.error('Error deleting test items:', error);
  }

  // Clear the array
  testItemIds.length = 0;
}

export async function createTestSupplier(data: {
  code: string;
  name: string;
}) {
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error('No organization found for testing');
  }

  return await prisma.supplier.create({
    data: {
      supplierCode: data.code,
      name: data.name,
      organizationId: organization.id,
    },
  });
}

export async function createTestWarehouse(data: {
  code: string;
  name: string;
}) {
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error('No organization found for testing');
  }

  return await prisma.warehouse.create({
    data: {
      code: data.code,
      name: data.name,
      organizationId: organization.id,
    },
  });
}

export async function createTestLocation(warehouseId: string, data: {
  code: string;
  description: string;
}) {
  return await prisma.location.create({
    data: {
      warehouseId,
      code: data.code,
      description: data.description,
    },
  });
}

// Export cleanup function to be used in tests
export { cleanupAllTestData } from '../../utils/db-cleanup';