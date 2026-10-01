# API Reference

This reference lists the public API of `@veap/framework` 0.11.x, organized by entry point. Every import path shown here exists in the package `exports` map. Symbols marked internal by the code (underscore prefixes, files not re-exported through an entry point) are intentionally omitted.

## Entry points

| Import path                                                          | Safe in client components | Purpose                                                     |
| -------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| `@veap/framework`                                                    | yes                       | client-safe core: errors, events, logging, config service   |
| `@veap/framework/core`                                               | yes                       | alias of the root entry                                     |
| `@veap/framework/core/server`                                        | no                        | server core: Application, container, providers, CLI service |
| `@veap/framework/auth`                                               | yes                       | auth domain types, validation, ports, repositories          |
| `@veap/framework/auth/server`                                        | no                        | auth facades, services, Server Actions, provider            |
| `@veap/framework/plugins`                                            | yes                       | plugin types and provider class                             |
| `@veap/framework/plugins/server`                                     | no                        | plugin registry, navigation, server widgets, UI extensions  |
| `@veap/framework/plugins/client`                                     | yes                       | client-side plugin presentation helpers                     |
| `@veap/framework/router`                                             | mixed                     | router engine, matcher, React router components             |
| `@veap/framework/router/server`                                      | no                        | API handler, middlewares, route discovery                   |
| `@veap/framework/intl`                                               | yes                       | client hooks (`useTranslation` and friends), translator     |
| `@veap/framework/intl/server`                                        | no                        | server I18nProvider, detection, loader                      |
| `@veap/framework/intl/client`                                        | yes                       | client intl API                                             |
| `@veap/framework/communication`                                      | no                        | mail port, facades, transports                              |
| `@veap/framework/storage`                                            | no                        | storage service and providers                               |
| `@veap/framework/settings`                                           | no                        | settings service and provider                               |
| `@veap/framework/database`                                           | no                        | ORM: Model, query builder, relations, migrations            |
| `@veap/framework/react`                                              | yes                       | client hooks and providers (`useUser`, `AuthProvider`, ...) |
| `@veap/framework/auth/models`, `/plugins/models`, `/settings/models` | no                        | built-in ORM models (User, SystemPlugin, setting)           |

## `@veap/framework/core/server` (server core)

### Application and ApplicationBuilder

```ts
import { Application, ApplicationBuilder } from "@veap/framework/core/server";
```

- `Application.configure(): ApplicationBuilder` - start building an application.
- Builder methods (all return `this`): `withMigrations(migrations[])`, `withPlugins(plugins[])`, `withDatabase()`, `withAuth(config?: AuthConfig)`, `withStorage()`, `withCommunication()`, `withIntl()`, `withRouter()`, `withSettings()`, `withProviders(providers[])`.
- `builder.create(): Application` - materialize the app without booting.
- `app.bootstrap(): Promise<void>` - register all providers and boot them. Idempotent per process; skipped during the Next.js build phase (`NEXT_PHASE=phase-production-build`) or when `SKIP_VEAP_INIT=true`.

Typical usage in the composition root (`lib/veap.ts`):

```ts
const application = Application.configure()
  .withMigrations(appMigrations)
  .withPlugins(plugins)
  .withDatabase()
  .withAuth()
  .withStorage()
  .withCommunication()
  .withIntl()
  .withRouter()
  .withSettings()
  .create();

void application.bootstrap();
```

### app() and the container

```ts
import {
  app,
  container,
  DATABASE,
  APP_PLUGINS,
  APP_MIGRATIONS,
  CLI_SERVICE,
} from "@veap/framework/core/server";
```

- `app()` returns the global `Container`.
- `app(token)` resolves a dependency and returns a `Promise<T>`. Laravel-style alias: `app().make(token)`.

```ts
const config = await app(ConfigService);
const knex = await app(DATABASE); // typed Knex token (or legacy "Knex")
```

The container is a singleton stored on `globalThis` (survives HMR in dev). Resolution is by token (class constructor, typed `Token<T>` symbol, or string). Services are singletons by default. Built-in kernel tokens (`DATABASE`, `APP_PLUGINS`, `APP_MIGRATIONS`, `CLI_SERVICE`) are exported for type-safe bindings.

### ConfigService

```ts
import { ConfigService } from "@veap/framework/core/server";
```

- `ConfigService.get(key, default?)` - synchronous access to validated environment config (`app.env`, `app.debug`, `auth.secret`, `database.client`, `storage.disk`, ...).
- Zod schemas in `ConfigService` validate environment variables at first import; missing required variables crash early with informative error messages.

### ServiceProvider and service contract

- Base class: `ServiceProvider` with `register(): void | Promise<void>` and `boot(): void | Promise<void>`.
- `this.app` is the container instance.
- Registration phase must not resolve services from other providers; cross-service wiring belongs in `boot()`.
- Built-in providers: `DatabaseServiceProvider`, `AuthServiceProvider`, `PluginServiceProvider`, `RouterServiceProvider`, `IntlServiceProvider`, `StorageServiceProvider`, `CommunicationServiceProvider`, `SettingsServiceProvider`, `MigrationServiceProvider`.

## `@veap/framework` and `@veap/framework/core` (client-safe core)

### Errors and Result

```ts
import { AppError, Result } from "@veap/framework";
```

- `AppError` carries a machine code (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`, ...), an HTTP status and optional details. Static constructors: `AppError.Validation`, `AppError.Unauthorized`, `AppError.Forbidden`, `AppError.NotFound`, `AppError.Conflict`, `AppError.Internal`.
- Thrown `AppError`s from Server Actions and API handlers are mapped to HTTP responses by the framework error mapper.
- `Result<T, E>` models fallible operations without exceptions: `Result.ok(value)`, `Result.fail(error)`, `result.isSuccess`, `result.isFailure`.

### Event bus

```ts
import {
  eventBus,
  SystemEventSchemas,
  type SystemEventMap,
} from "@veap/framework/core/server";
```

- `eventBus.publish(type, payload, source?, options?)` - typed publish with concurrent dispatch and handler fault isolation (errors logged via `logger.error`). Pass `{ strict: true }` in options to rethrow handler failures.
- `eventBus.publishStrict(type, payload, source?)` - convenience method for strict publish (rethrows `Error` or `AggregateError` on failure).
- `eventBus.subscribe(type, subscriberId, handler)` - register an idempotent handler (safe against HMR duplicate bindings); returns an unsubscribe function.
- System events (`system:auth:*`, `system:plugins:*`, `system:settings:*`) have schemas in `SystemEventSchemas`; plugin events extend the map via `declare module` augmentation.
- Client-safe events are re-exported from `@veap/framework` (no server imports required to publish from a Server Action).

### Logging

```ts
import { logger } from "@veap/framework/core/server";
logger.info("message", { context: "value" });
logger.child("veap:database").debug("...");
```

Scoped names (`veap:*`) are the convention used by the framework's own logs.

## `@veap/framework/auth` and `@veap/framework/auth/server`

### Client-safe (`/auth`)

- Types: `User`, `Session`, `Role`, `Permission`, `AuthUser` and related domain types.
- Validation schemas: zod schemas for login, registration, email and password.
- Ports and tokens: `PASSWORD_HASHER`, `TOKEN_GENERATOR`, `SECRET_CIPHER`, `COOKIE_STORE`, `REQUEST_CONTEXT` with interfaces `IPasswordHasher`, `ITokenGenerator`, `ISecretCipher`, `ICookieStore`, `IHttpRequestContext`.
- Repository read models: `IUserRepository`, `ISessionRepository` (plain data records).

### Server (`/auth/server`)

Facades (preferred, request-time):

```ts
import {
  authContext, // typed access to all auth facades
  getCurrentUser,
  getCurrentSession,
  requireUser,
  requireRole,
  requirePermission,
  login,
  logout,
  register,
  // rbac, email-verification, password-reset facades:
  hasRole,
  hasPermission,
  assignRole,
  revokeRole,
  sendVerificationEmail,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
} from "@veap/framework/auth/server";
```

- `getCurrentUser()`, `getCurrentSession()` - return the active user/session or `null`. Cached per request via React `cache`.
- `requireUser()`, `requireRole(role)`, `requirePermission(perm)` - throw `AppError.Unauthorized` or `AppError.Forbidden` on failure.
- `login(credentials)`, `logout()`, `register(data)` - authenticate and issue/clear cookies through `CookieStorePort`.

Server Actions (callable from client forms):

```ts
import {
  loginAction,
  registerAction,
  logoutAction,
  requestPasswordResetAction,
  resetPasswordAction,
  sendVerificationEmailAction,
  verifyEmailAction,
} from "@veap/framework/auth/server";
```

Port implementations (for swapping in custom providers):

```ts
container.bind(PASSWORD_HASHER).to(Argon2Hasher);
```

## `@veap/framework/plugins` and `@veap/framework/plugins/server`

### Client-safe (`/plugins`)

- `PluginManifestSchema`, `VeapPlugin` - manifest and plugin contract types.
- `PluginServiceProvider` - the provider class (server use).

### Server (`/plugins/server`)

Registry and status:

```ts
import {
  getPluginStatus,
  getPluginsStatus,
  getPluginConfig,
  updatePluginConfig,
  togglePluginState,
  applyPluginFilters,
  hasPluginExtension,
  hasPluginHooks,
} from "@veap/framework/plugins/server";
```

Navigation and breadcrumbs:

```ts
import {
  getPathPrefix, // the privatePath from veap.config.ts
  getPluginNavigation, // public navigation entries
  getVeapPluginNavigationGrouped, // grouped admin navigation
  getPluginBreadcrumbs,
} from "@veap/framework/plugins/server";
```

Compatibility aliases (`getModuleConfig`, `getModules`, `hasExtension`, ...) exist for code written before the module-to-plugin rename; prefer the plugin names.

Server extensions and widgets:

```ts
import {
  PluginExtensionPoint, // alias: ExtensionPoint
  PluginWidgetArea, // alias: WidgetArea
  WidgetComposer,
} from "@veap/framework/plugins/server";
```

- `<PluginExtensionPoint target="app" point="navbar" mode="single"><DefaultNavbar /></PluginExtensionPoint>` renders extensions for the specified target and point, with `"single"` or `"multiple"` mode and fallback children.
- `<PluginWidgetArea area="dashboard-stats" className="grid grid-cols-4 gap-4" />` renders widgets registered for a named dashboard area.

## `@veap/framework/router` and `@veap/framework/router/server`

Engine (pure, testable):

- `RouteTree`, `RouteNode`, `matchRoute(path, tree): MatchResult | null`.
- Segment helpers: `isDynamicSegment`, `isCatchAllSegment`, `isOptionalCatchAllSegment`, `isGroupSegment`, `isParallelSlot`, `resolveMagicPrefix`, `segmentMatchesUrlPart`, `extractParamName`.
- Discovery & rewrites: `discoverRoutes(dir)`, `generateRouteManifest`, `globToTree`, `getPluginsWithHomepage` (alias `getModulesWithHomepage`), `addRouteRewrite`, `getRouteRewrites`.

React:

```tsx
import {
  VeapRouter,
  RouterErrorBoundary,
  withRouter,
} from "@veap/framework/router";
```

API layer (server):

```ts
import {
  handleVeapApiRequest, // adapter from a Next.js route handler to the pipeline
  EnsuredAuth, // pipeline middleware: requires an authenticated user
  EnsuredGuest, // pipeline middleware: requires a guest
  EnsuredUser, // pipeline middleware: requires an authenticated session without gate checks
  SameOrigin, // pipeline middleware: enforces same-origin on mutations
  ApiSameOrigin, // API middleware: returns 403 on untrusted cross-origin mutations
} from "@veap/framework/router/server";
```

## `@veap/framework/intl` (`/intl`, `/intl/server`, `/intl/client`)

Client hooks:

```tsx
import {
  useTranslation,
  useTranslations,
  useLocale,
  useSupportedLocales,
  useTimeZone,
  I18nProvider,
} from "@veap/framework/intl";
```

- `useTranslation(namespace?)` returns `{ t, locale }`; `t` supports ICU message syntax via `intl-messageformat` (placeholders, plural, select).
- `useTranslations(...)` is the plural-form accessor used when loading several namespaces.

Server:

```ts
import {
  detectLocale,
  loadPluginTranslations,
  I18nProvider, // server wrapper
} from "@veap/framework/intl/server";
```

- `detectLocale(request, config)` detects language from cookie (`locale`), query param (`?lang=`), or `Accept-Language`.

## `@veap/framework/communication`

Ports: `MAILER` (`IMailer`).

Transports: `LogMailer` (logs to console/logger in development), `SendgridMailer` (`@sendgrid/mail`).

Facades:

```ts
import {
  sendMail,
  Mailer, // facade class
} from "@veap/framework/communication";

await sendMail({
  to: "user@example.com",
  subject: "Welcome",
  html: "<h1>Welcome</h1>",
});
```

Mailables: extend `Mailable` class to define reusable, strongly-typed email templates.

## `@veap/framework/storage`

Ports: `STORAGE_SERVICE`, `STORAGE_DRIVER` (`IStorageDriver`).

Drivers: `LocalDiskDriver` (stores in `public/storage`, served via route handler).

Facades:

```ts
import {
  putFile,
  getFile,
  deleteFile,
  fileExists,
  getFileUrl,
} from "@veap/framework/storage";
```

## `@veap/framework/settings`

Ports: `SETTINGS_SERVICE`, `SETTINGS_REPOSITORY`.

Facades:

```ts
import {
  getSetting,
  setSetting,
  hasSetting,
  deleteSetting,
} from "@veap/framework/settings";
```

Keys use `namespace:key` notation (`system:theme`, `plugin:commentable.autoApprove`). Settings are persisted in the `settings` table as JSON values and cached in memory.

## `@veap/framework/database`

ActiveRecord ORM:

```ts
import {
  Model,
  Schema,
  transaction,
  type Knex,
} from "@veap/framework/database";
```

- `Model` - base class for ActiveRecord models (`find`, `findOrFail`, `where`, `create`, `update`, `delete`, `all`, `first`). Relations: `hasOne`, `hasMany`, `belongsTo`, `belongsToMany`, `morphMany`, `morphTo`.
- `transaction(async (trx) => { ... })` - execute operations in a database transaction with automatic commit/rollback.
- `MorphMap` - polymorphic relation type-to-class registry.

## `@veap/framework/react`

Client hooks and components (client safe):

```tsx
import {
  AppProvider, // wraps theme, tooltip, auth
  useUser, // current user hook
  useSession, // current session hook
  useAuthRoutes, // authentication routes helper
  useConfirmAction, // confirmation dialog hook (sonner-backed)
} from "@veap/framework/react";
```

## CLI

The `veap` binary ships with the package (`bin.veap`). Full documentation for all commands and options is in the [CLI reference](./cli.md). Supported commands: `veap init`, `veap make:plugin`, `veap make:migration`, `veap add`, `veap eject`, `veap register`, and `veap docker`.
