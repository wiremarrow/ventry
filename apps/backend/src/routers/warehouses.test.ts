import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    warehouse: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    location: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
    inventory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    item: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  return { 
    prisma: mockPrisma,
    Prisma: {
      WarehouseWhereInput: {},
      LocationWhereInput: {},
    },
    OrganizationRole: {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    },
    UserRole: {
      ADMIN: 'ADMIN',
      MANAGER: 'MANAGER',
      EMPLOYEE: 'EMPLOYEE',
      USER: 'USER',
      WAREHOUSE: 'WAREHOUSE',
    },
  };
});

// Access the mocked prisma for tests
const mockPrisma = {
  warehouse: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  location: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
  },
  inventory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  stockMovement: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  item: {
    findMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  }),
};

describe('Warehouses Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create a proper mock response object
    mockRes = {
      setCookie: vi.fn(),
      clearCookie: vi.fn(),
      header: vi.fn(),
    };
    
    // Default authenticated user with organization context and ADMIN role for warehouse operations
    const authenticatedUser = {
      ...mockAuthenticatedUser,
      organizationId: testId('org'),
      organizationRole: 'ADMIN',
      role: 'ADMIN', // Warehouses require ADMIN role
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list warehouses', async () => {
      const mockWarehouses = [
        {
          id: testId('wh1'),
          code: 'WH01',
          name: 'Main Warehouse',
          organizationId: testId('org'),
          phone: '123-456-7890',
          line1: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          postalCode: '12345',
          country: 'USA',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            locations: 10,
          },
        },
      ];

      mockPrisma.warehouse.findMany.mockResolvedValue(mockWarehouses);

      const result = await caller.warehouses.list({
        includeInactive: false,
        includeStats: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('WH01');
      expect(result[0]._count.locations).toBe(10);
    });

    it('should include stats when requested', async () => {
      const mockWarehouses = [
        {
          id: testId('wh1'),
          code: 'WH01',
          name: 'Main Warehouse',
          organizationId: testId('org'),
          _count: { locations: 5 },
        },
      ];

      const mockStats = [
        {
          warehouseId: testId('wh1'),
          _count: 5,
          _sum: { maxCapacity: 1000 },
        },
      ];

      const mockInventoryStats = [
        {
          locationId: testId('loc1'),
          _sum: { qtyOnHand: 500, qtyReserved: 50 },
        },
      ];

      const mockLocations = [
        {
          id: testId('loc1'),
          warehouseId: testId('wh1'),
          _count: { inventory: 10 },
        },
      ];

      mockPrisma.warehouse.findMany.mockResolvedValue(mockWarehouses);
      mockPrisma.location.groupBy.mockResolvedValue(mockStats);
      mockPrisma.inventory.groupBy.mockResolvedValue(mockInventoryStats);
      mockPrisma.location.findMany.mockResolvedValue(mockLocations);
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: { qtyOnHand: 500, qtyReserved: 50 },
        _count: { itemId: 25 },
      });

      const result = await caller.warehouses.list({
        includeInactive: false,
        includeStats: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].stats).toBeDefined();
      expect(result[0].stats.locationCount).toBe(5);
      expect(result[0].stats.totalCapacity).toBe(1000);
      expect(result[0].stats.inventoryCount).toBe(25);
      expect(result[0].stats.totalStock).toBe(500);
    });

    it('should require organization context', async () => {
      const noOrgCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: undefined },
      });

      await expect(noOrgCaller.warehouses.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('get', () => {
    it('should get warehouse by id', async () => {
      const mockLocations = [
        {
          id: testId('loc1'),
          code: 'A-1-1',
          zone: 'A',
          aisle: '1',
          shelf: '1',
          maxCapacity: 1000,
          _count: { inventory: 5 },
        },
      ];

      const mockWarehouse = {
        id: testId('wh1'),
        code: 'WH01',
        name: 'Main Warehouse',
        organizationId: testId('org'),
        line1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345',
        country: 'USA',
        locations: mockLocations,
      };

      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.inventory.count.mockResolvedValue(10);
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: { qtyOnHand: 1000, qtyReserved: 100 },
      });

      const result = await caller.warehouses.get({
        id: testId('wh1'),
      });

      expect(result.id).toBe(testId('wh1'));
      expect(result.locations).toHaveLength(1);
      expect(result.stats.locationCount).toBe(1);
      expect(result.stats.totalStock).toBe(1000);
    });

    it('should throw NOT_FOUND when warehouse does not exist', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        caller.warehouses.get({ id: testId('nonexistent') })
      ).rejects.toThrow('Warehouse not found');
    });
  });

  describe('create', () => {
    it('should create a new warehouse', async () => {
      const warehouseData = {
        code: 'WH02',
        name: 'Secondary Warehouse',
        phone: '987-654-3210',
        line1: '456 Oak Ave',
        line2: 'Suite 100',
        city: 'Another City',
        state: 'NY',
        postalCode: '54321',
        country: 'USA',
      };

      const newWarehouse = {
        id: testId('wh2'),
        ...warehouseData,
        organizationId: testId('org'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.warehouse.findFirst.mockResolvedValue(null); // No duplicate code
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return newWarehouse;
      });
      mockPrisma.warehouse.create.mockResolvedValue(newWarehouse);

      const result = await caller.warehouses.create(warehouseData);

      expect(result.code).toBe('WH02');
      expect(result.name).toBe('Secondary Warehouse');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw CONFLICT when code already exists', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: testId('existing') });

      await expect(
        caller.warehouses.create({
          code: 'WH01',
          name: 'New Warehouse',
          line1: '123 Main St',
          city: 'City',
          state: 'ST',
          postalCode: '12345',
          country: 'USA',
        })
      ).rejects.toThrow('A warehouse with this code already exists');
    });

    it('should require ADMIN role', async () => {
      const managerCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'MANAGER' },
      });

      await expect(
        managerCaller.warehouses.create({
          code: 'WH01',
          name: 'New Warehouse',
          line1: '123 Main St',
          city: 'City',
          state: 'ST',
          postalCode: '12345',
          country: 'USA',
        })
      ).rejects.toThrow('Only administrators can create warehouses');
    });
  });

  describe('update', () => {
    it('should update an existing warehouse', async () => {
      const existingWarehouse = {
        id: testId('wh1'),
        code: 'WH01',
        name: 'Old Name',
        organizationId: testId('org'),
      };

      const updatedWarehouse = {
        ...existingWarehouse,
        name: 'Updated Name',
      };

      mockPrisma.warehouse.findFirst.mockResolvedValue(existingWarehouse);
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return updatedWarehouse;
      });
      mockPrisma.warehouse.update.mockResolvedValue(updatedWarehouse);

      const result = await caller.warehouses.update({
        id: testId('wh1'),
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockPrisma.warehouse.update).toHaveBeenCalledWith({
        where: { id: testId('wh1') },
        data: { name: 'Updated Name' },
      });
    });

    it('should prevent updating code to existing one', async () => {
      const existingWarehouse = {
        id: testId('wh1'),
        code: 'WH01',
        organizationId: testId('org'),
      };

      mockPrisma.warehouse.findFirst
        .mockResolvedValueOnce(existingWarehouse) // Current warehouse
        .mockResolvedValueOnce({ id: testId('wh2') }); // Different warehouse with same code

      await expect(
        caller.warehouses.update({
          id: testId('wh1'),
          code: 'WH02',
        })
      ).rejects.toThrow('A warehouse with this code already exists');
    });
  });

  describe('delete', () => {
    it('should delete a warehouse', async () => {
      // Create caller with ADMIN role for delete
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });

      const mockWarehouse = {
        id: testId('wh1'),
        code: 'WH01',
        name: 'Test Warehouse',
        organizationId: testId('org'),
      };

      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.location.count.mockResolvedValue(0); // No locations
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return { ...mockWarehouse, isActive: false };
      });
      mockPrisma.warehouse.update.mockResolvedValue({ ...mockWarehouse, isActive: false });

      const result = await adminCaller.warehouses.delete({
        id: testId('wh1'),
      });

      expect(result.id).toBe(testId('wh1'));
      expect(result.isActive).toBe(false);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw PRECONDITION_FAILED when warehouse has locations', async () => {
      // Create caller with ADMIN role for delete
      const adminCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'ADMIN' },
      });

      const mockWarehouse = {
        id: testId('wh1'),
        organizationId: testId('org'),
      };

      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.location.count.mockResolvedValue(5); // Has locations

      await expect(
        adminCaller.warehouses.delete({ id: testId('wh1') })
      ).rejects.toThrow('Cannot delete warehouse with 5 locations');
    });

    it('should require ADMIN role for delete', async () => {
      // Create non-admin caller
      const managerCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'MANAGER' },
      });

      await expect(
        managerCaller.warehouses.delete({ id: testId('wh1') })
      ).rejects.toThrow('Only administrators can delete warehouses');
    });
  });

  describe('locations.list', () => {
    it('should list locations for a warehouse', async () => {
      const mockWarehouse = {
        id: testId('wh1'),
        organizationId: testId('org'),
      };

      const mockLocations = [
        {
          id: testId('loc1'),
          code: 'A-1-1',
          zone: 'A',
          aisle: '1',
          shelf: '1',
          warehouseId: testId('wh1'),
          inventory: [
            {
              id: testId('inv1'),
              qtyOnHand: 100,
              item: {
                sku: 'ITEM001',
                name: 'Test Item',
              },
            },
          ],
          maxCapacity: 1000,
        },
      ];

      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.location.findMany.mockResolvedValue(mockLocations);
      mockPrisma.location.count.mockResolvedValue(1);

      const result = await caller.warehouses.locations.list({
        warehouseId: testId('wh1'),
      });

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('A-1-1');
      expect(result[0].isOccupied).toBe(true);
      expect(result[0].occupancy).toBe(100);
      expect(result[0].utilization).toBe(10); // 100/1000 * 100
    });

    it('should filter by zone', async () => {
      const mockWarehouse = {
        id: testId('wh1'),
        organizationId: testId('org'),
      };

      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.location.findMany.mockResolvedValue([]);
      mockPrisma.location.count.mockResolvedValue(0);

      await caller.warehouses.locations.list({
        warehouseId: testId('wh1'),
        zone: 'B',
      });

      expect(mockPrisma.location.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: testId('wh1'),
            zone: 'B',
          }),
        })
      );
    });
  });

  describe('locations.create', () => {
    it('should create a new location', async () => {
      const mockWarehouse = {
        id: testId('wh1'),
        organizationId: testId('org'),
      };

      const locationData = {
        warehouseId: testId('wh1'),
        code: 'B-2-3',
        description: 'Section B, Aisle 2, Shelf 3',
        zone: 'B',
        aisle: '2',
        shelf: '3',
      };

      const newLocation = {
        id: testId('loc2'),
        ...locationData,
        organizationId: testId('org'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.location.findFirst.mockResolvedValue(null); // No duplicate code
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const result = await fn(mockPrisma);
        return newLocation;
      });
      mockPrisma.location.create.mockResolvedValue(newLocation);

      const result = await caller.warehouses.locations.create(locationData);

      expect(result.code).toBe('B-2-3');
      expect(result.zone).toBe('B');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw CONFLICT when location code already exists', async () => {
      const mockWarehouse = {
        id: testId('wh1'),
        organizationId: testId('org'),
      };

      mockPrisma.warehouse.findFirst.mockResolvedValue(mockWarehouse);
      mockPrisma.location.findUnique.mockResolvedValue({ id: testId('existing') });

      await expect(
        caller.warehouses.locations.create({
          warehouseId: testId('wh1'),
          code: 'A-1-1',
        })
      ).rejects.toThrow('A location with this code already exists');
    });

    it('should require ADMIN or MANAGER role', async () => {
      const employeeCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: testId('org'), role: 'EMPLOYEE' },
      });

      await expect(
        employeeCaller.warehouses.locations.create({
          warehouseId: testId('wh1'),
          code: 'A-1-1',
        })
      ).rejects.toThrow('Only administrators and managers can create locations');
    });
  });

  describe('locations.getInventory', () => {
    it('should get inventory for a location', async () => {
      const mockLocation = {
        id: testId('loc1'),
        code: 'A-1-1',
        warehouseId: testId('wh1'),
        warehouse: { organizationId: testId('org') },
      };

      const mockInventory = [
        {
          id: testId('inv1'),
          itemId: testId('item1'),
          qtyOnHand: 100,
          qtyReserved: 20,
          item: {
            sku: 'ITEM001',
            name: 'Test Item',
            category: { name: 'Category 1' },
            unitOfMeasure: { name: 'Each' },
          },
          lot: null,
        },
      ];

      mockPrisma.location.findFirst.mockResolvedValue(mockLocation);
      mockPrisma.inventory.findMany.mockResolvedValue(mockInventory);
      mockPrisma.inventory.aggregate.mockResolvedValue({
        _sum: { qtyOnHand: 100, qtyReserved: 20 },
        _count: 1,
      });

      const result = await caller.warehouses.locations.getInventory({
        locationId: testId('loc1'),
      });

      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0].qtyOnHand).toBe(100);
      expect(result.summary.totalQuantity).toBe(100);
      expect(result.summary.totalReserved).toBe(20);
      expect(result.summary.totalAvailable).toBe(80);
    });
  });
});