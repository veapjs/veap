# CLI Reference

The `veap` command-line interface provides scaffolding, plugin management, database migration generation, and deployment utilities. It is distributed with `@veap/core` and runs via your package manager's runner.

```bash
bunx veap <command> [options]
# or
pnpm exec veap <command> [options]
# or
npx veap <command> [options]
```

## Global options

| Flag            | Description                                     |
| --------------- | ----------------------------------------------- |
| `-h, --help`    | Display help for the CLI or a specific command. |
| `-v, --version` | Output the current version of `@veap/core`.     |

## Commands

### `veap init [name]`

Initialize a new Veap project in an existing directory or create a new project directory. If the project name is omitted in an interactive terminal, the CLI prompts for a name and optional Docker configuration.

```bash
veap init my-project
```

#### Options

| Option           | Description                                                                         |
| ---------------- | ----------------------------------------------------------------------------------- |
| `--docker`       | Generate Docker configuration (`Dockerfile`, `compose.yml`, `.dockerignore`).       |
| `--no-docker`    | Skip Docker configuration without prompting.                                        |
| `--skip-install` | Skip running the package manager installation step.                                 |
| `--pm <manager>` | Specify package manager (`bun`, `pnpm`, `npm`, `yarn`). Auto-detected when omitted. |

<!-- prettier-ignore -->
> [!NOTE]
> Project names must adhere to npm package naming conventions (lowercase, valid characters, no reserved names). Scoped names like `@my-org/my-app` are supported; the folder is created with the base name while `package.json` retains the full scoped name.

---

### `veap add <plugin>`

Install an official or third-party Veap plugin package and automatically register it in the application's plugin registry (`lib/plugins.gen.ts`).

```bash
# Install from npm registry
veap add @veap/commentable

# Install from Git repository into local workspace
veap add https://github.com/user/my-veap-plugin.git --local
```

#### Options

| Option           | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `--local`        | Clone and install the plugin into the local `plugins/` directory.        |
| `--skip-install` | Add the dependency to `package.json` without executing the install step. |

Running `veap add` executes:

1. Package installation via the active package manager.
2. Discovery of the plugin manifest from the installed package's `package.json`.
3. Automatic regeneration of `lib/plugins.gen.ts`.

---

### `veap eject <plugin>`

Eject an installed npm plugin into your project's local `plugins/` folder, allowing you to modify and customize its source code directly.

```bash
veap eject @veap/commentable
```

The CLI:

1. Copies the plugin source from `node_modules` into `plugins/<plugin-id>`.
2. Updates root `package.json` dependencies to point to the local package workspace.
3. Re-syncs `lib/plugins.gen.ts`.

---

### `veap make:plugin <name>`

Scaffold a new, self-contained local plugin in the `plugins/` directory.

```bash
veap make:plugin blog
```

#### Options

| Option           | Description                                           |
| ---------------- | ----------------------------------------------------- |
| `--skip-install` | Skip updating package manager workspace dependencies. |

#### Generated structure

```text
plugins/blog/
├── package.json         # Contains "veap" metadata block (id, name, type: "plugin")
├── tsconfig.json        # TypeScript project references
└── src/
    ├── index.ts         # IPlugin export definition
    └── app/
        └── page.tsx     # Starter page route
```

The new plugin is automatically registered in `lib/plugins.gen.ts`.

---

### `veap make:template <name>`

Scaffold a new layout and presentation template under `templates/<name>`.

```bash
veap make:template modern-theme
```

#### Options

| Option           | Description                           |
| ---------------- | ------------------------------------- |
| `--skip-install` | Skip updating workspace dependencies. |

---

### `veap make:migration <name>`

Generate a timestamped native application migration file inside the `migrations/` directory.

```bash
veap make:migration create_articles_table
```

#### Generated file format

```ts
// migrations/0002_create_articles_table.ts
import type { Knex } from "knex";

export const name = "0002_create_articles_table";

export async function up(db: Knex, schema: Knex.SchemaBuilder): Promise<void> {
  await schema.createTable("articles", (table) => {
    table.uuid("id").primary();
    table.string("title").notNullable();
    table.text("content").notNullable();
    table.timestamps(true, true);
  });
}

export async function down(
  db: Knex,
  schema: Knex.SchemaBuilder,
): Promise<void> {
  await schema.dropTableIfExists("articles");
}
```

Migrations are tracked in the database `migrations` table and executed during application boot (`withDatabase()` and `withMigrations()`).

---

### `veap register`

Re-scan all local workspace plugins (`plugins/*`) and npm dependencies declaring `veap` metadata in `package.json`, then regenerate `lib/plugins.gen.ts`.

```bash
veap register
```

Use this command when you manually clone plugins, remove packages, or update workspace manifests without running `veap add` or `veap make:plugin`.

---

### `veap docker`

Generate production-ready Docker deployment files customized for your detected package manager (`bun`, `pnpm`, `npm`, or `yarn`).

```bash
veap docker
```

#### Generated files

- `Dockerfile`: Multi-stage build leveraging Next.js standalone output.
- `compose.yml`: Local Docker Compose service configuration.
- `.dockerignore`: Exclusions for node_modules, build caches, and sensitive environment files.
