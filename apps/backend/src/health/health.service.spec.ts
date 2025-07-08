import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service.js';
import { DatabaseService } from '../database/database.service.js';

const mockDatabaseService = {
  getHealth: jest.fn(),
};

describe('HealthService', () => {
  let service: HealthService;
  let _databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    _databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('getHealth', () => {
    it('should return ok status when database is healthy', async () => {
      mockDatabaseService.getHealth.mockResolvedValue({ status: 'connected' });

      const result = await service.getHealth();

      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: '1.0.0',
        database: 'connected',
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          usage: expect.any(String),
        },
        responseTime: expect.any(Number),
      });

      expect(mockDatabaseService.getHealth).toHaveBeenCalled();
    });

    it('should return error status when database check fails', async () => {
      mockDatabaseService.getHealth.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.getHealth();

      expect(result).toEqual({
        status: 'error',
        timestamp: expect.any(String),
        error: 'Database connection failed',
        uptime: expect.any(Number),
        version: '1.0.0',
        database: 'disconnected',
        memory: {
          used: 0,
          total: 0,
          usage: '0%',
        },
        responseTime: expect.any(Number),
      });

      expect(mockDatabaseService.getHealth).toHaveBeenCalled();
    });

    it('should calculate memory usage correctly', async () => {
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 52428800,
        heapTotal: 33554432,
        heapUsed: 16777216,
        external: 1024000,
        arrayBuffers: 512000,
      });

      mockDatabaseService.getHealth.mockResolvedValue({ status: 'connected' });

      const result = await service.getHealth();

      expect(result.memory).toEqual({
        used: 16, // 16777216 / 1024 / 1024
        total: 32, // 33554432 / 1024 / 1024
        usage: '50%', // (16777216 / 33554432) * 100
      });
    });

    it('should calculate response time correctly', async () => {
      const startTime = Date.now();
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(startTime + 25); // 25ms later

      mockDatabaseService.getHealth.mockResolvedValue({ status: 'connected' });

      const result = await service.getHealth();

      expect(result.responseTime).toBe(25);
    });

    it('should handle uptime calculation', async () => {
      jest.spyOn(process, 'uptime').mockReturnValue(86400.7); // 24 hours and some change

      mockDatabaseService.getHealth.mockResolvedValue({ status: 'connected' });

      const result = await service.getHealth();

      expect(result.uptime).toBe(86401); // Rounded
    });

    it('should handle different database statuses', async () => {
      const mockDbHealth = {
        status: 'slow',
        responseTime: 500,
        connectionCount: 10,
      };

      mockDatabaseService.getHealth.mockResolvedValue(mockDbHealth);

      const result = await service.getHealth();

      expect(result.status).toBe('ok');
      expect(result.database).toBe('slow');
    });

    it('should handle edge case memory calculations', async () => {
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 1048576,
        heapTotal: 1048576,
        heapUsed: 1048576,
        external: 0,
        arrayBuffers: 0,
      });

      mockDatabaseService.getHealth.mockResolvedValue({ status: 'connected' });

      const result = await service.getHealth();

      expect(result.memory).toEqual({
        used: 1, // 1048576 / 1024 / 1024 = 1
        total: 1, // 1048576 / 1024 / 1024 = 1
        usage: '100%', // (1048576 / 1048576) * 100 = 100
      });
    });

    it('should handle zero memory usage', async () => {
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 0,
        heapTotal: 1048576,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0,
      });

      mockDatabaseService.getHealth.mockResolvedValue({ status: 'connected' });

      const result = await service.getHealth();

      expect(result.memory).toEqual({
        used: 0,
        total: 1,
        usage: '0%',
      });
    });

    it('should include version information', async () => {
      mockDatabaseService.getHealth.mockResolvedValue({ status: 'connected' });

      const result = await service.getHealth();

      expect(result.version).toBe('1.0.0');
    });

    it('should include timestamp in ISO format', async () => {
      mockDatabaseService.getHealth.mockResolvedValue({ status: 'connected' });

      const result = await service.getHealth();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(typeof result.timestamp).toBe('string');
    });

    it('should handle various database error messages', async () => {
      const customError = new Error('Connection pool exhausted');
      mockDatabaseService.getHealth.mockRejectedValue(customError);

      const result = await service.getHealth();

      expect(result.status).toBe('error');
      expect(result.error).toBe('Connection pool exhausted');
      expect(result.database).toBe('disconnected');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockDatabaseService.getHealth.mockRejectedValue(networkError);

      const result = await service.getHealth();

      expect(result.status).toBe('error');
      expect(result.error).toBe('ECONNREFUSED');
      expect(result.database).toBe('disconnected');
    });

    it('should maintain consistent structure on error', async () => {
      jest.spyOn(process, 'uptime').mockReturnValue(7200);
      mockDatabaseService.getHealth.mockRejectedValue(new Error('Test error'));

      const result = await service.getHealth();

      expect(result).toHaveProperty('status', 'error');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('error', 'Test error');
      expect(result).toHaveProperty('uptime', 7200);
      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('database', 'disconnected');
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('responseTime');
    });
  });
});