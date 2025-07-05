import { Test, TestingModule } from '@nestjs/testing';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotFoundException, ConflictException } from '@nestjs/common';

const mockLocationsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('LocationsController', () => {
  let controller: LocationsController;
  let locationsService: LocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [
        {
          provide: LocationsService,
          useValue: mockLocationsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<LocationsController>(LocationsController);
    locationsService = module.get<LocationsService>(LocationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a location successfully', async () => {
      const createLocationDto = {
        name: 'Main Warehouse',
        description: 'Primary storage facility',
        address: '123 Warehouse Ave',
        isActive: true,
      };

      const mockCreatedLocation = {
        id: '1',
        ...createLocationDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLocationsService.create.mockResolvedValue(mockCreatedLocation);

      const result = await controller.create(createLocationDto);

      expect(result).toEqual(mockCreatedLocation);
      expect(mockLocationsService.create).toHaveBeenCalledWith(createLocationDto);
      expect(mockLocationsService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle ConflictException when location name already exists', async () => {
      const createLocationDto = {
        name: 'Existing Warehouse',
        description: 'A warehouse that already exists',
        address: '456 Existing St',
        isActive: true,
      };

      mockLocationsService.create.mockRejectedValue(new ConflictException('Location name already exists'));

      await expect(controller.create(createLocationDto)).rejects.toThrow(ConflictException);
      expect(mockLocationsService.create).toHaveBeenCalledWith(createLocationDto);
    });

    it('should create location with minimal data', async () => {
      const createLocationDto = {
        name: 'Minimal Location',
        isActive: true,
      };

      const mockCreatedLocation = {
        id: '2',
        name: 'Minimal Location',
        description: null,
        address: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLocationsService.create.mockResolvedValue(mockCreatedLocation);

      const result = await controller.create(createLocationDto);

      expect(result).toEqual(mockCreatedLocation);
      expect(result.description).toBeNull();
      expect(result.address).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all locations', async () => {
      const mockLocations = [
        {
          id: '1',
          name: 'Main Warehouse',
          description: 'Primary storage',
          address: '123 Main St',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { inventoryItems: 10 },
        },
        {
          id: '2',
          name: 'Secondary Warehouse',
          description: 'Overflow storage',
          address: '456 Secondary Ave',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { inventoryItems: 5 },
        },
      ];

      mockLocationsService.findAll.mockResolvedValue(mockLocations);

      const result = await controller.findAll();

      expect(result).toEqual(mockLocations);
      expect(mockLocationsService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no locations exist', async () => {
      mockLocationsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(mockLocationsService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return locations with inventory counts', async () => {
      const mockLocations = [
        {
          id: '1',
          name: 'Empty Warehouse',
          description: 'No inventory yet',
          address: '789 Empty St',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { inventoryItems: 0 },
        },
      ];

      mockLocationsService.findAll.mockResolvedValue(mockLocations);

      const result = await controller.findAll();

      expect(result[0]).toHaveProperty('_count');
      expect((result[0] as any)._count.inventoryItems).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a location by ID', async () => {
      const mockLocation = {
        id: '1',
        name: 'Main Warehouse',
        description: 'Primary storage facility',
        address: '123 Warehouse Ave',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { inventoryItems: 10 },
      };

      mockLocationsService.findById.mockResolvedValue(mockLocation);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockLocation);
      expect(mockLocationsService.findById).toHaveBeenCalledWith('1');
      expect(mockLocationsService.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when location not found', async () => {
      mockLocationsService.findById.mockRejectedValue(new NotFoundException('Location not found'));

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockLocationsService.findById).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('update', () => {
    it('should update a location successfully', async () => {
      const updateDto = {
        name: 'Updated Warehouse',
        description: 'Updated primary storage facility',
        address: '321 Updated Ave',
        isActive: false,
      };

      const mockUpdatedLocation = {
        id: '1',
        name: 'Updated Warehouse',
        description: 'Updated primary storage facility',
        address: '321 Updated Ave',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLocationsService.update.mockResolvedValue(mockUpdatedLocation);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(mockUpdatedLocation);
      expect(mockLocationsService.update).toHaveBeenCalledWith('1', updateDto);
      expect(mockLocationsService.update).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const updateDto = {
        name: 'Main Warehouse',
        description: 'Updated description only',
        isActive: true,
      };

      const mockUpdatedLocation = {
        id: '1',
        name: 'Main Warehouse',
        description: 'Updated description only',
        address: '123 Warehouse Ave',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLocationsService.update.mockResolvedValue(mockUpdatedLocation);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(mockUpdatedLocation);
      expect(mockLocationsService.update).toHaveBeenCalledWith('1', updateDto);
    });

    it('should throw NotFoundException when updating non-existent location', async () => {
      const updateDto = {
        name: 'Updated Location',
        isActive: true,
      };

      mockLocationsService.update.mockRejectedValue(new NotFoundException('Location not found'));

      await expect(controller.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
      expect(mockLocationsService.update).toHaveBeenCalledWith('non-existent', updateDto);
    });

    it('should handle ConflictException when updating to existing name', async () => {
      const updateDto = {
        name: 'Existing Location Name',
        isActive: true,
      };

      mockLocationsService.update.mockRejectedValue(new ConflictException('Location name already exists'));

      await expect(controller.update('1', updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove a location successfully', async () => {
      const mockRemovedLocation = {
        id: '1',
        name: 'Main Warehouse',
        description: 'Primary storage',
        address: '123 Main St',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLocationsService.remove.mockResolvedValue(mockRemovedLocation);

      const result = await controller.remove('1');

      expect(result).toEqual(mockRemovedLocation);
      expect(mockLocationsService.remove).toHaveBeenCalledWith('1');
      expect(mockLocationsService.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when removing non-existent location', async () => {
      mockLocationsService.remove.mockRejectedValue(new NotFoundException('Location not found'));

      await expect(controller.remove('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockLocationsService.remove).toHaveBeenCalledWith('non-existent');
    });

    it('should handle ConflictException when location has inventory', async () => {
      mockLocationsService.remove.mockRejectedValue(new ConflictException('Cannot delete location with existing inventory'));

      await expect(controller.remove('1')).rejects.toThrow(ConflictException);
      expect(mockLocationsService.remove).toHaveBeenCalledWith('1');
    });
  });

  describe('controller metadata', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have correct service dependency', () => {
      expect(locationsService).toBeDefined();
    });
  });
});