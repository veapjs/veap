# ADR-006: Layered (Clean) Architecture for @veap/core

## Status

Accepted

## Context

`@veap/core` originally organised everything under a single `src/core` folder plus `src/modules`. A single directory held the IoC container, the event bus, logging, configuration, error handling and the application bootstrap, mixing four different concerns:

- **Framework/transport coupling:** `AppError` carried an `httpStatus`, so a domain error knew about HTTP.
- **Dependency direction:** the kernel's `ApplicationBuilder` imported nine concrete module providers and hard-coded `withDatabase()` → `DatabaseServiceProvider`, so high-level policy depended on low-level implementation details.
- **Duplicate abstractions:** logging existed twice - module-level functions (`debug`, `info`, …) and an `@Injectable` `LoggerService`.
- **Ad-hoc tokens:** the cache was registered and injected through the bare string `"CacheProvider"`.
- **Self-imports:** modules imported their own package (`@veap/core/settings/models`), hiding layer boundaries.

This made the "domain-driven framework" claim hard to verify and made the package difficult to reason about and test.

## Decision

Restructure `packages/veap/src` into four Clean Architecture layers with a strict inward dependency direction:

```
presentation → infrastructure → application → domain
```

1. **domain** - pure contracts and primitives, no framework/I/O imports: `AppError` (carrying only an `ErrorCode`), `Result`, event contracts, and ports (`ICacheProvider`, `ILogger`, `IConfigService`, `IEventBus`, `ICookieStore`, `IHttpRequestContext`).
2. **application** - orchestration depending only on domain ports; the in-memory `EventBus` implements `IEventBus` and receives its logger through a composition-root hook (`EventBus.setLogger(ILogger)`, called by `KernelServiceProvider`) instead of importing the console adapter directly.
3. **infrastructure** - adapters: IoC container, providers, config (env schema + `veap.config` loader), cache adapters, console logger, CLI, and the **composition root** (`ApplicationBuilder`).
4. **presentation** - delivery: React hooks/providers and HTTP-facing helpers (`handleActionError`, `httpStatusForErrorCode`).

Supporting rules:

- HTTP mapping moves to the presentation layer; the domain no longer knows about status codes.
- Logging has one implementation (`ConsoleLogger implements ILogger`); `logger` is an instance of it, and the named `debug/info/warn/error` functions delegate to it.
- Injection tokens are centralised as typed constants and live **in the domain layer**, next to the contract they belong to: kernel ports carry their tokens in `domain/contracts/*` (`CACHE_PROVIDER`, `LOGGER`, `EVENT_BUS`, `CONFIG_SERVICE`, `VEAP_CONFIG`) and repository ports in `domain/<context>/repositories/*`. All are `Symbol.for("veap:...")` values; `infrastructure/ioc/tokens.ts` is removed - do not reintroduce token files outside the domain.
- DI decorators (`@Injectable`, `@Inject`) are part of the same vocabulary and live in the domain as well (`domain/contracts/ioc.ts`): they only record metadata, which the infrastructure container reads. `infrastructure/ioc/decorators.ts` re-exports them for backwards compatibility; application services must import them from the domain contracts, never from infrastructure.
- Entry points (`src/index.ts`, `src/server.ts`) are barrels only; the `@veap/core` and `@veap/core/core/server` subpaths map to `dist/index.js` and `dist/server.js` for backwards compatibility.
- Global singletons (`EventBus`, the `Container`) are created exactly once, on `globalThis`; the container only **exposes** that instance via `useValue` and must never construct a second copy. Inject services through the domain token (`EVENT_BUS`, …) - the concrete-class token (`EventBus`) exists only as a backwards-compatibility alias to the same instance.

The migration was incremental: the kernel first, then each module, keeping a clean `tsc --noEmit` at every step. `src/modules/*` is now gone; every bounded context is split across the four layers and its public API is exposed through a barrel in `src/entries/`.

## Consequences

- **Positive:** dependencies point inward and are mechanically verifiable; the domain is free of HTTP, ORM and framework imports.
- **Positive:** the composition root is the single wiring point, so `withDatabase()`, `withAuth()`, etc. no longer leak concrete providers into the kernel logic.
- **Positive:** one logging API, typed injection tokens, and no package self-imports.
- **Negative:** a breaking reshuffle of internal paths; imports that referenced `src/core/*` must move to the layer directories.
- **Known debt (resolved):** the Dependency Rule is now closed for `settings`, `auth`, `plugins` and `communication` - see _Repository ports_ below. There is no remaining case of an application service importing a concrete infrastructure class.
- **Constraint:** new core code must be added to `domain` / `application` / `infrastructure` / `presentation` and exposed through `src/entries/*` - never via a resurrected `src/modules` folder.

## Repository ports

Application services must not import ActiveRecord models. Each bounded context that needs persistence defines a **port** in `domain/<context>/repositories/*.repository.ts` (a TypeScript interface plus a `Symbol.for("veap:<context>:<name>-repository")` injection token) and an **adapter** in `infrastructure/<context>/repositories/active-record-*.repository.ts` that is the only code allowed to touch the ORM. Service providers register the token → adapter binding and the composition root injects ports into services with `@Inject(TOKEN)`.

Implemented so far:

- `settings` - `ISettingsRepository` → `ActiveRecordSettingsRepository`.
- `auth` - `IUserRepository`, `IRoleRepository`, `IPermissionRepository`, `ISessionRepository`, plus `IPasswordResetRepository` and `IEmailVerificationRepository` → `ActiveRecord*Repository`.
- `plugins` - `IPluginRepository` and `ITemplateRepository` → `ActiveRecord*Repository`, plus the `IMigrationRunner` port (→ `KnexMigrationRunner`), so `PluginRegistry` no longer imports the ORM or the knex runner.
- `communication` - `IMailer` is a **pure delivery port**: a single `sendMail(MailMessage)` operation speaking the framework-neutral `MailMessage` DTO (`domain/communication/mail-message.ts`), never a provider's types and never mail semantics. Email semantics live in **mailables** (`application/communication/mail.ts` - `sendVerifyEmail`, `sendResetPassword`, `sendRecoveryCode`, `send2FACode`), which build localized `MailMessage`s via the injected translator factory (`setMailTranslatorFactory`, so adapters never import intl and request locale is preserved) and hand them to the bound port - the Laravel split: `Mailable` = content, `Transport` = delivery. Transports are swappable at the composition root via `MAIL_TRANSPORT`: `smtp` (default, `NodemailerMailService` mapping the DTO onto Nodemailer), `console` (`ConsoleMailService`, logs messages for dev/test) and `custom` (resolves `CUSTOM_MAILER` - bring your own SES/Postmark/Resend adapter; see `providers/example-ses.provider.ts.example`). `CommunicationServiceProvider.boot()` binds the selected transport into `CommunicationContext` (`application/communication/context.ts`); the facade forwards with no container lookups.
- `auth` cryptography - `IPasswordHasher` (→ `BcryptPasswordHasher`), `ITokenGenerator` (→ `OsloTokenGenerator`, consolidating `utils/encode.ts` and the SHA-256 token hashing from `SessionService`/`PasswordResetService`) and `ISecretCipher` (→ `AesSecretCipher` wrapping `utils/encryption`); tokens `PASSWORD_HASHER`, `TOKEN_GENERATOR`, `SECRET_CIPHER`, registered by `AuthServiceProvider`. The `utils/password|encode|encryption` files remain public API for plugins (exported via `entries/auth-server.ts`) - only application services must go through the ports.
- `auth` HTTP transport - `ICookieStore` (→ `NextCookieStore`) and `IHttpRequestContext` (→ `NextRequestContext` for headers and redirects) in `domain/contracts/http-transport.ts`, adapters in `infrastructure/http/next-request-context.ts`, tokens `COOKIE_STORE` and `REQUEST_CONTEXT`, registered by `KernelServiceProvider`. Auth services no longer import `next/headers` or `next/navigation` - reading cookies/headers and issuing redirects are transport concerns resolved at the composition root. Direct Next.js imports remain legitimate only at the outer edges (presentation components/actions, server entry points).

**Facades do not use the container.** `application/auth/context.ts` defines a typed `AuthContext` (the full dependency surface of the auth facades and `logic` helpers). `AuthServiceProvider.boot()` resolves the concrete services once and calls `bindAuthContext(...)`; consumers read it via `authContext()`. The same pattern is applied by `application/plugins/context.ts` (`PluginsContext`: registry, templates, navigation) for the plugins facades and presentation components. This replaces scattered `app(Service)` lookups inside the application layer with a single composition-bound, typed boundary. `app()` stays acceptable only in the composition root, `src/entries/*` and server actions (`presentation/*/actions/*`).

**Trade-off:** `authContext()` (and `pluginsContext()`) throws if read before the provider boots. The app's routes are `force-dynamic` and `initializeSystem()` runs in the root layout first, so every request path bootstraps before a facade is called.

**Build-phase trade-off (NEXT_PHASE).** `Application.bootstrap()` deliberately skips provider boot when `NEXT_PHASE=phase-production-build` (i.e. during `next build`): the database, environment and plugins are not guaranteed to exist at build time, and booting them there was a recurring source of build crashes. The price is that Next.js still prerenders `/_not-found` - root layout included - executing context-bound helpers (`getPathPrefix()`, `ExtensionPoint`, session cookies) against an unbooted system. This broke the build in practice ("[Plugins] Context is not bound" during the `/_not-found` prerender). The contract that resolves it, and which must be preserved:

- **`app/layout.tsx` and `app/not-found.tsx` must export `dynamic = "force-dynamic"`** - no page that renders the framework shell may ever be prerendered. The `create-veap` stubs carry the same exports.
- The only intentionally static route is `manifest.webmanifest`, which touches no framework code.
- `I18nProvider` falls back to the default locale when `cookies()` is unavailable (build-time safety net, see `.veap/architecture/nextjs.md`).

Consequence: framework pages render on demand only - we consciously give up static optimization for them in exchange for deterministic context binding and build independence from the database. If prerenderable pages are ever needed, they must avoid the framework shell rather than depend on a bound context.
