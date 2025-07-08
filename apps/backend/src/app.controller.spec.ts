import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  const mockAppService = {
    getInfo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<AppService>(AppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getInfo', () => {
    it('should return application info from service', () => {
      const mockInfo = {
        name: 'Ventry API',
        version: '1.0.0',
        description: 'AI-native inventory management system',
        status: 'operational',
        timestamp: new Date().toISOString(),
      };

      mockAppService.getInfo.mockReturnValue(mockInfo);

      const result = controller.getInfo();

      expect(result).toBe(mockInfo);
      expect(service.getInfo).toHaveBeenCalledTimes(1);
    });
  });
});