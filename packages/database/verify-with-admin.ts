#!/usr/bin/env tsx

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PrismaClient } from './generated/client/client.js';

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });

// Create a Prisma client using the admin connection
const adminPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_ADMIN_URL
    }
  }
});

async function verifyWithAdmin() {
  try {
    console.log('🔧 Using admin connection to verify database...\n');
    
    const counts = {
      organizations: await adminPrisma.organization.count(),
      items: await adminPrisma.item.count(),
      warehouses: await adminPrisma.warehouse.count(),
      locations: await adminPrisma.location.count(),
      inventory: await adminPrisma.inventory.count(),
      suppliers: await adminPrisma.supplier.count(),
      customers: await adminPrisma.customer.count(),
      orders: await adminPrisma.order.count(),
      movements: await adminPrisma.stockMovement.count()
    };
    
    console.log('Database counts:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });
    
    // Check low stock items
    const inventory = await adminPrisma.inventory.findMany({
      include: { item: true },
      take: 20,
      orderBy: { qtyOnHand: 'asc' }
    });
    
    const lowStockItems = inventory.filter(inv => 
      inv.item.reorderPoint && inv.qtyOnHand <= inv.item.reorderPoint
    );
    
    console.log(`\n📊 Low Stock Summary:`);
    console.log(`Total inventory records: ${inventory.length}`);
    console.log(`Low stock items: ${lowStockItems.length}`);
    
    console.log('\nFirst 10 inventory items (sorted by qty):');
    inventory.slice(0, 10).forEach(inv => {
      const status = inv.qtyOnHand === 0 ? '🔴' : 
                     (inv.item.reorderPoint && inv.qtyOnHand <= inv.item.reorderPoint) ? '🟡' : '🟢';
      console.log(`  ${status} ${inv.item.sku}: ${inv.qtyOnHand} on hand, reorder at ${inv.item.reorderPoint || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await adminPrisma.$disconnect();
  }
}

verifyWithAdmin();