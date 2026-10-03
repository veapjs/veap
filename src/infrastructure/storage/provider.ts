import { StorageService } from "../../application/storage/storage.service";
import { isSystemInstalled } from "../../infrastructure/auth/setup";
import { ConfigService } from "../../infrastructure/config/config.service";
import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { LocalFileProvider } from "./providers/local";

export class StorageServiceProvider extends ServiceProvider {
  register(): void {
    this.container.register({
      token: StorageService,
      useClass: StorageService,
      singleton: true,
    });
  }

  async boot(): Promise<void> {
    if (await isSystemInstalled()) {
      const storageService = await this.container.resolve(StorageService);
      const config = await this.container.resolve(ConfigService);
      if (storageService.getProviders().length === 0) {
        const local = new LocalFileProvider(config);
        storageService.registerProvider(local);
        storageService.setDefaultProvider(local.id);
      }
    }
  }
}
