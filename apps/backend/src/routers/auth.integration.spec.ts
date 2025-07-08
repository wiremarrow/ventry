import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appRouter } from './app.js';
import { createIntegrationContext } from '../test-utils/trpc-test-client.js';
import { prisma } from '@ventry/database/client';
import { hash } from 'bcryptjs';

describe('Auth Router Integration', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'integration.test'
        }
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'integration.test'
        }
      }
    });
  });

  describe('register', () => {
    it('should register a new user in the database', async () => {
      const ctx = await createIntegrationContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.register({
        email: 'test@integration.test',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(result.user).toMatchObject({
        email: 'test@integration.test',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        isActive: true,
      });

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: 'test@integration.test' }
      });
      expect(user).toBeTruthy();
      expect(user?.email).toBe('test@integration.test');
    });

    it('should throw error for duplicate email', async () => {
      const ctx = await createIntegrationContext();
      const caller = appRouter.createCaller(ctx);

      // Create first user
      await prisma.user.create({
        data: {
          email: 'duplicate@integration.test',
          username: 'user1',
          firstName: 'First',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      // Try to create second user with same email
      await expect(caller.auth.register({
        email: 'duplicate@integration.test',
        username: 'user2',
        firstName: 'Second',
        lastName: 'User',
        password: 'password123',
      })).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const ctx = await createIntegrationContext();
      const caller = appRouter.createCaller(ctx);

      // Create test user
      await prisma.user.create({
        data: {
          email: 'login@integration.test',
          username: 'loginuser',
          firstName: 'Login',
          lastName: 'User',
          password: await hash('password123', 10),
        }
      });

      const result = await caller.auth.login({
        email: 'login@integration.test',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('login@integration.test');
    });

    it('should throw error for invalid password', async () => {
      const ctx = await createIntegrationContext();
      const caller = appRouter.createCaller(ctx);

      // Create test user
      await prisma.user.create({
        data: {
          email: 'wrongpass@integration.test',
          username: 'wrongpass',
          firstName: 'Wrong',
          lastName: 'Pass',
          password: await hash('correctpassword', 10),
        }
      });

      await expect(caller.auth.login({
        email: 'wrongpass@integration.test',
        password: 'wrongpassword',
      })).rejects.toThrow('Invalid credentials');
    });
  });
});