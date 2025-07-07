import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppModule', () => {
  it('should be defined', () => {
    expect(AppModule).toBeDefined();
  });

  it('should import required modules', () => {
    const imports = Reflect.getMetadata('imports', AppModule) || [];
    expect(imports.length).toBeGreaterThan(0);
  });

  it('should declare controllers', () => {
    const controllers = Reflect.getMetadata('controllers', AppModule) || [];
    expect(controllers).toContain(AppController);
  });

  it('should provide services', () => {
    const providers = Reflect.getMetadata('providers', AppModule) || [];
    expect(providers).toContain(AppService);
  });
});