import { prisma } from './client.js';

async function checkData() {
  try {
    const orgCount = await prisma.organization.count();
    const userCount = await prisma.user.count();
    const itemCount = await prisma.item.count();
    const warehouseCount = await prisma.warehouse.count();
    const supplierCount = await prisma.supplier.count();
    const customerCount = await prisma.customer.count();
    const orderCount = await prisma.order.count();
    
    console.log('📊 Database Status:');
    console.log(`Organizations: ${orgCount}`);
    console.log(`Users: ${userCount}`);
    console.log(`Items: ${itemCount}`);
    console.log(`Warehouses: ${warehouseCount}`);
    console.log(`Suppliers: ${supplierCount}`);
    console.log(`Customers: ${customerCount}`);
    console.log(`Orders: ${orderCount}`);
    
    if (orgCount === 0) {
      console.log('\n⚠️  No organizations found! Need to run comprehensive seed.');
    } else {
      const orgs = await prisma.organization.findMany({
        include: {
          members: {
            include: {
              user: true
            }
          }
        }
      });
      console.log('\n🏢 Organizations:');
      orgs.forEach(org => {
        console.log(`- ${org.name} (${org.members.length} members)`);
      });
    }
  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();