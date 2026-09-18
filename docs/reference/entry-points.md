# API Reference

This reference lists the public API of `@veap/core` 0.11.x, organized by entry point. Every import path shown here exists in the package `exports` map. Symbols marked internal by the code (underscore prefixes, files not re-exported through an entry point) are intentionally omitted.

## Entry points

| Import path                                                     | Safe in client components | Purpose                                                     |
| --------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| `@veap/core`                                                    | yes                       | client-safe core: errors, events, logging, config service   |
| `@veap/core/core`                                               | yes                       | alias of the root entry                                     |
| `@veap/core/core/server`                                        | no                        | server core: Application, container, providers, CLI service |
| `@veap/core/auth`                                               | yes                       | auth domain types, validation, ports, repositories          |
| `@veap/core/auth/server`                                        | no                        | auth facades, services, Server Actions, provider            |
| `@veap/core/plugins`                                            | yes                       | plugin types and provider class                             |
| `@veap/core/plugins/server`                                     | no                        | plugin registry, navigation, templates, server widgets      |
| `@veap/core/plugins/client`                                     | yes                       | client-side plugin presentation helpers                     |
| `@veap/core/router`                                             | mixed                     | router engine, matcher, React router components             |
| `@veap/core/router/server`                                      | no                        | API handler, middlewares, route discovery                   |
| `@veap/core/intl`                                               | yes                       | client hooks (`useTranslation` and friends), translator     |
| `@veap/core/intl/server`                                        | no                        | server I18nProvider, detection, loader                      |
| `@veap/core/intl/client`                                        | yes                       | client intl API                                             |
| `@veap/core/communication`                                      | no                        | mail port, facades, transports                              |
| `@veap/core/storage`                                            | no                        | storage service and providers                               |
| `@veap/core/settings`                                           | no                        | settings service and provider                               |
| `@veap/core/database`                                           | no                        | ORM: Model, query builder, relations, migrations            |
| `@veap/core/react`                                              | yes                       | client hooks and providers (`useUser`, `AuthProvider`, ...) |
| `@veap/core/auth/models`, `/plugins/models`, `/settings/models` | no                        | built-in ORM models (User, SystemPlugin, setting)           |

## `@veap/core/core/server` (server core)

### Application and ApplicationBuilder

```ts
import { Application, ApplicationBuilder } from "@veap/core/core/server";
```

- `Application.configure(): ApplicationBuilder` - start building an application.
- Builder methods (all return `this`): `withMigrations(migrations[])`, `withPlugins(plugins[])`, `withTemplates(templates[])`, `withDatabase()`, `withAuth()`, `withStorage()`, `withCommunication()`, `withIntl()`, `withRouter()`, `withSettings()`, `withProviders(providers[])`.
- `builder.create(): Application` - materialize the app without booting.
- `app.bootstrap(): Promise<void>` - register all providers and boot them. Idempotent per process; skipped during the Next.js build phase (`NEXT_PHASE=phase-production-build`) or when `SKIP_VEAP_INIT=true`.

Typical usage in the composition root (`lib/veap.ts`):

```ts
const application = Application.configure()
  .withMigrations(appMigrations)
  .withPlugins(plugins)
  .withTemplates(templates)
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
  APP_TEMPLATES,
  APP_MIGRATIONS,
  CLI_SERVICE,
} from "@veap/core/core/server";
```

- `app()` returns the global `Container`.
- `app(token)` resolves a dependency and returns a `Promise<T>`. Laravel-style alias: `app().make(token)`.

```ts
const config = await app(ConfigService);
const knex = await app(DATABASE); // typed Knex token (or legacy "Knex")
```

The container is a singleton stored on `globalThis` (survives HMR in dev). Resolution is by token (class constructor, typed `Token<T>` symbol, or string). Services are singletons by default. Built-in kernel tokens (`DATABASE`, `APP_PLUGINS`, `APP_TEMPLATES`, `APP_MIGRATIONS`, `CLI_SERVICE`) are exported for type-safe bindings.

### ConfigService

```ts
import { ConfigService } from "@veap/core/core/server";
```

- `config.get(key: EnvKey): string | undefined` - validated environment access.
- `config.has(key)`, `config.all()` - presence and full snapshot.
- Validates `ENCRYPTION_KEY` (must decode to 16, 24 or 32 bytes), `DATABASE_URL`, `FILE_STORAGE_FOLDER` and the mail/intl variables at first construction.

### Errors and Result

```ts
import { AppError, Result } from "@veap/core/core/server";
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
} from "@veap/core/core/server";
```

- `eventBus.publish(event)` - fire-and-forget typed publish. The payload is validated against the registered schema for the event name.
- `eventBus.subscribe(name, handler)` - register a handler; returns an unsubscribe function.
- System events (`system:auth:*`, `system:plugins:*`, `system:settings:*`) have schemas in `SystemEventSchemas`; plugin events extend the map via `declare module` augmentation.
- Client-safe events are re-exported from `@veap/core` (no server imports required to publish from a Server Action).

### Logging

```ts
import { logger } from "@veap/core/core/server";
logger.info("message", { context: "value" });
logger.child("veap:database").debug("...");
```

Scoped names (`veap:*`) are the convention used by the framework's own logs.

## `@veap/core/auth` and `@veap/core/auth/server`

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
  sendPasswordResetEmail,
  resetPassword,
} from "@veap/core/auth/server";
```

- `getCurrentUser(): Promise<AuthUser | null>` - session user or null.
- `requireUser()` throws `AppError.Unauthorized` when not signed in; `requireRole(role)` / `requirePermission(perm)` throw `AppError.Forbidden`.
- Sessions are httpOnly cookies; creation and destruction go through the session facade.

Server Actions (called from forms/client components):

```ts
import {
  loginAction,
  logoutAction,
  registerAction,
} from "@veap/core/auth/server";
```

Services (resolve with `app(...)` when extending the framework):

- `AuthService`, `SessionService`, `UserService`, `RbacService`, `EmailVerificationService`, `PasswordResetService`.
- Provider: `AuthServiceProvider` (registered by `withAuth()`).

Auth events (typed): `system:auth:user-registered`, `system:auth:login`, `system:auth:logout`, and related verification/reset events - subscribe with the event bus.

### Extending auth

Replace crypto or HTTP ports by binding your own implementation before boot:

```ts
import { PASSWORD_HASHER } from "@veap/core/auth";
import { Argon2Hasher } from "./argon2-hasher";

container.bind(PASSWORD_HASHER).to(Argon2Hasher);
```

## `@veap/core/plugins` and `@veap/core/plugins/server`

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
} from "@veap/core/plugins/server";
```

Navigation and breadcrumbs:

```ts
import {
  getPathPrefix, // the privatePath from veap.config.ts
  getPluginNavigation, // public navigation entries
  getVeapPluginNavigationGrouped, // grouped admin navigation
  getPluginBreadcrumbs,
} from "@veap/core/plugins/server";
```

Compatibility aliases (`getModuleConfig`, `getModules`, `hasExtension`, ...) exist for code written before the module-to-plugin rename; prefer the plugin names.

Server widgets:

```ts
import {
  PluginExtensionPoint, // alias: ExtensionPoint
  PluginWidgetArea, // alias: WidgetArea
  WidgetComposer,
} from "@veap/core/plugins/server";
```

- `<PluginExtensionPoint name="dashboard.widgets" />` renders every widget registered by booted plugins for that point.
- `<PluginWidgetArea plugin="shop" area="product.sidebar" />` renders widgets of one plugin.

## `@veap/core/router` and `@veap/core/router/server`

Engine (pure, testable):

- `RouteTree`, `RouteNode`, `matchRoute(path, tree): MatchResult | null`.
- Segment helpers: `isDynamicSegment`, `isCatchAllSegment`, `isOptionalCatchAllSegment`, `isGroupSegment`, `isParallelSlot`, `resolveMagicPrefix`, `segmentMatchesUrlPart`, `extractParamName`.
- Discovery: `discoverRoutes(dir)`, `generateRouteManifest`, `globToTree`, `getPluginsWithHomepage` (alias `getModulesWithHomepage`).

React:

```tsx
import { VeapRouter, RouterErrorBoundary, withRouter } from "@veap/core/router";
```

API layer (server):

```ts
import {
  handleVeapApiRequest, // adapter from a Next.js route handler to the pipeline
  EnsuredAuth, // pipeline middleware: requires an authenticated user
  EnsuredGuest, // pipeline middleware: requires a guest
  EnsuredUser, // pipeline middleware: requires a specific user
} from "@veap/core/router/server";
```

## `@veap/core/intl` (`/intl`, `/intl/server`, `/intl/client`)

Client hooks:

```tsx
import {
  useTranslation,
  useTranslations,
  useLocale,
  useSupportedLocales,
  useTimeZone,
  I18nProvider,
} from "@veap/core/intl";
```

- `useTranslation(namespace?)` returns `{ t, locale }`; `t` supports ICU message syntax via `intl-messageformat` (placeholders, plural, select).
- `useTranslations(...)` is the plural-form accessor used when loading several namespaces.

Server:

```tsx
import { I18nProvider } from "@veap/core/intl/server";
import { detectLocale, getTranslations } from "@veap/core/intl/server";
```

- `detectLocale(request)` negotiates the locale from cookie, then `Accept-Language` (`negotiator` + `@formatjs/intl-localematcher`).
- `getTranslations(namespace)` loads merged dictionaries (app + plugins) on the server.

Shared translator (server and client safe):

```ts
import { createTranslator } from "@veap/core/intl";
```

## `@veap/core/communication`

```ts
import {
  sendMail, // facade: send one MailMessage
  communicationContext, // typed access to the bound port
  MailMessage, // framework-neutral message DTO (subject, to, from, text, html, replyTo, attachments...)
  IMailer, // transport port
  MAIL_TRANSPORT, // DI token for the active transport
  NodemailerMailService, // SMTP transport (alias: MailService)
  ConsoleMailService, // logs the message instead of sending
  CommunicationServiceProvider,
} from "@veap/core/communication";
```

- `SendMailOptions` exists as a deprecated alias of `MailMessage` for pre-refactor plugins.
- Transports only deliver `MailMessage` objects; semantic emails (verification, reset) are built by domain mailables and handed to the facade. This keeps SES/Postmark/Resend adapters possible: implement `IMailer`, bind it to `MAIL_TRANSPORT` with `transport: "custom"`.

## `@veap/core/storage`

```ts
import {
  StorageService, // facade: put/get/delete/url/metadata
  IStorageProvider, // port
  STORAGE_PROVIDER, // DI token
  LocalFileProvider, // default provider (FILE_STORAGE_FOLDER, default public/storage)
  StorageServiceProvider,
} from "@veap/core/storage";
```

Files under the local provider are served by the built-in `/storage/[...path]` route.

## `@veap/core/settings`

```ts
import {
  SettingsService, // namespaced key-value settings with typed getters
  SettingsServiceProvider,
} from "@veap/core/settings";
```

Settings are persisted through the settings model and cached; plugins read and write their own namespaces.

## `@veap/core/database`

```ts
import {
  Model, // ActiveRecord base class
  QB, // query builder facade over Knex
  transaction, // the only supported write path
  HasMany,
  BelongsTo,
  BelongsToMany,
  MorphOne,
  MorphMany,
  MorphToMany,
  MorphTo,
  MorphMap, // polymorphic target registry
  connectDatabase, // low-level Knex bootstrap (used by the provider)
} from "@veap/core/database";
```

- Models declare `static table = "name"` (the old `static tableName` is gone; see the ORM chapter for the full contract).
- All writes must run inside `transaction(async (trx) => { ... })`.
- Full usage is documented in the Data chapter: [ORM](../data/orm.md), [Transactions](../data/transactions.md), [Migrations](../data/migrations.md).

## `@veap/core/auth/models`, `@veap/core/plugins/models`, `@veap/core/settings/models`

Core domain entities are exported from dedicated subpaths to enforce clean DDD boundaries:

```ts
// Auth domain models
import {
  User,
  Session,
  Role,
  Permission,
  PasswordResetSession,
  EmailVerification,
} from "@veap/core/auth/models";

// Plugin system models
import { SystemPlugin, SystemUserWidget } from "@veap/core/plugins/models";

// Settings model
import { Setting } from "@veap/core/settings/models";
```

All models inherit from `Model` and have full ActiveRecord features (casts, scopes, relations, validation).

## `@veap/core/react`

```ts
import {
  AppProvider, // client providers root
  AuthProvider, // session context for client components
  useUser, // current user in client components
  useConfirmAction, // confirmation dialog hook (sonner-backed)
} from "@veap/core/react";
```

## CLI

The `veap` binary ships with the package (`bin.veap`). Full documentation for all commands and options is in the [CLI reference](./cli.md). Supported commands: `veap init`, `veap make:plugin`, `veap make:template`, `veap make:migration`, `veap add`, `veap eject`, `veap register`, and `veap docker`.
