import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { User, OrganizationMember, Organization } from '@ventry/database';

import { signJWT, verifyJwt, type JWTPayload, type JWTVerifyResult } from '../auth/jwt.js';
import { createLogger } from '../lib/logger.js';
import type { PrismaClient } from '@ventry/database';
import { CookieService } from './cookie-service.js';

const logger = createLogger('auth-service');

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: User['role'];
    isActive: boolean;
    createdAt: string;
    organizationId?: string;
    organizationRole?: OrganizationMember['role'];
  };
  token?: string; // Only for testing purposes
}

export interface AuthServiceOptions {
  prisma: PrismaClient;
}

export class AuthService {
  private readonly logger = createLogger('auth-service');
  private readonly prisma: PrismaClient;

  constructor(options: AuthServiceOptions) {
    this.prisma = options.prisma;
  }

  /**
   * Authenticate a user with email and password
   */
  async login(credentials: LoginInput, res: FastifyReply): Promise<AuthResult> {
    const { email, password } = credentials;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn({ email }, 'Login attempt with non-existent email');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      this.logger.warn({ userId: user.id, email }, 'Login attempt with invalid password');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      this.logger.warn({ userId: user.id, email }, 'Login attempt with deactivated account');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Account is deactivated',
      });
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Get user's first organization membership
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { joinedAt: 'asc' },
    });

    // Require organization membership for access
    if (!membership) {
      this.logger.warn({ userId: user.id, email }, 'User has no organization membership');
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied: User is not a member of any organization',
      });
    }

    // Generate JWT token
    const token = signJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: membership.organizationId,
    });

    // Set authentication cookie
    this.setAuthCookie(res, token);

    // Log successful authentication
    this.logger.info({ userId: user.id, email: user.email }, 'User authenticated successfully');

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        organizationId: membership.organizationId,
        organizationRole: membership.role,
      },
      token, // Include token for testing purposes
    };
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput, res: FastifyReply): Promise<AuthResult> {
    const { email, username, firstName, lastName, password } = input;

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    });

    if (existingUser) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in a transaction with default organization
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          username,
          firstName,
          lastName,
          password: hashedPassword,
        },
      });

      // Create default organization for the user
      const organizationSlug = `${username}-org-${Date.now()}`;
      const organization = await tx.organization.create({
        data: {
          name: `${firstName}'s Organization`,
          slug: organizationSlug,
        },
      });

      // Create organization membership
      const membership = await tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER',
        },
      });

      return { user, organization, membership };
    });

    const { user, organization, membership } = result;

    // Generate JWT token with organization
    const token = signJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: organization.id,
    });

    // Set authentication cookie
    this.setAuthCookie(res, token);

    // Log successful registration
    this.logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        organizationId: organization.id,
        organizationRole: membership.role,
      },
      token, // Include token for testing purposes
    };
  }

  /**
   * Logout a user
   */
  async logout(userId: string | undefined, res: FastifyReply): Promise<void> {
    // Clear all authentication-related cookies
    CookieService.clearAllAuthCookies(res);
    
    this.logger.info({ userId }, 'User logged out');
  }

  /**
   * Verify a JWT token
   */
  async verifyToken(token: string): Promise<JWTVerifyResult> {
    try {
      return verifyJwt(token);
    } catch (error) {
      this.logger.warn({ error }, 'Token verification failed');
      throw error;
    }
  }

  /**
   * Set authentication cookie
   */
  setAuthCookie(res: FastifyReply, token: string): void {
    CookieService.setAuthToken(res, token);
  }

  /**
   * Clear authentication cookie
   */
  clearAuthCookie(res: FastifyReply): void {
    CookieService.clearAuthToken(res);
  }

  /**
   * Get authentication token from request
   */
  getAuthToken(req: FastifyRequest): string | undefined {
    return CookieService.getAuthToken(req);
  }

  /**
   * Refresh authentication token (not implemented yet)
   */
  async refreshToken(refreshToken: string, res: FastifyReply): Promise<AuthResult> {
    // TODO: Implement refresh token logic
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Refresh token not implemented yet',
    });
  }
}

// Export a factory function for creating AuthService instances
export function createAuthService(options: AuthServiceOptions): AuthService {
  return new AuthService(options);
}