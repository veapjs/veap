# Service providers

A service provider is the unit of framework wiring. Each provider registers bindings into the IoC container and, optionally, boots them after all registrations are done. Veap's own subsystems (database, auth, plugins, router, storage, communication, intl, settings) are service providers; you add your own through the application builder.

## The contract

```ts
import { ServiceProvider } from "@veap/framework/core/server";
import { container } from "@veap/framework/core/server";

export class AnalyticsServiceProvider extends ServiceProvider {
  register(): void {
    // Bindings only. Do not resolve other services here:
    // they may not be registered yet.
    container.register({
      token: AnalyticsService,
      useClass: AnalyticsService,
      singleton: true,
    });
  }

  async boot(): Promise<void> {
    // Safe to resolve and wire. Runs after ALL providers registered.
    const settings = await container.resolve(SettingsService);
    const enabled = await settings.get<boolean>("analytics:enabled");
    if (enabled) {
      eventBus.subscribe("model:created", "analytics", async (event) => {
        // track(event)
      });
    }
  }
}
```

Execution order is: every `register()` in registration order, then every `boot()` in registration order. `boot` is optional.

## Registering a provider

```ts
// lib/veap.ts
import { Application } from "@veap/framework/core/server";
import { AnalyticsServiceProvider } from "@/providers/analytics";

export const app = Application.configure()
  .withDatabase()
  .withAuth()
  .withProviders([AnalyticsServiceProvider])
  .create();
```

`.withProviders([...])` appends after the built-in providers you enabled with `with*` calls, so your `boot()` can depend on framework services.

## Built-in providers

| Provider                       | Registered by          | What it does                                                                                                      |
| ------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `KernelServiceProvider`        | always first           | binds event bus, logger, config service, cache, cookie store, request context                                     |
| `DatabaseServiceProvider`      | `.withDatabase()`      | creates the Knex instance from `DATABASE_URL`, registers it as `"Knex"`                                           |
| `MigrationServiceProvider`     | `.withDatabase()`      | runs `core` and `app` migrations in `boot()`; adds `veap make:migration`                                          |
| `AuthServiceProvider`          | `.withAuth()`          | binds crypto ports, repositories and auth services; binds `AuthContext`; initializes email verification           |
| `StorageServiceProvider`       | `.withStorage()`       | registers `StorageService`; registers the local provider on first boot                                            |
| `CommunicationServiceProvider` | `.withCommunication()` | selects the mail transport from `MAIL_TRANSPORT`, binds `MAILER` and `CommunicationContext`                       |
| `IntlServiceProvider`          | `.withIntl()`          | registers `IntlService`                                                                                           |
| `RouterServiceProvider`        | `.withRouter()`        | registers `RouterService`; clears the route tree cache on plugin events                                           |
| `SettingsServiceProvider`      | `.withSettings()`      | binds settings repository and `SettingsService`                                                                   |
| `PluginServiceProvider`        | `.withPlugins([...])`  | binds plugin/template repositories and registry; registers and initializes plugins; registers plugin CLI commands |

## Registering CLI commands from a provider

If the CLI booted the application (it loads your `lib/veap.ts`), providers can add commands during `boot()`:

```ts
async boot(): Promise<void> {
  if (!container.has("CliService")) return;
  const cliService = await container.resolve<any>("CliService");
  cliService.program
    .command("analytics:report", "Print an analytics report")
    .action(async () => {
      // ...
    });
}
```

The plugin and migration providers register `veap add`, `veap register`, `veap eject`, `veap make:plugin`, `veap make:template`, `veap docker` and `veap make:migration` exactly this way.

## Tips

- Keep `register()` free of side effects; the framework may instantiate providers more than once across workers.
- In `boot()`, tolerate the database being empty on first run (Veap's own providers wrap first-run DB access in try/catch for this reason).
- Bind ports, not concrete classes, for anything a host application might want to swap.
- Never import from `@veap/framework/<entry>` inside framework-layer code; that rule applies to plugins and hosts, providers included.
