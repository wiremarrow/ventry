#!/usr/bin/env tsx

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });

import { prisma } from './index.js';

async function countAll() {
  try {
    const counts = {
      organizations: await prisma.organization.count(),
      items: await prisma.item.count(),
      warehouses: await prisma.warehouse.count(),
      locations: await prisma.location.count(),
      inventory: await prisma.inventory.count(),
      suppliers: await prisma.supplier.count(),
      customers: await prisma.customer.count(),
      orders: await prisma.order.count(),
      movements: await prisma.stockMovement.count(),
    };

    console.log('Database counts:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`  ${table}: ${count}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

countAll();
