# Migrations

Migrations are versioned schema changes tracked in a `migrations` table. Veap runs them automatically at boot, scoped: `core` migrations ship with the framework, `app` migrations come from your application, and each plugin runs its own.

## Anatomy of a migration

```ts
import type { Schema } from "@veap/framework/database";

export default {
  name: "20260916000000_create_projects_table",
  async up(db: any, schema: Schema) {
    await schema.createTable("projects", (table) => {
      table.uuid("id").primaryKey();
      table.text("name").notNull();
      table
        .text("owner_id")
        .notNull()
        .references("id", "users")
        .onDelete("CASCADE");
      table.jsonb("settings");
      table.timestamps();
    });
  },
  async down(db: any, schema: Schema) {
    await schema.dropTableIfExists("projects");
  },
};
```

- `name` must be unique within its scope; the convention is a timestamp prefix (the CLI generates one).
- `up(db, schema)` applies the change. `db` is a transaction-bound adapter: callable as `db("table")` (Knex builder), with `db.raw(sql)` and `db.execute(query)` helpers.
- `down` reverses it. Migrations without `down` are skipped during rollback and removed from tracking.

## The Schema builder

`schema` exposes a dialect-aware builder (SQLite, PostgreSQL, MySQL type mapping handled internally):

```ts
schema.createTable(name, (table) => { ... });
schema.table(name, (table) => { ... });     // ALTER TABLE ADD COLUMN (idempotent)
schema.hasTable(name);
schema.hasColumn(table, column);
schema.dropTable(name);
schema.dropTableIfExists(name);
schema.createEnum(name, values);            // Postgres only (no-op on SQLite)
schema.dropEnum(name);
schema.raw(sql);
```

Column helpers on the blueprint: `id()`, `uuid()`, `increments()`, `text()`, `varchar(name, length)`, `integer()`, `smallint()`, `bigint()`, `boolean()`, `timestamp()`, `timestamptz()`, `date()`, `json()`, `jsonb()`, `bytea()`/`blob()`, `decimal()`, `float()`, `double()`, `custom(type, name)`, plus `timestamps()`, `softDeletes()`, and the column chainers `notNull()`, `primaryKey()`, `unique()`, `default(value)`, `defaultNow()`, `references(table, column)` with `onDelete`/`onUpdate`. Composite keys and uniques: `table.primary([...])`, `table.unique([...])`.

## Creating migrations

App migrations:

```bash
bun veap make:migration create_projects_table
```

This creates `migrations/<timestamp>_create_projects_table.ts` and regenerates `migrations/index.ts` exporting `appMigrations`. The array is passed to the application builder:

```ts
Application.configure().withDatabase().withMigrations(appMigrations);
// ...
```

Plugin migrations live in the plugin (`plugins/<name>-plugin/src/migrations/`) and are declared on the plugin object:

```ts
const myPlugin: IPlugin = {
  manifest,
  migrations: myMigrations,
  // ...
};
```

## When they run

| Trigger                                            | What runs                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Application boot (first request or CLI boot)       | `MigrationServiceProvider.boot()` runs `core` scope, then `app` scope |
| Plugin initialization (enabled, not yet installed) | plugin migrations in the plugin's scope                               |
| Toggling a plugin on                               | pending plugin migrations run before `onEnable`                       |
| Toggling a plugin off                              | plugin migrations roll back (`down`) before disabling dependents      |

Execution semantics:

- Pending migrations (not yet recorded for the scope) run in array order, each recorded with a batch number.
- The whole batch runs inside one transaction; a failing migration rolls back the batch.
- A Postgres advisory lock prevents concurrent runners from racing.
- Rollback (`rollbackMigrations`) reverts executed migrations in reverse order per scope.

## CLI summary

| Command                      | Effect                                                    |
| ---------------------------- | --------------------------------------------------------- |
| `veap make:migration <name>` | generate an app migration + refresh `migrations/index.ts` |
| `veap make:plugin <name>`    | scaffold a plugin (empty migrations folder)               |
| `veap add <plugin>`          | install a plugin package and register it                  |

There is no separate `veap migrate` command; migrations run on boot by design, which keeps serverless deployments and Docker containers self-migrating.
