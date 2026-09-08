import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { eventBus } from "../../application/events/event-bus";
import { RouterService } from "../../application/router/router.service";

export class RouterServiceProvider extends ServiceProvider {
  register(): void {
    this.container.register({
      token: RouterService,
      useClass: RouterService,
      singleton: true,
    });
  }

  async boot(): Promise<void> {
    // Clear cache when plugins are enabled/disabled
    eventBus.subscribe("system:plugin:toggle", "route-tree-cache", async () => {
      const routerService =
        await this.container.resolve<RouterService>(RouterService);
      await routerService.clearCache();
    });

    // Clear cache after plugin initialization finishes
    eventBus.subscribe(
      "system:plugins:init:end",
      "route-tree-cache-init",
      async () => {
        const routerService =
          await this.container.resolve<RouterService>(RouterService);
        await routerService.clearCache();
      },
    );
  }
}
