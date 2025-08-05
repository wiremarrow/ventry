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
  .description(
    `Database verification and inspection tool

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
    --where "inventory.qtyOnHand <= item.reorderPoint"  # Explicit table names
    
  Advanced operators:
    --where "status IN ('PENDING', 'APPROVED')"      # IN clause
    --where "name LIKE '%Widget%'"                   # Pattern matching
    --where "deletedAt IS NULL"                      # NULL checks
    --where "deletedAt IS NOT NULL"                  # NOT NULL checks
    --where "status = 'ACTIVE' AND price > 100"      # Simple AND conditions
    
  Date comparisons:
    --where "createdAt > NOW() - INTERVAL '7 days'"  # Recent records
    --where "expiryDate < NOW()"                      # Expired items
    --where "orderDate >= CURRENT_DATE"               # Today's orders`
  )
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
      console.error(
        `Error: Invalid format '${opts.format}'. Must be 'table', 'json', 'csv', or 'count'.`
      );
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
  .option(
    '--where <condition>',
    'WHERE clause condition (e.g., "isActive = true", "qtyOnHand > 100", "qtyOnHand <= reorderPoint")'
  )
  .action(async (table: string, cmdOptions: any) => {
    const options: CountOptions = {
      ...program.opts(),
      ...cmdOptions,
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
  .option(
    '--where <condition>',
    'WHERE clause condition (e.g., "isActive = true", "qtyOnHand > 100", "qtyOnHand <= reorderPoint")'
  )
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
      offset,
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
  .option(
    '--where <condition>',
    'WHERE clause condition (e.g., "isActive = true", "qtyOnHand > 100", "qtyOnHand <= reorderPoint")'
  )
  .option('--group-by <field>', 'Group by field')
  .option('--count <field>', 'Count field')
  .option('--sum <field>', 'Sum field')
  .option('--avg <field>', 'Average field')
  .option('--min <field>', 'Minimum field')
  .option('--max <field>', 'Maximum field')
  .action(async (table: string, cmdOptions: any) => {
    // Validate that at least one aggregate function is provided
    if (
      !cmdOptions.count &&
      !cmdOptions.sum &&
      !cmdOptions.avg &&
      !cmdOptions.min &&
      !cmdOptions.max
    ) {
      console.error(
        'Error: At least one aggregate function (--count, --sum, --avg, --min, --max) is required'
      );
      process.exit(1);
    }

    const options: StatsOptions = {
      ...program.opts(),
      ...cmdOptions,
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
      auth: cmdOptions.as,
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
      ...cmdOptions,
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
    const tables = [
      'user',
      'organization',
      'item',
      'inventory',
      'warehouse',
      'location',
      'order',
      'orderItem',
      'customer',
      'supplier',
      'stockMovement',
      'stockAdjustment',
      'lot',
      'serialNumber',
      'itemCategory',
      'unitOfMeasure',
      'address',
      'purchaseOrder',
      'purchaseOrderItem',
      'payment',
      'paymentMethod',
      'shipment',
      'shipmentItem',
      'return',
      'returnItem',
      'cycleCount',
      'cycleCountItem',
      'receipt',
      'receiptItem',
      'carrier',
      'shippingMethod',
      'posTransaction',
      'posTransactionItem',
      'discount',
      'supplierContact',
      'auditLog',
    ];

    console.log('Available tables:');
    tables.sort().forEach((table) => console.log(`  - ${table}`));
  });

// Fields command
program
  .command('fields <table>')
  .description('Show all fields for a table')
  .action(async (table: string) => {
    const options: GlobalOptions = {
      ...program.opts(),
    };

    try {
      const tableInfo = getTableInfo(table);
      if (!tableInfo) {
        console.error(`Error: Table '${table}' not found`);
        process.exit(1);
      }

      console.log(`\nFields for table '${table}':\n`);

      // Group fields by type
      const systemFields = ['id', 'createdAt', 'updatedAt', 'organizationId'];
      const regularFields = tableInfo.fields.filter((f) => !systemFields.includes(f));

      if (regularFields.length > 0) {
        console.log('Business Fields:');
        regularFields.forEach((field) => {
          console.log(`  - ${field}`);
        });
      }

      const presentSystemFields = tableInfo.fields.filter((f) => systemFields.includes(f));
      if (presentSystemFields.length > 0) {
        console.log('\nSystem Fields:');
        presentSystemFields.forEach((field) => {
          console.log(`  - ${field}`);
        });
      }

      if (Object.keys(tableInfo.relations).length > 0) {
        console.log('\nRelationships:');
        Object.entries(tableInfo.relations).forEach(([field, targetTable]) => {
          console.log(`  - ${field} → ${targetTable}`);
        });
      }
    } catch (error) {
      console.error(formatError(error as Error));
      process.exit(1);
    }
  });

// Relationships command
program
  .command('relationships [table]')
  .description('Show foreign key relationships between tables')
  .action(async (table?: string) => {
    try {
      if (table) {
        // Show relationships for specific table
        const tableInfo = getTableInfo(table);
        if (!tableInfo) {
          console.error(`Error: Table '${table}' not found`);
          process.exit(1);
        }

        console.log(`\nRelationships for table '${table}':\n`);

        if (Object.keys(tableInfo.relations).length === 0) {
          console.log('No foreign key relationships found.');
        } else {
          console.log('Outgoing relationships (this table references):');
          Object.entries(tableInfo.relations).forEach(([field, targetTable]) => {
            console.log(`  ${table}.${field} → ${targetTable}.id`);
          });
        }

        // Find incoming relationships
        console.log('\nIncoming relationships (tables that reference this):');
        const allTables = [
          'user',
          'organization',
          'item',
          'inventory',
          'warehouse',
          'location',
          'order',
          'orderItem',
          'customer',
          'supplier',
          'stockMovement',
        ];
        let foundIncoming = false;

        allTables.forEach((otherTable) => {
          if (otherTable !== table) {
            const otherInfo = getTableInfo(otherTable);
            if (otherInfo) {
              Object.entries(otherInfo.relations).forEach(([field, target]) => {
                if (target === table) {
                  console.log(`  ${otherTable}.${field} → ${table}.id`);
                  foundIncoming = true;
                }
              });
            }
          }
        });

        if (!foundIncoming) {
          console.log('  None found');
        }
      } else {
        // Show all relationships
        console.log('\nAll table relationships:\n');
        const tables = [
          'item',
          'inventory',
          'order',
          'orderItem',
          'warehouse',
          'location',
          'customer',
          'supplier',
          'purchaseOrder',
          'purchaseOrderItem',
        ];

        tables.forEach((tableName) => {
          const tableInfo = getTableInfo(tableName);
          if (tableInfo && Object.keys(tableInfo.relations).length > 0) {
            console.log(`${tableName}:`);
            Object.entries(tableInfo.relations).forEach(([field, targetTable]) => {
              console.log(`  ${field} → ${targetTable}`);
            });
            console.log('');
          }
        });
      }
    } catch (error) {
      console.error(formatError(error as Error));
      process.exit(1);
    }
  });

// Sample command
program
  .command('sample <table>')
  .description('Get random sample data from a table')
  .option('--size <n>', 'Number of samples', '5')
  .action(async (table: string, cmdOptions: any) => {
    const size = parseInt(cmdOptions.size);

    if (isNaN(size) || size < 1 || size > 100) {
      console.error(`Error: Invalid sample size '${cmdOptions.size}'. Must be between 1 and 100.`);
      process.exit(1);
    }

    const options: ShowOptions = {
      ...program.opts(),
      ...cmdOptions,
      limit: size,
      offset: 0,
      order: 'asc' as SortOrder,
    };

    const prisma = await createPrismaClient(options);

    try {
      // First get total count
      const count = await executeCount(prisma, table, options);

      if (count === 0) {
        console.log(`No records found in table '${table}'`);
        return;
      }

      // Get random samples by using different offsets
      const samples = [];
      const usedOffsets = new Set<number>();

      for (let i = 0; i < Math.min(size, count); i++) {
        let offset;
        do {
          offset = Math.floor(Math.random() * count);
        } while (usedOffsets.has(offset) && usedOffsets.size < count);

        usedOffsets.add(offset);

        const sampleOptions = { ...options, limit: 1, offset };
        const data = await executeShow(prisma, table, sampleOptions);
        if (data.length > 0) {
          samples.push(data[0]);
        }
      }

      const result = { data: samples, count: samples.length };
      console.log(formatOutput(result, options.format));
    } catch (error) {
      console.error(formatError(error as Error));
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// Validate command
program
  .command('validate [check]')
  .description('Run data integrity checks')
  .option('--fix', 'Attempt to fix issues (NOT IMPLEMENTED - read-only)', false)
  .action(async (check?: string, cmdOptions?: any) => {
    const options: GlobalOptions = {
      ...program.opts(),
      ...cmdOptions,
    };

    const prisma = await createPrismaClient(options);

    try {
      const checks = check ? [check] : ['orphans', 'constraints', 'duplicates', 'business'];
      let totalIssues = 0;

      console.log('Running data integrity checks...\n');

      for (const checkType of checks) {
        switch (checkType) {
          case 'orphans':
            console.log('=== Checking for orphaned records ===');
            // Check inventory without items
            const orphanedInventory = await prisma.$queryRaw`
              SELECT COUNT(*) as count FROM inventory i
              LEFT JOIN item it ON i.item_id = it.id
              WHERE it.id IS NULL`;
            console.log(`Inventory records without items: ${(orphanedInventory as any)[0].count}`);
            totalIssues += parseInt((orphanedInventory as any)[0].count);

            // Check order items without orders
            const orphanedOrderItems = await prisma.$queryRaw`
              SELECT COUNT(*) as count FROM order_item oi
              LEFT JOIN "order" o ON oi.order_id = o.id
              WHERE o.id IS NULL`;
            console.log(`Order items without orders: ${(orphanedOrderItems as any)[0].count}`);
            totalIssues += parseInt((orphanedOrderItems as any)[0].count);

            console.log('');
            break;

          case 'constraints':
            console.log('=== Checking business constraints ===');
            // Check over-reserved inventory
            const overReserved = await prisma.$queryRaw`
              SELECT COUNT(*) as count FROM inventory
              WHERE qty_reserved > qty_on_hand`;
            console.log(`Over-reserved inventory items: ${(overReserved as any)[0].count}`);
            totalIssues += parseInt((overReserved as any)[0].count);

            // Check negative quantities
            const negativeQty = await prisma.$queryRaw`
              SELECT COUNT(*) as count FROM inventory
              WHERE qty_on_hand < 0 OR qty_reserved < 0`;
            console.log(`Items with negative quantities: ${(negativeQty as any)[0].count}`);
            totalIssues += parseInt((negativeQty as any)[0].count);

            console.log('');
            break;

          case 'duplicates':
            console.log('=== Checking for duplicate values ===');
            // Check duplicate SKUs
            const duplicateSkus = await prisma.$queryRaw`
              SELECT sku, COUNT(*) as count FROM item
              WHERE organization_id IS NOT NULL
              GROUP BY sku, organization_id
              HAVING COUNT(*) > 1`;
            console.log(`Duplicate SKUs found: ${(duplicateSkus as any[]).length}`);
            if ((duplicateSkus as any[]).length > 0) {
              (duplicateSkus as any[]).slice(0, 5).forEach((dup) => {
                console.log(`  - SKU '${dup.sku}': ${dup.count} occurrences`);
              });
            }
            totalIssues += (duplicateSkus as any[]).length;

            console.log('');
            break;

          case 'business':
            console.log('=== Checking business rules ===');
            // Check items without reorder points
            const noReorderPoint = await prisma.$queryRaw`
              SELECT COUNT(*) as count FROM item
              WHERE reorder_point IS NULL OR reorder_point = 0`;
            console.log(`Items without reorder points: ${(noReorderPoint as any)[0].count}`);

            // Check unfulfilled orders older than 30 days
            const oldPendingOrders = await prisma.$queryRaw`
              SELECT COUNT(*) as count FROM "order"
              WHERE status = 'PENDING' 
              AND order_date < NOW() - INTERVAL '30 days'`;
            console.log(`Pending orders older than 30 days: ${(oldPendingOrders as any)[0].count}`);

            console.log('');
            break;

          default:
            console.log(`Unknown check type: ${checkType}`);
        }
      }

      console.log(`\nTotal issues found: ${totalIssues}`);
      if (cmdOptions?.fix) {
        console.log('\nNote: --fix option is not implemented. This tool is read-only.');
      }
    } catch (error) {
      console.error(formatError(error as Error));
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// Helper function to count all tables
async function countAllTables(options: CountOptions) {
  const tables = [
    'user',
    'organization',
    'item',
    'inventory',
    'warehouse',
    'location',
    'order',
    'orderItem',
    'customer',
    'supplier',
    'stockMovement',
    'stockAdjustment',
    'itemCategory',
    'unitOfMeasure',
    'lot',
    'purchaseOrder',
    'purchaseOrderItem',
    'payment',
    'paymentMethod',
    'shipment',
    'shipmentItem',
    'return',
    'returnItem',
    'cycleCount',
    'cycleCountItem',
    'receipt',
    'receiptItem',
    'carrier',
    'shippingMethod',
    'posTransaction',
    'posTransactionItem',
    'discount',
    'supplierContact',
    'address',
    'auditLog',
  ];

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
  console.log('UTILITY COMMANDS:');
  console.log('  # List all available tables');
  console.log('  $ pnpm db:verify tables');
  console.log('');
  console.log('  # Show all fields for a table');
  console.log('  $ pnpm db:verify fields inventory');
  console.log('');
  console.log('  # Show foreign key relationships');
  console.log('  $ pnpm db:verify relationships order        # For specific table');
  console.log('  $ pnpm db:verify relationships              # For all tables');
  console.log('');
  console.log('  # Get random sample data');
  console.log('  $ pnpm db:verify sample item --size 5');
  console.log('  $ pnpm db:verify sample customer --size 10');
  console.log('');
  console.log('  # Run data integrity checks');
  console.log('  $ pnpm db:verify validate                   # All checks');
  console.log('  $ pnpm db:verify validate orphans           # Check for orphaned records');
  console.log('  $ pnpm db:verify validate constraints       # Check business constraints');
  console.log('  $ pnpm db:verify validate duplicates        # Check for duplicate values');
  console.log('  $ pnpm db:verify validate business          # Check business rules');
  console.log('');
  console.log('ADVANCED WHERE CLAUSE EXAMPLES:');
  console.log('  # IN operator for multiple values');
  console.log(
    "  $ pnpm db:verify count order --where \"status IN ('PENDING', 'CONFIRMED', 'PACKED')\""
  );
  console.log('  $ pnpm db:verify show item --where "categoryId IN (1, 2, 3)" --limit 10');
  console.log('');
  console.log('  # LIKE pattern matching (% = any characters, _ = single character)');
  console.log('  $ pnpm db:verify show customer --where "email LIKE \'%@ventry.com\'"');
  console.log('  $ pnpm db:verify count item --where "sku LIKE \'WIDGET%\'"');
  console.log('  $ pnpm db:verify show supplier --where "name LIKE \'%Corp%\'"');
  console.log('');
  console.log('  # NULL checks');
  console.log('  $ pnpm db:verify count customer --where "phone IS NULL"');
  console.log('  $ pnpm db:verify show item --where "defaultSupplierId IS NOT NULL"');
  console.log('  $ pnpm db:verify count order --where "shippedAt IS NULL AND status = \'PACKED\'"');
  console.log('');
  console.log('  # Date comparisons with intervals');
  console.log('  $ pnpm db:verify count order --where "orderDate > NOW() - INTERVAL \'7 days\'"');
  console.log(
    '  $ pnpm db:verify show purchaseOrder --where "expectedDate < NOW() + INTERVAL \'3 days\'"'
  );
  console.log(
    '  $ pnpm db:verify count item --where "createdAt >= CURRENT_DATE - INTERVAL \'1 month\'"'
  );
  console.log(
    '  $ pnpm db:verify show stockMovement --where "movedAt > NOW() - INTERVAL \'24 hours\'"'
  );
  console.log('');
  console.log('  # Complex AND combinations');
  console.log(
    '  $ pnpm db:verify count inventory --where "qtyOnHand > 0 AND qtyOnHand <= item.reorderPoint"'
  );
  console.log(
    "  $ pnpm db:verify show order --where \"status IN ('PENDING', 'CONFIRMED') AND grandTotal > 5000 AND orderDate > NOW() - INTERVAL '30 days'\""
  );
  console.log(
    "  $ pnpm db:verify count customer --where \"email LIKE '%@corp.com' AND phone IS NOT NULL AND createdAt > NOW() - INTERVAL '6 months'\""
  );
  console.log('');
  console.log('Common Business Queries:');
  console.log('');
  console.log('  INVENTORY MANAGEMENT:');
  console.log('  # Low stock items (cross-table comparison)');
  console.log('  $ pnpm db:verify count inventory --where "qtyOnHand <= item.reorderPoint"');
  console.log(
    '  $ pnpm db:verify show inventory --where "qtyOnHand <= item.reorderPoint" --select "item.sku,item.name,qtyOnHand,item.reorderPoint"'
  );
  console.log('');
  console.log('  # Over-reserved inventory');
  console.log(
    '  $ pnpm db:verify show inventory --where "qtyReserved > qtyOnHand" --select "item.sku,qtyOnHand,qtyReserved"'
  );
  console.log('');
  console.log('  # Inventory by warehouse');
  console.log(
    '  $ pnpm db:verify stats inventory --group-by locationId --sum qtyOnHand --count id'
  );
  console.log('');
  console.log('  # Items never ordered');
  console.log('  $ pnpm db:verify count item --where "id NOT IN (SELECT itemId FROM orderItem)"');
  console.log('');
  console.log('  ORDER ANALYSIS:');
  console.log('  # Pending orders by status');
  console.log('  $ pnpm db:verify stats order --group-by status --count id --sum grandTotal');
  console.log('');
  console.log('  # Orders with specific statuses (IN operator)');
  console.log("  $ pnpm db:verify count order --where \"status IN ('PENDING', 'PROCESSING')\"");
  console.log('');
  console.log('  # High-value orders');
  console.log(
    '  $ pnpm db:verify show order --where "grandTotal > 10000" --order-by grandTotal --order desc'
  );
  console.log('');
  console.log('  # Orders with unpaid balance');
  console.log(
    '  $ pnpm db:verify count order --where "status != \'CANCELLED\' AND grandTotal > 0"'
  );
  console.log('');
  console.log('  SUPPLIER PERFORMANCE:');
  console.log('  # Overdue purchase orders');
  console.log(
    '  $ pnpm db:verify count purchaseOrder --where "status = \'ORDERED\' AND expectedDate < NOW()"'
  );
  console.log('');
  console.log('  # Suppliers by order count');
  console.log('  $ pnpm db:verify stats purchaseOrder --group-by supplierId --count id');
  console.log('');
  console.log('  CUSTOMER INSIGHTS:');
  console.log('  # Top customers by order value');
  console.log(
    '  $ pnpm db:verify stats order --group-by customerId --sum grandTotal --count id --order-by sum --order desc'
  );
  console.log('');
  console.log('  # Customers with returns');
  console.log(
    '  $ pnpm db:verify stats return --group-by customerId --count id --sum refundAmount'
  );
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
  console.log(
    "  $ pnpm db:verify count shipment --where \"status = 'PENDING' AND shipDate <= NOW() + INTERVAL '7 days'\""
  );
  console.log('');
  console.log('  # Recent stock movements');
  console.log(
    '  $ pnpm db:verify show stockMovement --where "movedAt > NOW() - INTERVAL \'24 hours\'" --limit 20'
  );
  console.log('');
  console.log('  # Cycle count variances');
  console.log(
    '  $ pnpm db:verify show cycleCountItem --where "actualQty != expectedQty" --select "item.sku,expectedQty,actualQty,variance"'
  );
  console.log('');
  console.log('  DATA EXPORT:');
  console.log('  # Export all customers to CSV');
  console.log('  $ pnpm db:verify show customer --format csv > customers.csv');
  console.log('');
  console.log('  # Export specific customers (LIKE operator)');
  console.log(
    '  $ pnpm db:verify show customer --where "email LIKE \'%@ventry.com\'" --format csv > ventry-customers.csv'
  );
  console.log('');
  console.log('  # Export inventory snapshot');
  console.log(
    '  $ pnpm db:verify show inventory --select "item.sku,location.code,qtyOnHand" --format csv > inventory-snapshot.csv'
  );
  console.log('');
  console.log('  DATA QUALITY:');
  console.log('  # Find records with missing data (IS NULL)');
  console.log('  $ pnpm db:verify count customer --where "phone IS NULL"');
  console.log('  $ pnpm db:verify show item --where "defaultSupplierId IS NULL" --limit 10');
  console.log('');
  console.log('  RLS TESTING:');
  console.log('  # Test what employee can see');
  console.log('  $ pnpm db:verify access order --as employee@ventry.com');
  console.log('');
  console.log('  # Compare user access');
  console.log(
    '  $ pnpm db:verify compare customer --users "admin@ventry.com,manager@ventry.com,employee@ventry.com"'
  );
  console.log('');
  console.log('MORE WHERE CLAUSE COMBINATIONS:');
  console.log('  # Field-to-field comparisons (same table)');
  console.log(
    '  $ pnpm db:verify count inventory --where "qtyReserved > qtyOnHand"         # Over-reserved'
  );
  console.log(
    '  $ pnpm db:verify show cycleCountItem --where "actualQty != expectedQty"    # Count variances'
  );
  console.log(
    '  $ pnpm db:verify count item --where "defaultPrice <= defaultCost"          # Loss-making items'
  );
  console.log('');
  console.log('  # Cross-table field comparisons');
  console.log('  $ pnpm db:verify count inventory --where "qtyOnHand <= item.reorderPoint"');
  console.log('  $ pnpm db:verify show orderItem --where "qtyOrdered > inventory.qtyOnHand"');
  console.log('');
  console.log('  # Combining different operators');
  console.log(
    '  $ pnpm db:verify count item --where "name LIKE \'%Widget%\' AND defaultPrice > 100"'
  );
  console.log(
    "  $ pnpm db:verify show order --where \"customerId IS NOT NULL AND status IN ('PENDING', 'CONFIRMED')\""
  );
  console.log(
    '  $ pnpm db:verify count inventory --where "locationId IN (1, 2, 3) AND qtyOnHand > 0"'
  );
  console.log('');
  console.log('  # Real-world business queries');
  console.log(
    '  $ pnpm db:verify show item --where "isActive = true AND reorderPoint IS NULL"  # Active items missing reorder points'
  );
  console.log(
    '  $ pnpm db:verify count order --where "status = \'SHIPPED\' AND shippedAt IS NULL"  # Data inconsistency check'
  );
  console.log(
    '  $ pnpm db:verify show customer --where "createdAt > NOW() - INTERVAL \'90 days\' AND totalOrders = 0"  # New inactive customers'
  );
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
