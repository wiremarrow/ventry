import type { OutputFormat, QueryResult } from './types.js';

// Flatten nested objects for display
function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  for (const key in obj) {
    const value = obj[key];
    const prefixedKey = prefix + key;
    
    if (value === null || value === undefined) {
      flattened[prefixedKey] = value;
    } else if (typeof value === 'bigint') {
      // Handle BigInt
      flattened[prefixedKey] = value.toString();
    } else if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal') {
      // Handle Prisma Decimal type
      flattened[prefixedKey] = value.toString();
    } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Skip complex object types that aren't meant to be flattened
      if (value.constructor && ['Decimal', 'BigNumber'].includes(value.constructor.name)) {
        flattened[prefixedKey] = value.toString();
      } else {
        // Recursively flatten nested objects
        Object.assign(flattened, flattenObject(value, prefixedKey + '.'));
      }
    } else {
      flattened[prefixedKey] = value;
    }
  }
  
  return flattened;
}

function flattenData(data: any[]): any[] {
  return data.map(row => flattenObject(row));
}

export function formatOutput(result: QueryResult, format: OutputFormat): string {
  // Flatten nested objects for all formats except JSON
  const processedResult = format === 'json' 
    ? result 
    : { ...result, data: flattenData(result.data) };
    
  switch (format) {
    case 'json':
      return formatJson(result);  // Use original result for JSON
    case 'csv':
      return formatCsv(processedResult);
    case 'count':
      return formatCount(processedResult);
    case 'table':
    default:
      return formatTable(processedResult);
  }
}

function formatJson(result: QueryResult): string {
  // Handle BigInt and Decimal serialization
  return JSON.stringify(result.data, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal') {
      return value.toString();
    }
    return value;
  }, 2);
}

function formatCount(result: QueryResult): string {
  return result.count.toString();
}

function formatCsv(result: QueryResult): string {
  if (result.data.length === 0) {
    return '';
  }

  const headers = Object.keys(result.data[0]);
  const rows = result.data.map(row => 
    headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma or newline
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function formatTable(result: QueryResult): string {
  if (result.data.length === 0) {
    return 'No records found.';
  }

  // Calculate column widths
  const headers = Object.keys(result.data[0]);
  const columnWidths: Record<string, number> = {};
  
  headers.forEach(header => {
    columnWidths[header] = header.length;
    result.data.forEach(row => {
      const value = String(row[header] ?? '');
      columnWidths[header] = Math.max(columnWidths[header], value.length);
    });
  });

  // Build table
  const separator = headers.map(h => '-'.repeat(columnWidths[h])).join('-+-');
  const headerRow = headers.map(h => h.padEnd(columnWidths[h])).join(' | ');
  const dataRows = result.data.map(row =>
    headers.map(h => String(row[h] ?? '').padEnd(columnWidths[h])).join(' | ')
  );

  return [
    headerRow,
    separator,
    ...dataRows,
    '',
    `Total: ${result.count} records`
  ].join('\n');
}

export function formatError(error: Error): string {
  if (error.message.includes('Invalid `prisma.')) {
    // Prisma error - extract useful info
    const match = error.message.match(/Unknown arg `(\w+)`.*Available args:/);
    if (match) {
      return `Error: Unknown field '${match[1]}'. Check available fields with 'pnpm db:verify show <table> --limit 1'`;
    }
  }
  
  if (error.message.includes('does not exist')) {
    return `Error: ${error.message}\n\nHint: Use 'pnpm db:verify tables' to see available tables.`;
  }

  return `Error: ${error.message}`;
}