import { ServiceProvider } from "./service-provider";
import { eventBus, EventBus } from "../../application/events/event-bus";
import { logger, LoggerService } from "../logging/console-logger";
import { ConfigService } from "../config/config.service";
import { MemoryCacheProvider } from "../cache/memory-cache.provider";
import {
  CACHE_PROVIDER,
  CONFIG_SERVICE,
  EVENT_BUS,
  LOGGER,
  VEAP_CONFIG,
  COOKIE_STORE,
  REQUEST_CONTEXT,
} from "../../domain/contracts";
import { VeapConfigProvider } from "../config/veap-config.provider";
import {
  NextCookieStore,
  NextRequestContext,
} from "../http/next-request-context";

export class KernelServiceProvider extends ServiceProvider {
  register(): void {
    // The pre-initialized global singleton (`eventBus`) is the single source
    // of truth; the container only exposes it. Registering the class token as
    // an alias keeps `app(EventBus)` working for existing consumers.
    this.container.register({
      token: EventBus,
      useValue: eventBus,
      singleton: true,
    });

    // Register LoggerService as a singleton class
    this.container.register({
      token: LoggerService,
      useClass: LoggerService,
      singleton: true,
    });

    this.container.register({
      token: ConfigService,
      useClass: ConfigService,
      singleton: true,
    });

    this.container.register({
      token: CACHE_PROVIDER,
      useClass: MemoryCacheProvider,
      singleton: true,
    });

    // Port tokens → global singletons, so application services can inject
    // the contracts (IEventBus, ILogger) instead of concrete classes.
    // `EVENT_BUS` is the primary token; the class-token registration above is
    // only a backwards-compatibility alias to the same instance.
    this.container.register({
      token: EVENT_BUS,
      useValue: eventBus,
      singleton: true,
    });

    // Inject the logging adapter into the pre-created event bus singleton
    // (composition-root hook, not part of the IEventBus contract).
    eventBus.setLogger(logger);

    this.container.register({
      token: LOGGER,
      useValue: logger,
      singleton: true,
    });

    // IConfigService port → the env/zod adapter
    this.container.register({
      token: CONFIG_SERVICE,
      useClass: ConfigService,
      singleton: true,
    });

    // IVeapConfigProvider port → the jiti `veap.config.ts` adapter
    this.container.register({
      token: VEAP_CONFIG,
      useClass: VeapConfigProvider,
      singleton: true,
    });

    // ICookieStore / IHttpRequestContext ports → the Next.js transport adapter
    this.container.register({
      token: COOKIE_STORE,
      useClass: NextCookieStore,
      singleton: true,
    });

    this.container.register({
      token: REQUEST_CONTEXT,
      useClass: NextRequestContext,
      singleton: true,
    });
  }

  async boot(): Promise<void> {
    logger.debug(
      "veap:kernel",
      "Kernel core services registered successfully.",
    );
  }
}
