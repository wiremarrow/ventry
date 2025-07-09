import { FullConfig } from '@playwright/test';
import { cleanupAllTestData, getDatabaseStats } from './utils/db-cleanup';
import { prisma } from '@ventry/database';

/**
 * Global teardown for E2E tests
 * 
 * Runs once after all tests to clean up test data
 */

async function globalTeardown(_config: FullConfig) {
  console.log('\n🧹 E2E Global Teardown Starting...\n');

  try {
    await prisma.$connect();

    // Get final stats
    const statsBefore = await getDatabaseStats();
    console.log('📈 Final database stats:');
    console.log(`   Total users: ${statsBefore.totalUsers} (${statsBefore.testUsers} test users)`);
    console.log(`   Total products: ${statsBefore.totalProducts} (${statsBefore.testProducts} test products)`);

    // Final cleanup
    console.log('\n🧹 Final test data cleanup...');
    await cleanupAllTestData();

    // Verify cleanup
    const statsAfter = await getDatabaseStats();
    console.log('\n📈 Database after cleanup:');
    console.log(`   Total users: ${statsAfter.totalUsers} (${statsAfter.testUsers} test users)`);
    console.log(`   Total products: ${statsAfter.totalProducts} (${statsAfter.testProducts} test products)`);

    console.log('\n✅ E2E Global Teardown Complete!\n');

  } catch (error) {
    console.error('\n❌ E2E Global Teardown Failed:', error);
    // Don't throw - we don't want to fail tests because of cleanup issues
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;