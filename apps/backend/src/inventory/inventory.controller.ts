import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InventoryItemRequest, InventoryMovementRequest, InventoryAdjustmentRequest, InventoryTransferRequest } from '@ventry/shared';
import { Role } from '@ventry/database';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create inventory item' })
  @ApiResponse({ status: 201, description: 'Inventory item created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createInventoryDto: InventoryItemRequest) {
    return this.inventoryService.create(createInventoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all inventory items' })
  @ApiResponse({ status: 200, description: 'Inventory items retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() query: any) {
    const { page, limit, productId, locationId, lowStock } = query;
    
    const skip = page ? (parseInt(page) - 1) * parseInt(limit || '20') : undefined;
    const take = limit ? parseInt(limit) : undefined;
    
    const where: any = {};
    
    if (productId) {
      where.productId = productId;
    }
    
    if (locationId) {
      where.locationId = locationId;
    }
    
    if (lowStock === 'true') {
      where.quantity = {
        lte: where.reorderPoint || 0,
      };
    }

    return this.inventoryService.findAll({
      skip,
      take,
      where,
      orderBy: { product: { name: 'asc' } },
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get inventory statistics' })
  @ApiResponse({ status: 200, description: 'Inventory statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats() {
    return this.inventoryService.getStats();
  }

  @Get('movements')
  @ApiOperation({ summary: 'Get inventory movements' })
  @ApiResponse({ status: 200, description: 'Inventory movements retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMovements(@Query() query: any) {
    const { page, limit, productId, locationId, type } = query;
    
    const skip = page ? (parseInt(page) - 1) * parseInt(limit || '20') : undefined;
    const take = limit ? parseInt(limit) : undefined;
    
    const where: any = {};
    
    if (productId) {
      where.productId = productId;
    }
    
    if (locationId) {
      where.inventoryItem = {
        locationId,
      };
    }
    
    if (type) {
      where.type = type;
    }

    return this.inventoryService.getMovements({
      skip,
      take,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('movements')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create inventory movement' })
  @ApiResponse({ status: 201, description: 'Inventory movement created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createMovement(@Body() createMovementDto: InventoryMovementRequest, @Request() req) {
    return this.inventoryService.createMovement(createMovementDto, req.user.id);
  }

  @Post('adjust')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Adjust inventory quantity' })
  @ApiResponse({ status: 201, description: 'Inventory adjusted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async adjustInventory(@Body() adjustDto: InventoryAdjustmentRequest, @Request() req) {
    return this.inventoryService.adjustInventory(adjustDto, req.user.id);
  }

  @Post('transfer')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Transfer inventory between locations' })
  @ApiResponse({ status: 201, description: 'Inventory transferred successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async transferInventory(@Body() transferDto: InventoryTransferRequest, @Request() req) {
    return this.inventoryService.transferInventory(transferDto, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  @ApiResponse({ status: 200, description: 'Inventory item retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  async findOne(@Param('id') id: string) {
    return this.inventoryService.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update inventory item' })
  @ApiResponse({ status: 200, description: 'Inventory item updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  async update(@Param('id') id: string, @Body() updateInventoryDto: Partial<InventoryItemRequest>) {
    return this.inventoryService.update(id, updateInventoryDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete inventory item' })
  @ApiResponse({ status: 200, description: 'Inventory item deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  async remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}