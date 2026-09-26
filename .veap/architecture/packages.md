# Monorepo and Packages

Veap uses a monorepo structure managed by `bun workspaces`.

## Structure

- **`@veap/framework`** (`packages/veap`): The framework kernel. Exposes public APIs such as `@veap/framework/auth`, `@veap/framework/plugins`, `@veap/framework/database`, `@veap/framework/router` and `@veap/framework/settings`, plus the `veap` CLI binary.
- **`@veap/ui`** (`packages/ui`): Shared primitive UI components (Tailwind v4 + shadcn/ui) used by all plugins and templates.
- **`create-veap`** (`packages/create-veap`): The project initializer consumed by `veap init`.
- **`packages/veap-*`** (`veap-categorizable`, `veap-commentable`, `veap-taggable`, `veap-translatable`): Reusable trait packages (behavior add-ons for plugin models).
- **`@veap/[name]-plugin`** (`plugins/*`): Independent business plugins.
- **`@veap/[name]-template`** (`templates/*`): Visual themes.

## Dependency Management

Plugins declare their dependencies on other plugins inside their `package.json` under `veap.dependencies` or standard `dependencies`.

The `PluginRegistry` reads these dependencies, performs a topological sort (DAG) during bootstrap, and ensures that:

1. Circular dependencies are detected and prevented.
2. Migrations and lifecycle hooks (`onEnable`, `init`) run in the correct order.
