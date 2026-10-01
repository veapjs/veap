# @veap/framework

## 0.12.0

### Minor Changes

- ### Removal of Legacy Template Subsystem & Enhanced ExtensionPoint Architecture
  - **Template Subsystem Removal**:
    - Removed deprecated template layer (`withTemplates()`, `APP_TEMPLATES` DI token, `TemplateService`, `ITemplateRepository`, and database migrations for the `templates` table).
    - Removed `veap make:template` command from the CLI.
    - Removed template generator stubs from `packages/veap/stubs/template/`.
    - Replaced legacy template override mechanisms with native Next.js App Router file shadowing (e.g. creating `/app/signin/page.tsx` in the host application to override virtual routes provided by plugins).

  - **ExtensionPoint Enhancements (`single` / `multiple` mode & fallback support)**:
    - Added `mode?: "single" | "multiple"` prop to `<ExtensionPoint />` (server) and `<PluginExtensionPointClient />` (client), defaulting to `"multiple"`.
    - When `mode="single"` is specified, only the registered widget/extension with the highest `priority` is rendered (ideal for modular navigation bars, single footers, hero sections, etc.).
    - Added support for `children` fallback: when no widgets match or are enabled for the specified target/point, the optional children are rendered as a fallback.
    - Retained deterministic descending priority ordering (`priority` property).

  - **Documentation & Ecosystem Alignment**:
    - Re-architected documentation around modular App Shell composition, layouts, slots, and Next.js route shadowing.

### Patch Changes

- Updated dependencies
  - create-veap@0.2.0

## 0.11.16

### Patch Changes

- ### Configurable Auth Routes, Virtual Router Rewrites & IoC Fixes
  - **Configurable Authentication Routes**:
    - Support custom authentication URLs (e.g. `/logowanie`, `/rejestracja`, `/odzyskaj-haslo`, `/nowe-haslo`, `/weryfikacja-email`) via `Application.configure().withAuth({ routes: { ... } })` and `AuthServiceProvider`.
    - Added `AUTH_ROUTES` DI token and `AuthRoutesConfig` contract, preserving 100% backward compatibility with default routes (`/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/new-password`, `/verify-email`).
    - Added `getAuthRoutes()` server facade in `@veap/framework/auth/server` and `useAuthRoutes()` React hook in `@veap/framework/auth`.
    - Automatically register rewrites with `RouterService` so custom routes seamlessly point to internal auth handlers.

  - **Virtual Router Dynamic Rewrites**:
    - Added support for application-level rewrites via `Application.configure().withRouter({ rewrites: { ... } })` and `RouterService.registerRewrite()`.
    - Added dynamic pattern matching in `RouteTree.findMatch()` supporting named parameters (`:slug`, `[slug]`) and catch-all wildcards (`*`, `:path*`), transparently forwarding resolved params to matched routes.

  - **IoC Container Concurrency Deduplication**:
    - Fixed singleton instantiation race condition in `Container.resolveAsync()` by deduplicating in-flight resolution promises, preventing duplicate service creation and duplicate event listener registration during concurrent initialization (`Promise.all`).

## 0.11.15

### Patch Changes

- Add `SameOrigin` (`VeapMiddleware`) and `ApiSameOrigin` (`ApiMiddleware`) in `@veap/framework/router` and `@veap/framework/router/server` for declarative CSRF and Same-Origin protection on page routes and API handlers.

## 0.11.14

### Patch Changes

- ### Security Hardening & Architectural Fixes
  - **File Upload Security & Path Traversal (VULN-05)**: Added dangerous extension blocklist (`.html`, `.svg`, `.php`, `.exe`, `.sh`, `.js`, etc.) and filename sanitization in `LocalFileProvider` to prevent Stored XSS and server-side script execution. Hardened `delete()` against path traversal using normalized relative path validation.
  - **Password Reset OTP & Security (SEC-01 & VULN-06)**: Reduced OTP TTL from 1 hour to 15 minutes in `PasswordResetService` and `EmailVerificationService`, added attempt tracking (max 5 failed attempts per session before invalidation), and introduced `createDummyPasswordResetSession` and `verifyResetCode` facades in `@veap/framework/auth/server` for user enumeration and brute-force protection.
  - **Login Brute-Force & Timing Attacks (SEC-02)**: Added IP and email-based rate limiting (max 5 failed attempts per 15 minutes) and dummy password hash verification to `AuthService.signIn()` in `@veap/framework`.
  - **PostgreSQL TLS (SEC-04)**: Enforced secure-by-default TLS certificate verification (`rejectUnauthorized: true`) for PostgreSQL in production to prevent Man-in-the-Middle (MITM) vulnerabilities. Allow opt-out via `DATABASE_SSL_REJECT_UNAUTHORIZED=false`, `?sslmode=no-verify`, or `?rejectUnauthorized=false`. Support custom CA bundles via `DATABASE_SSL_CA`, and support development TLS when requested in `DATABASE_URL` (`?sslmode=require` or `?ssl=true`).
  - **CSRF & Origin Verification (SEC-05)**: Added `verifySameOrigin(request)` helper to `@veap/framework/auth/server` verifying `Sec-Fetch-Site` and `Origin`/`Host` consistency on state-changing requests.
  - **IP Spoofing (SEC-06)**: Hardened `getIPAddress()` in `SessionService` to validate IPv4/IPv6 format with `node:net.isIP()` and respect trusted proxy headers (`cf-connecting-ip`, `x-real-ip`, `x-client-ip`).
  - **EventBus Error Handling (SEC-08)**: Upgraded unhandled handler logging from warning to `logger.error` for better observability in APM/monitoring. Re-throw Next.js `NEXT_NOT_FOUND` alongside `NEXT_REDIRECT`. Added opt-in strict mode (`{ strict: true }` option and `publishStrict()` convenience method) that collects and re-throws handler errors (wrapped in `AggregateError` when multiple fail) while preserving default fault isolation for standard pub/sub events.
  - **Bootstrap Fail-Closed (SEC-09)**: Fix error propagation in `Application.bootstrap()` to prevent silent initialization failures. Re-throw caught errors after logging, preserve Next.js control flow exceptions (`NEXT_REDIRECT`, `NEXT_NOT_FOUND`), and clean up the bootstrapping promise on failure for transient self-healing.
  - **Database Savepoints**: Documented nested transaction semantics (`Propagation: REQUIRED` by default reusing existing outer transaction via `AsyncLocalStorage`) and added opt-in savepoints support via `transaction(fn, { savepoint: true })` for partial rollback isolation without failing the outer transaction.
  - **Auth Cryptography**: Made bcrypt salt rounds and password minimum length configurable via `AUTH_BCRYPT_ROUNDS` (default: 10) and `AUTH_PASSWORD_MIN_LENGTH` (default: 8), allowing higher security costs in production and fast execution in tests without changing source code.
  - **Plugin Status Split-Brain**: Prevent split-brain state in `PluginRegistry.updateStatus()` by rolling back in-memory state and re-throwing errors when database persistence fails during plugin state transitions (`enabled`/`installed`), while allowing ephemeral UI progress steps (`lastStep`) to safely degrade without crashing.

## 0.11.13

### Patch Changes

- - **Communication**: Add graceful fallback to `ConsoleMailService` when `MAIL_TRANSPORT` is unset and no SMTP credentials are configured, preventing crashes in development and fresh installations.
  - **Auth**: Wrap `sendRecoveryCode` in `UserService.createUser()` and `UserService.generateNewRecoverCode()` with safe error handling so email delivery issues do not abort user creation or crash installation flows.

## 0.11.12

### Patch Changes

- Update CLI reference and installation documentation with dynamic command discovery and package manager resilience

## 0.11.11

### Patch Changes

- Updated dependencies
  - create-veap@0.1.4

## 0.11.10

### Patch Changes

- Fix CLI command discovery by loading environment variables and supporting all application bootstrap export formats

## 0.11.9

### Patch Changes

- Fix CLI ESM module resolution by adding explicit .js extensions to IoC imports

## 0.11.8

### Patch Changes

- Updated dependencies
  - create-veap@0.1.3

## 0.11.7

### Patch Changes

- Updated dependencies
  - create-veap@0.1.2

## 0.11.6

### Patch Changes

- Updated dependencies
  - create-veap@0.1.1

## 0.11.5

### Patch Changes

- Fix Hot Module Replacement (HMR) for templates and plugins in development mode:
  - Re-register in-memory template and plugin instances in `Application.bootstrap()` when already bootstrapped, refreshing stale component references across HMR re-evaluations.
  - Ensures Next.js dev server updates template layouts, component overrides, widgets, and extensions seamlessly during local development.

  Support explicit lifecycle teardown for auth extensions via string IDs:
  - Introduce `AuthCallbackRegistry` supporting keyed registrations and explicit unregistration.
  - Add `unregisterSecurityRequirement`, `unregisterAuthValidator`, `unregisterSessionAugmenter`, and related helpers to `@veap/framework/auth/server`.
  - Update `auth-passkey-plugin` and `auth-totp-plugin` to register security requirements, auth validators, and session augmenters using their plugin IDs in `init` and explicitly unregister them in `onDisable`.
  - Prevents disabled plugins from leaving stale security checks and session augmenters in memory.

  Update documentation for templates HMR and auth extension lifecycle teardown:
  - Document template development workflow, `dev:pkg` watch script, and Fast Refresh in `plugins/templates.md`.
  - Document string ID registration and `onDisable()` teardown (`unregisterSecurityRequirement`, `unregisterAuthValidator`, `unregisterSessionAugmenter`, etc.) in `auth/extensibility.md`.
  - Update plugin conventions and gate plugin examples in `plugins/creating-plugins.md`, `guides/gate-plugins.md`, and `guides/cookbook.md`.

  Update package dependencies to use explicit package versions instead of workspace protocols for reliable version resolution and automated changeset releases.

- chore(deps): Update package dependencies to use explicit package versions instead of workspace protocols for reliable version resolution and automated changeset releases.

## 0.11.4

### Patch Changes

- chore(deps): Patch dependencies

## 0.11.3

### Patch Changes

- Add template support to `veap eject <package>` CLI command:
  - Automatically detect whether an ejected package is a template or a plugin (`veap.type` manifest).
  - Eject templates into the local `templates/` directory and plugins into `plugins/`.
  - Ensure workspace directory is present in root `package.json` workspaces array.
  - Conditionally skip `lib/plugins.gen.ts` regeneration for templates.
  - Preserve `ejectPlugin` as a backward-compatible alias of `ejectPackage`.
  - Update CLI and framework documentation for template ejection and plugin authoring.

## 0.11.2

### Patch Changes

- Audit & framework stabilization:
  - **Exports & Bundler Safety**: Added missing `.` root export to `package.json` to resolve ESM `ERR_PACKAGE_PATH_NOT_EXPORTED`. Added `bin` directory to `package.json` `files` field.
  - **Turbopack Tracing**: Added `/*turbopackIgnore: true*/` annotation to SQLite filesystem path resolution in `connection.ts` to suppress Next.js build warnings.
  - **Server/Client Isolation**: Extracted `PathPrefixContext` into a dedicated client context module. Decoupled `auth-provider` and `app-provider` from server-side dependencies. Removed `import "server-only"` from internal application services (`registry.ts`, `templates.ts`, `facade.ts`, `email-verification.service.ts`), preserving it exclusively at server boundaries.
  - **Clean Architecture (ADR-006)**: Replaced all 33 internal `@veap/framework/...` self-imports with relative imports across `domain`, `application`, `infrastructure`, and `presentation`.
  - **IoC Container Symbols**: Added typed domain symbols (`DATABASE`, `APP_PLUGINS`, `APP_TEMPLATES`, `APP_MIGRATIONS`, `CLI_SERVICE`) in `domain/contracts/token.ts` alongside string tokens for 100% backward compatibility.
  - **Test Suite Expansion**: Added comprehensive test suites for Router matching & segment classification, router middlewares (`SkipSecurity`, `EnsuredGuest`, `EnsuredUser`, `EnsuredAuth`), `PluginRegistry` topological sorting and hook filtering, and `transaction()` AsyncLocalStorage lifecycle (121/121 tests passing).

## 0.11.1

### Patch Changes

- Path-aware security checks: `checkSecurity` now accepts the request path and forwards it to registered security requirements, which can exempt their own pages (fixes infinite redirect loops with gate plugins). New `SkipSecurity` route middleware suppresses the automatic `EnsuredAuth` injection for gate pages. New `auth:after_verify:redirect` filter lets plugins reroute the post-email-verification landing. `applyFilters` accepts an optional context passed to hook handlers.

## 0.11.0

### Minor Changes

- a0a8324: Domain-Driven Design (DDD) Models Refactor

  - **Core**: Relocated ORM models from the centralized database module into their respective domain modules (auth, settings, plugins). The database module now acts strictly as an ORM and migration engine, devoid of business-specific model logic.
  - **Core (Database)**: Fixed a critical typo in the 0001_initial migration where the reset_sessions table incorrectly defined emailVerified (camelCase) instead of email_verified (snake_case). Added a 0006_fix_email_verified migration to safely rename the column in existing deployments, preventing a fatal crash during password reset workflows.
  - **Plugins**: Updated all internal and cross-module imports across all plugins to resolve domain models from their new architectural locations (e.g., import { User } from "@veap/framework/auth/models").

## 0.10.1

### Patch Changes

- Clean up ORM references and migration types

## 0.10.0

### Minor Changes

- Refactored internal core modules (Auth, Plugins, Router, Database) to exclusively use the @Injectable() IoC container pattern rather than static singletons. This includes fixes for async initialization sequences, Next.js dual-package hazard for DI containers in Edge/Node workers, and backwards-compatible proxy wrappers for legacy direct imports.

## 0.9.0

### Minor Changes

- Refactor system initialization to use Laravel-like fluent ApplicationBuilder and update plugins to properly resolve core services via Dependency Injection container instead of static singletons.

## 0.8.0

### Minor Changes

- Refactored Veap Core to use a Dependency Injection (DI) system with a lightweight IoC container. Introduced KernelServiceProvider and SettingsServiceProvider. Added app() helper function for container resolution in Server Actions and React Server Components. Refactored plugins to utilize the new DI container.

## 0.7.0

### Minor Changes

- `@veap/framework`: Added the ability for native Next.js applications to run their own migrations. `ensureSystemInitialized` now accepts an `appMigrations` array and executes them securely before loading plugins.

## 0.6.0

### Minor Changes

- Removed the proprietary template engine (`ITemplate`, overrides, and related APIs).
  - Introduced the `withRouter` Higher-Order Component (HOC) to seamlessly integrate physical Next.js pages with the virtual plugin router, enabling layout inheritance and middleware protection.

## 0.5.4

### Patch Changes

- Updated dependencies

## 0.5.3

### Patch Changes

- Upgrade Next.js, React, and switch linter to ESLint

## 0.5.2

### Patch Changes

- Add plugin dependency ID resolution for npm scoped packages

## 0.5.1

### Patch Changes

- Align package imports with @veap/framework

## 0.5.0

### Minor Changes

- 290ed45: Consolidate plugin and template manifests into `package.json`. The standalone `manifest.json` files have been removed - all metadata (`id`, `name`, `description`, `enabled`, `system`, `hasSetup`, `dependencies`, `extends`) now lives in the `veap` field of each package's `package.json`. A new helper `createManifestFromPackageJson()` and types `VeapPackageMetadata` / `VeapPackageJson` are exported from `@veap/framework/plugins` for this purpose.

## 0.4.1

### Patch Changes

- Fix locale registration for generated plugins and templates. The CLI stubs now scaffold `src/locales/{en,pl}.ts` dictionaries and register them through the plugin/template `locales` field - previously generated packages shipped translations that were never loaded. Templates gained first-class locale support in the core: `ITemplate.locales` is merged into the message dictionary by the intl discovery loader (after plugins, before app-level fallbacks), and `@veap/minimal-template`'s existing en/pl dictionaries are now actually registered.

## 0.4.0

### Minor Changes

- Adds the internationalization engine (locale detection, translation loading, pluralization), a storage service with local and provider-backed disks, and the plugin system: manifest, lifecycle hooks, plugin-scoped routes and global model scopes.

## 0.3.1

### Patch Changes

- Public hooks and defaults extracted so the new Veap CLI and the `create-veap` scaffolder can drive the framework programmatically.

## 0.3.0

### Minor Changes

- Introduces the database module on top of Knex: connection lifecycle management, migrations and a fluent query builder with where/orderBy/pagination composition.
- Extends the ORM with Eloquent-style relations: hasOne, hasMany, belongsTo and belongsToMany with eager loading, plus attribute casting and model accessors.

## 0.2.0

### Minor Changes

- Adds the HTTP layer: middleware pipeline, the route matcher with static, dynamic and wildcard segments, and the route tree for grouped and nested registration. Server-sent events are wired into the response layer.

## 0.1.0

### Minor Changes

- Initial public scaffold of the Veap core: application container, typed config loading with the `server` schema, structured logger and the shared error hierarchy. The framework boots headlessly as a single importable package.
