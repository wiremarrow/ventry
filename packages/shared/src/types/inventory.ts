import { z } from 'zod';

export const CategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const ProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  unitPrice: z.number().min(0, 'Unit price must be positive'),
  cost: z.number().min(0, 'Cost must be positive').optional(),
  isActive: z.boolean().default(true),
});

export const LocationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  description: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const InventoryItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  locationId: z.string().min(1, 'Location is required'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  reservedQty: z.number().int().min(0, 'Reserved quantity must be non-negative').default(0),
  reorderPoint: z.number().int().min(0, 'Reorder point must be non-negative').default(0),
  maxStock: z.number().int().min(0, 'Max stock must be non-negative').optional(),
});

export const InventoryMovementSchema = z.object({
  inventoryItemId: z.string().min(1, 'Inventory item is required'),
  productId: z.string().min(1, 'Product is required'),
  type: z.enum(['INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'TRANSFER', 'RETURN']),
  quantity: z.number().int().min(1, 'Quantity must be positive'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export type CategoryRequest = z.infer<typeof CategorySchema>;
export type ProductRequest = z.infer<typeof ProductSchema>;
export type LocationRequest = z.infer<typeof LocationSchema>;
export type InventoryItemRequest = z.infer<typeof InventoryItemSchema>;
export type InventoryMovementRequest = z.infer<typeof InventoryMovementSchema>;

export interface CategoryResponse {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
}

export interface ProductResponse {
  id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  unitPrice: number;
  cost?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  updatedById: string;
  category?: CategoryResponse;
  createdBy?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  updatedBy?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  _count?: {
    inventoryItems: number;
  };
}

export interface LocationResponse {
  id: string;
  name: string;
  description?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    inventoryItems: number;
  };
}

export interface InventoryItemResponse {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  reservedQty: number;
  reorderPoint: number;
  maxStock?: number;
  lastCountDate?: string;
  createdAt: string;
  updatedAt: string;
  product?: ProductResponse;
  location?: LocationResponse;
  availableQty: number;
  isLowStock: boolean;
  isOverStock: boolean;
}

export interface InventoryMovementResponse {
  id: string;
  inventoryItemId: string;
  productId: string;
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';
  quantity: number;
  previousQty: number;
  newQty: number;
  reference?: string;
  notes?: string;
  createdAt: string;
  createdById: string;
  product?: ProductResponse;
  inventoryItem?: InventoryItemResponse;
  createdBy?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
}

export interface InventoryAdjustmentRequest {
  inventoryItemId: string;
  newQuantity: number;
  reason: string;
  notes?: string;
}

export interface InventoryTransferRequest {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  notes?: string;
}

export interface InventoryStatsResponse {
  totalProducts: number;
  totalLocations: number;
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  overStockItems: number;
  recentMovements: number;
}
