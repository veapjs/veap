import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { SettingsService } from "../../application/settings/settings.service";
import { SETTINGS_REPOSITORY } from "../../domain/settings/settings.repository";
import { ActiveRecordSettingsRepository } from "./repositories/setting.repository";

export class SettingsServiceProvider extends ServiceProvider {
  register(): void {
    this.container.register({
      token: SETTINGS_REPOSITORY,
      useClass: ActiveRecordSettingsRepository,
      singleton: true,
    });

    this.container.register({
      token: SettingsService,
      useClass: SettingsService,
      singleton: true,
    });
  }

  async boot(): Promise<void> {}
}
