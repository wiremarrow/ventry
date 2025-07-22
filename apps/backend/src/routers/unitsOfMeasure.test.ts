import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';
import { prisma as mockPrisma } from '@ventry/database';

// Helper to create valid CUID-like IDs for testing
const testId = (prefix: string) => `cl${prefix}1234567890abcdefghij`;

// Mock @ventry/database
vi.mock('@ventry/database', () => {
  const mockPrisma = {
    unitOfMeasure: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  
  // Set up transaction mock
  mockPrisma.$transaction.mockImplementation(async (fn) => {
    return await fn(mockPrisma);
  });
  
  return {
    prisma: mockPrisma,
    Prisma: {
      UnitOfMeasureWhereInput: {},
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
    },
  };
});

describe('UnitsOfMeasure Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;
  let mockRes: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset all mock implementations to avoid interference between tests
    mockPrisma.unitOfMeasure.findMany.mockReset();
    mockPrisma.unitOfMeasure.findFirst.mockReset();
    mockPrisma.unitOfMeasure.findUnique.mockReset();
    mockPrisma.unitOfMeasure.count.mockReset();
    mockPrisma.unitOfMeasure.create.mockReset();
    mockPrisma.unitOfMeasure.update.mockReset();
    mockPrisma.unitOfMeasure.delete.mockReset();
    mockPrisma.auditLog.create.mockReset();
    
    // Create a proper mock response object
    mockRes = {
      setCookie: vi.fn(),
      clearCookie: vi.fn(),
      header: vi.fn(),
    };
    
    // Default authenticated user with organization context
    const authenticatedUser = {
      ...mockAuthenticatedUser,
      organizationId: testId('org'),
      organizationRole: 'ADMIN',
      role: 'ADMIN',
    };
    
    caller = await createDirectCaller({ 
      prisma: mockPrisma as any,
      res: mockRes,
      user: authenticatedUser,
    });
  });

  describe('list', () => {
    it('should list units of measure', async () => {
      const mockUnits = [
        {
          id: testId('uom1'),
          code: 'KG',
          description: 'Kilogram',
          isBase: true,
          conversionFactorToBase: 1,
          organizationId: testId('org'),
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            items: 10,
          },
        },
        {
          id: testId('uom2'),
          code: 'G',
          description: 'Gram',
          isBase: false,
          conversionFactorToBase: 0.001,
          organizationId: testId('org'),
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            items: 5,
          },
        },
      ];

      mockPrisma.unitOfMeasure.findMany.mockResolvedValue(mockUnits);

      const result = await caller.unitsOfMeasure.list({});

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('KG');
      expect(result[0].isBase).toBe(true);
      expect(result[1].code).toBe('G');
      expect(result[1].conversionFactorToBase).toBe(0.001);
    });

    it('should search units by code or description', async () => {
      mockPrisma.unitOfMeasure.findMany.mockResolvedValue([]);

      await caller.unitsOfMeasure.list({
        search: 'gram',
      });

      expect(mockPrisma.unitOfMeasure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { code: { contains: 'gram', mode: 'insensitive' } },
              { description: { contains: 'gram', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should filter by base units only', async () => {
      mockPrisma.unitOfMeasure.findMany.mockResolvedValue([]);

      await caller.unitsOfMeasure.list({
        isBase: true,
      });

      expect(mockPrisma.unitOfMeasure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isBase: true,
          }),
        })
      );
    });

    it('should order base units first', async () => {
      mockPrisma.unitOfMeasure.findMany.mockResolvedValue([]);

      await caller.unitsOfMeasure.list({});

      expect(mockPrisma.unitOfMeasure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { isBase: 'desc' },
            { code: 'asc' },
          ],
        })
      );
    });

    it('should require organization context', async () => {
      const noOrgCaller = await createDirectCaller({ 
        prisma: mockPrisma as any,
        res: mockRes,
        user: { ...mockAuthenticatedUser, organizationId: undefined },
      });

      await expect(noOrgCaller.unitsOfMeasure.list({})).rejects.toThrow('No organization selected');
    });
  });

  describe('getById', () => {
    it('should get unit of measure by id', async () => {
      const mockUnit = {
        id: testId('uom1'),
        code: 'KG',
        description: 'Kilogram',
        isBase: true,
        conversionFactorToBase: 1,
        organizationId: testId('org'),
        items: [
          {
            id: testId('item1'),
            name: 'Product A',
            sku: 'PROD-A',
          },
        ],
      };

      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(mockUnit);

      const result = await caller.unitsOfMeasure.getById({
        id: testId('uom1'),
      });

      expect(result.id).toBe(testId('uom1'));
      expect(result.code).toBe('KG');
      expect(result.items).toHaveLength(1);
    });

    it('should throw NOT_FOUND when unit does not exist', async () => {
      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(null);

      await expect(
        caller.unitsOfMeasure.getById({ id: testId('nonexistent') })
      ).rejects.toThrow('Unit of measure not found');
    });
  });

  describe('create', () => {
    it('should create a new unit of measure', async () => {
      const unitData = {
        code: 'KG',
        description: 'Kilogram',
        isBase: true,
        conversionFactorToBase: 1,
      };

      const newUnit = {
        id: testId('uom1'),
        ...unitData,
        organizationId: testId('org'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(null); // No duplicate
      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(null); // No existing base
      mockPrisma.unitOfMeasure.create.mockResolvedValue(newUnit);

      const result = await caller.unitsOfMeasure.create(unitData);

      expect(result.code).toBe('KG');
      expect(result.isBase).toBe(true);
    });

    it('should create a non-base unit', async () => {
      const unitData = {
        code: 'G',
        description: 'Gram',
        isBase: false,
        conversionFactorToBase: 0.001,
      };

      const newUnit = {
        id: testId('uom2'),
        ...unitData,
        organizationId: testId('org'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(null);
      mockPrisma.unitOfMeasure.create.mockResolvedValue(newUnit);

      const result = await caller.unitsOfMeasure.create(unitData);

      expect(result.code).toBe('G');
      expect(result.conversionFactorToBase).toBe(0.001);
    });

    it('should enforce base unit conversion factor of 1', async () => {
      const unitData = {
        code: 'KG',
        description: 'Kilogram',
        isBase: true,
        conversionFactorToBase: 2, // Invalid for base unit
      };

      await expect(
        caller.unitsOfMeasure.create(unitData)
      ).rejects.toThrow('Base unit must have conversion factor of 1');
    });

    it('should prevent duplicate code', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'KG',
        organizationId: testId('org'),
      };

      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(existingUnit);

      await expect(
        caller.unitsOfMeasure.create({
          code: 'KG',
          description: 'Another Kilogram',
        })
      ).rejects.toThrow('Unit code already exists');
    });

    it('should prevent multiple base units', async () => {
      const existingBase = {
        id: testId('uom1'),
        code: 'KG',
        isBase: true,
        organizationId: testId('org'),
      };

      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(null);
      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(existingBase);

      await expect(
        caller.unitsOfMeasure.create({
          code: 'LB',
          description: 'Pound',
          isBase: true,
        })
      ).rejects.toThrow('A base unit already exists. Only one base unit is allowed.');
    });
  });

  describe('update', () => {
    it('should update unit of measure', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'KG',
        description: 'Kilogram',
        isBase: true,
        conversionFactorToBase: 1,
        organizationId: testId('org'),
      };

      const updatedUnit = {
        ...existingUnit,
        description: 'Kilogram (Base)',
        updatedAt: new Date(),
      };

      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(existingUnit);
      mockPrisma.unitOfMeasure.update.mockResolvedValue(updatedUnit);

      const result = await caller.unitsOfMeasure.update({
        id: testId('uom1'),
        description: 'Kilogram (Base)',
      });

      expect(result.description).toBe('Kilogram (Base)');
    });

    it('should update code if not duplicate', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'KG',
        description: 'Kilogram',
        organizationId: testId('org'),
      };

      const updatedUnit = {
        ...existingUnit,
        code: 'KILO',
        updatedAt: new Date(),
      };

      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(existingUnit);
      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(null); // No duplicate
      mockPrisma.unitOfMeasure.update.mockResolvedValue(updatedUnit);

      const result = await caller.unitsOfMeasure.update({
        id: testId('uom1'),
        code: 'KILO',
      });

      expect(result.code).toBe('KILO');
    });

    it('should prevent changing to duplicate code', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'KG',
        organizationId: testId('org'),
      };

      const duplicateUnit = {
        id: testId('uom2'),
        code: 'LB',
        organizationId: testId('org'),
      };

      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(existingUnit);
      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(duplicateUnit);

      await expect(
        caller.unitsOfMeasure.update({
          id: testId('uom1'),
          code: 'LB',
        })
      ).rejects.toThrow('Unit code already exists');
    });

    it('should prevent changing to base when base exists', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'G',
        isBase: false,
        organizationId: testId('org'),
      };

      const existingBase = {
        id: testId('uom2'),
        code: 'KG',
        isBase: true,
        organizationId: testId('org'),
      };

      mockPrisma.unitOfMeasure.findFirst
        .mockResolvedValueOnce(existingUnit)
        .mockResolvedValueOnce(existingBase);

      await expect(
        caller.unitsOfMeasure.update({
          id: testId('uom1'),
          isBase: true,
        })
      ).rejects.toThrow('A base unit already exists. Only one base unit is allowed.');
    });

    it('should enforce base unit conversion factor', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'KG',
        isBase: true,
        conversionFactorToBase: 1,
        organizationId: testId('org'),
      };

      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(existingUnit);

      await expect(
        caller.unitsOfMeasure.update({
          id: testId('uom1'),
          conversionFactorToBase: 2,
        })
      ).rejects.toThrow('Base unit must have conversion factor of 1');
    });

    it('should throw NOT_FOUND when unit does not exist', async () => {
      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(null);

      await expect(
        caller.unitsOfMeasure.update({
          id: testId('nonexistent'),
          description: 'New Description',
        })
      ).rejects.toThrow('Unit of measure not found');
    });
  });

  describe('delete', () => {
    it('should delete unit without items', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'KG',
        description: 'Kilogram',
        isBase: false,
        organizationId: testId('org'),
        _count: {
          items: 0,
        },
      };

      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(existingUnit);
      mockPrisma.unitOfMeasure.delete.mockResolvedValue(existingUnit);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await caller.unitsOfMeasure.delete({
        id: testId('uom1'),
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.unitOfMeasure.delete).toHaveBeenCalledWith({
        where: { id: testId('uom1') },
      });
    });

    it('should prevent deleting unit with items', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'KG',
        organizationId: testId('org'),
        _count: {
          items: 5, // Has items
        },
      };

      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(existingUnit);

      await expect(
        caller.unitsOfMeasure.delete({ id: testId('uom1') })
      ).rejects.toThrow('Cannot delete unit of measure that is in use');
    });

    it('should prevent deleting base unit if other units exist', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'KG',
        isBase: true,
        organizationId: testId('org'),
        _count: {
          items: 0,
        },
      };

      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(existingUnit);
      mockPrisma.unitOfMeasure.count.mockResolvedValue(2); // Other units exist

      await expect(
        caller.unitsOfMeasure.delete({ id: testId('uom1') })
      ).rejects.toThrow('Cannot delete base unit while other units exist');
    });

    it('should allow deleting base unit if no other units', async () => {
      const existingUnit = {
        id: testId('uom1'),
        code: 'KG',
        isBase: true,
        organizationId: testId('org'),
        _count: {
          items: 0,
        },
      };

      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(existingUnit);
      mockPrisma.unitOfMeasure.count.mockResolvedValue(0); // No other units
      mockPrisma.unitOfMeasure.delete.mockResolvedValue(existingUnit);

      const result = await caller.unitsOfMeasure.delete({
        id: testId('uom1'),
      });

      expect(result.success).toBe(true);
    });

    it('should throw NOT_FOUND when unit does not exist', async () => {
      mockPrisma.unitOfMeasure.findFirst.mockResolvedValue(null);

      await expect(
        caller.unitsOfMeasure.delete({ id: testId('nonexistent') })
      ).rejects.toThrow('Unit of measure not found');
    });
  });
});