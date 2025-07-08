import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { createDirectCaller } from '../test-utils/trpc-test-client.js';
import { mockUser, mockAuthenticatedUser } from '../test-utils/test-data.js';

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// Mock @ventry/database
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@ventry/database', () => ({
  prisma: mockPrisma,
}));

describe('Auth Router', () => {
  let caller: Awaited<ReturnType<typeof createDirectCaller>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    caller = await createDirectCaller({ prisma: mockPrisma as any });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const userWithPassword = { ...mockUser, password: 'hashedpassword' };
      mockPrisma.user.findUnique.mockResolvedValue(userWithPassword);
      mockPrisma.user.update.mockResolvedValue(userWithPassword);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await caller.auth.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('test@example.com');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should throw error for invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        caller.auth.login({
          email: 'invalid@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      const userWithPassword = { ...mockUser, password: 'hashedpassword' };
      mockPrisma.user.findUnique.mockResolvedValue(userWithPassword);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        caller.auth.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for inactive user', async () => {
      const inactiveUser = { ...mockUser, password: 'hashedpassword', isActive: false };
      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(
        caller.auth.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Account is deactivated');
    });
  });

  describe('register', () => {
    it('should register new user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null); // No existing user
      mockPrisma.user.create.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedpassword' as never);

      const result = await caller.auth.register({
        email: 'new@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          password: 'hashedpassword',
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
    });

    it('should throw error for existing email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, email: 'existing@example.com' });

      await expect(
        caller.auth.register({
          email: 'existing@example.com',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          password: 'password123',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should throw error for existing username', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, username: 'existinguser' });

      await expect(
        caller.auth.register({
          email: 'new@example.com',
          username: 'existinguser',
          firstName: 'New',
          lastName: 'User',
          password: 'password123',
        })
      ).rejects.toThrow('Username already taken');
    });
  });

  describe('me', () => {
    it('should return current user when authenticated', async () => {
      const authenticatedCaller = await createDirectCaller({ 
        user: mockAuthenticatedUser,
        prisma: mockPrisma as any 
      });

      const result = await authenticatedCaller.auth.me();

      expect(result).toEqual(mockAuthenticatedUser);
    });

    it('should throw error when not authenticated', async () => {
      await expect(caller.auth.me()).rejects.toThrow('UNAUTHORIZED');
    });
  });
});