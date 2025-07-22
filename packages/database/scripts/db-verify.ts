#!/usr/bin/env tsx

import { Command } from 'commander';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

import { createPrismaClient, compareAccess } from './verify/auth-context.js';
import { formatOutput, formatError } from './verify/formatters.js';
import { executeCount, executeShow, executeStats, getTableInfo } from './verify/query-builder.js';
import type { GlobalOptions, CountOptions, ShowOptions, StatsOptions } from './verify/types.js';

const program = new Command();

// Global options
program
  .name('db:verify')
  .description(`Database verification and inspection tool

WHERE clause examples:
  Simple conditions:
    --where "isActive = true"
    --where "qtyOnHand > 100"
    --where "name = 'Widget'"
  
  Field comparisons (same table):
    --where "qtyOnHand <= qtyReserved"    # Over-reserved items
    --where "actualQty != expectedQty"     # Inventory discrepancies
    --where "defaultPrice > defaultCost"   # Profitable items
    
  Cross-table comparisons:
    --where "qtyOnHand <= item.reorderPoint"         # Low stock items
    --where "inventory.qtyOnHand <= item.reorderPoint"  # Explicit table names`)
  .version('1.0.0')
  .option('--user <type>', 'Database user: admin or app', 'admin')
  .option('--auth <email>', 'Simulate authenticated user (requires --user app)')
  .option('--format <type>', 'Output format: table, json, csv, count', 'table')
  .option('--org <slug>', 'Filter by organization slug')
  .option('--verbose', 'Show SQL queries being executed', false)
  .hook('preAction', (thisCommand, actionCommand) => {
    const opts = thisCommand.opts();
    
    // Validate user type
    if (opts.user && !['admin', 'app'].includes(opts.user)) {
      console.error(`Error: Invalid user type '${opts.user}'. Must be 'admin' or 'app'.`);
      process.exit(1);
    }
    
    // Validate format
    if (opts.format && !['table', 'json', 'csv', 'count'].includes(opts.format)) {
      console.error(`Error: Invalid format '${opts.format}'. Must be 'table', 'json', 'csv', or 'count'.`);
      process.exit(1);
    }
    
    // Validate auth requires app user
    if (opts.auth && opts.user !== 'app') {
      console.error(`Error: --auth option requires --user app`);
      process.exit(1);
    }
  });

// Count command
program
  .command('count <table>')
  .description('Count records in a table')
  .option('--where <condition>', 'WHERE clause condition (e.g., "isActive = true", "qtyOnHand > 100", "qtyOnHand <= reorderPoint")')
  .action(async (table: string, cmdOptions: any) => {
    const options: CountOptions = {
      ...program.opts(),
      ...cmdOptions
    };

    if (table === 'all') {
      await countAllTables(options);
      return;
    }

    const prisma = await createPrismaClient(options);
    
    try {
      const count = await executeCount(prisma, table, options);
      const result = { data: [{ table, count }], count };
      console.log(formatOutput(result, options.format));
    } catch (error) {
      console.error(formatError(error as Error));
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// Show command
program
  .command('show <table>')
  .description('Display records from a table')
  .option('--where <condition>', 'WHERE clause condition (e.g., "isActive = true", "qtyOnHand > 100", "qtyOnHand <= reorderPoint")')
  .option('--select <fields>', 'Fields to select (comma-separated)')
  .option('--limit <n>', 'Number of records', '10')
  .option('--offset <n>', 'Skip records', '0')
  .option('--order-by <field>', 'Sort by field')
  .option('--order <dir>', 'Sort direction: asc or desc', 'asc')
  .action(async (table: string, cmdOptions: any) => {
    const limit = parseInt(cmdOptions.limit);
    const offset = parseInt(cmdOptions.offset);
    
    // Validate numeric options
    if (isNaN(limit) || limit < 0) {
      console.error(`Error: Invalid limit '${cmdOptions.limit}'. Must be a non-negative number.`);
      process.exit(1);
    }
    if (isNaN(offset) || offset < 0) {
      console.error(`Error: Invalid offset '${cmdOptions.offset}'. Must be a non-negative number.`);
      process.exit(1);
    }
    
    // Validate order direction
    if (cmdOptions.order && !['asc', 'desc'].includes(cmdOptions.order)) {
      console.error(`Error: Invalid sort order '${cmdOptions.order}'. Must be 'asc' or 'desc'.`);
      process.exit(1);
    }
    
    const options: ShowOptions = {
      ...program.opts(),
      ...cmdOptions,
      limit,
      offset
    };

    const prisma = await createPrismaClient(options);
    
    try {
      const data = await executeShow(prisma, table, options);
      const result = { data, count: data.length };
      console.log(formatOutput(result, options.format));
    } catch (error) {
      console.error(formatError(error as Error));
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// Stats command
program
  .command('stats <table>')
  .description('Calculate statistics on a table')
  .option('--where <condition>', 'WHERE clause condition (e.g., "isActive = true", "qtyOnHand > 100", "qtyOnHand <= reorderPoint")')
  .option('--group-by <field>', 'Group by field')
  .option('--count <field>', 'Count field')
  .option('--sum <field>', 'Sum field')
  .option('--avg <field>', 'Average field')
  .option('--min <field>', 'Minimum field')
  .option('--max <field>', 'Maximum field')
  .action(async (table: string, cmdOptions: any) => {
    // Validate that at least one aggregate function is provided
    if (!cmdOptions.count && !cmdOptions.sum && !cmdOptions.avg && !cmdOptions.min && !cmdOptions.max) {
      console.error('Error: At least one aggregate function (--count, --sum, --avg, --min, --max) is required');
      process.exit(1);
    }
    
    const options: StatsOptions = {
      ...program.opts(),
      ...cmdOptions
    };

    const prisma = await createPrismaClient(options);
    
    try {
      const data = await executeStats(prisma, table, options);
      const result = { data, count: data.length };
      console.log(formatOutput(result, options.format));
    } catch (error) {
      console.error(formatError(error as Error));
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// Access command
program
  .command('access <table>')
  .description('Test RLS access for a specific user')
  .requiredOption('--as <email>', 'User email to test as')
  .action(async (table: string, cmdOptions: any) => {
    const options: GlobalOptions = {
      ...program.opts(),
      user: 'app',
      auth: cmdOptions.as
    };

    const prisma = await createPrismaClient(options);
    
    try {
      const count = await executeCount(prisma, table, options as CountOptions);
      console.log(`User '${cmdOptions.as}' can see ${count} records in table '${table}'`);
    } catch (error) {
      console.error(formatError(error as Error));
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// Compare command
program
  .command('compare <table>')
  .description('Compare access between multiple users')
  .requiredOption('--users <emails>', 'Comma-separated list of user emails')
  .action(async (table: string, cmdOptions: any) => {
    const options: GlobalOptions = {
      ...program.opts(),
      ...cmdOptions
    };

    const users = cmdOptions.users.split(',').map((u: string) => u.trim());
    
    try {
      const results = await compareAccess(table, users, options);
      
      console.log(`Access comparison for table '${table}':\n`);
      Object.entries(results).forEach(([user, count]) => {
        console.log(`  ${user}: ${count} records`);
      });
    } catch (error) {
      console.error(formatError(error as Error));
      process.exit(1);
    }
  });

// Tables command
program
  .command('tables')
  .description('List all available tables')
  .action(() => {
    const tables = ['user', 'organization', 'item', 'inventory', 'warehouse', 'location', 
                   'order', 'orderItem', 'customer', 'supplier', 'stockMovement', 'stockAdjustment',
                   'lot', 'serialNumber', 'itemCategory', 'unitOfMeasure', 'address', 
                   'purchaseOrder', 'purchaseOrderItem', 'payment', 'paymentMethod',
                   'shipment', 'shipmentItem', 'return', 'returnItem', 'cycleCount', 
                   'cycleCountItem', 'receipt', 'receiptItem', 'carrier', 'shippingMethod',
                   'posTransaction', 'posTransactionItem', 'discount', 'supplierContact', 
                   'auditLog'];
    
    console.log('Available tables:');
    tables.sort().forEach(table => console.log(`  - ${table}`));
  });

// Helper function to count all tables
async function countAllTables(options: CountOptions) {
  const tables = ['user', 'organization', 'item', 'inventory', 'warehouse', 'location', 
                 'order', 'orderItem', 'customer', 'supplier', 'stockMovement', 'stockAdjustment',
                 'itemCategory', 'unitOfMeasure', 'lot', 'purchaseOrder', 'purchaseOrderItem',
                 'payment', 'paymentMethod', 'shipment', 'shipmentItem', 'return', 'returnItem',
                 'cycleCount', 'cycleCountItem', 'receipt', 'receiptItem', 'carrier', 
                 'shippingMethod', 'posTransaction', 'posTransactionItem', 'discount', 
                 'supplierContact', 'address', 'auditLog'];
  
  const prisma = await createPrismaClient(options);
  const results: any[] = [];
  
  try {
    for (const table of tables) {
      try {
        const count = await executeCount(prisma, table, options);
        results.push({ table, count });
      } catch (error) {
        // Handle specific error for better display
        if (error instanceof Error && error.message.includes('not found')) {
          continue; // Skip tables that don't exist
        }
        results.push({ table, count: 'error', error: (error as Error).message });
      }
    }
    
    const result = { data: results, count: results.length };
    console.log(formatOutput(result, options.format));
  } finally {
    await prisma.$disconnect();
  }
}

// Add custom help
program.on('--help', () => {
  console.log('');
  console.log('Common Business Queries:');
  console.log('');
  console.log('  INVENTORY MANAGEMENT:');
  console.log('  # Low stock items (cross-table comparison)');
  console.log('  $ pnpm db:verify count inventory --where "qtyOnHand <= item.reorderPoint"');
  console.log('  $ pnpm db:verify show inventory --where "qtyOnHand <= item.reorderPoint" --select "item.sku,item.name,qtyOnHand,item.reorderPoint"');
  console.log('');
  console.log('  # Over-reserved inventory');
  console.log('  $ pnpm db:verify show inventory --where "qtyReserved > qtyOnHand" --select "item.sku,qtyOnHand,qtyReserved"');
  console.log('');
  console.log('  # Inventory by warehouse');
  console.log('  $ pnpm db:verify stats inventory --group-by locationId --sum qtyOnHand --count id');
  console.log('');
  console.log('  # Items never ordered');
  console.log('  $ pnpm db:verify count item --where "id NOT IN (SELECT itemId FROM orderItem)"');
  console.log('');
  console.log('  ORDER ANALYSIS:');
  console.log('  # Pending orders by status');
  console.log('  $ pnpm db:verify stats order --group-by status --count id --sum grandTotal');
  console.log('');
  console.log('  # High-value orders');
  console.log('  $ pnpm db:verify show order --where "grandTotal > 10000" --order-by grandTotal --order desc');
  console.log('');
  console.log('  # Orders with unpaid balance');
  console.log('  $ pnpm db:verify count order --where "status != \'CANCELLED\' AND grandTotal > 0"');
  console.log('');
  console.log('  SUPPLIER PERFORMANCE:');
  console.log('  # Overdue purchase orders');
  console.log('  $ pnpm db:verify count purchaseOrder --where "status = \'ORDERED\' AND expectedDate < NOW()"');
  console.log('');
  console.log('  # Suppliers by order count');
  console.log('  $ pnpm db:verify stats purchaseOrder --group-by supplierId --count id');
  console.log('');
  console.log('  CUSTOMER INSIGHTS:');
  console.log('  # Top customers by order value');
  console.log('  $ pnpm db:verify stats order --group-by customerId --sum grandTotal --count id --order-by sum --order desc');
  console.log('');
  console.log('  # Customers with returns');
  console.log('  $ pnpm db:verify stats return --group-by customerId --count id --sum refundAmount');
  console.log('');
  console.log('  FINANCIAL QUERIES:');
  console.log('  # Profitable items');
  console.log('  $ pnpm db:verify count item --where "defaultPrice > defaultCost"');
  console.log('');
  console.log('  # Pending payments');
  console.log('  $ pnpm db:verify stats payment --where "status = \'PENDING\'" --sum amount');
  console.log('');
  console.log('  OPERATIONAL:');
  console.log('  # Upcoming shipments');
  console.log('  $ pnpm db:verify count shipment --where "status = \'PENDING\' AND shipDate <= NOW() + INTERVAL \'7 days\'"');
  console.log('');
  console.log('  # Cycle count variances');
  console.log('  $ pnpm db:verify show cycleCountItem --where "actualQty != expectedQty" --select "item.sku,expectedQty,actualQty,variance"');
  console.log('');
  console.log('  DATA EXPORT:');
  console.log('  # Export all customers to CSV');
  console.log('  $ pnpm db:verify show customer --format csv > customers.csv');
  console.log('');
  console.log('  # Export inventory snapshot');
  console.log('  $ pnpm db:verify show inventory --select "item.sku,location.code,qtyOnHand" --format csv > inventory-snapshot.csv');
  console.log('');
  console.log('  RLS TESTING:');
  console.log('  # Test what employee can see');
  console.log('  $ pnpm db:verify access order --as employee@ventry.com');
  console.log('');
  console.log('  # Compare user access');
  console.log('  $ pnpm db:verify compare customer --users "admin@ventry.com,manager@ventry.com,employee@ventry.com"');
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}