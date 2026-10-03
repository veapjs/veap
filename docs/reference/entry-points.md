### Application and ApplicationBuilder

```ts
import { Application, ApplicationBuilder } from "@veap/framework/core/server";
```

- `Application.configure(): ApplicationBuilder` - start building an application.
- Builder methods (all return `this`):
  - `withMigrations(migrations[])` - register host database migrations.
  - `withPlugins(plugins[])` - register enabled plugins.
  - `withDatabase()` - configure database connection and migrations.
  - `withAuth(config?: AuthConfig)` - configure authentication and sessions.
  - `withStorage()` - configure file storage service.
  - `withCommunication()` - configure mailer and notifications.
  - `withIntl()` - configure internationalization services.
  - `withRouter(config?: RouterConfig)` - configure the virtual router.
  - `withSiteLayout(layout: React.ComponentType<any>)` - declare the UI shell layout for the `(site)` route group, automatically wrapping public virtual routes (e.g. `/blog`).
  - `withSettings()` - configure system settings provider.
  - `withProviders(providers[])` - register custom Service Providers.
- `builder.create(): Application` - materialize the app without booting.
- `app.bootstrap(): Promise<void>` - register all providers and boot them. Idempotent per process; skipped during the Next.js build phase (`NEXT_PHASE=phase-production-build`) or when `SKIP_VEAP_INIT=true`.

Typical usage in the composition root (`lib/veap.ts`):

```ts
import { SiteLayout } from "@/components/site-layout";

const application = Application.configure()
  .withMigrations(appMigrations)
  .withPlugins(plugins)
  .withDatabase()
  .withAuth()
  .withStorage()
  .withCommunication()
  .withIntl()
  .withRouter()
  .withSiteLayout(SiteLayout)
  .withSettings()
  .create();

void application.bootstrap();
```
