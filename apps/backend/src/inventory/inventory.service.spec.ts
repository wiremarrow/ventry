import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { DatabaseService } from '../database/database.service';

const mockDatabaseService = {
  inventoryItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    fields: {
      reorderPoint: 'reorderPoint',
    },
  },
  inventoryMovement: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  product: {
    count: jest.fn(),
  },
  location: {
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('InventoryService', () => {
  let service: InventoryService;
  let _databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    _databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an inventory item successfully', async () => {
      const createInventoryDto = {
        productId: 'prod1',
        locationId: 'loc1',
        quantity: 100,
        reservedQty: 0,
        reorderPoint: 10,
        maxStock: 500,
      };

      const mockCreatedItem = {
        id: '1',
        ...createInventoryDto,
        lastCountDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'prod1',
          name: 'Product 1',
          sku: 'SKU001',
          category: {
            id: 'cat1',
            name: 'Category 1',
          },
        },
        location: {
          id: 'loc1',
          name: 'Location 1',
        },
      };

      mockDatabaseService.inventoryItem.create.mockResolvedValue(mockCreatedItem);

      const result = await service.create(createInventoryDto);

      expect(result).toEqual(mockCreatedItem);
      expect(mockDatabaseService.inventoryItem.create).toHaveBeenCalledWith({
        data: createInventoryDto,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });
    });

    it('should throw BadRequestException when inventory item already exists', async () => {
      const createInventoryDto = {
        productId: 'prod1',
        locationId: 'loc1',
        quantity: 100,
        reservedQty: 0,
        reorderPoint: 10,
        maxStock: 500,
      };

      mockDatabaseService.inventoryItem.create.mockRejectedValue({
        code: 'P2002',
      });

      await expect(service.create(createInventoryDto)).rejects.toThrow(BadRequestException);
      expect(mockDatabaseService.inventoryItem.create).toHaveBeenCalledWith({
        data: createInventoryDto,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return all inventory items', async () => {
      const mockInventoryItems = [
        {
          id: '1',
          productId: 'prod1',
          locationId: 'loc1',
          quantity: 100,
          reservedQty: 0,
          reorderPoint: 10,
          maxStock: 500,
          lastCountDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            id: 'prod1',
            name: 'Product 1',
            sku: 'SKU001',
            category: {
              id: 'cat1',
              name: 'Category 1',
            },
          },
          location: {
            id: 'loc1',
            name: 'Location 1',
          },
        },
        {
          id: '2',
          productId: 'prod2',
          locationId: 'loc2',
          quantity: 50,
          reservedQty: 5,
          reorderPoint: 5,
          maxStock: 200,
          lastCountDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            id: 'prod2',
            name: 'Product 2',
            sku: 'SKU002',
            category: {
              id: 'cat2',
              name: 'Category 2',
            },
          },
          location: {
            id: 'loc2',
            name: 'Location 2',
          },
        },
      ];

      mockDatabaseService.inventoryItem.findMany.mockResolvedValue(mockInventoryItems);

      const result = await service.findAll();

      expect(result).toEqual(mockInventoryItems);
      expect(mockDatabaseService.inventoryItem.findMany).toHaveBeenCalledWith({
        skip: undefined,
        take: undefined,
        where: undefined,
        orderBy: undefined,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });
    });

    it('should return inventory items with pagination and filtering', async () => {
      const params = {
        skip: 0,
        take: 10,
        where: { productId: 'prod1' },
        orderBy: { quantity: 'desc' as const },
      };

      const mockInventoryItems = [
        {
          id: '1',
          productId: 'prod1',
          locationId: 'loc1',
          quantity: 100,
          reservedQty: 0,
          reorderPoint: 10,
          maxStock: 500,
          lastCountDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            id: 'prod1',
            name: 'Product 1',
            sku: 'SKU001',
            category: {
              id: 'cat1',
              name: 'Category 1',
            },
          },
          location: {
            id: 'loc1',
            name: 'Location 1',
          },
        },
      ];

      mockDatabaseService.inventoryItem.findMany.mockResolvedValue(mockInventoryItems);

      const result = await service.findAll(params);

      expect(result).toEqual(mockInventoryItems);
      expect(mockDatabaseService.inventoryItem.findMany).toHaveBeenCalledWith({
        ...params,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });
    });
  });

  describe('findById', () => {
    it('should return an inventory item when found', async () => {
      const mockInventoryItem = {
        id: '1',
        productId: 'prod1',
        locationId: 'loc1',
        quantity: 100,
        reservedQty: 0,
        reorderPoint: 10,
        maxStock: 500,
        lastCountDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'prod1',
          name: 'Product 1',
          sku: 'SKU001',
          category: {
            id: 'cat1',
            name: 'Category 1',
          },
        },
        location: {
          id: 'loc1',
          name: 'Location 1',
        },
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(mockInventoryItem);

      const result = await service.findById('1');

      expect(result).toEqual(mockInventoryItem);
      expect(mockDatabaseService.inventoryItem.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });
    });

    it('should throw NotFoundException when inventory item not found', async () => {
      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockDatabaseService.inventoryItem.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });
    });
  });

  describe('findByProductAndLocation', () => {
    it('should return inventory item for specific product and location', async () => {
      const mockInventoryItem = {
        id: '1',
        productId: 'prod1',
        locationId: 'loc1',
        quantity: 100,
        reservedQty: 0,
        reorderPoint: 10,
        maxStock: 500,
        lastCountDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'prod1',
          name: 'Product 1',
          sku: 'SKU001',
          category: {
            id: 'cat1',
            name: 'Category 1',
          },
        },
        location: {
          id: 'loc1',
          name: 'Location 1',
        },
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(mockInventoryItem);

      const result = await service.findByProductAndLocation('prod1', 'loc1');

      expect(result).toEqual(mockInventoryItem);
      expect(mockDatabaseService.inventoryItem.findUnique).toHaveBeenCalledWith({
        where: {
          productId_locationId: {
            productId: 'prod1',
            locationId: 'loc1',
          },
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });
    });

    it('should return null when inventory item not found for product and location', async () => {
      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(null);

      const result = await service.findByProductAndLocation('prod1', 'loc1');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an inventory item successfully', async () => {
      const updateData = {
        quantity: 150,
        reorderPoint: 20,
        maxStock: 600,
      };

      const mockExistingItem = {
        id: '1',
        productId: 'prod1',
        locationId: 'loc1',
        quantity: 100,
        reservedQty: 0,
        reorderPoint: 10,
        maxStock: 500,
        lastCountDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'prod1',
          name: 'Product 1',
          sku: 'SKU001',
          category: {
            id: 'cat1',
            name: 'Category 1',
          },
        },
        location: {
          id: 'loc1',
          name: 'Location 1',
        },
      };

      const mockUpdatedItem = {
        ...mockExistingItem,
        ...updateData,
      };

      // Mock findById to return existing item
      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(mockExistingItem);
      mockDatabaseService.inventoryItem.update.mockResolvedValue(mockUpdatedItem);

      const result = await service.update('1', updateData);

      expect(result).toEqual(mockUpdatedItem);
      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });
    });

    it('should throw NotFoundException when inventory item not found for update', async () => {
      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', { quantity: 150 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an inventory item successfully', async () => {
      const mockExistingItem = {
        id: '1',
        productId: 'prod1',
        locationId: 'loc1',
        quantity: 100,
        reservedQty: 0,
        reorderPoint: 10,
        maxStock: 500,
        lastCountDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'prod1',
          name: 'Product 1',
          sku: 'SKU001',
          category: {
            id: 'cat1',
            name: 'Category 1',
          },
        },
        location: {
          id: 'loc1',
          name: 'Location 1',
        },
      };

      // Mock findById to return existing item
      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(mockExistingItem);
      mockDatabaseService.inventoryItem.delete.mockResolvedValue(mockExistingItem);

      const result = await service.remove('1');

      expect(result).toEqual(mockExistingItem);
      expect(mockDatabaseService.inventoryItem.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException when inventory item not found for deletion', async () => {
      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMovements', () => {
    it('should return all inventory movements', async () => {
      const mockMovements = [
        {
          id: 'mov1',
          inventoryItemId: 'inv1',
          productId: 'prod1',
          type: 'INBOUND',
          quantity: 50,
          previousQty: 100,
          newQty: 150,
          reference: 'PO-001',
          notes: 'Purchase order delivery',
          createdById: 'user1',
          createdAt: new Date(),
          product: {
            id: 'prod1',
            name: 'Product 1',
            category: { id: 'cat1', name: 'Category 1' },
          },
          inventoryItem: {
            id: 'inv1',
            location: { id: 'loc1', name: 'Location 1' },
          },
          createdBy: {
            id: 'user1',
            username: 'testuser',
            firstName: 'Test',
            lastName: 'User',
          },
        },
      ];

      mockDatabaseService.inventoryMovement.findMany.mockResolvedValue(mockMovements);

      const result = await service.getMovements();

      expect(result).toEqual(mockMovements);
      expect(mockDatabaseService.inventoryMovement.findMany).toHaveBeenCalledWith({
        skip: undefined,
        take: undefined,
        where: undefined,
        orderBy: undefined,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          inventoryItem: {
            include: {
              location: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    it('should return movements with pagination and filtering', async () => {
      const params = {
        skip: 0,
        take: 10,
        where: { type: 'INBOUND' as const },
        orderBy: { createdAt: 'desc' as const },
      };

      const mockMovements = [
        {
          id: 'mov1',
          inventoryItemId: 'inv1',
          productId: 'prod1',
          type: 'INBOUND',
          quantity: 50,
          previousQty: 100,
          newQty: 150,
          reference: 'PO-001',
          notes: 'Purchase order delivery',
          createdById: 'user1',
          createdAt: new Date(),
        },
      ];

      mockDatabaseService.inventoryMovement.findMany.mockResolvedValue(mockMovements);

      const result = await service.getMovements(params);

      expect(result).toEqual(mockMovements);
      expect(mockDatabaseService.inventoryMovement.findMany).toHaveBeenCalledWith({
        ...params,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          inventoryItem: {
            include: {
              location: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  });

  describe('adjustInventory', () => {
    beforeEach(() => {
      mockDatabaseService.$transaction.mockImplementation((callback) => callback(mockDatabaseService));
    });

    it('should create adjustment movement when increasing quantity', async () => {
      const adjustmentData = {
        inventoryItemId: 'inv1',
        newQuantity: 120,
        reason: 'Physical count',
        notes: 'Inventory adjustment after count',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      const mockMovement = {
        id: 'mov1',
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'ADJUSTMENT',
        quantity: 20,
        previousQty: 100,
        newQty: 120,
        reference: 'Physical count',
        notes: 'Inventory adjustment after count',
        createdById: 'user1',
        createdAt: new Date(),
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);
      mockDatabaseService.inventoryItem.update.mockResolvedValue({ ...existingInventoryItem, quantity: 120 });
      mockDatabaseService.inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await service.adjustInventory(adjustmentData, 'user1');

      expect(result).toEqual(mockMovement);
      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { quantity: 120 },
      });
      expect(mockDatabaseService.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          inventoryItemId: 'inv1',
          productId: 'prod1',
          type: 'ADJUSTMENT',
          quantity: 20,
          previousQty: 100,
          newQty: 120,
          reference: 'Physical count',
          notes: 'Inventory adjustment after count',
          createdById: 'user1',
        },
        include: expect.any(Object),
      });
    });

    it('should create adjustment movement when decreasing quantity', async () => {
      const adjustmentData = {
        inventoryItemId: 'inv1',
        newQuantity: 80,
        reason: 'Damaged goods',
        notes: 'Write-off damaged inventory',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);
      mockDatabaseService.inventoryItem.update.mockResolvedValue({ ...existingInventoryItem, quantity: 80 });
      mockDatabaseService.inventoryMovement.create.mockResolvedValue({
        id: 'mov2',
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'ADJUSTMENT',
        quantity: 20,
        previousQty: 100,
        newQty: 80,
        reference: 'Damaged goods',
        notes: 'Write-off damaged inventory',
        createdById: 'user1',
        createdAt: new Date(),
      });

      const _result = await service.adjustInventory(adjustmentData, 'user1');

      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { quantity: 80 },
      });
      expect(mockDatabaseService.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          inventoryItemId: 'inv1',
          productId: 'prod1',
          type: 'ADJUSTMENT',
          quantity: 20,
          previousQty: 100,
          newQty: 80,
          reference: 'Damaged goods',
          notes: 'Write-off damaged inventory',
          createdById: 'user1',
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when inventory item not found for adjustment', async () => {
      const adjustmentData = {
        inventoryItemId: 'non-existent',
        newQuantity: 50,
        reason: 'Test adjustment',
        notes: 'Test notes',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(null);

      await expect(service.adjustInventory(adjustmentData, 'user1')).rejects.toThrow(NotFoundException);
      expect(mockDatabaseService.inventoryItem.update).not.toHaveBeenCalled();
      expect(mockDatabaseService.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('transferInventory', () => {
    beforeEach(() => {
      mockDatabaseService.$transaction.mockImplementation((callback) => callback(mockDatabaseService));
    });

    it('should transfer inventory between existing locations', async () => {
      const transferData = {
        productId: 'prod1',
        fromLocationId: 'loc1',
        toLocationId: 'loc2',
        quantity: 25,
        notes: 'Transfer for stock balancing',
      };

      const fromItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      const toItem = {
        id: 'inv2',
        quantity: 50,
        productId: 'prod1',
        locationId: 'loc2',
      };

      const outboundMovement = {
        id: 'mov1',
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'TRANSFER',
        quantity: 25,
        previousQty: 100,
        newQty: 75,
        reference: 'Transfer to loc2',
        notes: 'Transfer for stock balancing',
        createdById: 'user1',
        createdAt: new Date(),
      };

      const inboundMovement = {
        id: 'mov2',
        inventoryItemId: 'inv2',
        productId: 'prod1',
        type: 'INBOUND',
        quantity: 25,
        previousQty: 50,
        newQty: 75,
        reference: 'Transfer from loc1',
        notes: 'Transfer for stock balancing',
        createdById: 'user1',
        createdAt: new Date(),
      };

      mockDatabaseService.inventoryItem.findUnique
        .mockResolvedValueOnce(fromItem)
        .mockResolvedValueOnce(toItem);
      mockDatabaseService.inventoryItem.update
        .mockResolvedValueOnce({ ...fromItem, quantity: 75 })
        .mockResolvedValueOnce({ ...toItem, quantity: 75 });
      mockDatabaseService.inventoryMovement.create
        .mockResolvedValueOnce(outboundMovement)
        .mockResolvedValueOnce(inboundMovement);

      const result = await service.transferInventory(transferData, 'user1');

      expect(result).toEqual([outboundMovement, inboundMovement]);
      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { quantity: 75 },
      });
      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv2' },
        data: { quantity: 75 },
      });
    });

    it('should create destination inventory item if not exists', async () => {
      const transferData = {
        productId: 'prod1',
        fromLocationId: 'loc1',
        toLocationId: 'loc2',
        quantity: 25,
        notes: 'Transfer to new location',
      };

      const fromItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      const newToItem = {
        id: 'inv2',
        quantity: 0,
        productId: 'prod1',
        locationId: 'loc2',
        reorderPoint: 0,
      };

      mockDatabaseService.inventoryItem.findUnique
        .mockResolvedValueOnce(fromItem)
        .mockResolvedValueOnce(null);
      mockDatabaseService.inventoryItem.create.mockResolvedValue(newToItem);
      mockDatabaseService.inventoryItem.update
        .mockResolvedValueOnce({ ...fromItem, quantity: 75 })
        .mockResolvedValueOnce({ ...newToItem, quantity: 25 });
      mockDatabaseService.inventoryMovement.create
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any);

      const result = await service.transferInventory(transferData, 'user1');

      expect(mockDatabaseService.inventoryItem.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod1',
          locationId: 'loc2',
          quantity: 0,
          reorderPoint: 0,
        },
      });
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException when source inventory item not found', async () => {
      const transferData = {
        productId: 'prod1',
        fromLocationId: 'non-existent',
        toLocationId: 'loc2',
        quantity: 25,
        notes: 'Transfer test',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(null);

      await expect(service.transferInventory(transferData, 'user1')).rejects.toThrow(NotFoundException);
      expect(mockDatabaseService.inventoryItem.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when insufficient stock for transfer', async () => {
      const transferData = {
        productId: 'prod1',
        fromLocationId: 'loc1',
        toLocationId: 'loc2',
        quantity: 150,
        notes: 'Oversized transfer',
      };

      const fromItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(fromItem);

      await expect(service.transferInventory(transferData, 'user1')).rejects.toThrow(BadRequestException);
      expect(mockDatabaseService.inventoryItem.update).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return inventory statistics', async () => {
      const mockStats = {
        totalProducts: 100,
        totalLocations: 5,
        totalItems: 250,
        totalValue: 15000,
        lowStockItems: 12,
        overStockItems: 0,
        recentMovements: 45,
      };

      mockDatabaseService.product.count.mockResolvedValue(100);
      mockDatabaseService.location.count.mockResolvedValue(5);
      mockDatabaseService.inventoryItem.count
        .mockResolvedValueOnce(250)
        .mockResolvedValueOnce(12);
      mockDatabaseService.inventoryItem.aggregate.mockResolvedValue({
        _sum: { quantity: 15000 },
      });
      mockDatabaseService.inventoryMovement.count.mockResolvedValue(45);

      const result = await service.getStats();

      expect(result).toEqual(mockStats);
      expect(mockDatabaseService.product.count).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(mockDatabaseService.location.count).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(mockDatabaseService.inventoryItem.count).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.inventoryItem.aggregate).toHaveBeenCalledWith({
        _sum: { quantity: true },
      });
      expect(mockDatabaseService.inventoryMovement.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: expect.any(Date),
          },
        },
      });
    });

    it('should handle null total value', async () => {
      mockDatabaseService.product.count.mockResolvedValue(0);
      mockDatabaseService.location.count.mockResolvedValue(0);
      mockDatabaseService.inventoryItem.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockDatabaseService.inventoryItem.aggregate.mockResolvedValue({
        _sum: { quantity: null },
      });
      mockDatabaseService.inventoryMovement.count.mockResolvedValue(0);

      const result = await service.getStats();

      expect(result.totalValue).toBe(0);
      expect(result.totalProducts).toBe(0);
      expect(result.totalLocations).toBe(0);
      expect(result.totalItems).toBe(0);
      expect(result.lowStockItems).toBe(0);
      expect(result.recentMovements).toBe(0);
    });
  });

  describe('createMovement', () => {
    beforeEach(() => {
      // Reset the mock implementation for transactions
      mockDatabaseService.$transaction.mockImplementation((callback) => callback(mockDatabaseService));
    });

    it('should create INBOUND movement and increase inventory', async () => {
      const movementData = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'INBOUND' as const,
        quantity: 50,
        reference: 'PO-001',
        notes: 'Purchase order delivery',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      const mockMovement = {
        id: 'mov1',
        ...movementData,
        previousQty: 100,
        newQty: 150,
        createdById: 'user1',
        createdAt: new Date(),
        product: {
          id: 'prod1',
          name: 'Product 1',
          category: { id: 'cat1', name: 'Category 1' },
        },
        inventoryItem: {
          id: 'inv1',
          location: { id: 'loc1', name: 'Location 1' },
        },
        createdBy: {
          id: 'user1',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
        },
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);
      mockDatabaseService.inventoryItem.update.mockResolvedValue({ ...existingInventoryItem, quantity: 150 });
      mockDatabaseService.inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await service.createMovement(movementData, 'user1');

      expect(result).toEqual(mockMovement);
      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { quantity: 150 },
      });
      expect(mockDatabaseService.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          ...movementData,
          previousQty: 100,
          newQty: 150,
          createdById: 'user1',
        },
        include: expect.any(Object),
      });
    });

    it('should create OUTBOUND movement and decrease inventory', async () => {
      const movementData = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'OUTBOUND' as const,
        quantity: 30,
        reference: 'SO-001',
        notes: 'Sales order fulfillment',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      const mockMovement = {
        id: 'mov2',
        ...movementData,
        previousQty: 100,
        newQty: 70,
        createdById: 'user1',
        createdAt: new Date(),
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);
      mockDatabaseService.inventoryItem.update.mockResolvedValue({ ...existingInventoryItem, quantity: 70 });
      mockDatabaseService.inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await service.createMovement(movementData, 'user1');

      expect(result).toEqual(mockMovement);
      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { quantity: 70 },
      });
    });

    it('should throw BadRequestException for OUTBOUND when insufficient stock', async () => {
      const movementData = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'OUTBOUND' as const,
        quantity: 150,
        reference: 'SO-002',
        notes: 'Attempt to oversell',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);

      await expect(service.createMovement(movementData, 'user1')).rejects.toThrow(BadRequestException);
      expect(mockDatabaseService.inventoryItem.update).not.toHaveBeenCalled();
      expect(mockDatabaseService.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('should create ADJUSTMENT movement and set exact quantity', async () => {
      const movementData = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'ADJUSTMENT' as const,
        quantity: 85,
        reference: 'ADJ-001',
        notes: 'Physical count adjustment',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      const mockMovement = {
        id: 'mov3',
        ...movementData,
        previousQty: 100,
        newQty: 85,
        createdById: 'user1',
        createdAt: new Date(),
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);
      mockDatabaseService.inventoryItem.update.mockResolvedValue({ ...existingInventoryItem, quantity: 85 });
      mockDatabaseService.inventoryMovement.create.mockResolvedValue(mockMovement);

      const result = await service.createMovement(movementData, 'user1');

      expect(result).toEqual(mockMovement);
      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { quantity: 85 },
      });
    });

    it('should create TRANSFER movement and decrease source inventory', async () => {
      const movementData = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'TRANSFER' as const,
        quantity: 25,
        reference: 'TRF-001',
        notes: 'Transfer to another location',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);
      mockDatabaseService.inventoryItem.update.mockResolvedValue({ ...existingInventoryItem, quantity: 75 });
      mockDatabaseService.inventoryMovement.create.mockResolvedValue({
        id: 'mov4',
        ...movementData,
        previousQty: 100,
        newQty: 75,
        createdById: 'user1',
        createdAt: new Date(),
      });

      const _result = await service.createMovement(movementData, 'user1');

      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { quantity: 75 },
      });
    });

    it('should throw BadRequestException for TRANSFER when insufficient stock', async () => {
      const movementData = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'TRANSFER' as const,
        quantity: 150,
        reference: 'TRF-002',
        notes: 'Attempt to transfer more than available',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);

      await expect(service.createMovement(movementData, 'user1')).rejects.toThrow(BadRequestException);
    });

    it('should create RETURN movement and increase inventory', async () => {
      const movementData = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'RETURN' as const,
        quantity: 15,
        reference: 'RET-001',
        notes: 'Customer return',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);
      mockDatabaseService.inventoryItem.update.mockResolvedValue({ ...existingInventoryItem, quantity: 115 });
      mockDatabaseService.inventoryMovement.create.mockResolvedValue({
        id: 'mov5',
        ...movementData,
        previousQty: 100,
        newQty: 115,
        createdById: 'user1',
        createdAt: new Date(),
      });

      const _result = await service.createMovement(movementData, 'user1');

      expect(mockDatabaseService.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { quantity: 115 },
      });
    });

    it('should throw BadRequestException for invalid movement type', async () => {
      const movementData = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'INVALID' as any,
        quantity: 10,
        reference: 'INV-001',
        notes: 'Invalid movement type',
      };

      const existingInventoryItem = {
        id: 'inv1',
        quantity: 100,
        productId: 'prod1',
        locationId: 'loc1',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(existingInventoryItem);

      await expect(service.createMovement(movementData, 'user1')).rejects.toThrow(BadRequestException);
      expect(mockDatabaseService.inventoryItem.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when inventory item not found for movement', async () => {
      const movementData = {
        inventoryItemId: 'non-existent',
        productId: 'prod1',
        type: 'INBOUND' as const,
        quantity: 10,
        reference: 'REF-001',
        notes: 'Movement for non-existent item',
      };

      mockDatabaseService.inventoryItem.findUnique.mockResolvedValue(null);

      await expect(service.createMovement(movementData, 'user1')).rejects.toThrow(NotFoundException);
      expect(mockDatabaseService.inventoryItem.update).not.toHaveBeenCalled();
      expect(mockDatabaseService.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

});