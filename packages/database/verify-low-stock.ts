#!/usr/bin/env tsx

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });

import { prisma } from './index.js';

async function verifyLowStock() {
  try {
    // First check what organizations exist
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true }
    });
    console.log('\n🏢 Organizations in database:');
    orgs.forEach(org => console.log(`  - ${org.name} (${org.slug}): ${org.id}`));

    // Check how many items each org has
    for (const org of orgs) {
      const itemCount = await prisma.item.count({
        where: { organizationId: org.id }
      });
      const invCount = await prisma.inventory.count({
        where: { organizationId: org.id }
      });
      console.log(`\n📦 ${org.name}:`);
      console.log(`  - Items: ${itemCount}`);
      console.log(`  - Inventory records: ${invCount}`);
    }

    // Get first 15 items with their inventory
    const items = await prisma.item.findMany({
      include: {
        inventory: {
          include: {
            location: true
          }
        }
      },
      orderBy: {
        sku: 'asc'
      },
      take: 15
    });

    console.log('\n📊 First 15 Items in Ventry Corporation:');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
    console.log('#  | SKU          | Name                     | Reorder | Location      | On Hand | Status');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
    
    items.forEach((item, index) => {
      if (item.inventory.length > 0) {
        const inv = item.inventory[0]; // First location
        const status = inv.qtyOnHand === 0 ? '🔴 OUT OF STOCK' :
                       inv.qtyOnHand < item.reorderPoint ? '🟡 LOW STOCK' : 
                       '🟢 IN STOCK';
        
        console.log(
          `${String(index + 1).padStart(2)} | ${item.sku.padEnd(12)} | ${item.name.padEnd(24).substring(0, 24)} | ${String(item.reorderPoint).padStart(7)} | ${inv.location.code.padEnd(13)} | ${String(inv.qtyOnHand).padStart(7)} | ${status}`
        );
      } else {
        console.log(
          `${String(index + 1).padStart(2)} | ${item.sku.padEnd(12)} | ${item.name.padEnd(24).substring(0, 24)} | ${String(item.reorderPoint).padStart(7)} | NO INVENTORY  |       - | ❓ NO DATA`
        );
      }
    });

    // Also check the actual low stock filter logic
    const inventory = await prisma.inventory.findMany({
      where: {
        organization: {
          slug: 'ventry-corp'
        }
      },
      include: {
        item: true
      }
    });

    const lowStockItems = inventory.filter(inv => 
      inv.item.reorderPoint && inv.qtyOnHand <= inv.item.reorderPoint
    );

    console.log(`\n📈 Low Stock Summary:`);
    console.log(`Total inventory records: ${inventory.length}`);
    console.log(`Low stock items (qty <= reorder point): ${lowStockItems.length}`);
    console.log(`\nFirst 5 low stock items:`);
    lowStockItems.slice(0, 5).forEach(inv => {
      console.log(`  - ${inv.item.sku}: ${inv.qtyOnHand} on hand, reorder at ${inv.item.reorderPoint}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyLowStock();