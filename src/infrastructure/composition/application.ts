import type * as React from "react";
import {
  container,
  eventBus,
  KernelServiceProvider,
  logger,
  ServiceProvider,
  VEAP_CONFIG,
} from "@veap/kernel";
import {
  DatabaseServiceProvider,
  MigrationServiceProvider,
} from "@veap/database";
import {
  StorageServiceProvider,
} from "@veap/storage";
import {
  AuthServiceProvider,
  type AuthConfig,
} from "@veap/auth/server";
import {
  PluginServiceProvider,
  type RouterConfig,
  RouterServiceProvider,
} from "@veap/plugins/server";
import { APP_MIGRATIONS, APP_PLUGINS } from "../../domain/contracts/token";
import { CommunicationServiceProvider } from "../communication/provider";
import { IntlServiceProvider } from "../intl/provider";
import { SettingsServiceProvider } from "../settings/provider";
import { VeapConfigProvider } from "../config/veap-config.provider";

export type ProviderEntry =
  | (new (
      c: typeof container,
    ) => ServiceProvider)
  | ((c: typeof container) => ServiceProvider)
  | ServiceProvider;

export class ApplicationBuilder {
  private migrations: any[] = [];
  private plugins: any[] = [];
  private templates: any[] = [];
  private customProviders: ProviderEntry[] = [];
  private authConfig?: AuthConfig;

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

  public withAuth(config?: AuthConfig): this {
    this.authConfig = config;
    this.customProviders.push(
      (c) => new AuthServiceProvider(c, this.authConfig),
    );
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

  public withRouter(config?: RouterConfig): this {
    this.customProviders.push((c) => new RouterServiceProvider(c, config));
    return this;
  }

  public withSiteLayout(layout: React.ComponentType<any>): this {
    return this.withRouter({ siteLayout: layout });
  }

  public withSettings(): this {
    this.customProviders.push(SettingsServiceProvider);
    return this;
  }

  public withProviders(providers: ProviderEntry[]): this {
    this.customProviders.push(...providers);
    return this;
  }

  public create(): Application {
    return new Application(this.migrations, this.plugins, this.customProviders);
  }
}

export class Application {
  constructor(
    private readonly migrations: any[],
    private readonly plugins: any[],
    private readonly providerEntries: ProviderEntry[],
  ) {}

  public static configure(): ApplicationBuilder {
    return new ApplicationBuilder();
  }

  public async bootstrap(): Promise<void> {
    if (typeof window !== "undefined") return;

    const g = globalThis as any;

    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.SKIP_VEAP_INIT === "true"
    ) {
      return;
    }

    if (g.__VEAP_BOOTSTRAPPED__) {
      if (process.env.NODE_ENV === "development") {
        if (this.plugins.length) {
          const { registerPlugins } = await import("@veap/plugins/server");
          await registerPlugins(this.plugins);
        }
      }
      return;
    }

    if (g.__VEAP_BOOTSTRAPPING_PROMISE__) {
      return g.__VEAP_BOOTSTRAPPING_PROMISE__;
    }

    g.__VEAP_BOOTSTRAPPING_PROMISE__ = (async () => {
      try {
        logger.info("veap:bootstrap", "Starting system initialization...");

        container.register({
          token: VEAP_CONFIG,
          useClass: VeapConfigProvider,
          singleton: true,
        });

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

        const entries = [KernelServiceProvider, ...this.providerEntries];

        for (const entry of entries) {
          if (typeof entry === "function" && entry.prototype) {
            const provider = new (entry as new (c: any) => ServiceProvider)(
              container,
            );
            await provider.register();
          } else if (typeof entry === "function") {
            const provider = (entry as (c: any) => ServiceProvider)(container);
            await provider.register();
          } else if (entry instanceof ServiceProvider) {
            await entry.register();
          }
        }

        for (const entry of entries) {
          let provider: ServiceProvider | undefined;
          if (typeof entry === "function" && entry.prototype) {
            provider = new (entry as new (c: any) => ServiceProvider)(
              container,
            );
          } else if (typeof entry === "function") {
            provider = (entry as (c: any) => ServiceProvider)(container);
          } else if (entry instanceof ServiceProvider) {
            provider = entry;
          }

          if (provider && typeof provider.boot === "function") {
            await provider.boot();
          }
        }

        if (this.plugins.length) {
          const { registerPlugins } = await import("@veap/plugins/server");
          await registerPlugins(this.plugins);
        }

        g.__VEAP_BOOTSTRAPPED__ = true;
        logger.info("veap:bootstrap", "System initialized successfully.");
        await eventBus.publish("system:ready", { timestamp: Date.now() });
      } catch (error: any) {
        if (
          error?.digest?.startsWith?.("NEXT_REDIRECT") ||
          error?.digest === "NEXT_NOT_FOUND"
        ) {
          throw error;
        }

        logger.error(
          "veap:bootstrap",
          "Critical error during system initialization:",
          error,
        );

        throw error;
      } finally {
        g.__VEAP_BOOTSTRAPPING_PROMISE__ = null;
      }
    })();

    return g.__VEAP_BOOTSTRAPPING_PROMISE__;
  }
}
