# Plugins (Modules)

In Veap, **Modules are Plugins**. The system uses the `IPlugin` interface for everything, and aliases like `getModule` are just compatibility wrappers for `getPluginStatus`.

## Plugin Definition

A plugin is an npm package exporting an `IPlugin` object. It can define:

- `manifest`: Metadata (id, name, dependencies).
- `migrations`: Array of database migrations.
- `hooks`: Data transformation filters.
- `extensions`: React components injected into UI extension points.
- `widgets`: Dashboard components.
- `routeTree`: Next.js-like route definitions (using `discoverRoutes`).

## Lifecycle

When a plugin is enabled:

1. `migrations`: Knex runs the plugin's SQL migrations.
2. `onMigrate`: Optional hook executed after migrations.
3. `onEnable`: Activation hook (runs once).
4. `init`: Initialization hook (runs on every server restart if the plugin is enabled).

## Route Injection

Plugins do not place files in the host's `app/` directory. Instead, they provide a `routeTree` (usually built by pointing `discoverRoutes` to the plugin's own internal `src/app` folder). The `VeapRouter` merges all plugin route trees at runtime.
