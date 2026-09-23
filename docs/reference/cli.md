# CLI reference

The `veap` command-line interface provides scaffolding, plugin management,
database migration generation, and deployment utilities. It is distributed
with `@veap/framework` and runs via your package manager.

```bash
bun veap <command> [options]
# or
npx veap <command> [options]
# or
pnpm exec veap <command> [options]
```

## Global options

The CLI accepts the following global options:

| Flag            | Description                                      |
| --------------- | ------------------------------------------------ |
| `-h, --help`    | Display help for the CLI or a specific command.  |
| `-v, --version` | Output the current version of `@veap/framework`. |

## Architecture and command discovery

The Veap CLI operates in two modes depending on your current working directory:

- **Standalone mode (outside a project):** When run outside an existing Veap
  project, the CLI exposes the project creation command (`veap init`).
- **Project mode (inside a Veap project):** When `lib/veap.ts` exists in your
  project directory, the CLI automatically loads your environment files
  (`.env.local`, `.env`, and mode-specific files) into `process.env`. It then
  boots the application through `lib/veap.ts` and allows registered service
  providers to dynamically contribute commands during their `boot()` phase:
  - `MigrationServiceProvider` registers `make:migration`.
  - `PluginsServiceProvider` registers `add`, `register`, `eject`,
    `make:plugin`, `make:template`, and `docker`.
  - Custom host application providers can register domain-specific commands
    by resolving `CliService`.

## Commands

### `veap init [name]`

Initialize a new Veap project in an existing directory or create a new project
directory. If the project name is omitted in an interactive terminal, the CLI
prompts for a name and optional Docker configuration.

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
# Install from npm registry
bun veap add @veap/commentable

# Install from Git repository into local workspace
bun veap add https://github.com/user/my-veap-plugin.git --local
```

#### Options

| Option           | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `--local`        | Clone and install the plugin into the local `plugins/` directory.        |
| `--skip-install` | Add the dependency to `package.json` without executing the install step. |

Running `veap add` executes:

1. Package installation via the active package manager.
2. Discovery of the plugin manifest from the installed package `package.json`.
3. Automatic regeneration of `lib/plugins.gen.ts`.

---

### `veap eject <package>`

Eject an installed npm plugin or template into your project's local `plugins/`
or `templates/` folder, allowing you to modify and customize its source code
directly.

```bash
# Eject an installed plugin
bun veap eject @veap/commentable

# Eject an installed template
bun veap eject @veap/minimal-template
```

The CLI:

1. Detects whether the package is a plugin or template by inspecting `veap.type`
   in its `package.json`.
2. Clones the package repository into `plugins/<name>` or `templates/<name>`.
3. Updates root `package.json` dependencies to point to the local workspace
   (`workspace:*`).
4. Re-links workspace packages with the detected package manager.
5. Re-syncs `lib/plugins.gen.ts` when ejecting a plugin.

---

### `veap make:plugin <name>`

Scaffold a new, self-contained local plugin in the `plugins/` directory.

```bash
bun veap make:plugin blog
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
bun veap make:template modern-theme
```

#### Options

| Option           | Description                           |
| ---------------- | ------------------------------------- |
| `--skip-install` | Skip updating workspace dependencies. |

---

### `veap make:migration <name>`

Generate a timestamped native application migration file inside the
`migrations/` directory.

```bash
bun veap make:migration create_articles_table
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

Migrations are tracked in the database `migrations` table and executed during
application boot (`withDatabase()` and `withMigrations()`).

---

### `veap register`

Re-scan all local workspace plugins (`plugins/*`) and npm dependencies declaring
`veap` metadata in `package.json`, then regenerate `lib/plugins.gen.ts`.

```bash
bun veap register
```

Use this command when you manually clone plugins, remove packages, or update
workspace manifests without running `veap add` or `veap make:plugin`.

---

### `veap docker`

Generate production-ready Docker deployment files customized for your detected
package manager (`bun`, `pnpm`, `npm`, or `yarn`).

```bash
bun veap docker
```

#### Generated files

- `Dockerfile`: Multi-stage build leveraging Next.js standalone output.
- `compose.yml`: Local Docker Compose service configuration.
- `.dockerignore`: Exclusions for node_modules, build caches, and sensitive
  environment files.
