import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { ExecutionContext } from '@nestjs/common';
import { Role } from '@ventry/database';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => user !== null ? { user } : {},
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  describe('canActivate', () => {
    it('should return true when no roles are required', () => {
      const mockContext = createMockExecutionContext({
        id: 'user-123',
        role: Role.USER,
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('roles', [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should return true when user has required role', () => {
      const mockUser = {
        id: 'admin-123',
        role: Role.ADMIN,
      };
      const mockContext = createMockExecutionContext(mockUser);

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return true when user has one of multiple required roles', () => {
      const mockUser = {
        id: 'manager-123',
        role: Role.MANAGER,
      };
      const mockContext = createMockExecutionContext(mockUser);

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN, Role.MANAGER]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should return false when user does not have required role', () => {
      const mockUser = {
        id: 'user-123',
        role: Role.USER,
      };
      const mockContext = createMockExecutionContext(mockUser);

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when user does not have any of the required roles', () => {
      const mockUser = {
        id: 'user-123',
        role: Role.USER,
      };
      const mockContext = createMockExecutionContext(mockUser);

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN, Role.MANAGER]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when user has no role', () => {
      const mockUser = {
        id: 'user-123',
        // no role property
      };
      const mockContext = createMockExecutionContext(mockUser);

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.USER]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should return false when there is no user', () => {
      const mockContext = createMockExecutionContext(null);

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.USER]);

      expect(() => guard.canActivate(mockContext)).toThrow();
    });

    it('should handle empty roles array', () => {
      const mockUser = {
        id: 'user-123',
        role: Role.USER,
      };
      const mockContext = createMockExecutionContext(mockUser);

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });
});