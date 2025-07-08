import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ThrottlerGuard } from '@nestjs/throttler';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockInventoryService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByProductAndLocation: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  createMovement: jest.fn(),
  getMovements: jest.fn(),
  adjustInventory: jest.fn(),
  transferInventory: jest.fn(),
  getStats: jest.fn(),
};

describe('InventoryController', () => {
  let controller: InventoryController;
  let inventoryService: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<InventoryController>(InventoryController);
    inventoryService = module.get<InventoryService>(InventoryService);
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

      mockInventoryService.create.mockResolvedValue(mockCreatedItem);

      const result = await controller.create(createInventoryDto);

      expect(result).toEqual(mockCreatedItem);
      expect(mockInventoryService.create).toHaveBeenCalledWith(createInventoryDto);
      expect(mockInventoryService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle BadRequestException when inventory item already exists', async () => {
      const createInventoryDto = {
        productId: 'prod1',
        locationId: 'loc1',
        quantity: 100,
        reservedQty: 0,
        reorderPoint: 10,
        maxStock: 500,
      };

      mockInventoryService.create.mockRejectedValue(new BadRequestException('Inventory item already exists for this product and location'));

      await expect(controller.create(createInventoryDto)).rejects.toThrow(BadRequestException);
      expect(mockInventoryService.create).toHaveBeenCalledWith(createInventoryDto);
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
      ];

      mockInventoryService.findAll.mockResolvedValue(mockInventoryItems);

      const result = await controller.findAll({});

      expect(result).toEqual(mockInventoryItems);
      expect(mockInventoryService.findAll).toHaveBeenCalledWith({
        skip: undefined,
        take: undefined,
        where: {},
        orderBy: { product: { name: 'asc' } },
      });
      expect(mockInventoryService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return inventory items with query parameters', async () => {
      const queryParams = {
        page: '1',
        limit: '10',
        productId: 'prod1',
        locationId: 'loc1',
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
        },
      ];

      mockInventoryService.findAll.mockResolvedValue(mockInventoryItems);

      const result = await controller.findAll(queryParams);

      expect(result).toEqual(mockInventoryItems);
      expect(mockInventoryService.findAll).toHaveBeenCalledWith(expect.objectContaining({
        skip: 0,
        take: 10,
        where: {
          productId: 'prod1',
          locationId: 'loc1',
        },
        orderBy: { product: { name: 'asc' } },
      }));
    });
  });

  describe('findOne', () => {
    it('should return an inventory item by ID', async () => {
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

      mockInventoryService.findById.mockResolvedValue(mockInventoryItem);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockInventoryItem);
      expect(mockInventoryService.findById).toHaveBeenCalledWith('1');
      expect(mockInventoryService.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when inventory item not found', async () => {
      mockInventoryService.findById.mockRejectedValue(new NotFoundException('Inventory item not found'));

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockInventoryService.findById).toHaveBeenCalledWith('non-existent');
    });
  });


  describe('update', () => {
    it('should update an inventory item successfully', async () => {
      const updateDto = {
        quantity: 150,
        reorderPoint: 20,
        maxStock: 600,
      };

      const mockUpdatedItem = {
        id: '1',
        productId: 'prod1',
        locationId: 'loc1',
        quantity: 150,
        reservedQty: 0,
        reorderPoint: 20,
        maxStock: 600,
        lastCountDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'prod1',
          name: 'Product 1',
          sku: 'SKU001',
        },
        location: {
          id: 'loc1',
          name: 'Location 1',
        },
      };

      mockInventoryService.update.mockResolvedValue(mockUpdatedItem);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(mockUpdatedItem);
      expect(mockInventoryService.update).toHaveBeenCalledWith('1', updateDto);
      expect(mockInventoryService.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when updating non-existent inventory item', async () => {
      const updateDto = {
        quantity: 150,
        reorderPoint: 20,
      };

      mockInventoryService.update.mockRejectedValue(new NotFoundException('Inventory item not found'));

      await expect(controller.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
      expect(mockInventoryService.update).toHaveBeenCalledWith('non-existent', updateDto);
    });
  });

  describe('remove', () => {
    it('should remove an inventory item successfully', async () => {
      const mockRemovedItem = {
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
      };

      mockInventoryService.remove.mockResolvedValue(mockRemovedItem);

      const result = await controller.remove('1');

      expect(result).toEqual(mockRemovedItem);
      expect(mockInventoryService.remove).toHaveBeenCalledWith('1');
      expect(mockInventoryService.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when removing non-existent inventory item', async () => {
      mockInventoryService.remove.mockRejectedValue(new NotFoundException('Inventory item not found'));

      await expect(controller.remove('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockInventoryService.remove).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('createMovement', () => {
    it('should create an inventory movement successfully', async () => {
      const movementDto = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'INBOUND' as const,
        quantity: 50,
        reference: 'PO-001',
        notes: 'Purchase order delivery',
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      const mockMovement = {
        id: 'mov1',
        ...movementDto,
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

      mockInventoryService.createMovement.mockResolvedValue(mockMovement);

      const result = await controller.createMovement(movementDto, mockRequest);

      expect(result).toEqual(mockMovement);
      expect(mockInventoryService.createMovement).toHaveBeenCalledWith(movementDto, 'user1');
      expect(mockInventoryService.createMovement).toHaveBeenCalledTimes(1);
    });

    it('should handle BadRequestException for insufficient stock', async () => {
      const movementDto = {
        inventoryItemId: 'inv1',
        productId: 'prod1',
        type: 'OUTBOUND' as const,
        quantity: 150,
        reference: 'SO-001',
        notes: 'Sales order',
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      mockInventoryService.createMovement.mockRejectedValue(new BadRequestException('Insufficient stock'));

      await expect(controller.createMovement(movementDto, mockRequest)).rejects.toThrow(BadRequestException);
      expect(mockInventoryService.createMovement).toHaveBeenCalledWith(movementDto, 'user1');
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
        },
      ];

      mockInventoryService.getMovements.mockResolvedValue(mockMovements);

      const result = await controller.getMovements({});

      expect(result).toEqual(mockMovements);
      expect(mockInventoryService.getMovements).toHaveBeenCalledWith({
        skip: undefined,
        take: undefined,
        where: {},
        orderBy: { createdAt: 'desc' },
      });
      expect(mockInventoryService.getMovements).toHaveBeenCalledTimes(1);
    });

    it('should return movements with query parameters', async () => {
      const queryParams = {
        page: '1',
        limit: '10',
        type: 'INBOUND',
      };

      const mockMovements = [
        {
          id: 'mov1',
          type: 'INBOUND',
          quantity: 50,
        },
      ];

      mockInventoryService.getMovements.mockResolvedValue(mockMovements);

      const result = await controller.getMovements(queryParams);

      expect(result).toEqual(mockMovements);
      expect(mockInventoryService.getMovements).toHaveBeenCalledWith(expect.objectContaining({
        skip: 0,
        take: 10,
        where: {
          type: 'INBOUND',
        },
        orderBy: { createdAt: 'desc' },
      }));
    });

    it('should return movements filtered by productId and locationId', async () => {
      const queryParams = {
        productId: 'prod1',
        locationId: 'loc1',
      };

      const mockMovements = [
        {
          id: 'mov1',
          type: 'INBOUND',
          quantity: 50,
          productId: 'prod1',
          inventoryItem: {
            locationId: 'loc1',
          },
        },
      ];

      mockInventoryService.getMovements.mockResolvedValue(mockMovements);

      const result = await controller.getMovements(queryParams);

      expect(result).toEqual(mockMovements);
      expect(mockInventoryService.getMovements).toHaveBeenCalledWith(expect.objectContaining({
        skip: undefined,
        take: undefined,
        where: {
          productId: 'prod1',
          inventoryItem: {
            locationId: 'loc1',
          },
        },
        orderBy: { createdAt: 'desc' },
      }));
    });
  });

  describe('adjustInventory', () => {
    it('should adjust inventory successfully', async () => {
      const adjustmentDto = {
        inventoryItemId: 'inv1',
        newQuantity: 120,
        reason: 'Physical count',
        notes: 'Inventory adjustment after count',
      };

      const mockRequest = {
        user: { id: 'user1' },
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

      mockInventoryService.adjustInventory.mockResolvedValue(mockMovement);

      const result = await controller.adjustInventory(adjustmentDto, mockRequest);

      expect(result).toEqual(mockMovement);
      expect(mockInventoryService.adjustInventory).toHaveBeenCalledWith(adjustmentDto, 'user1');
      expect(mockInventoryService.adjustInventory).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when inventory item not found for adjustment', async () => {
      const adjustmentDto = {
        inventoryItemId: 'non-existent',
        newQuantity: 50,
        reason: 'Test adjustment',
        notes: 'Test notes',
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      mockInventoryService.adjustInventory.mockRejectedValue(new NotFoundException('Inventory item not found'));

      await expect(controller.adjustInventory(adjustmentDto, mockRequest)).rejects.toThrow(NotFoundException);
      expect(mockInventoryService.adjustInventory).toHaveBeenCalledWith(adjustmentDto, 'user1');
    });
  });

  describe('transferInventory', () => {
    it('should transfer inventory successfully', async () => {
      const transferDto = {
        productId: 'prod1',
        fromLocationId: 'loc1',
        toLocationId: 'loc2',
        quantity: 25,
        notes: 'Transfer for stock balancing',
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      const mockMovements = [
        {
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
        },
        {
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
        },
      ];

      mockInventoryService.transferInventory.mockResolvedValue(mockMovements);

      const result = await controller.transferInventory(transferDto, mockRequest);

      expect(result).toEqual(mockMovements);
      expect(mockInventoryService.transferInventory).toHaveBeenCalledWith(transferDto, 'user1');
      expect(mockInventoryService.transferInventory).toHaveBeenCalledTimes(1);
    });

    it('should handle BadRequestException for insufficient stock transfer', async () => {
      const transferDto = {
        productId: 'prod1',
        fromLocationId: 'loc1',
        toLocationId: 'loc2',
        quantity: 150,
        notes: 'Oversized transfer',
      };

      const mockRequest = {
        user: { id: 'user1' },
      };

      mockInventoryService.transferInventory.mockRejectedValue(new BadRequestException('Insufficient stock in source location'));

      await expect(controller.transferInventory(transferDto, mockRequest)).rejects.toThrow(BadRequestException);
      expect(mockInventoryService.transferInventory).toHaveBeenCalledWith(transferDto, 'user1');
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

      mockInventoryService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual(mockStats);
      expect(mockInventoryService.getStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('controller metadata', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have correct service dependency', () => {
      expect(inventoryService).toBeDefined();
    });
  });
});