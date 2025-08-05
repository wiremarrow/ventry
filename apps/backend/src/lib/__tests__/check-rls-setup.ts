import { prisma } from '@ventry/database';

async function checkRLSSetup() {
  try {
    // Check if RLS functions exist
    const functions = await prisma.$queryRaw`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_type = 'FUNCTION' 
      AND routine_name IN ('current_organization_id', 'current_user_id', 'is_organization_member')
      AND routine_schema = 'public'
    `;
    console.log('RLS Functions:', functions);

    // Check if RLS is enabled on items table
    const rlsStatus = await prisma.$queryRaw`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'items' 
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;
    console.log('RLS Status on items table:', rlsStatus);

    // Check policies
    const policies = await prisma.$queryRaw`
      SELECT polname, polcmd, polpermissive 
      FROM pg_policy 
      WHERE polrelid = (
        SELECT oid FROM pg_class 
        WHERE relname = 'items' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      )
    `;
    console.log('RLS Policies on items table:', policies);
  } catch (error) {
    console.error('Error checking RLS setup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRLSSetup();
