import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Location } from '@ventry/database';
import { LocationRequest } from '@ventry/shared';

@Injectable()
export class LocationsService {
  constructor(private database: DatabaseService) {}

  async create(data: LocationRequest): Promise<Location> {
    try {
      return await this.database.location.create({
        data,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Location name already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<Location[]> {
    return this.database.location.findMany({
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
  }

  async findById(id: string): Promise<Location | null> {
    const location = await this.database.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inventoryItems: true,
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  async update(id: string, data: LocationRequest): Promise<Location> {
    const location = await this.findById(id);
    
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    try {
      return await this.database.location.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Location name already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Location> {
    const location = await this.findById(id);
    
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const inventoryCount = await this.database.inventoryItem.count({
      where: { locationId: id },
    });

    if (inventoryCount > 0) {
      throw new ConflictException('Cannot delete location with existing inventory');
    }

    return this.database.location.delete({
      where: { id },
    });
  }
}