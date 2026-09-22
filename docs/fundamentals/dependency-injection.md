# Dependency injection

Veap has a small IoC container inspired by Laravel's container. It maps tokens (classes, strings or symbols) to provider definitions and resolves instances lazily, caching singletons.

## Resolving services

```ts
import { app } from "@veap/framework/core/server";
import { AuthService } from "@veap/framework/auth/server";

// app() with no arguments returns the Container
const container = app();

// app(Token) resolves an instance
const auth = await app(AuthService);
const storage = await app(StorageService);
```

`app(token)` is an alias for `container.resolve(token)` (`container.make(token)` also exists, Laravel-style). Resolution is async because factory providers may be async.

## Tokens

A token is one of:

- a **class**, resolved by constructing it (constructor parameters resolved recursively),
- a **symbol**, registered with `Symbol.for(...)` next to its contract (for example `EVENT_BUS`, `LOGGER`, `COOKIE_STORE`),
- a **string** (legacy form, for example `"Knex"`).

Class tokens survive bundling in development because the container keys them by `Symbol.for("veap:ioc:" + className)`; in production the class reference itself is used.

## Registering bindings

Bindings are normally created by service providers (see [Service providers](./service-providers.md)), but any server code can register into the global container:

```ts
import { container } from "@veap/framework/core/server";

container.register({
  token: EVENT_BUS, // Token<IEventBus>
  useValue: eventBus, // existing instance
  singleton: true,
});

container.register({
  token: MyService,
  useClass: MyService, // constructed on first resolve
  singleton: true,
});

container.register({
  token: "MailerConfig",
  useFactory: (config: ConfigService) => buildConfig(config),
  inject: [ConfigService], // explicit deps for factories
});
```

Provider definition shape (`ProviderDef`):

| Property     | Type        | Meaning                                                            |
| ------------ | ----------- | ------------------------------------------------------------------ |
| `token`      | `Token<T>`  | registry key                                                       |
| `useClass`   | constructor | construct on first resolve, resolving constructor params           |
| `useValue`   | `T`         | use this instance as-is                                            |
| `useFactory` | function    | call to produce the instance (may be async)                        |
| `inject`     | `Token[]`   | dependencies for `useClass`/`useFactory` (overrides type metadata) |
| `singleton`  | boolean     | cache the instance (default `true` for explicit registrations)     |

## Constructor injection with decorators

Classes marked `@Injectable()` get their constructor parameter types read from `reflect-metadata` and resolved automatically:

```ts
import { Injectable, Inject } from "@veap/framework/core/server";

@Injectable()
export class MyService {
  constructor(
    private settings: SettingsService, // resolved by class type
    @Inject(LOGGER) private logger: ILogger, // resolved by symbol token
  ) {}
}
```

Rules to keep resolution working:

- Injected class dependencies must be **value imports**. `import type` erases the class from `design:paramtypes`; the container then sees the `Object` token and throws an explanatory `AppError` telling you exactly this.
- Constructor parameters whose types are interfaces (which TypeScript erases) need `@Inject(Token)`.

## Ports and adapters

Veap's own services follow the ports-and-adapters pattern, which is the recommended style for your code too: depend on a contract, bind the implementation at the edge.

```ts
// Contract (token + interface), e.g. domain/contracts/cache.ts
export interface ICacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
export const CACHE_PROVIDER: Token<ICacheProvider> =
  Symbol.for("veap:kernel:cache");
```

Built-in port tokens bound by the kernel:

| Token             | Contract              | Default adapter                          |
| ----------------- | --------------------- | ---------------------------------------- |
| `EVENT_BUS`       | `IEventBus`           | the global `eventBus` singleton          |
| `LOGGER`          | `ILogger`             | console logger                           |
| `CONFIG_SERVICE`  | `IConfigService`      | zod-validated `ConfigService`            |
| `VEAP_CONFIG`     | `IVeapConfigProvider` | jiti `veap.config.ts` loader             |
| `CACHE_PROVIDER`  | `ICacheProvider`      | in-memory cache                          |
| `COOKIE_STORE`    | `ICookieStore`        | Next.js `cookies()` adapter              |
| `REQUEST_CONTEXT` | `IHttpRequestContext` | Next.js `headers()`/`redirect()` adapter |
| `DATABASE`        | `Knex`                | active Knex instance (also `"Knex"`)     |
| `APP_PLUGINS`     | `IPlugin[]`           | array of registered plugins              |
| `APP_TEMPLATES`   | `ITemplate[]`         | array of registered templates            |
| `APP_MIGRATIONS`  | `Migration[]`         | array of native app migrations           |
| `CLI_SERVICE`     | `CliService`          | CAC CLI command registry service         |

Feature tokens: `PASSWORD_HASHER`, `TOKEN_GENERATOR`, `SECRET_CIPHER` (auth); `USER_REPOSITORY`, `ROLE_REPOSITORY`, `PERMISSION_REPOSITORY`, `SESSION_REPOSITORY`, `PASSWORD_RESET_REPOSITORY`, `EMAIL_VERIFICATION_REPOSITORY` (auth persistence); `MAILER`, `CUSTOM_MAILER` (communication); `PLUGIN_REPOSITORY`, `TEMPLATE_REPOSITORY`, `MIGRATION_RUNNER`, `SETTINGS_REPOSITORY` (platform).

To replace an adapter, register your implementation under the same token in a provider that boots before the subsystem that consumes it (or re-register after boot, like the communication provider rebinds `MAILER` when selecting a transport).

## Resolving in Server Components and Server Actions

```ts
import { app } from "@veap/framework/core/server";

export default async function Page() {
  const settings = await app(SettingsService);
  const value = await settings.get<string>("announcement");
  return <p>{value}</p>;
}
```

In Server Actions the same works; Veap's own actions wrap services with `handleActionError` to convert thrown `AppError`s into `Result` values (see [Error handling](./error-handling.md)).

## What not to do

- Do not call `app()` at module top level; resolve inside functions after boot.
- Do not resolve services from client components; the container is server-only (`@veap/framework/core/server`).
- Do not use `container.clear()` in application code; it exists for tests and full reboots.
- Prefer facades over raw container lookups. `getCurrentSession()` is the supported API for session access, not `app(SessionService).getCurrentSession()`.
