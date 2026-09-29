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

## Status Synchronization & Split-Brain Prevention

Plugin activation states are stored both in-memory (in `PluginRegistry`) and persisted in the database (`SystemPlugin` model / table).
- When altering activation state (`enabled` / `installed`), `PluginRegistry.updateStatus()` enforces database synchronization as the authoritative source of truth.
- If database persistence fails, in-memory state is rolled back to its previous status and the error is re-thrown. This prevents split-brain conditions where memory believes the plugin is active while the DB (shared across workers) has it disabled.
- Ephemeral UI progress tracking (`lastStep`) gracefully logs warnings without aborting execution.

## Route Injection

Plugins do not place files in the host's `app/` directory. Instead, they provide a `routeTree` (usually built by pointing `discoverRoutes` to the plugin's own internal `src/app` folder). The `VeapRouter` merges all plugin route trees at runtime.
