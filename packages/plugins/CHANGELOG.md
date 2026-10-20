# @veap/plugins

## 0.1.13

### Patch Changes

- Updated dependencies []:
  - @veap/database@0.1.10
  - @veap/auth@0.1.12

## 0.1.12

### Patch Changes

- fix(router): prevent SoftNavigationInterceptor from hijacking internal links when onNavigate is not configured
  
  - Return early in `SoftNavigationInterceptor` when `onNavigate` is not provided to prevent calling `e.preventDefault()` and `window.history.pushState` on clicks.
  - Allow framework client-side navigation (for example, Next.js `<Link>`) and standard browser links to navigate properly inside virtual router layouts.
  - Export `handleSoftNavigationClick` helper function with comprehensive unit tests.

## 0.1.11

### Patch Changes

- Updated dependencies [[`bece042`](https://github.com/veapjs/veap/commit/bece042e820444f2b6fe89b15df882e9c77b8750)]:
  - @veap/auth@0.1.11

## 0.1.10

### Patch Changes

- Updated dependencies []:
  - @veap/auth@0.1.10

## 0.1.9

### Patch Changes

- chore: bump version
- Updated dependencies []:
  - @veap/auth@0.1.9
  - @veap/database@0.1.9
  - @veap/intl@0.1.9
  - @veap/kernel@0.2.2
  - @veap/ui@0.1.4

## 0.1.8

### Patch Changes

- Architectural cleanup, CLI isolation, and ESM consistency in `@veap/plugins`:
  
  - **CLI Leak Removal**: Removed CLI commands from primary `@veap/plugins` root export; CLI commands and utilities are now accessible strictly via `@veap/plugins/cli`.
  - **Legacy Framework Cleanup**: Removed dead references to non-existent `@veap/framework` package from CLI stubs.
  - **Strict ESM Compliance**: Added missing `.js` extensions across all relative imports in router, navigation, and widget submodules.
  - **Unified PathPrefixContext**: Unified `PathPrefixContext` provider and consumer implementations into a single source of truth.
  
  Register `@veap/plugins` CLI commands in the `@veap/kernel/cli` console via `PluginsServiceProvider.commands()`:
  
  - Added `ListPluginsCommand` (`veap list-plugins`), `AddPluginCommand` (`veap add`), `RemovePluginCommand` (`veap remove`), `EjectPluginCommand` (`veap eject`), `MakePluginCommand` (`veap make:plugin`), and `PluginsSyncCommand` (`veap plugins:sync`).
  - Exported the new `@veap/plugins/cli` subpath along with programmatic helpers (`addPlugin`, `removePlugin`, `ejectPackage`, `ejectPlugin`, `generatePlugin`, `regeneratePluginsRegistry`) using the `@veap/kernel/cli` `Output` port.
  - Guarded `PluginsServiceProvider.boot()` when `VEAP_CLI=1` so console commands register plugin definitions in memory without executing automatic database migrations or `onEnable`/`onMigrate` side effects.
  - Updated `generatePlugin` (`veap make:plugin`) to scaffold a valid `IPlugin` class using `createManifestFromPackageJson` and the `init()`, `onEnable()`, and `onDisable()` lifecycle hooks.
  - Updated `PluginRegistry` to invoke `init`, `onMigrate`, `onEnable`, and `onDisable` via `Container.call()`, enabling `@Inject(token)` parameter injection on plugin lifecycle methods.
  - Added `MenuService` (`MENU_SERVICE`), `WidgetService` (`WIDGET_SERVICE`), and `ExtensionService` (`EXTENSION_SERVICE`) for programmatic registration of navigation items, dashboard widgets, and UI extension points inside `plugin.init()`, and removed the static `navigation`, `widgets`, and `extensions` properties from `IPlugin`.
  - Removed unused `@clack/prompts`, `chalk`, and `ora` dependencies from `@veap/plugins`.
- Updated dependencies [`a7f6a1f`]:
  - @veap/auth@0.1.8
  - @veap/intl@0.1.8
  - @veap/database@0.1.8
  - @veap/kernel@0.2.1
  - @veap/ui@0.1.3

## 0.1.7

### Patch Changes

- Updated dependencies []:
  - @veap/kernel@0.2.0
  - @veap/auth@0.1.7
  - @veap/database@0.1.7
  - @veap/intl@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies []:
  - @veap/kernel@0.1.6
  - @veap/auth@0.1.6
  - @veap/database@0.1.6
  - @veap/intl@0.1.6

## 0.1.6

### Patch Changes

- Updated dependencies []:
  - @veap/auth@0.1.5
  - @veap/database@0.1.5
  - @veap/intl@0.1.5
  - @veap/kernel@0.1.5

## 0.1.5

### Patch Changes

- Keep the plugin migration adapter in sync with the migration runner's results.
  
  - `KnexMigrationRunner.run()` and `rollback()` now await `runMigrations()` and `rollbackMigrations()`. Both report what they did (`{ scope, ran, batch }` / `{ scope, rolledBack }`) for the `veap migrate` and `veap migrate:rollback` commands, so returning their promise directly no longer type-checks against `IMigrationRunner`; the port itself still resolves to `void`, and the summary is dropped on purpose.
- Updated dependencies []:
  - @veap/database@0.1.2
  - @veap/kernel@0.1.4
  - @veap/intl@0.1.4

## 0.1.4

### Patch Changes

- Updated dependencies []:
  - @veap/kernel@0.1.3
  - @veap/intl@0.1.3

## 0.1.3

### Patch Changes

- Fully decouple `@veap/plugins` from Next.js runtime dependencies:
  
  - Decoupled router middlewares (`SameOrigin`, `EnsuredGuest`, `EnsuredUser`, `EnsuredAuth`) and `withRouter` HOC from `next/headers` and `next/navigation` in favor of `@veap/kernel`'s `REQUEST_CONTEXT` port (`IHttpRequestContext`).
  - Removed `useRouter` from `SoftNavigationInterceptor` in favor of framework-agnostic HTML5 navigation with an optional `onNavigate` handler.
  - Replaced `next` `Metadata` type in `route-tree.ts` with a framework-agnostic `VeapMetadata` interface.
  - Removed `next` from `peerDependencies` in `package.json`.
  - Preserved virtual router file conventions and `NEXT_RUNTIME` environment handling.

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - @veap/intl@0.1.2
  - @veap/kernel@0.1.2

## 0.1.1

### Patch Changes

- Augment VeapConfig with privatePath, declare local APP_PLUGINS, ROUTER_SERVICE and SITE_LAYOUT tokens, augment ApplicationBuilder with withPlugins, and ensure full ESM compliance:
  - Augment `VeapConfig` from `@veap/kernel` via TypeScript Module Augmentation to declare the `privatePath?: string` configuration schema.
  - Augment `ApplicationBuilder` from `@veap/kernel` via TypeScript Module Augmentation with `.withPlugins(plugins: any[])` and configure `PluginsConfigProvider` and `PluginsServiceProvider`.
  - Define and export `APP_PLUGINS` (`Token<any[]>`), `ROUTER_SERVICE` (`Token<RouterService>`), and `SITE_LAYOUT` (`Token<any>`) IoC tokens within `@veap/plugins` (`src/common/tokens.ts`, `src/common/index.ts`, `src/router/index.ts`), decoupling them from `@veap/kernel`.
  - Update `PluginsServiceProvider` to bind the local `APP_PLUGINS`, `ROUTER_SERVICE`, and `SITE_LAYOUT` tokens.
- Updated dependencies []:
  - @veap/auth@0.1.1
  - @veap/database@0.1.1
  - @veap/intl@0.1.1
  - @veap/kernel@0.1.1

## 0.1.0

### Minor Changes

- Initial public scaffold of the Veap plugins.
