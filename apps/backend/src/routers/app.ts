import { createTRPCRouter } from '../trpc/trpc.js';
import { analyticsRouter } from './analytics.js';
import { authRouter } from './auth.js';
import { categoriesRouter } from './categories.js';
import { customersRouter } from './customers.js';
import { healthRouter } from './health.js';
import { inventoryRouter } from './inventory.js';
import { itemCategoriesRouter } from './itemCategories.js';
import { itemsRouter } from './items.js';
import { ordersRouter } from './orders.js';
import { organizationsRouter } from './organizations.js';
import { productsRouter } from './products.js';
import { purchaseOrdersRouter } from './purchaseOrders.js';
import { receiptsRouter } from './receipts.js';
import { reportsRouter } from './reports.js';
import { returnsRouter } from './returns.js';
import { shipmentsRouter } from './shipments.js';
import { stockMovementsRouter } from './stockMovements.js';
import { suppliersRouter } from './suppliers.js';
import { unitsOfMeasureRouter } from './unitsOfMeasure.js';
import { usersRouter } from './users.js';
import { warehousesRouter } from './warehouses.js';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  users: usersRouter,
  products: productsRouter,
  categories: categoriesRouter,
  health: healthRouter,
  organizations: organizationsRouter,
  items: itemsRouter,
  itemCategories: itemCategoriesRouter,
  unitsOfMeasure: unitsOfMeasureRouter,
  warehouses: warehousesRouter,
  inventory: inventoryRouter,
  stockMovements: stockMovementsRouter,
  suppliers: suppliersRouter,
  customers: customersRouter,
  orders: ordersRouter,
  purchaseOrders: purchaseOrdersRouter,
  receipts: receiptsRouter,
  returns: returnsRouter,
  shipments: shipmentsRouter,
  reports: reportsRouter,
  analytics: analyticsRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;

// Re-export for better module resolution
export default appRouter;