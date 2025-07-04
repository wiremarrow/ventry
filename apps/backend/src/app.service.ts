import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'Ventry API',
      version: '1.0.0',
      description: 'AI-native inventory management system',
      status: 'operational',
      timestamp: new Date().toISOString(),
    };
  }
}