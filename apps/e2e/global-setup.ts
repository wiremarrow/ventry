import { FullConfig } from '@playwright/test';
import { cleanupAllTestData, verifySeedDataExists, getDatabaseStats } from './utils/db-cleanup';
import { prisma } from '@ventry/database';

/**
 * Global setup for E2E tests
 *
 * Runs once before all tests to ensure:
 * 1. Database connection is working
 * 2. Seed data exists
 * 3. Any leftover test data is cleaned up
 */

async function globalSetup(config: FullConfig) {
  console.log('\n🚀 E2E Global Setup Starting...\n');

  try {
    // Test database connection
    console.log('📊 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Get initial stats
    const statsBefore = await getDatabaseStats();
    console.log('\n📈 Database stats before cleanup:');
    console.log(`   Total users: ${statsBefore.totalUsers} (${statsBefore.testUsers} test users)`);
    console.log(`   Total items: ${statsBefore.totalItems} (${statsBefore.testItems} test items)`);

    // Clean up any leftover test data from previous runs
    console.log('\n🧹 Cleaning up leftover test data...');
    await cleanupAllTestData();

    // Get stats after cleanup
    const statsAfter = await getDatabaseStats();
    console.log('\n📈 Database stats after cleanup:');
    console.log(`   Total users: ${statsAfter.totalUsers} (${statsAfter.testUsers} test users)`);
    console.log(`   Total items: ${statsAfter.totalItems} (${statsAfter.testItems} test items)`);

    // Verify seed data exists
    console.log('\n🌱 Verifying seed data...');
    await verifySeedDataExists();

    console.log('\n✅ E2E Global Setup Complete!\n');

    // Store config for use in tests if needed
    process.env.E2E_BASE_URL = config.projects?.[0]?.use?.baseURL || 'http://localhost:6061';
    process.env.E2E_SETUP_COMPLETE = 'true';
  } catch (error) {
    console.error('\n❌ E2E Global Setup Failed:', error);

    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('P1001') || error.message.includes('ECONNREFUSED')) {
        console.error('\n🔌 Database connection failed!');
        console.error('Make sure PostgreSQL is running:');
        console.error('  ./tools/scripts/switch-db.sh start');
      } else if (error.message.includes('seed user')) {
        console.error('\n🌱 Seed data missing!');
        console.error('Please run: pnpm db:seed');
      }
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
