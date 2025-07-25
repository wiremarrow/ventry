#!/usr/bin/env tsx

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });

import { prisma } from './index.js';

async function listOrganizations() {
  try {
    const orgs = await prisma.organization.findMany({
      include: { _count: { select: { items: true, warehouses: true } } },
    });

    console.log('Organizations in database:');
    orgs.forEach((org) => {
      console.log(`\n${org.name} (${org.slug})`);
      console.log(`  ID: ${org.id}`);
      console.log(`  Items: ${org._count.items}`);
      console.log(`  Warehouses: ${org._count.warehouses}`);
    });

    // Check items table directly
    const totalItems = await prisma.item.count();
    console.log(`\nTotal items in database: ${totalItems}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listOrganizations();
