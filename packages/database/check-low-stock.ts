#!/usr/bin/env tsx

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });

import { prisma } from './index.js';

async function checkLowStock() {
  try {
    // First check organizations
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
    });
    console.log('\n🏢 Organizations:');
    orgs.forEach((org) => console.log(`  - ${org.name} (${org.slug}): ${org.id}`));

    // Check items count per org
    const itemCounts = await prisma.item.groupBy({
      by: ['organizationId'],
      _count: true,
    });
    console.log('\n📦 Items per organization:');
    itemCounts.forEach((count) => {
      const org = orgs.find((o) => o.id === count.organizationId);
      console.log(`  - ${org?.name || count.organizationId}: ${count._count} items`);
    });

    // Get all inventory records with item details
    const inventory = await prisma.inventory.findMany({
      include: {
        item: true,
        location: true,
      },
      orderBy: {
        qtyOnHand: 'asc',
      },
      take: 20,
    });

    console.log('\n📊 Inventory Status for Ventry Corporation:');
    console.log(
      '═══════════════════════════════════════════════════════════════════════════════════'
    );
    console.log('SKU          | Name                     | On Hand | Reserved | Reorder | Status');
    console.log(
      '═══════════════════════════════════════════════════════════════════════════════════'
    );

    inventory.forEach((inv) => {
      const status =
        inv.qtyOnHand === 0
          ? '🔴 OUT OF STOCK'
          : inv.qtyOnHand < inv.item.reorderPoint
            ? '🟡 LOW STOCK'
            : '🟢 IN STOCK';

      console.log(
        `${inv.item.sku.padEnd(12)} | ${inv.item.name.padEnd(24).substring(0, 24)} | ${String(inv.qtyOnHand).padStart(7)} | ${String(inv.qtyReserved).padStart(8)} | ${String(inv.item.reorderPoint).padStart(7)} | ${status}`
      );
    });

    // Count totals
    const counts = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(CASE WHEN inv.qty_on_hand = 0 THEN 1 END) as out_of_stock,
        COUNT(CASE WHEN inv.qty_on_hand < i.reorder_point AND inv.qty_on_hand > 0 THEN 1 END) as low_stock,
        COUNT(CASE WHEN inv.qty_on_hand >= i.reorder_point THEN 1 END) as in_stock,
        COUNT(*) as total
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      JOIN organizations o ON i.organization_id = o.id
      WHERE o.slug = 'ventry-corp'
    `;

    console.log('\n📈 Summary:');
    console.log(`Total inventory records: ${counts[0].total}`);
    console.log(`🔴 Out of stock: ${counts[0].out_of_stock}`);
    console.log(`🟡 Low stock: ${counts[0].low_stock}`);
    console.log(`🟢 In stock: ${counts[0].in_stock}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLowStock();
