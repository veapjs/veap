# CLI Reference

The `@veap/framework` CLI provides tools for project initialization, plugin
management, database migrations, and Docker configurations.

## Overview

The CLI entry point is available as `veap` when installed globally or via package
runners:

```bash
# Using bun
bun veap <command>

# Using npx
npx veap <command>
```

When creating a new project from scratch, use the `create-veap` initializer:

```bash
bun create veap [name]
# or
pnpm create veap [name]
```

## Architecture

The CLI is built with `cac` and extensible through service providers:

- Commands are registered in the IoC container via `CliService`.
- Core service providers register framework commands during bootstrap:
  - `MigrationServiceProvider` registers `make:migration`.
  - `PluginsServiceProvider` registers `add`, `register`, `eject`,
    `make:plugin`, and `docker`.
  - Custom host application providers can register domain-specific commands
    by resolving `CliService`.

## Commands

### `veap init [name]`

Initialize a new Veap project in an existing directory or create a new project
directory. If you omit the project name in an interactive terminal, the CLI
prompts for a name. During setup, the scaffolder asks whether you want to include
Docker configuration unless the `--docker` or `--no-docker` flag is provided.
The active package manager is auto-detected from the execution environment.

```bash
bun veap init my-project
```

#### Options

| Option           | Description                                                                         |
| ---------------- | ----------------------------------------------------------------------------------- |
| `--docker`       | Generate Docker configuration (`Dockerfile`, `compose.yml`, `.dockerignore`).       |
| `--no-docker`    | Skip Docker configuration without prompting.                                        |
| `--skip-install` | Skip running the package manager installation step.                                 |
| `--pm <manager>` | Specify package manager (`bun`, `pnpm`, `npm`, `yarn`). Auto-detected when omitted. |
| `--pnpm`         | Force pnpm as package manager.                                                      |
| `--bun`          | Force Bun as package manager.                                                       |
| `--npm`          | Force npm as package manager.                                                       |
| `--yarn`         | Force Yarn as package manager.                                                      |

<!-- prettier-ignore -->
> [!NOTE]
> Project names must adhere to npm package naming conventions (lowercase, valid
> characters, no reserved names). Scoped names like `@my-org/my-app` are
> supported; the folder is created with the base name while `package.json`
> retains the full scoped name.

---

### `veap add <plugin>`

Install an official or third-party Veap plugin package and automatically
register it in the application plugin registry (`lib/plugins.gen.ts`).

```bash
bun veap add @veap/blog-plugin
```

This command performs two actions:

1. Runs your package manager to install the dependency (`bun add <plugin>`,
   `pnpm add <plugin>`, etc.).
2. Executes `veap register` to update `lib/plugins.gen.ts`.

---

### `veap register`

Scan `node_modules` and local workspace packages (`plugins/*`) for installed Veap
plugins and regenerate `lib/plugins.gen.ts`.

```bash
bun veap register
```

Plugins are detected by checking `package.json` for:

- `"veap": { "type": "plugin" }` configuration metadata.
- Or package names matching the `@veap/*-plugin` or `*-veap-plugin` naming
  convention.

---

### `veap eject <package>`

Extract an installed plugin or template from `node_modules` into your local
project tree for customization.

```bash
# Eject a plugin into local plugins/ directory
bun veap eject @veap/blog-plugin

# Eject into a custom target folder
bun veap eject @veap/blog-plugin --path ./custom-plugins/blog
```

When ejecting:

- The package source is copied to `plugins/<name>` (or the specified `--path`).
- Root `package.json` dependencies are updated to point to the local workspace
  reference (for example, `"@veap/blog-plugin": "workspace:*"`).
- `veap register` runs automatically to update registry imports.

---

### `veap make:plugin <name>`

Scaffold a new local plugin inside the `plugins/` directory.

```bash
bun veap make:plugin notifications
```

Creates a plugin workspace directory containing:

- `package.json` with Veap plugin manifest metadata.
- `tsconfig.json` with path mappings.
- `src/index.ts` with a starter `PluginDefinition` and `ServiceProvider`.

After creation, register the plugin by adding it to your root dependencies and
running `veap register`.

---

### `veap make:template <name>`

Scaffold a new layout template inside `templates/<name>`.

```bash
bun veap make:template marketing-layout
```

Creates a template component directory for customizable presentation shells.

---

### `veap make:migration <name>`

Create a new Knex timestamped database migration file in `migrations/`.

```bash
bun veap make:migration create_posts_table
```

Generated file: `migrations/YYYYMMDDHHMMSS_create_posts_table.ts`

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("posts", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.string("title").notNullable();
    table.text("content");
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("posts");
}
```

Migrations are executed automatically on application bootstrap via
`MigrationServiceProvider`.

---

### `veap docker`

Generate production Docker deployment files for your Veap application.

```bash
bun veap docker
```

Generates:

- `Dockerfile`: Multi-stage build tailored to the detected package manager
  (Node.js 22 alpine base, standalone Next.js output).
- `compose.yml`: Local multi-container development configuration.
- `.dockerignore`: Exclusions for node_modules, build caches, and sensitive
  files.
