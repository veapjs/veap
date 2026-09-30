import { ServiceProvider } from "../../infrastructure/providers/service-provider";
import { eventBus } from "../../application/events/event-bus";
import { RouterService } from "../../application/router/router.service";

export interface RouterConfig {
  rewrites?: Record<string, string>;
}

export class RouterServiceProvider extends ServiceProvider {
  constructor(
    container: any,
    private config?: RouterConfig,
  ) {
    super(container);
  }

  register(): void {
    this.container.register({
      token: RouterService,
      useClass: RouterService,
      singleton: true,
    });
  }

  async boot(): Promise<void> {
    const routerService =
      await this.container.resolve<RouterService>(RouterService);

    if (this.config?.rewrites) {
      for (const [from, to] of Object.entries(this.config.rewrites)) {
        routerService.addRewrite(from, to);
      }
    }

    // Clear cache when plugins are enabled/disabled
    eventBus.subscribe("system:plugin:toggle", "route-tree-cache", async () => {
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
