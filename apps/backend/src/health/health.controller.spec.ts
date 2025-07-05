import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

const mockHealthService = {
  getHealth: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return health status when service is healthy', async () => {
      const mockHealthResponse = {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
        uptime: 3600,
        version: '1.0.0',
        database: 'connected',
        memory: {
          used: 128,
          total: 256,
          usage: '50%',
        },
        responseTime: 15,
      };

      mockHealthService.getHealth.mockResolvedValue(mockHealthResponse);

      const result = await controller.getHealth();

      expect(result).toEqual(mockHealthResponse);
      expect(mockHealthService.getHealth).toHaveBeenCalledTimes(1);
    });

    it('should return error status when service is unhealthy', async () => {
      const mockErrorResponse = {
        status: 'error',
        timestamp: '2024-01-01T00:00:00.000Z',
        error: 'Database connection failed',
        uptime: 3600,
        version: '1.0.0',
        database: 'disconnected',
        memory: {
          used: 0,
          total: 0,
          usage: '0%',
        },
        responseTime: 50,
      };

      mockHealthService.getHealth.mockResolvedValue(mockErrorResponse);

      const result = await controller.getHealth();

      expect(result).toEqual(mockErrorResponse);
      expect(result.status).toBe('error');
      expect(result.database).toBe('disconnected');
      expect(mockHealthService.getHealth).toHaveBeenCalledTimes(1);
    });

    it('should handle service exceptions', async () => {
      const serviceError = new Error('Health service unavailable');
      mockHealthService.getHealth.mockRejectedValue(serviceError);

      await expect(controller.getHealth()).rejects.toThrow('Health service unavailable');
      expect(mockHealthService.getHealth).toHaveBeenCalledTimes(1);
    });

    it('should return health status with proper memory metrics', async () => {
      const mockHealthResponse = {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
        uptime: 7200,
        version: '1.0.0',
        database: 'connected',
        memory: {
          used: 512,
          total: 1024,
          usage: '50%',
        },
        responseTime: 8,
      };

      mockHealthService.getHealth.mockResolvedValue(mockHealthResponse);

      const result = await controller.getHealth();

      expect(result.memory).toBeDefined();
      expect(result.memory.used).toBe(512);
      expect(result.memory.total).toBe(1024);
      expect(result.memory.usage).toBe('50%');
      expect(result.responseTime).toBeDefined();
      expect(typeof result.responseTime).toBe('number');
    });

    it('should return health status with uptime information', async () => {
      const mockHealthResponse = {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
        uptime: 86400, // 24 hours
        version: '1.0.0',
        database: 'connected',
        memory: {
          used: 256,
          total: 512,
          usage: '50%',
        },
        responseTime: 12,
      };

      mockHealthService.getHealth.mockResolvedValue(mockHealthResponse);

      const result = await controller.getHealth();

      expect(result.uptime).toBe(86400);
      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('controller metadata', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have correct service dependency', () => {
      expect(healthService).toBeDefined();
    });
  });
});