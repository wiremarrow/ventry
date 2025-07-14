import { prisma } from '../index.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Enterprise-grade idempotent seeding - works safely with existing data
    console.log('🔧 Using idempotent operations for enterprise-grade reliability...');

    // Create admin user (idempotent - safe for CI/CD)
    const adminPassword = await bcrypt.hash('password123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@ventry.com' },
      update: {}, // Don't modify existing user in CI environments
      create: {
        email: 'admin@ventry.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        password: adminPassword,
        role: 'ADMIN',
      },
    });

    // Create manager user (idempotent - safe for CI/CD)
    const managerPassword = await bcrypt.hash('password123', 10);
    const manager = await prisma.user.upsert({
      where: { email: 'manager@ventry.com' },
      update: {}, // Don't modify existing user in CI environments
      create: {
        email: 'manager@ventry.com',
        username: 'manager',
        firstName: 'Manager',
        lastName: 'User',
        password: managerPassword,
        role: 'MANAGER',
      },
    });

    // Create regular user (idempotent - safe for CI/CD)
    const userPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.upsert({
      where: { email: 'user@ventry.com' },
      update: {}, // Don't modify existing user in CI environments
      create: {
        email: 'user@ventry.com',
        username: 'user',
        firstName: 'Regular',
        lastName: 'User',
        password: userPassword,
        role: 'USER',
      },
    });

    console.log('✅ Basic user seed completed successfully!');
    console.log('👤 Users: 3 (admin@ventry.com, manager@ventry.com, user@ventry.com)');
    console.log('\n📝 For comprehensive inventory data, run: pnpm db:seed:comprehensive');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });