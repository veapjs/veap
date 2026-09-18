# @veap/core

## 0.11.2

### Patch Changes

- Audit & framework stabilization:
  - **Exports & Bundler Safety**: Added missing `.` root export to `package.json` to resolve ESM `ERR_PACKAGE_PATH_NOT_EXPORTED`. Added `bin` directory to `package.json` `files` field.
  - **Turbopack Tracing**: Added `/*turbopackIgnore: true*/` annotation to SQLite filesystem path resolution in `connection.ts` to suppress Next.js build warnings.
  - **Server/Client Isolation**: Extracted `PathPrefixContext` into a dedicated client context module. Decoupled `auth-provider` and `app-provider` from server-side dependencies. Removed `import "server-only"` from internal application services (`registry.ts`, `templates.ts`, `facade.ts`, `email-verification.service.ts`), preserving it exclusively at server boundaries.
  - **Clean Architecture (ADR-006)**: Replaced all 33 internal `@veap/core/...` self-imports with relative imports across `domain`, `application`, `infrastructure`, and `presentation`.
  - **IoC Container Symbols**: Added typed domain symbols (`DATABASE`, `APP_PLUGINS`, `APP_TEMPLATES`, `APP_MIGRATIONS`, `CLI_SERVICE`) in `domain/contracts/token.ts` alongside string tokens for 100% backward compatibility.
  - **Test Suite Expansion**: Added comprehensive test suites for Router matching & segment classification, router middlewares (`SkipSecurity`, `EnsuredGuest`, `EnsuredUser`, `EnsuredAuth`), `PluginRegistry` topological sorting and hook filtering, and `transaction()` AsyncLocalStorage lifecycle (121/121 tests passing).

## 0.11.1

### Patch Changes

- Path-aware security checks: `checkSecurity` now accepts the request path and forwards it to registered security requirements, which can exempt their own pages (fixes infinite redirect loops with gate plugins). New `SkipSecurity` route middleware suppresses the automatic `EnsuredAuth` injection for gate pages. New `auth:after_verify:redirect` filter lets plugins reroute the post-email-verification landing. `applyFilters` accepts an optional context passed to hook handlers.

## 0.11.0

### Minor Changes

- a0a8324: ### Domain-Driven Design (DDD) Models Refactor

  - **Core**: Relocated ORM models from the centralized database module into their respective domain modules (auth, settings, plugins). The database module now acts strictly as an ORM and migration engine, devoid of business-specific model logic.
  - **Core (Database)**: Fixed a critical typo in the 0001_initial migration where the reset_sessions table incorrectly defined emailVerified (camelCase) instead of email_verified (snake_case). Added a 0006_fix_email_verified migration to safely rename the column in existing deployments, preventing a fatal crash during password reset workflows.
  - **Plugins**: Updated all internal and cross-module imports across all plugins to resolve domain models from their new architectural locations (e.g., import { User } from "@veap/core/auth/models").

## 0.10.1

### Patch Changes

- Clean up ORM references and migration types
- Updated dependencies
  - create-veap@0.2.3

## 0.10.0

### Minor Changes

- Refactored internal core modules (Auth, Plugins, Router, Database) to exclusively use the @Injectable() IoC container pattern rather than static singletons. This includes fixes for async initialization sequences, Next.js dual-package hazard for DI containers in Edge/Node workers, and backwards-compatible proxy wrappers for legacy direct imports.

### Patch Changes

- Updated dependencies
  - create-veap@0.2.2

## 0.9.0

### Minor Changes

- Refactor system initialization to use Laravel-like fluent ApplicationBuilder and update plugins to properly resolve core services via Dependency Injection container instead of static singletons.

### Patch Changes

- Updated dependencies
  - create-veap@0.2.1

## 0.8.0

### Minor Changes

- Refactored Veap Core to use a Dependency Injection (DI) system with a lightweight IoC container. Introduced KernelServiceProvider and SettingsServiceProvider. Added app() helper function for container resolution in Server Actions and React Server Components. Refactored plugins to utilize the new DI container.

## 0.7.0

### Minor Changes

- `@veap/core`: Added the ability for native Next.js applications to run their own migrations. `ensureSystemInitialized` now accepts an `appMigrations` array and executes them securely before loading plugins.

## 0.6.0

### Minor Changes

- Removed the proprietary template engine (`ITemplate`, overrides, and related APIs).
  - Introduced the `withRouter` Higher-Order Component (HOC) to seamlessly integrate physical Next.js pages with the virtual plugin router, enabling layout inheritance and middleware protection.

## 0.5.4

### Patch Changes

- Updated dependencies
  - @veap/ui@0.1.3

## 0.5.3

### Patch Changes

- Upgrade Next.js, React, and switch linter to ESLint
- Updated dependencies
  - @veap/ui@0.1.2

## 0.5.2

### Patch Changes

- Add plugin dependency ID resolution for npm scoped packages

## 0.5.1

### Patch Changes

- Align package imports with @veap/core
- Updated dependencies
  - @veap/ui@0.1.1

## 0.5.0

### Minor Changes

- 290ed45: Consolidate plugin and template manifests into `package.json`. The standalone `manifest.json` files have been removed - all metadata (`id`, `name`, `description`, `enabled`, `system`, `hasSetup`, `dependencies`, `extends`) now lives in the `veap` field of each package's `package.json`. A new helper `createManifestFromPackageJson()` and types `VeapPackageMetadata` / `VeapPackageJson` are exported from `@veap/core/plugins` for this purpose.

## 0.4.1

### Patch Changes

- Fix locale registration for generated plugins and templates. The CLI stubs now scaffold `src/locales/{en,pl}.ts` dictionaries and register them through the plugin/template `locales` field - previously generated packages shipped translations that were never loaded. Templates gained first-class locale support in the core: `ITemplate.locales` is merged into the message dictionary by the intl discovery loader (after plugins, before app-level fallbacks), and `@veap/minimal-template`'s existing en/pl dictionaries are now actually registered.

## 0.4.0

### Minor Changes

- Adds the internationalization engine (locale detection, translation loading, pluralization), a storage service with local and provider-backed disks, and the plugin system: manifest, lifecycle hooks, plugin-scoped routes and global model scopes.

### Patch Changes

- Updated dependencies
  - @veap/ui@0.1.0

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
