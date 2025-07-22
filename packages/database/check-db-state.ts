#!/usr/bin/env tsx

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });

import { prisma } from './index.js';

async function checkDatabaseState() {
  try {
    const itemCount = await prisma.item.count();
    const inventoryCount = await prisma.inventory.count();
    const orgCount = await prisma.organization.count();
    const warehouseCount = await prisma.warehouse.count();
    const locationCount = await prisma.location.count();
    
    console.log('Database State:');
    console.log('  Organizations:', orgCount);
    console.log('  Items:', itemCount);
    console.log('  Inventory records:', inventoryCount);
    console.log('  Warehouses:', warehouseCount);
    console.log('  Locations:', locationCount);
    
    // Check specifically in Ventry org
    const ventryOrg = await prisma.organization.findFirst({
      where: { slug: 'ventry-corp' }
    });
    
    if (ventryOrg) {
      const ventryItems = await prisma.item.count({
        where: { organizationId: ventryOrg.id }
      });
      console.log('\nVentry Corporation:');
      console.log('  Items:', ventryItems);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseState();