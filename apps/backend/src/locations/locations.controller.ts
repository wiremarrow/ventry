import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LocationRequest } from '@ventry/shared';
import { Role } from '@ventry/database';

@ApiTags('Locations')
@Controller('locations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create a new location' })
  @ApiResponse({ status: 201, description: 'Location created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Location name already exists' })
  async create(@Body() createLocationDto: LocationRequest) {
    return this.locationsService.create(createLocationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all locations' })
  @ApiResponse({ status: 200, description: 'Locations retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll() {
    return this.locationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiResponse({ status: 200, description: 'Location retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async findOne(@Param('id') id: string) {
    return this.locationsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update location' })
  @ApiResponse({ status: 200, description: 'Location updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  @ApiResponse({ status: 409, description: 'Location name already exists' })
  async update(@Param('id') id: string, @Body() updateLocationDto: LocationRequest) {
    return this.locationsService.update(id, updateLocationDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete location' })
  @ApiResponse({ status: 200, description: 'Location deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete location with existing inventory' })
  async remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }
}