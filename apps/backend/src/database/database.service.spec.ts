import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  describe('onModuleInit', () => {
    it('should call $connect on module initialization', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalledTimes(1);

      connectSpy.mockRestore();
    });

    it('should handle connection errors during initialization', async () => {
      const connectSpy = jest.spyOn(service, '$connect').mockRejectedValue(new Error('Connection failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
      expect(connectSpy).toHaveBeenCalledTimes(1);

      connectSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect on module destruction', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue();

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);

      disconnectSpy.mockRestore();
    });

    it('should handle disconnection errors during destruction', async () => {
      const disconnectSpy = jest.spyOn(service, '$disconnect').mockRejectedValue(new Error('Disconnection failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.onModuleDestroy()).rejects.toThrow('Disconnection failed');
      expect(disconnectSpy).toHaveBeenCalledTimes(1);

      disconnectSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getHealth', () => {
    it('should return connected status when database is healthy', async () => {
      const queryRawSpy = jest.spyOn(service, '$queryRaw').mockResolvedValue(undefined);

      const result = await service.getHealth();

      expect(result).toEqual({ status: 'connected' });
      expect(queryRawSpy).toHaveBeenCalledWith`SELECT 1`;

      queryRawSpy.mockRestore();
    });

    it('should return disconnected status when database query fails', async () => {
      const queryRawSpy = jest.spyOn(service, '$queryRaw').mockRejectedValue(new Error('Database error'));

      const result = await service.getHealth();

      expect(result).toEqual({
        status: 'disconnected',
        error: 'Database error',
      });
      expect(queryRawSpy).toHaveBeenCalledWith`SELECT 1`;

      queryRawSpy.mockRestore();
    });

    it('should handle connection timeout errors', async () => {
      const queryRawSpy = jest.spyOn(service, '$queryRaw').mockRejectedValue(new Error('Connection timeout'));

      const result = await service.getHealth();

      expect(result.status).toBe('disconnected');
      expect(result.error).toBe('Connection timeout');

      queryRawSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      const queryRawSpy = jest.spyOn(service, '$queryRaw').mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.getHealth();

      expect(result.status).toBe('disconnected');
      expect(result.error).toBe('ECONNREFUSED');

      queryRawSpy.mockRestore();
    });

    it('should handle generic database errors', async () => {
      const queryRawSpy = jest.spyOn(service, '$queryRaw').mockRejectedValue(new Error('P2002: Unique constraint'));

      const result = await service.getHealth();

      expect(result.status).toBe('disconnected');
      expect(result.error).toBe('P2002: Unique constraint');

      queryRawSpy.mockRestore();
    });

    it('should handle successful query execution', async () => {
      const queryRawSpy = jest.spyOn(service, '$queryRaw').mockResolvedValue(undefined);

      const result = await service.getHealth();

      expect(result.status).toBe('connected');
      expect(result).not.toHaveProperty('error');

      queryRawSpy.mockRestore();
    });
  });

  describe('service metadata', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should extend PrismaClient', () => {
      expect(service).toHaveProperty('$connect');
      expect(service).toHaveProperty('$disconnect');
      expect(service).toHaveProperty('$queryRaw');
    });
  });
});