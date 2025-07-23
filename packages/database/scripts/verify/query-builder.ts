import { PrismaClient, Prisma } from '../../generated/client/client.js';
import type { ShowOptions, CountOptions, StatsOptions, TableInfo } from './types.js';

// Map of Prisma model names to their metadata
const MODEL_INFO: Record<string, TableInfo> = {
  user: {
    name: 'user',
    fields: ['id', 'email', 'username', 'firstName', 'lastName', 'role', 'isActive', 'createdAt', 'updatedAt'],
    relations: { organizations: 'organizationMember' }
  },
  organization: {
    name: 'organization',
    fields: ['id', 'name', 'slug', 'domain', 'logoUrl', 'settings', 'subscriptionTier', 'subscriptionStatus', 'createdAt', 'updatedAt'],
    relations: { members: 'organizationMember', items: 'item', warehouses: 'warehouse' }
  },
  item: {
    name: 'item',
    fields: ['id', 'organizationId', 'sku', 'name', 'description', 'categoryId', 'uomId', 'upc', 'reorderPoint', 'reorderQty', 'defaultCost', 'defaultPrice', 'defaultSupplierId', 'weightKg', 'lengthCm', 'widthCm', 'heightCm', 'isSerialized', 'isLotTracked', 'isActive', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', category: 'itemCategory', unitOfMeasure: 'unitOfMeasure', inventory: 'inventory', defaultSupplier: 'supplier' }
  },
  inventory: {
    name: 'inventory',
    fields: ['id', 'organizationId', 'itemId', 'locationId', 'lotId', 'qtyOnHand', 'qtyReserved', 'qtyInTransit', 'lastCountedAt', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', item: 'item', location: 'location', lot: 'lot' }
  },
  warehouse: {
    name: 'warehouse',
    fields: ['id', 'organizationId', 'code', 'name', 'phone', 'line1', 'line2', 'city', 'state', 'postalCode', 'country', 'notes', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', locations: 'location' }
  },
  location: {
    name: 'location',
    fields: ['id', 'organizationId', 'warehouseId', 'code', 'aisle', 'shelf', 'bin', 'zone', 'description', 'isTempControlled', 'maxCapacity', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', warehouse: 'warehouse', inventory: 'inventory' }
  },
  order: {
    name: 'order',
    fields: ['id', 'organizationId', 'orderNumber', 'customerId', 'status', 'orderDate', 'requestedShipDate', 'currencyId', 'subtotal', 'discountTotal', 'taxTotal', 'shippingTotal', 'grandTotal', 'notes', 'createdById', 'updatedById', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', customer: 'customer', createdBy: 'user', updatedBy: 'user', items: 'orderItem' }
  },
  customer: {
    name: 'customer',
    fields: ['id', 'organizationId', 'customerCode', 'companyName', 'firstName', 'lastName', 'email', 'phone', 'taxId', 'currencyId', 'defaultPaymentTerms', 'defaultShipMethodId', 'website', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', addresses: 'address', orders: 'order', defaultShipMethod: 'shippingMethod' }
  },
  supplier: {
    name: 'supplier',
    fields: ['id', 'organizationId', 'supplierCode', 'name', 'email', 'phone', 'website', 'taxId', 'paymentTerms', 'leadTimeDays', 'minOrderAmount', 'notes', 'isActive', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', contacts: 'supplierContact', purchaseOrders: 'purchaseOrder' }
  },
  stockmovement: {
    name: 'stockMovement',
    fields: ['id', 'organizationId', 'itemId', 'lotId', 'serialId', 'fromLocationId', 'toLocationId', 'qty', 'movementType', 'refType', 'refId', 'movedById', 'movedAt', 'notes'],
    relations: { organization: 'organization', item: 'item', fromLocation: 'location', toLocation: 'location', movedBy: 'user' }
  },
  orderitem: {
    name: 'orderItem',
    fields: ['id', 'organizationId', 'orderId', 'itemId', 'description', 'qtyOrdered', 'qtyAllocated', 'qtyShipped', 'unitPrice', 'discountPct', 'taxRate', 'totalPrice', 'lotId', 'serialId'],
    relations: { organization: 'organization', order: 'order', item: 'item', lot: 'lot', serialNumber: 'serialNumber' }
  },
  purchaseorder: {
    name: 'purchaseOrder',
    fields: ['id', 'organizationId', 'poNumber', 'supplierId', 'status', 'orderDate', 'expectedDate', 'currencyId', 'subtotal', 'taxTotal', 'shippingCost', 'grandTotal', 'notes', 'createdById', 'approvedById', 'approvedAt', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', supplier: 'supplier', createdBy: 'user', approvedBy: 'user', items: 'purchaseOrderItem', receipts: 'receipt' }
  },
  purchaseorderitem: {
    name: 'purchaseOrderItem',
    fields: ['id', 'organizationId', 'purchaseOrderId', 'itemId', 'description', 'qtyOrdered', 'qtyReceived', 'unitCost', 'taxRate', 'totalCost', 'lotNumber'],
    relations: { organization: 'organization', purchaseOrder: 'purchaseOrder', item: 'item' }
  },
  payment: {
    name: 'payment',
    fields: ['id', 'organizationId', 'orderId', 'paymentMethodId', 'amount', 'currencyId', 'paymentDate', 'transactionRef', 'status', 'processedById', 'notes', 'createdAt'],
    relations: { organization: 'organization', order: 'order', paymentMethod: 'paymentMethod', processedBy: 'user' }
  },
  paymentmethod: {
    name: 'paymentMethod',
    fields: ['id', 'organizationId', 'methodName', 'provider', 'acctLast4', 'detailsJson', 'isActive', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', payments: 'payment' }
  },
  shipment: {
    name: 'shipment',
    fields: ['id', 'organizationId', 'orderId', 'shipmentNumber', 'carrierId', 'carrierService', 'trackingNumber', 'shipDate', 'expectedDelivery', 'shippedFromLocationId', 'shippedById', 'status', 'weightKg', 'shippingCost', 'notes', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', order: 'order', carrier: 'carrier', shippedBy: 'user', shippedFromLocation: 'location', items: 'shipmentItem' }
  },
  shipmentitem: {
    name: 'shipmentItem',
    fields: ['id', 'organizationId', 'shipmentId', 'orderItemId', 'itemId', 'lotId', 'serialId', 'qtyShipped'],
    relations: { organization: 'organization', shipment: 'shipment', orderItem: 'orderItem', item: 'item', lot: 'lot', serialNumber: 'serialNumber' }
  },
  return: {
    name: 'return',
    fields: ['id', 'organizationId', 'orderId', 'customerId', 'returnNumber', 'status', 'returnDate', 'rmaNumber', 'reason', 'refundAmount', 'restockFee', 'notes', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', order: 'order', customer: 'customer', items: 'returnItem' }
  },
  returnitem: {
    name: 'returnItem',
    fields: ['id', 'organizationId', 'returnId', 'orderItemId', 'itemId', 'lotId', 'serialId', 'qtyReturned', 'condition', 'refundAmount'],
    relations: { organization: 'organization', return: 'return', orderItem: 'orderItem', item: 'item', lot: 'lot', serialNumber: 'serialNumber' }
  },
  itemcategory: {
    name: 'itemCategory',
    fields: ['id', 'organizationId', 'name', 'slug', 'description', 'parentId', 'isActive', 'displayOrder', 'imageUrl', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', parent: 'itemCategory', children: 'itemCategory', items: 'item' }
  },
  unitofmeasure: {
    name: 'unitOfMeasure',
    fields: ['id', 'organizationId', 'code', 'name', 'abbreviation', 'type', 'conversionFactor', 'baseUnit', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', items: 'item' }
  },
  lot: {
    name: 'lot',
    fields: ['id', 'organizationId', 'itemId', 'lotNumber', 'manufactureDate', 'expirationDate', 'vendorLotNumber', 'notes', 'createdAt'],
    relations: { organization: 'organization', item: 'item', inventory: 'inventory', stockMovements: 'stockMovement', orderItems: 'orderItem' }
  },
  serialnumber: {
    name: 'serialNumber',
    fields: ['id', 'organizationId', 'itemId', 'serialNumber', 'lotId', 'status', 'locationId', 'purchaseDate', 'warrantyExpiration', 'notes', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', item: 'item', lot: 'lot', location: 'location', stockMovements: 'stockMovement' }
  },
  address: {
    name: 'address',
    fields: ['id', 'organizationId', 'customerId', 'type', 'name', 'line1', 'line2', 'city', 'state', 'postalCode', 'country', 'isDefault', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', customer: 'customer' }
  },
  suppliercontact: {
    name: 'supplierContact',
    fields: ['id', 'organizationId', 'supplierId', 'firstName', 'lastName', 'title', 'email', 'phone', 'isPrimary', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', supplier: 'supplier' }
  },
  cyclecount: {
    name: 'cycleCount',
    fields: ['id', 'organizationId', 'countNumber', 'status', 'countType', 'scheduledDate', 'startedAt', 'completedAt', 'locationId', 'countedById', 'reviewedById', 'notes', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', location: 'location', countedBy: 'user', reviewedBy: 'user', items: 'cycleCountItem' }
  },
  cyclecountitem: {
    name: 'cycleCountItem',
    fields: ['id', 'organizationId', 'countId', 'itemId', 'lotId', 'qtyCounted', 'qtySystem', 'variance'],
    relations: { organization: 'organization', count: 'cycleCount', item: 'item', lot: 'lot' }
  },
  receipt: {
    name: 'receipt',
    fields: ['id', 'organizationId', 'poId', 'receivedDate', 'receivedById', 'reference', 'notes', 'createdAt'],
    relations: { organization: 'organization', purchaseOrder: 'purchaseOrder', receivedBy: 'user', items: 'receiptItem' }
  },
  receiptitem: {
    name: 'receiptItem',
    fields: ['id', 'organizationId', 'receiptId', 'itemId', 'lotId', 'serialNumber', 'qtyReceived', 'unitCost', 'expirationDate', 'locationId'],
    relations: { organization: 'organization', receipt: 'receipt', item: 'item', lot: 'lot', location: 'location' }
  },
  carrier: {
    name: 'carrier',
    fields: ['id', 'organizationId', 'code', 'name', 'website', 'trackingUrl', 'isActive', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', shipments: 'shipment' }
  },
  shippingmethod: {
    name: 'shippingMethod',
    fields: ['id', 'organizationId', 'name', 'carrier', 'estimatedDays', 'baseCost', 'isActive', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization', customers: 'customer' }
  },
  stockadjustment: {
    name: 'stockAdjustment',
    fields: ['id', 'organizationId', 'adjustmentNumber', 'itemId', 'locationId', 'lotId', 'serialId', 'qtyAdjustment', 'adjustmentType', 'reason', 'adjustedById', 'adjustedAt', 'notes', 'createdAt'],
    relations: { organization: 'organization', item: 'item', location: 'location', lot: 'lot', serialNumber: 'serialNumber', adjustedBy: 'user' }
  },
  auditlog: {
    name: 'auditLog',
    fields: ['id', 'organizationId', 'userId', 'entityType', 'entityId', 'action', 'oldValues', 'newValues', 'ipAddress', 'userAgent', 'timestamp'],
    relations: { organization: 'organization', user: 'user' }
  },
  postransaction: {
    name: 'posTransaction',
    fields: ['id', 'organizationId', 'txNumber', 'storeId', 'registerId', 'employeeId', 'customerId', 'txDate', 'status', 'subtotal', 'taxTotal', 'discountTotal', 'grandTotal', 'paymentReceived', 'changeGiven', 'notes'],
    relations: { organization: 'organization', employee: 'user', customer: 'customer', items: 'posTransactionItem' }
  },
  postransactionitem: {
    name: 'posTransactionItem',
    fields: ['id', 'organizationId', 'posTxId', 'itemId', 'lotId', 'serialId', 'qty', 'unitPrice', 'discountPct', 'totalPrice'],
    relations: { organization: 'organization', transaction: 'posTransaction', item: 'item', lot: 'lot', serialNumber: 'serialNumber' }
  },
  discount: {
    name: 'discount',
    fields: ['id', 'organizationId', 'code', 'name', 'type', 'value', 'minOrderAmount', 'validFrom', 'validTo', 'maxUses', 'currentUses', 'isActive', 'createdAt', 'updatedAt'],
    relations: { organization: 'organization' }
  }
};

export function getTableInfo(tableName: string): TableInfo {
  const info = MODEL_INFO[tableName.toLowerCase()];
  if (!info) {
    const available = Object.keys(MODEL_INFO).sort().join(', ');
    throw new Error(`Table '${tableName}' not found. Available tables: ${available}`);
  }
  return info;
}

export function parseWhereClause(where: string | undefined, tableInfo: TableInfo): any {
  if (!where) return undefined;

  // Handle IN operator
  const inMatch = where.match(/^(\w+)\s+IN\s*\((.*)\)$/i);
  if (inMatch) {
    const [, field, values] = inMatch;
    if (!tableInfo.fields.includes(field)) {
      throw new Error(`Field '${field}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
    }
    // Parse values - handle both quoted and unquoted
    const parsedValues = values.split(',').map(v => {
      const trimmed = v.trim();
      // Remove quotes if present
      if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || 
          (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        return trimmed.slice(1, -1);
      }
      return trimmed;
    });
    return { _inClause: { field, values: parsedValues } };
  }

  // Handle LIKE operator
  const likeMatch = where.match(/^(\w+)\s+LIKE\s+['"]([^'"]+)['"]$/i);
  if (likeMatch) {
    const [, field, pattern] = likeMatch;
    if (!tableInfo.fields.includes(field)) {
      throw new Error(`Field '${field}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
    }
    return { _likeClause: { field, pattern } };
  }

  // Handle IS NULL / IS NOT NULL
  const nullMatch = where.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL$/i);
  if (nullMatch) {
    const [, field, notPart] = nullMatch;
    if (!tableInfo.fields.includes(field)) {
      throw new Error(`Field '${field}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
    }
    return { _nullCheck: { field, isNotNull: !!notPart } };
  }

  // Handle date comparisons (basic support for NOW() and INTERVAL)
  const dateMatch = where.match(/^(\w+)\s*([<>]=?)\s*(NOW\(\)|CURRENT_DATE|CURRENT_TIMESTAMP)(?:\s*([+-])\s*INTERVAL\s*'([^']+)')?$/i);
  if (dateMatch) {
    const [, field, operator, dateFn, intervalOp, intervalValue] = dateMatch;
    if (!tableInfo.fields.includes(field)) {
      throw new Error(`Field '${field}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
    }
    return { 
      _dateComparison: { 
        field, 
        operator, 
        dateFn: dateFn.toUpperCase(),
        intervalOp,
        intervalValue 
      } 
    };
  }

  // Check for AND/OR operators - support simple AND for now
  if (where.match(/\b(AND|OR)\b/i)) {
    if (where.includes(' AND ') && !where.includes(' OR ')) {
      const parts = where.split(/\s+AND\s+/i).map(p => p.trim());
      const conditions = parts.map(part => parseWhereClause(part, tableInfo));
      return { _andClause: conditions };
    }
    throw new Error(`Complex WHERE clauses with mixed AND/OR not yet supported. Use simple conditions or multiple queries.`);
  }

  // Basic parsing - in a real implementation, this would be more sophisticated
  // For now, we'll support simple conditions like "field = 'value'" and "field > number"
  const conditions: any = {};
  
  // Handle simple equality with quotes
  let eqMatch = where.match(/(\w+)\s*=\s*['"]([^'"]+)['"]/);
  if (eqMatch) {
    const [, field, value] = eqMatch;
    if (!tableInfo.fields.includes(field)) {
      throw new Error(`Field '${field}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
    }
    conditions[field] = value;
    return conditions;
  }

  // Handle boolean and null values
  eqMatch = where.match(/(\w+)\s*=\s*(true|false|null)\b/i);
  if (eqMatch) {
    const [, field, value] = eqMatch;
    if (!tableInfo.fields.includes(field)) {
      throw new Error(`Field '${field}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
    }
    if (value.toLowerCase() === 'true') {
      conditions[field] = true;
    } else if (value.toLowerCase() === 'false') {
      conditions[field] = false;
    } else if (value.toLowerCase() === 'null') {
      conditions[field] = null;
    }
    return conditions;
  }

  // Handle numeric comparisons
  const compMatch = where.match(/(\w+)\s*([<>]=?)\s*(\d+)/);
  if (compMatch) {
    const [, field, op, value] = compMatch;
    if (!tableInfo.fields.includes(field)) {
      throw new Error(`Field '${field}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
    }
    const operators: Record<string, string> = {
      '>': 'gt',
      '>=': 'gte',
      '<': 'lt',
      '<=': 'lte'
    };
    conditions[field] = { [operators[op]]: parseInt(value) };
    return conditions;
  }

  // Handle field-to-field comparisons (including cross-table)
  // Pattern: [table1.]field1 op [table2.]field2
  const fieldCompMatch = where.match(/^(?:(\w+)\.)?(\w+)\s*([<>]=?|=|!=)\s*(?:(\w+)\.)?(\w+)$/);
  if (fieldCompMatch) {
    const [, table1, field1, op, table2, field2] = fieldCompMatch;
    
    // If no table specified, assume current table
    const sourceTable = table1 || tableInfo.name;
    const targetTable = table2 || tableInfo.name;
    
    // For same-table comparison, validate fields exist
    if (sourceTable === tableInfo.name && targetTable === tableInfo.name) {
      if (!tableInfo.fields.includes(field1)) {
        throw new Error(`Field '${field1}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
      }
      if (!tableInfo.fields.includes(field2)) {
        throw new Error(`Field '${field2}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
      }
    }
    
    // Return special marker for field comparison
    return {
      _fieldComparison: {
        sourceTable,
        field1,
        operator: op,
        targetTable,
        field2
      }
    };
  }

  // For other complex queries, we'd need a proper SQL parser
  // For now, throw an error
  throw new Error(`WHERE clause syntax not recognized: "${where}". Use simple conditions like "field = 'value'", "field = true", "field > 10", or field comparisons like "field1 <= field2"`);
}

export function parseSelectFields(select: string | undefined, tableInfo: TableInfo): any {
  if (!select) return undefined;

  const fields = select.split(',').map(f => f.trim());
  const selectObj: any = {};
  
  fields.forEach(field => {
    if (field.includes('.')) {
      // Handle relations like "item.name"
      const [relation, subfield] = field.split('.');
      if (!tableInfo.relations[relation]) {
        throw new Error(`Relation '${relation}' not found in table '${tableInfo.name}'`);
      }
      // Initialize relation select if not exists
      if (!selectObj[relation]) {
        selectObj[relation] = { select: {} };
      }
      // Add the subfield
      selectObj[relation].select[subfield] = true;
    } else {
      if (!tableInfo.fields.includes(field)) {
        throw new Error(`Field '${field}' not found in table '${tableInfo.name}'. Available fields: ${tableInfo.fields.join(', ')}`);
      }
      selectObj[field] = true;
    }
  });

  return selectObj;
}

export async function executeCount(
  prisma: PrismaClient,
  tableName: string,
  options: CountOptions
): Promise<number> {
  const tableInfo = getTableInfo(tableName);
  const where = parseWhereClause(options.where, tableInfo);
  
  // Check if this is a special clause type that needs raw SQL
  if (where && (where._fieldComparison || where._inClause || where._likeClause || where._nullCheck || where._dateComparison || where._andClause)) {
    const dbTableName = getDbTableName(tableName);
    let sql = `SELECT COUNT(*) as count FROM "${dbTableName}"`;
    let whereClause = '';
    let params: any[] = [];
    let paramIndex = 1;
    
    // Handle different clause types
    if (where._fieldComparison) {
      const { sourceTable, field1, operator, targetTable, field2 } = where._fieldComparison;
      const snakeField1 = toSnakeCase(field1);
      const snakeField2 = toSnakeCase(field2);
      
      if (sourceTable === targetTable) {
        whereClause = `"${snakeField1}" ${operator} "${snakeField2}"`;
      } else {
        const joinInfo = getJoinInfo(tableName, targetTable);
        if (!joinInfo) {
          throw new Error(`Cannot determine relationship between tables '${tableName}' and '${targetTable}'`);
        }
        
        const sourceDbTable = getDbTableName(sourceTable);
        const targetDbTable = getDbTableName(targetTable);
        
        sql = `SELECT COUNT(*) as count FROM "${dbTableName}" ${joinInfo.joinClause}`;
        whereClause = `"${sourceDbTable}"."${snakeField1}" ${operator} "${targetDbTable}"."${snakeField2}"`;
      }
    } else if (where._inClause) {
      const { field, values } = where._inClause;
      const snakeField = toSnakeCase(field);
      const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(', ');
      // Special handling for known enum fields
      if ((tableName === 'order' && field === 'status') ||
          (tableName === 'purchaseOrder' && field === 'status') ||
          (tableName === 'payment' && field === 'status') ||
          (tableName === 'user' && field === 'role')) {
        // Cast enum values for PostgreSQL
        const enumType = getEnumTypeName(tableName, field);
        whereClause = `"${snakeField}" IN (${values.map((_, i) => `$${paramIndex + i}::"${enumType}"`).join(', ')})`;
      } else {
        whereClause = `"${snakeField}" IN (${placeholders})`;
      }
      params.push(...values);
      paramIndex += values.length;
    } else if (where._likeClause) {
      const { field, pattern } = where._likeClause;
      const snakeField = toSnakeCase(field);
      whereClause = `"${snakeField}" LIKE $${paramIndex}`;
      params.push(pattern);
      paramIndex++;
    } else if (where._nullCheck) {
      const { field, isNotNull } = where._nullCheck;
      const snakeField = toSnakeCase(field);
      whereClause = `"${snakeField}" IS ${isNotNull ? 'NOT NULL' : 'NULL'}`;
    } else if (where._dateComparison) {
      const { field, operator, dateFn, intervalOp, intervalValue } = where._dateComparison;
      const snakeField = toSnakeCase(field);
      let dateExpression = dateFn;
      if (intervalOp && intervalValue) {
        dateExpression = `${dateFn} ${intervalOp} INTERVAL '${intervalValue}'`;
      }
      whereClause = `"${snakeField}" ${operator} ${dateExpression}`;
    } else if (where._andClause) {
      // Handle AND clause recursively
      const clauses: string[] = [];
      where._andClause.forEach((clause: any) => {
        if (clause._fieldComparison) {
          const { field1, operator, field2 } = clause._fieldComparison;
          clauses.push(`"${toSnakeCase(field1)}" ${operator} "${toSnakeCase(field2)}"`);
        } else if (clause._inClause) {
          const { field, values } = clause._inClause;
          const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(', ');
          // Check for enum fields
          if ((tableName === 'order' && field === 'status') ||
              (tableName === 'purchaseOrder' && field === 'status') ||
              (tableName === 'payment' && field === 'status') ||
              (tableName === 'user' && field === 'role')) {
            const enumType = getEnumTypeName(tableName, field);
            clauses.push(`"${toSnakeCase(field)}" IN (${values.map((_, i) => `$${paramIndex + i}::"${enumType}"`).join(', ')})`);
          } else {
            clauses.push(`"${toSnakeCase(field)}" IN (${placeholders})`);
          }
          params.push(...values);
          paramIndex += values.length;
        }
        // Add more clause types as needed
      });
      whereClause = clauses.join(' AND ');
    }
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    // Add organization filter if specified
    if (options.org) {
      sql += whereClause ? ' AND' : ' WHERE';
      sql += ` "${dbTableName}".organization_id = (SELECT id FROM organizations WHERE slug = $${paramIndex} LIMIT 1)`;
      params.push(options.org);
    }
    
    const result = await prisma.$queryRawUnsafe(sql, ...params);
    return Number((result as any)[0].count);
  }
  
  // Normal Prisma query for non-field comparisons
  const model = (prisma as any)[tableInfo.name];
  if (!model) {
    throw new Error(`Model '${tableInfo.name}' not found in Prisma client`);
  }
  
  // Add organization filter if specified
  if (options.org) {
    const whereClause = where || {};
    whereClause.organization = { slug: options.org };
    return await model.count({ where: whereClause });
  }

  return await model.count({ where });
}

export async function executeShow(
  prisma: PrismaClient,
  tableName: string,
  options: ShowOptions
): Promise<any[]> {
  const tableInfo = getTableInfo(tableName);
  const where = parseWhereClause(options.where, tableInfo);
  
  // Check if this needs raw SQL (field comparison, IN, LIKE, IS NULL, date, AND)
  if (where && (where._fieldComparison || where._inClause || where._likeClause || where._nullCheck || where._dateComparison || where._andClause)) {
    const dbTableName = getDbTableName(tableName);
    let sql = `SELECT "${dbTableName}".* FROM "${dbTableName}"`;
    let whereClause = '';
    let params: any[] = [];
    let paramIndex = 1;
    
    // Handle different clause types
    if (where._fieldComparison) {
      const { sourceTable, field1, operator, targetTable, field2 } = where._fieldComparison;
      const snakeField1 = toSnakeCase(field1);
      const snakeField2 = toSnakeCase(field2);
      
      if (sourceTable === targetTable) {
        whereClause = `"${snakeField1}" ${operator} "${snakeField2}"`;
      } else {
        const joinInfo = getJoinInfo(tableName, targetTable);
        if (!joinInfo) {
          throw new Error(`Cannot determine relationship between tables '${tableName}' and '${targetTable}'`);
        }
        
        const sourceDbTable = getDbTableName(sourceTable);
        const targetDbTable = getDbTableName(targetTable);
        
        sql = `SELECT "${dbTableName}".* FROM "${dbTableName}" ${joinInfo.joinClause}`;
        whereClause = `"${sourceDbTable}"."${snakeField1}" ${operator} "${targetDbTable}"."${snakeField2}"`;
      }
    } else if (where._inClause) {
      const { field, values } = where._inClause;
      const snakeField = toSnakeCase(field);
      const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(', ');
      // Special handling for known enum fields
      if ((tableName === 'order' && field === 'status') ||
          (tableName === 'purchaseOrder' && field === 'status') ||
          (tableName === 'payment' && field === 'status') ||
          (tableName === 'user' && field === 'role')) {
        // Cast enum values for PostgreSQL
        const enumType = getEnumTypeName(tableName, field);
        whereClause = `"${snakeField}" IN (${values.map((_, i) => `$${paramIndex + i}::"${enumType}"`).join(', ')})`;
      } else {
        whereClause = `"${snakeField}" IN (${placeholders})`;
      }
      params.push(...values);
      paramIndex += values.length;
    } else if (where._likeClause) {
      const { field, pattern } = where._likeClause;
      const snakeField = toSnakeCase(field);
      whereClause = `"${snakeField}" LIKE $${paramIndex}`;
      params.push(pattern);
      paramIndex++;
    } else if (where._nullCheck) {
      const { field, isNotNull } = where._nullCheck;
      const snakeField = toSnakeCase(field);
      whereClause = `"${snakeField}" IS ${isNotNull ? 'NOT NULL' : 'NULL'}`;
    } else if (where._dateComparison) {
      const { field, operator, dateFn, intervalOp, intervalValue } = where._dateComparison;
      const snakeField = toSnakeCase(field);
      let dateExpression = dateFn;
      if (intervalOp && intervalValue) {
        dateExpression = `${dateFn} ${intervalOp} INTERVAL '${intervalValue}'`;
      }
      whereClause = `"${snakeField}" ${operator} ${dateExpression}`;
    } else if (where._andClause) {
      // Handle AND clause recursively
      const clauses: string[] = [];
      where._andClause.forEach((clause: any) => {
        if (clause._fieldComparison) {
          const { field1, operator, field2 } = clause._fieldComparison;
          clauses.push(`"${toSnakeCase(field1)}" ${operator} "${toSnakeCase(field2)}"`);
        } else if (clause._inClause) {
          const { field, values } = clause._inClause;
          const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(', ');
          // Check for enum fields
          if ((tableName === 'order' && field === 'status') ||
              (tableName === 'purchaseOrder' && field === 'status') ||
              (tableName === 'payment' && field === 'status') ||
              (tableName === 'user' && field === 'role')) {
            const enumType = getEnumTypeName(tableName, field);
            clauses.push(`"${toSnakeCase(field)}" IN (${values.map((_, i) => `$${paramIndex + i}::"${enumType}"`).join(', ')})`);
          } else {
            clauses.push(`"${toSnakeCase(field)}" IN (${placeholders})`);
          }
          params.push(...values);
          paramIndex += values.length;
        } else if (clause._likeClause) {
          const { field, pattern } = clause._likeClause;
          clauses.push(`"${toSnakeCase(field)}" LIKE $${paramIndex}`);
          params.push(pattern);
          paramIndex++;
        } else if (clause._nullCheck) {
          const { field, isNotNull } = clause._nullCheck;
          clauses.push(`"${toSnakeCase(field)}" IS ${isNotNull ? 'NOT NULL' : 'NULL'}`);
        } else if (clause._dateComparison) {
          const { field, operator, dateFn, intervalOp, intervalValue } = clause._dateComparison;
          const snakeField = toSnakeCase(field);
          let dateExpression = dateFn;
          if (intervalOp && intervalValue) {
            dateExpression = `${dateFn} ${intervalOp} INTERVAL '${intervalValue}'`;
          }
          clauses.push(`"${snakeField}" ${operator} ${dateExpression}`);
        } else {
          // Handle simple conditions
          for (const [field, value] of Object.entries(clause)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Handle operators like gt, lt, etc.
              for (const [op, val] of Object.entries(value)) {
                const operators: Record<string, string> = {
                  gt: '>',
                  gte: '>=',
                  lt: '<',
                  lte: '<='
                };
                if (operators[op]) {
                  clauses.push(`"${toSnakeCase(field)}" ${operators[op]} $${paramIndex}`);
                  params.push(val);
                  paramIndex++;
                }
              }
            } else {
              // Simple equality
              clauses.push(`"${toSnakeCase(field)}" = $${paramIndex}`);
              params.push(value);
              paramIndex++;
            }
          }
        }
      });
      whereClause = clauses.join(' AND ');
    }
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    // Add organization filter if specified
    if (options.org) {
      sql += whereClause ? ' AND' : ' WHERE';
      sql += ` "${dbTableName}".organization_id = (SELECT id FROM organizations WHERE slug = $${paramIndex} LIMIT 1)`;
      params.push(options.org);
      paramIndex++;
    }
    
    // Add ORDER BY if specified
    if (options.orderBy) {
      const snakeOrderBy = toSnakeCase(options.orderBy);
      sql += ` ORDER BY "${dbTableName}"."${snakeOrderBy}" ${options.order.toUpperCase()}`;
    }
    
    // Add LIMIT and OFFSET
    sql += ` LIMIT ${options.limit} OFFSET ${options.offset}`;
    
    // Execute query
    const result = await prisma.$queryRawUnsafe(sql, ...params);
    
    // Convert Decimal and BigInt objects to strings for proper display
    return (result as any[]).map(row => {
      const converted: any = {};
      for (const [key, value] of Object.entries(row)) {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal') {
          converted[key] = value.toString();
        } else if (typeof value === 'bigint') {
          converted[key] = value.toString();
        } else {
          converted[key] = value;
        }
      }
      return converted;
    });
  }
  
  // Normal Prisma query for non-special WHERE clauses
  const model = (prisma as any)[tableInfo.name];
  if (!model) {
    throw new Error(`Model '${tableInfo.name}' not found in Prisma client`);
  }

  const query: any = {
    where,
    take: options.limit,
    skip: options.offset
  };

  // Add select if specified
  if (options.select) {
    query.select = parseSelectFields(options.select, tableInfo);
  }

  // Add orderBy if specified
  if (options.orderBy) {
    query.orderBy = { [options.orderBy]: options.order };
  }

  // Add organization filter if specified
  if (options.org) {
    if (!query.where) query.where = {};
    query.where.organization = { slug: options.org };
  }

  return await model.findMany(query);
}

// Map camelCase to snake_case for SQL
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Map Prisma model names to actual database table names
const TABLE_NAME_MAP: Record<string, string> = {
  user: 'users',
  organization: 'organizations',
  organizationMember: 'organization_members',
  item: 'items',
  itemCategory: 'item_categories',
  inventory: 'inventory',
  warehouse: 'warehouses',
  location: 'locations',
  lot: 'lots',
  serialNumber: 'serial_numbers',
  order: 'orders',
  orderItem: 'order_items',
  customer: 'customers',
  supplier: 'suppliers',
  supplierContact: 'supplier_contacts',
  address: 'addresses',
  purchaseOrder: 'purchase_orders',
  purchaseOrderItem: 'purchase_order_items',
  stockMovement: 'stock_movements',
  stockAdjustment: 'stock_adjustments',
  unitOfMeasure: 'units_of_measure',
  payment: 'payments',
  paymentMethod: 'payment_methods',
  shipment: 'shipments',
  shipmentItem: 'shipment_items',
  auditLog: 'audit_logs',
  return: 'returns',
  returnItem: 'return_items',
  cycleCount: 'cycle_counts',
  cycleCountItem: 'cycle_count_items',
  receipt: 'receipts',
  receiptItem: 'receipt_items',
  carrier: 'carriers',
  shippingMethod: 'shipping_methods',
  posTransaction: 'pos_transactions',
  posTransactionItem: 'pos_transaction_items',
  discount: 'discounts'
};

function getDbTableName(modelName: string): string {
  return TABLE_NAME_MAP[modelName] || modelName;
}

// Get enum type name for a field
function getEnumTypeName(tableName: string, fieldName: string): string {
  // Map common enum fields to their PostgreSQL enum types
  const enumMap: Record<string, Record<string, string>> = {
    order: {
      status: 'OrderStatus'
    },
    purchaseOrder: {
      status: 'PurchaseOrderStatus'
    },
    shipment: {
      status: 'ShipmentStatus'
    },
    payment: {
      status: 'PaymentStatus'
    },
    return: {
      status: 'ReturnStatus'
    },
    cycleCount: {
      status: 'CycleCountStatus'
    },
    stockMovement: {
      movementType: 'MovementType'
    },
    user: {
      role: 'UserRole'
    },
    organization: {
      subscriptionStatus: 'SubscriptionStatus'
    },
    returnItem: {
      condition: 'ReturnCondition'
    },
    address: {
      type: 'AddressType'
    },
    discount: {
      type: 'DiscountType'
    },
    unitOfMeasure: {
      type: 'UOMType'
    }
  };
  
  if (enumMap[tableName] && enumMap[tableName][fieldName]) {
    return enumMap[tableName][fieldName];
  }
  
  // Default: try PascalCase version of field name
  return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
}

// Get join information between two tables
function getJoinInfo(fromTable: string, toTable: string): { joinClause: string, tables: string[] } | null {
  // Direct relationships
  const fromInfo = MODEL_INFO[fromTable];
  const toInfo = MODEL_INFO[toTable];
  
  if (!fromInfo || !toInfo) {
    return null;
  }
  
  // Check if fromTable has a direct relation to toTable
  for (const [relationName, relatedTable] of Object.entries(fromInfo.relations || {})) {
    if (relatedTable === toTable) {
      // Direct relation found
      const fromDbTable = getDbTableName(fromTable);
      const toDbTable = getDbTableName(toTable);
      const foreignKey = toSnakeCase(relationName) + '_id';
      
      return {
        joinClause: `JOIN "${toDbTable}" ON "${fromDbTable}"."${foreignKey}" = "${toDbTable}"."id"`,
        tables: [fromTable, toTable]
      };
    }
  }
  
  // Check reverse relation (toTable -> fromTable)
  for (const [relationName, relatedTable] of Object.entries(toInfo.relations || {})) {
    if (relatedTable === fromTable) {
      // Reverse relation found
      const fromDbTable = getDbTableName(fromTable);
      const toDbTable = getDbTableName(toTable);
      const foreignKey = toSnakeCase(relationName) + '_id';
      
      return {
        joinClause: `JOIN "${fromDbTable}" ON "${toDbTable}"."${foreignKey}" = "${fromDbTable}"."id"`,
        tables: [fromTable, toTable]
      };
    }
  }
  
  // Handle special cases and common patterns
  const specialCases: Record<string, Record<string, { joinClause: string, tables: string[] }>> = {
    // Order related joins
    orderItem: {
      customer: {
        joinClause: `JOIN "orders" ON "order_items"."order_id" = "orders"."id" JOIN "customers" ON "orders"."customer_id" = "customers"."id"`,
        tables: ['orderItem', 'order', 'customer']
      },
      shipment: {
        joinClause: `JOIN "orders" ON "order_items"."order_id" = "orders"."id" JOIN "shipments" ON "orders"."id" = "shipments"."order_id"`,
        tables: ['orderItem', 'order', 'shipment']
      }
    },
    // Inventory related joins
    inventory: {
      supplier: {
        joinClause: `JOIN "items" ON "inventory"."item_id" = "items"."id" LEFT JOIN "suppliers" ON "items"."default_supplier_id" = "suppliers"."id"`,
        tables: ['inventory', 'item', 'supplier']
      },
      category: {
        joinClause: `JOIN "items" ON "inventory"."item_id" = "items"."id" JOIN "item_categories" ON "items"."category_id" = "item_categories"."id"`,
        tables: ['inventory', 'item', 'itemCategory']
      },
      warehouse: {
        joinClause: `JOIN "locations" ON "inventory"."location_id" = "locations"."id" JOIN "warehouses" ON "locations"."warehouse_id" = "warehouses"."id"`,
        tables: ['inventory', 'location', 'warehouse']
      }
    },
    // Purchase order related joins
    purchaseOrderItem: {
      supplier: {
        joinClause: `JOIN "purchase_orders" ON "purchase_order_items"."purchase_order_id" = "purchase_orders"."id" JOIN "suppliers" ON "purchase_orders"."supplier_id" = "suppliers"."id"`,
        tables: ['purchaseOrderItem', 'purchaseOrder', 'supplier']
      }
    },
    // Stock movement related joins
    stockMovement: {
      warehouse: {
        joinClause: `JOIN "locations" ON "stock_movements"."from_location_id" = "locations"."id" JOIN "warehouses" ON "locations"."warehouse_id" = "warehouses"."id"`,
        tables: ['stockMovement', 'location', 'warehouse']
      }
    }
  };
  
  // Check special cases
  if (specialCases[fromTable] && specialCases[fromTable][toTable]) {
    return specialCases[fromTable][toTable];
  }
  
  return null;
}

export async function executeStats(
  prisma: PrismaClient,
  tableName: string,
  options: StatsOptions
): Promise<any[]> {
  const tableInfo = getTableInfo(tableName);
  const dbTableName = getDbTableName(tableInfo.name);
  
  // Convert field names to snake_case for SQL
  const aggregates = [];
  if (options.count) aggregates.push(`COUNT("${toSnakeCase(options.count)}") as count`);
  if (options.sum) aggregates.push(`SUM("${toSnakeCase(options.sum)}") as sum`);
  if (options.avg) aggregates.push(`AVG("${toSnakeCase(options.avg)}") as avg`);
  if (options.min) aggregates.push(`MIN("${toSnakeCase(options.min)}") as min`);
  if (options.max) aggregates.push(`MAX("${toSnakeCase(options.max)}") as max`);

  if (aggregates.length === 0) {
    throw new Error('At least one aggregate function (count, sum, avg, min, max) is required');
  }

  const groupByField = options.groupBy ? toSnakeCase(options.groupBy) : null;
  const groupBy = groupByField ? `GROUP BY "${groupByField}"` : '';
  
  // Parse WHERE clause
  let whereClause = '';
  let joinClause = '';
  let params: any[] = [];
  let paramIndex = 1;
  
  if (options.where) {
    const parsedWhere = parseWhereClause(options.where, tableInfo);
    
    if (parsedWhere && parsedWhere._fieldComparison) {
      // Handle field comparison
      const { sourceTable, field1, operator, targetTable, field2 } = parsedWhere._fieldComparison;
      const snakeField1 = toSnakeCase(field1);
      const snakeField2 = toSnakeCase(field2);
      
      if (sourceTable === targetTable) {
        // Same table comparison
        whereClause = `"${snakeField1}" ${operator} "${snakeField2}"`;
      } else {
        // Cross-table comparison - need JOIN
        const joinInfo = getJoinInfo(tableName, targetTable);
        if (!joinInfo) {
          throw new Error(`Cannot determine relationship between tables '${tableName}' and '${targetTable}'`);
        }
        
        const sourceDbTable = getDbTableName(sourceTable);
        const targetDbTable = getDbTableName(targetTable);
        
        joinClause = joinInfo.joinClause;
        whereClause = `"${sourceDbTable}"."${snakeField1}" ${operator} "${targetDbTable}"."${snakeField2}"`;
      }
    } else if (parsedWhere && parsedWhere._inClause) {
      const { field, values } = parsedWhere._inClause;
      const snakeField = toSnakeCase(field);
      const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(', ');
      // Special handling for known enum fields
      if ((tableName === 'order' && field === 'status') ||
          (tableName === 'purchaseOrder' && field === 'status') ||
          (tableName === 'payment' && field === 'status') ||
          (tableName === 'user' && field === 'role')) {
        // Cast enum values for PostgreSQL
        const enumType = getEnumTypeName(tableName, field);
        whereClause = `"${snakeField}" IN (${values.map((_, i) => `$${paramIndex + i}::"${enumType}"`).join(', ')})`;
      } else {
        whereClause = `"${snakeField}" IN (${placeholders})`;
      }
      params.push(...values);
      paramIndex += values.length;
    } else if (parsedWhere && parsedWhere._likeClause) {
      const { field, pattern } = parsedWhere._likeClause;
      const snakeField = toSnakeCase(field);
      whereClause = `"${snakeField}" LIKE $${paramIndex}`;
      params.push(pattern);
      paramIndex++;
    } else if (parsedWhere && parsedWhere._nullCheck) {
      const { field, isNotNull } = parsedWhere._nullCheck;
      const snakeField = toSnakeCase(field);
      whereClause = `"${snakeField}" IS ${isNotNull ? 'NOT NULL' : 'NULL'}`;
    } else if (parsedWhere && parsedWhere._dateComparison) {
      const { field, operator, dateFn, intervalOp, intervalValue } = parsedWhere._dateComparison;
      const snakeField = toSnakeCase(field);
      let dateExpression = dateFn;
      if (intervalOp && intervalValue) {
        dateExpression = `${dateFn} ${intervalOp} INTERVAL '${intervalValue}'`;
      }
      whereClause = `"${snakeField}" ${operator} ${dateExpression}`;
    } else if (parsedWhere && parsedWhere._andClause) {
      // Handle AND clause recursively
      const clauses: string[] = [];
      parsedWhere._andClause.forEach((clause: any) => {
        if (clause._fieldComparison) {
          const { field1, operator, field2 } = clause._fieldComparison;
          clauses.push(`"${toSnakeCase(field1)}" ${operator} "${toSnakeCase(field2)}"`);
        } else if (clause._inClause) {
          const { field, values } = clause._inClause;
          const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(', ');
          // Check for enum fields
          if ((tableName === 'order' && field === 'status') ||
              (tableName === 'purchaseOrder' && field === 'status') ||
              (tableName === 'payment' && field === 'status') ||
              (tableName === 'user' && field === 'role')) {
            const enumType = getEnumTypeName(tableName, field);
            clauses.push(`"${toSnakeCase(field)}" IN (${values.map((_, i) => `$${paramIndex + i}::"${enumType}"`).join(', ')})`);
          } else {
            clauses.push(`"${toSnakeCase(field)}" IN (${placeholders})`);
          }
          params.push(...values);
          paramIndex += values.length;
        } else if (clause._likeClause) {
          const { field, pattern } = clause._likeClause;
          clauses.push(`"${toSnakeCase(field)}" LIKE $${paramIndex}`);
          params.push(pattern);
          paramIndex++;
        } else if (clause._nullCheck) {
          const { field, isNotNull } = clause._nullCheck;
          clauses.push(`"${toSnakeCase(field)}" IS ${isNotNull ? 'NOT NULL' : 'NULL'}`);
        } else if (clause._dateComparison) {
          const { field, operator, dateFn, intervalOp, intervalValue } = clause._dateComparison;
          const snakeField = toSnakeCase(field);
          let dateExpression = dateFn;
          if (intervalOp && intervalValue) {
            dateExpression = `${dateFn} ${intervalOp} INTERVAL '${intervalValue}'`;
          }
          clauses.push(`"${snakeField}" ${operator} ${dateExpression}`);
        } else {
          // Handle simple conditions
          for (const [field, value] of Object.entries(clause)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Handle operators like gt, lt, etc.
              for (const [op, val] of Object.entries(value)) {
                const operators: Record<string, string> = {
                  gt: '>',
                  gte: '>=',
                  lt: '<',
                  lte: '<='
                };
                if (operators[op]) {
                  clauses.push(`"${toSnakeCase(field)}" ${operators[op]} $${paramIndex}`);
                  params.push(val);
                  paramIndex++;
                }
              }
            } else {
              // Simple equality
              clauses.push(`"${toSnakeCase(field)}" = $${paramIndex}`);
              params.push(value);
              paramIndex++;
            }
          }
        }
      });
      whereClause = clauses.join(' AND ');
    } else if (parsedWhere) {
      // Simple WHERE clause - convert field names to snake_case
      let processedWhere = options.where;
      tableInfo.fields.forEach(field => {
        const snakeField = toSnakeCase(field);
        if (field !== snakeField) {
          // Replace field name with snake_case version, but only if it's a whole word
          const regex = new RegExp(`\\b${field}\\b`, 'g');
          processedWhere = processedWhere.replace(regex, snakeField);
        }
      });
      whereClause = processedWhere;
    }
  }

  const sql = `
    SELECT ${groupByField ? `"${groupByField}",` : ''} ${aggregates.join(', ')}
    FROM "${dbTableName}"
    ${joinClause}
    ${whereClause ? `WHERE ${whereClause}` : ''}
    ${groupBy}
  `;

  const result = await prisma.$queryRawUnsafe(sql, ...params);
  
  // Convert Decimal objects to strings for proper display
  return (result as any[]).map(row => {
    const converted: any = {};
    for (const [key, value] of Object.entries(row)) {
      if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal') {
        converted[key] = value.toString();
      } else if (typeof value === 'bigint') {
        converted[key] = value.toString();
      } else {
        converted[key] = value;
      }
    }
    return converted;
  });
}