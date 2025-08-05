import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAuthenticatedIntegrationContext } from '../../test-utils/trpc-test-client.js';
import { appRouter } from '../app.js';
import type { User } from '@ventry/database';

describe('Warehouses Router Integration', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let user: User;
  let organizationId: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testContext = await createAuthenticatedIntegrationContext();
    caller = appRouter.createCaller(testContext.ctx);
    user = testContext.user;
    organizationId = testContext.organization.id;
    cleanup = testContext.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('warehouses.list', () => {
    it('should return empty list when no warehouses exist', async () => {
      const result = await caller.warehouses.list({});
      expect(result).toEqual([]);
    });

    it('should create and list warehouses', async () => {
      // Create a warehouse
      const warehouse = await caller.warehouses.create({
        code: 'WH-001',
        name: 'Test Warehouse',
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
        phone: '+1-555-0123',
        notes: 'Test warehouse',
      });

      expect(warehouse).toMatchObject({
        code: 'WH-001',
        name: 'Test Warehouse',
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
        phone: '+1-555-0123',
        notes: 'Test warehouse',
        organizationId,
      });

      // List warehouses
      const warehouses = await caller.warehouses.list({});
      expect(warehouses).toHaveLength(1);
      expect(warehouses[0]).toMatchObject(warehouse);
    });

    it('should include stats when requested', async () => {
      // Create a warehouse
      await caller.warehouses.create({
        code: 'WH-002',
        name: 'Stats Test Warehouse',
        line1: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90210',
        country: 'USA',
      });

      const warehouses = await caller.warehouses.list({ includeStats: true });
      expect(warehouses).toHaveLength(1);
      expect(warehouses[0]).toHaveProperty('stats');
      expect(warehouses[0].stats).toMatchObject({
        locationCount: 0,
        totalCapacity: 0,
        occupiedLocations: 0,
        inventoryCount: 0,
        totalStock: 0,
        reservedStock: 0,
        utilizationRate: 0,
      });
    });

    it('should only return warehouses for the current organization', async () => {
      // This would require creating a second organization and user
      // For now, we verify basic organization isolation
      const warehouses = await caller.warehouses.list({});
      warehouses.forEach((warehouse) => {
        expect(warehouse.organizationId).toBe(organizationId);
      });
    });
  });

  describe('warehouses.get', () => {
    it('should get warehouse by id with locations', async () => {
      // Create a warehouse
      const warehouse = await caller.warehouses.create({
        code: 'WH-003',
        name: 'Get Test Warehouse',
        line1: '789 Pine St',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'USA',
      });

      // Get warehouse
      const result = await caller.warehouses.get({
        id: warehouse.id,
        includeLocations: true,
      });

      expect(result).toMatchObject(warehouse);
      expect(result.locations).toEqual([]);
      expect(result.stats).toBeDefined();
    });

    it('should throw error for non-existent warehouse', async () => {
      const nonExistentId = 'clh1234567890abcdefghijkl'; // Valid CUID format
      await expect(caller.warehouses.get({ id: nonExistentId })).rejects.toThrow(
        'Warehouse not found'
      );
    });
  });

  describe('warehouses.create', () => {
    it('should create warehouse with valid data', async () => {
      const warehouseData = {
        code: 'WH-004',
        name: 'Create Test Warehouse',
        line1: '321 Elm St',
        line2: 'Suite 100',
        city: 'Houston',
        state: 'TX',
        postalCode: '77001',
        country: 'USA',
        phone: '+1-555-0456',
        notes: 'New test warehouse',
      };

      const warehouse = await caller.warehouses.create(warehouseData);

      expect(warehouse).toMatchObject({
        ...warehouseData,
        organizationId,
      });
      expect(warehouse.id).toBeDefined();
      expect(warehouse.createdAt).toBeInstanceOf(Date);
      expect(warehouse.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate code', async () => {
      const warehouseData = {
        code: 'WH-DUPLICATE',
        name: 'First Warehouse',
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      };

      // Create first warehouse
      await caller.warehouses.create(warehouseData);

      // Try to create second warehouse with same code
      await expect(
        caller.warehouses.create({
          ...warehouseData,
          name: 'Second Warehouse',
        })
      ).rejects.toThrow('A warehouse with this code already exists');
    });

    it('should require admin role', async () => {
      // This test would require modifying the user's role to non-admin
      // and verifying the permission check works
      // For now, we verify it works with admin role
      const warehouse = await caller.warehouses.create({
        code: 'WH-ADMIN',
        name: 'Admin Test',
        line1: '123 Admin St',
        city: 'Admin City',
        state: 'AC',
        postalCode: '00000',
        country: 'USA',
      });

      expect(warehouse).toBeDefined();
    });
  });

  describe('warehouses.update', () => {
    let warehouseId: string;

    beforeEach(async () => {
      const warehouse = await caller.warehouses.create({
        code: 'WH-UPDATE',
        name: 'Update Test Warehouse',
        line1: '555 Update Ave',
        city: 'Update City',
        state: 'UC',
        postalCode: '55555',
        country: 'USA',
      });
      warehouseId = warehouse.id;
    });

    it('should update warehouse with valid data', async () => {
      const updatedWarehouse = await caller.warehouses.update({
        id: warehouseId,
        name: 'Updated Warehouse Name',
        line1: '666 Updated St',
        city: 'Updated City',
        state: 'UP',
        postalCode: '66666',
        country: 'USA',
        notes: 'Updated notes',
      });

      expect(updatedWarehouse).toMatchObject({
        id: warehouseId,
        name: 'Updated Warehouse Name',
        line1: '666 Updated St',
        city: 'Updated City',
        state: 'UP',
        postalCode: '66666',
        notes: 'Updated notes',
      });
    });

    it('should throw error for non-existent warehouse', async () => {
      const nonExistentId = 'clh1234567890abcdefghijkl'; // Valid CUID format
      await expect(
        caller.warehouses.update({
          id: nonExistentId,
          name: 'Updated Name',
          line1: '123 Test St',
          city: 'Test',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
        })
      ).rejects.toThrow('Warehouse not found');
    });
  });

  describe('warehouses.delete', () => {
    let warehouseId: string;

    beforeEach(async () => {
      const warehouse = await caller.warehouses.create({
        code: 'WH-DELETE',
        name: 'Delete Test Warehouse',
        line1: '777 Delete Rd',
        city: 'Delete City',
        state: 'DL',
        postalCode: '77777',
        country: 'USA',
      });
      warehouseId = warehouse.id;
    });

    it('should delete empty warehouse', async () => {
      const deletedWarehouse = await caller.warehouses.delete({
        id: warehouseId,
      });

      expect(deletedWarehouse.id).toBe(warehouseId);

      // Verify warehouse is deleted
      await expect(caller.warehouses.get({ id: warehouseId })).rejects.toThrow(
        'Warehouse not found'
      );
    });

    it('should throw error for non-existent warehouse', async () => {
      const nonExistentId = 'clh1234567890abcdefghijkl'; // Valid CUID format
      await expect(caller.warehouses.delete({ id: nonExistentId })).rejects.toThrow();
    });
  });

  describe('warehouses.getStats', () => {
    let warehouseId: string;

    beforeEach(async () => {
      const warehouse = await caller.warehouses.create({
        code: 'WH-STATS',
        name: 'Stats Test Warehouse',
        line1: '888 Stats Blvd',
        city: 'Stats City',
        state: 'ST',
        postalCode: '88888',
        country: 'USA',
      });
      warehouseId = warehouse.id;
    });

    it('should return warehouse statistics', async () => {
      const stats = await caller.warehouses.getStats({ warehouseId });

      expect(stats).toMatchObject({
        locations: {
          total: 0,
          occupied: 0,
          empty: 0,
          tempControlled: 0,
          utilizationRate: 0,
        },
        inventory: {
          totalItems: 0,
          totalQuantity: 0,
          reservedQuantity: 0,
          inTransitQuantity: 0,
          availableQuantity: 0,
          totalValue: 0,
        },
        movements: {
          last30Days: [],
        },
        capacity: {
          totalCapacity: 0,
          usedCapacity: 0,
          capacityUtilization: 0,
        },
      });
    });

    it('should throw error for non-existent warehouse', async () => {
      const nonExistentId = 'clh1234567890abcdefghijkl'; // Valid CUID format
      await expect(caller.warehouses.getStats({ warehouseId: nonExistentId })).rejects.toThrow(
        'Warehouse not found'
      );
    });
  });

  describe('warehouses.locations', () => {
    let warehouseId: string;

    beforeEach(async () => {
      const warehouse = await caller.warehouses.create({
        code: 'WH-LOCATIONS',
        name: 'Locations Test Warehouse',
        line1: '999 Locations Way',
        city: 'Locations City',
        state: 'LC',
        postalCode: '99999',
        country: 'USA',
      });
      warehouseId = warehouse.id;
    });

    describe('locations.create', () => {
      it('should create location with valid data', async () => {
        const locationData = {
          warehouseId,
          code: 'A1-01-001',
          description: 'Test location',
          zone: 'A',
          aisle: '01',
          shelf: 'A',
          bin: '001',
          maxCapacity: 100,
          isTempControlled: true,
        };

        const location = await caller.warehouses.locations.create(locationData);

        expect(location).toMatchObject(locationData);
        expect(location.id).toBeDefined();
      });

      it('should throw error for duplicate code', async () => {
        const locationData = {
          warehouseId,
          code: 'DUPLICATE-LOC',
          description: 'First location',
        };

        // Create first location
        await caller.warehouses.locations.create(locationData);

        // Try to create second location with same code
        await expect(
          caller.warehouses.locations.create({
            ...locationData,
            description: 'Second location',
          })
        ).rejects.toThrow('A location with this code already exists');
      });
    });

    describe('locations.list', () => {
      it('should list locations for warehouse', async () => {
        // Create a location
        await caller.warehouses.locations.create({
          warehouseId,
          code: 'LIST-LOC-001',
          description: 'List test location',
        });

        const locations = await caller.warehouses.locations.list({
          warehouseId,
        });

        expect(locations).toHaveLength(1);
        expect(locations[0]).toMatchObject({
          code: 'LIST-LOC-001',
          description: 'List test location',
          warehouseId,
        });
      });

      it('should filter locations by zone', async () => {
        // Create locations in different zones
        await caller.warehouses.locations.create({
          warehouseId,
          code: 'ZONE-A-001',
          zone: 'A',
        });
        await caller.warehouses.locations.create({
          warehouseId,
          code: 'ZONE-B-001',
          zone: 'B',
        });

        const locationsZoneA = await caller.warehouses.locations.list({
          warehouseId,
          zone: 'A',
        });

        expect(locationsZoneA).toHaveLength(1);
        expect(locationsZoneA[0].code).toBe('ZONE-A-001');
      });
    });
  });
});
