import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { User, Prisma } from '@ventry/database';

@Injectable()
export class UsersService {
  constructor(private database: DatabaseService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.database.user.create({
      data,
    });
  }

  async findAll(): Promise<User[]> {
    return this.database.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        password: false,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.database.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.database.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.database.user.findUnique({
      where: { username },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    const user = await this.findById(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.database.user.update({
      where: { id },
      data,
    });
  }

  async updateLastLogin(id: string): Promise<User> {
    return this.database.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  async remove(id: string): Promise<User> {
    const user = await this.findById(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.database.user.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  async delete(id: string): Promise<User> {
    const user = await this.findById(id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.database.user.delete({
      where: { id },
    });
  }
}