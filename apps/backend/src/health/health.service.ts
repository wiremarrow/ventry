import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class HealthService {
  constructor(private database: DatabaseService) {}

  async getHealth() {
    const startTime = Date.now();
    
    try {
      const dbHealth = await this.database.getHealth();
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.round(uptime),
        version: '1.0.0',
        database: dbHealth.status,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          usage: `${Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)}%`,
        },
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        uptime: Math.round(process.uptime()),
        version: '1.0.0',
        database: 'disconnected',
        memory: {
          used: 0,
          total: 0,
          usage: '0%',
        },
        responseTime: Date.now() - startTime,
      };
    }
  }
}