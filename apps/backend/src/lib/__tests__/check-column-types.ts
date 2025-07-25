import { prisma } from '@ventry/database';

async function checkColumnTypes() {
  try {
    // Check column types for items table
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'items' 
      AND table_schema = 'public'
      AND column_name IN ('organization_id', 'id')
    `;
    console.log('Column types:', columns);
  } catch (error) {
    console.error('Error checking column types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumnTypes();
