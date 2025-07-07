import { DatabaseModule } from './database.module';
import { DatabaseService } from './database.service';

describe('DatabaseModule', () => {
  it('should be defined', () => {
    expect(DatabaseModule).toBeDefined();
  });

  it('should export DatabaseService', () => {
    const exportedProviders = Reflect.getMetadata('exports', DatabaseModule);
    expect(exportedProviders).toContain(DatabaseService);
  });
});