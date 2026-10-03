import type * as React from "react";
import { eventBus } from "../../application/events/event-bus";
import type { AuthConfig } from "../../domain/auth/types";
import { APP_MIGRATIONS, APP_PLUGINS } from "../../domain/contracts/token";
import { AuthServiceProvider } from "../auth/provider";
import { CommunicationServiceProvider } from "../communication/provider";
import { MigrationServiceProvider } from "../database/migration-provider";
// Core Providers
import { DatabaseServiceProvider } from "../database/provider";
import { IntlServiceProvider } from "../intl/provider";
import { container } from "../ioc/container";
import { logger } from "../logging/console-logger";
import { PluginServiceProvider } from "../plugins/provider";
import { KernelServiceProvider } from "../providers/kernel.provider";
import { ServiceProvider } from "../providers/service-provider";
import { type RouterConfig, RouterServiceProvider } from "../router/provider";
import { SettingsServiceProvider } from "../settings/provider";
import { StorageServiceProvider } from "../storage/provider";

export type ProviderEntry =
  | (new (
      c: typeof container,
    ) => ServiceProvider)
  | ((c: typeof container) => ServiceProvider)
  | ServiceProvider;

export class ApplicationBuilder {
  private migrations: any[] = [];
  private plugins: any[] = [];
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

  public withDatabase(): this {
    this.customProviders.push(DatabaseServiceProvider, MigrationServiceProvider);
    return this;
  }

  public withAuth(config?: AuthConfig): this {
    this.authConfig = config;
    this.customProviders.push((c) => new AuthServiceProvider(c, this.authConfig));
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

    // 1. Skip initialization during Next.js build phase
    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.SKIP_VEAP_INIT === "true"
    ) {
      return;
    }

    // 2. Return if already bootstrapped successfully
    if (g.__VEAP_BOOTSTRAPPED__) {
      // In development, when a plugin source file changes, the bundler
      // re-evaluates this Application instance with fresh module references.
      // We only refresh the in-memory registries so the renderer picks up
      // the new component references (extensions, widgets, etc.).
      if (process.env.NODE_ENV === "development") {
        if (this.plugins.length) {
          const { registerPlugins } = await import("../../application/plugins/facade");
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

        const entries = [KernelServiceProvider, ...this.providerEntries];
        const providers: ServiceProvider[] = [];

        for (const entry of entries) {
          if (entry instanceof ServiceProvider) {
            providers.push(entry);
          } else if (typeof entry === "function" && entry.prototype instanceof ServiceProvider) {
            providers.push(new (entry as any)(container));
          } else if (typeof entry === "function") {
            providers.push((entry as any)(container));
          }
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
        if (
          error?.digest?.startsWith("NEXT_REDIRECT") ||
          error?.digest?.startsWith("NEXT_NOT_FOUND")
        ) {
          throw error;
        }
        logger.error("veap:bootstrap", "Critical error during system initialization:", error);
        throw error;
      } finally {
        g.__VEAP_BOOTSTRAPPING_PROMISE__ = null;
      }
    })();

    return g.__VEAP_BOOTSTRAPPING_PROMISE__;
  }
}
