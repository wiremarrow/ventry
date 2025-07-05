import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { DatabaseService } from '../database/database.service';

const mockDatabaseService = {
  location: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  inventoryItem: {
    count: jest.fn(),
  },
};

describe('LocationsService', () => {
  let service: LocationsService;
  let _databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
    _databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all locations', async () => {
      const mockLocations = [
        {
          id: '1',
          name: 'Warehouse A',
          description: 'Main warehouse',
          address: '123 Main St',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Warehouse B',
          description: 'Secondary warehouse',
          address: '456 Oak Ave',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDatabaseService.location.findMany.mockResolvedValue(mockLocations);

      const result = await service.findAll();

      expect(result).toEqual(mockLocations);
      expect(mockDatabaseService.location.findMany).toHaveBeenCalledWith({
        include: {
          _count: {
            select: {
              inventoryItems: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    });
  });

  describe('findById', () => {
    it('should return a location when found', async () => {
      const mockLocation = {
        id: '1',
        name: 'Warehouse A',
        description: 'Main warehouse',
        address: '123 Main St',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabaseService.location.findUnique.mockResolvedValue(mockLocation);

      const result = await service.findById('1');

      expect(result).toEqual(mockLocation);
      expect(mockDatabaseService.location.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          _count: {
            select: {
              inventoryItems: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when location not found', async () => {
      mockDatabaseService.location.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });


  describe('create', () => {
    it('should create a location successfully', async () => {
      const createLocationDto = {
        name: 'New Warehouse',
        description: 'A new warehouse location',
        address: '789 Pine St',
        isActive: true,
      };

      const mockCreatedLocation = {
        id: '1',
        ...createLocationDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabaseService.location.create.mockResolvedValue(mockCreatedLocation);

      const result = await service.create(createLocationDto);

      expect(result).toEqual(mockCreatedLocation);
      expect(mockDatabaseService.location.create).toHaveBeenCalledWith({
        data: createLocationDto,
      });
    });

    it('should throw ConflictException when location name already exists', async () => {
      const createLocationDto = {
        name: 'Existing Warehouse',
        description: 'A warehouse that already exists',
        address: '789 Pine St',
        isActive: true,
      };

      mockDatabaseService.location.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['name'] },
      });

      await expect(service.create(createLocationDto)).rejects.toThrow(ConflictException);
    });

    it('should throw original error for database errors other than P2002', async () => {
      const createLocationDto = {
        name: 'New Warehouse',
        description: 'A new warehouse location',
        address: '789 Pine St',
        isActive: true,
      };

      const databaseError = new Error('Database connection failed');
      mockDatabaseService.location.create.mockRejectedValue(databaseError);

      await expect(service.create(createLocationDto)).rejects.toThrow(databaseError);
    });
  });

  describe('update', () => {
    it('should update a location successfully', async () => {
      const updateLocationDto = {
        name: 'Updated Warehouse',
        description: 'Updated warehouse description',
        address: '321 Updated St',
        isActive: true,
      };

      const mockUpdatedLocation = {
        id: '1',
        name: 'Updated Warehouse',
        description: 'Updated warehouse description',
        address: '321 Updated St',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabaseService.location.update.mockResolvedValue(mockUpdatedLocation);

      // Mock findById to return a location first
      mockDatabaseService.location.findUnique.mockResolvedValue({
        id: '1',
        name: 'Original Warehouse',
        description: 'Original description',
        address: '123 Original St',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update('1', updateLocationDto);

      expect(result).toEqual(mockUpdatedLocation);
      expect(mockDatabaseService.location.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateLocationDto,
      });
    });

    it('should throw NotFoundException when location not found', async () => {
      const updateLocationDto = {
        name: 'Updated Warehouse',
        isActive: true,
      };

      mockDatabaseService.location.update.mockRejectedValue({
        code: 'P2025',
      });

      // Mock findById to return null
      mockDatabaseService.location.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateLocationDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updated name already exists', async () => {
      const updateLocationDto = {
        name: 'Existing Warehouse Name',
        isActive: true,
      };

      // Mock findById to return a location first
      mockDatabaseService.location.findUnique.mockResolvedValue({
        id: '1',
        name: 'Original Warehouse',
        description: 'Original description',
        address: '123 Original St',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockDatabaseService.location.update.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['name'] },
      });

      await expect(service.update('1', updateLocationDto)).rejects.toThrow(ConflictException);
    });

    it('should throw original error for database errors other than P2002 on update', async () => {
      const updateLocationDto = {
        name: 'Updated Warehouse',
        isActive: true,
      };

      // Mock findById to return a location first
      mockDatabaseService.location.findUnique.mockResolvedValue({
        id: '1',
        name: 'Original Warehouse',
        description: 'Original description',
        address: '123 Original St',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const databaseError = new Error('Database connection failed');
      mockDatabaseService.location.update.mockRejectedValue(databaseError);

      await expect(service.update('1', updateLocationDto)).rejects.toThrow(databaseError);
    });
  });

  describe('remove', () => {
    it('should hard delete a location successfully when no inventory exists', async () => {
      const mockLocation = {
        id: '1',
        name: 'Warehouse A',
        description: 'Main warehouse',
        address: '123 Main St',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findById to return the location
      mockDatabaseService.location.findUnique.mockResolvedValue(mockLocation);
      // Mock inventory count to return 0
      mockDatabaseService.inventoryItem.count.mockResolvedValue(0);
      // Mock delete to return the deleted location
      mockDatabaseService.location.delete.mockResolvedValue(mockLocation);

      const result = await service.remove('1');

      expect(result).toEqual(mockLocation);
      expect(mockDatabaseService.inventoryItem.count).toHaveBeenCalledWith({
        where: { locationId: '1' },
      });
      expect(mockDatabaseService.location.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw ConflictException when location has inventory', async () => {
      const mockLocation = {
        id: '1',
        name: 'Warehouse A',
        description: 'Main warehouse',
        address: '123 Main St',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findById to return the location
      mockDatabaseService.location.findUnique.mockResolvedValue(mockLocation);
      // Mock inventory count to return > 0
      mockDatabaseService.inventoryItem.count.mockResolvedValue(5);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
      expect(mockDatabaseService.inventoryItem.count).toHaveBeenCalledWith({
        where: { locationId: '1' },
      });
    });

    it('should throw NotFoundException when location not found', async () => {
      mockDatabaseService.location.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});