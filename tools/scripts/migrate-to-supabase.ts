#!/usr/bin/env node

/**
 * Supabase Migration Script
 * 
 * This script helps migrate data from the current schema to the new Supabase schema.
 * It handles the mapping between old and new table structures.
 */

import { PrismaClient as OldPrismaClient } from '@prisma/client';
import { PrismaClient as NewPrismaClient } from '../../packages/database/node_modules/@prisma/client';

const oldPrisma = new OldPrismaClient();
const newPrisma = new NewPrismaClient();

async function migrateUsers() {
  console.log('🔄 Migrating users...');
  
  const users = await oldPrisma.user.findMany();
  
  for (const user of users) {
    await newPrisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        password: user.password,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  }
  
  console.log(`✅ Migrated ${users.length} users`);
}

async function migrateCategories() {
  console.log('🔄 Migrating categories...');
  
  const categories = await oldPrisma.category.findMany();
  
  for (const category of categories) {
    await newPrisma.itemCategory.create({
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  }
  
  console.log(`✅ Migrated ${categories.length} categories`);
}

async function migrateProducts() {
  console.log('🔄 Migrating products to items...');
  
  const products = await oldPrisma.product.findMany({
    include: { category: true },
  });
  
  // Create default unit of measure if it doesn't exist
  const defaultUOM = await newPrisma.unitOfMeasure.upsert({
    where: { code: 'EA' },
    create: {
      code: 'EA',
      description: 'Each',
      isBase: true,
      conversionFactorToBase: 1,
    },
    update: {},
  });
  
  for (const product of products) {
    await newPrisma.item.create({
      data: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        uomId: defaultUOM.id,
        defaultPrice: product.unitPrice,
        defaultCost: product.cost,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  }
  
  console.log(`✅ Migrated ${products.length} products to items`);
}

async function migrateLocations() {
  console.log('🔄 Migrating locations...');
  
  const locations = await oldPrisma.location.findMany();
  
  // Create default warehouse if it doesn't exist
  const defaultWarehouse = await newPrisma.warehouse.upsert({
    where: { code: 'MAIN' },
    create: {
      code: 'MAIN',
      name: 'Main Warehouse',
      line1: 'Default Address',
      city: 'Default City',
      state: 'Default State',
      postalCode: '00000',
      country: 'US',
    },
    update: {},
  });
  
  for (const location of locations) {
    await newPrisma.location.create({
      data: {
        id: location.id,
        warehouseId: defaultWarehouse.id,
        code: location.name,
        description: location.description,
        createdAt: location.createdAt,
        updatedAt: location.updatedAt,
      },
    });
  }
  
  console.log(`✅ Migrated ${locations.length} locations`);
}

async function migrateInventory() {
  console.log('🔄 Migrating inventory items...');
  
  const inventoryItems = await oldPrisma.inventoryItem.findMany();
  
  for (const item of inventoryItems) {
    await newPrisma.inventory.create({
      data: {
        itemId: item.productId,
        locationId: item.locationId,
        qtyOnHand: item.quantity,
        qtyReserved: item.reservedQty,
        lastCountedAt: item.lastCountDate,
        updatedAt: item.updatedAt,
      },
    });
  }
  
  console.log(`✅ Migrated ${inventoryItems.length} inventory items`);
}

async function migrateStockMovements() {
  console.log('🔄 Migrating inventory movements...');
  
  const movements = await oldPrisma.inventoryMovement.findMany();
  
  for (const movement of movements) {
    // Map old movement types to new ones
    const movementTypeMap: Record<string, any> = {
      INBOUND: 'INBOUND',
      OUTBOUND: 'OUTBOUND',
      ADJUSTMENT: 'ADJUSTMENT',
      TRANSFER: 'TRANSFER',
      RETURN: 'RETURN',
    };
    
    await newPrisma.stockMovement.create({
      data: {
        itemId: movement.productId,
        qty: movement.quantity,
        movementType: movementTypeMap[movement.type] || 'ADJUSTMENT',
        movedById: movement.createdById,
        movedAt: movement.createdAt,
        notes: movement.notes,
        refType: movement.reference,
      },
    });
  }
  
  console.log(`✅ Migrated ${movements.length} stock movements`);
}

async function migrateAuditLogs() {
  console.log('🔄 Migrating audit logs...');
  
  const auditLogs = await oldPrisma.auditLog.findMany();
  
  for (const log of auditLogs) {
    await newPrisma.auditLog.create({
      data: {
        tableName: log.entity,
        recordPk: log.entityId,
        userId: log.userId,
        action: log.action,
        beforeData: log.oldValues,
        afterData: log.newValues,
        eventTime: log.createdAt,
      },
    });
  }
  
  console.log(`✅ Migrated ${auditLogs.length} audit logs`);
}

async function main() {
  try {
    console.log('🚀 Starting Supabase migration...\n');
    
    // Migrate in dependency order
    await migrateUsers();
    await migrateCategories();
    await migrateProducts();
    await migrateLocations();
    await migrateInventory();
    await migrateStockMovements();
    await migrateAuditLogs();
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await oldPrisma.$disconnect();
    await newPrisma.$disconnect();
  }
}

// Run the migration
main();