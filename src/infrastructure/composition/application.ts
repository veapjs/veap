import { eventBus } from "../../application/events/event-bus";
import { logger } from "../logging/console-logger";
import { container } from "../ioc/container";
import type { ServiceProvider } from "../providers/service-provider";
import { KernelServiceProvider } from "../providers/kernel.provider";
import {
  APP_MIGRATIONS,
  APP_PLUGINS,
  APP_TEMPLATES,
} from "../../domain/contracts/token";

// Core Providers
import { DatabaseServiceProvider } from "../database/provider";
import { MigrationServiceProvider } from "../database/migration-provider";
import { AuthServiceProvider } from "../auth/provider";
import { StorageServiceProvider } from "../storage/provider";
import { CommunicationServiceProvider } from "../communication/provider";
import { PluginServiceProvider } from "../plugins/provider";
import { IntlServiceProvider } from "../intl/provider";
import { RouterServiceProvider } from "../router/provider";
import { SettingsServiceProvider } from "../settings/provider";

export class ApplicationBuilder {
  private migrations: any[] = [];
  private plugins: any[] = [];
  private templates: any[] = [];
  private customProviders: (new (c: typeof container) => ServiceProvider)[] =
    [];

  public withMigrations(migrations: any[]): this {
    this.migrations = migrations;
    return this;
  }

  public withPlugins(plugins: any[]): this {
    this.plugins = plugins;
    this.customProviders.push(PluginServiceProvider);
    return this;
  }

  public withTemplates(templates: any[]): this {
    this.templates = templates;
    return this;
  }

  public withDatabase(): this {
    this.customProviders.push(
      DatabaseServiceProvider,
      MigrationServiceProvider,
    );
    return this;
  }

  public withAuth(): this {
    this.customProviders.push(AuthServiceProvider);
    return this;
  }

  public withStorage(): this {
    this.customProviders.push(StorageServiceProvider);
    return this;
  }

  public withCommunication(): this {
    this.customProviders.push(CommunicationServiceProvider);
    return this;
  }

  public withIntl(): this {
    this.customProviders.push(IntlServiceProvider);
    return this;
  }

  public withRouter(): this {
    this.customProviders.push(RouterServiceProvider);
    return this;
  }

  public withSettings(): this {
    this.customProviders.push(SettingsServiceProvider);
    return this;
  }

  public withProviders(
    providers: (new (c: typeof container) => ServiceProvider)[],
  ): this {
    this.customProviders.push(...providers);
    return this;
  }

  public create(): Application {
    return new Application(
      this.migrations,
      this.plugins,
      this.templates,
      this.customProviders,
    );
  }
}

export class Application {
  constructor(
    private readonly migrations: any[],
    private readonly plugins: any[],
    private readonly templates: any[],
    private readonly providerClasses: (new (
      c: typeof container,
    ) => ServiceProvider)[],
  ) {}

  public static configure(): ApplicationBuilder {
    return new ApplicationBuilder();
  }

  public async bootstrap(): Promise<void> {
    if (typeof window !== "undefined") return;

    const g = globalThis as any;

    // 1. Skip initialization during Next.js build phase
    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.SKIP_VEAP_INIT === "true"
    ) {
      return;
    }

    // 2. Return if already bootstrapped successfully
    if (g.__VEAP_BOOTSTRAPPED__) {
      // In development, when a template/plugin source file changes, the
      // bundler re-evaluates this Application instance with fresh module
      // references — but the bootstrap guard above prevents full
      // re-initialization. We only refresh the in-memory registries so
      // the renderer picks up the new component references (layout,
      // overrides, extensions, widgets, etc.).
      if (process.env.NODE_ENV === "development") {
        if (this.templates.length) {
          const { registerTemplates } = await import(
            "../../application/plugins/templates"
          );
          await registerTemplates(this.templates);
        }
        if (this.plugins.length) {
          const { registerPlugins } = await import(
            "../../application/plugins/facade"
          );
          await registerPlugins(this.plugins);
        }
      }
      return;
    }

    // 3. Wait if currently bootstrapping
    if (g.__VEAP_BOOTSTRAPPING_PROMISE__) {
      return g.__VEAP_BOOTSTRAPPING_PROMISE__;
    }

    g.__VEAP_BOOTSTRAPPING_PROMISE__ = (async () => {
      try {
        logger.info("veap:bootstrap", "Starting system initialization...");

        if (this.migrations.length) {
          container.register({
            token: APP_MIGRATIONS,
            useValue: this.migrations,
          });
          container.register({
            token: "AppMigrations",
            useValue: this.migrations,
          });
        }
        if (this.plugins.length) {
          container.register({ token: APP_PLUGINS, useValue: this.plugins });
          container.register({ token: "AppPlugins", useValue: this.plugins });
        }
        if (this.templates.length) {
          container.register({
            token: APP_TEMPLATES,
            useValue: this.templates,
          });
          container.register({
            token: "AppTemplates",
            useValue: this.templates,
          });
        }

        const classes = [KernelServiceProvider, ...this.providerClasses];
        const providers: ServiceProvider[] = [];

        for (const ProviderClass of classes) {
          providers.push(new ProviderClass(container));
        }

        for (const provider of providers) {
          await provider.register();
        }

        for (const provider of providers) {
          if (provider.boot) {
            await provider.boot();
          }
        }

        await eventBus.publish("system:start", { runtime: "nodejs" });

        logger.info("veap:bootstrap", "System initialized successfully.");
        g.__VEAP_BOOTSTRAPPED__ = true;
      } catch (error: any) {
        if (error?.digest?.startsWith("NEXT_REDIRECT")) {
          throw error;
        }
        logger.error(
          "veap:bootstrap",
          "Critical error during system initialization:",
          error,
        );
      } finally {
        g.__VEAP_BOOTSTRAPPING_PROMISE__ = null;
      }
    })();

    return g.__VEAP_BOOTSTRAPPING_PROMISE__;
  }
}
