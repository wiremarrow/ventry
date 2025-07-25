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

  // Wait a bit to ensure all test cleanup has completed
  console.log('⏱️ Waiting for test cleanup to complete...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    await prisma.$connect();

    // Get final stats
    const statsBefore = await getDatabaseStats();
    console.log('📈 Final database stats:');
    console.log(`   Total users: ${statsBefore.totalUsers} (${statsBefore.testUsers} test users)`);
    console.log(`   Total items: ${statsBefore.totalItems} (${statsBefore.testItems} test items)`);

    // Final cleanup - only clean up truly orphaned data
    console.log('\n🧹 Final test data cleanup (orphaned data only)...');
    await cleanupAllTestData();

    // Verify cleanup
    const statsAfter = await getDatabaseStats();
    console.log('\n📈 Database after cleanup:');
    console.log(`   Total users: ${statsAfter.totalUsers} (${statsAfter.testUsers} test users)`);
    console.log(`   Total items: ${statsAfter.totalItems} (${statsAfter.testItems} test items)`);

    console.log('\n✅ E2E Global Teardown Complete!\n');
  } catch (error) {
    console.error('\n❌ E2E Global Teardown Failed:', error);
    // Don't throw - we don't want to fail tests because of cleanup issues
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;
