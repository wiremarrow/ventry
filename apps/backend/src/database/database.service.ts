import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Database disconnected');
  }

  async getHealth() {
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'connected' };
    } catch (error) {
      return { status: 'disconnected', error: error.message };
    }
  }
}