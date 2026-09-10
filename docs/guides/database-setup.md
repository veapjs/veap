# Database setup

How to choose an engine, configure the connection, and run migrations in development and production.

## Engines

The database provider reads `DATABASE_URL` and selects a driver:

| URL form                                                                                  | Driver                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `postgresql://user:pass@host:5432/db`                                                     | PostgreSQL (`pg`), SSL auto-enabled in production |
| `sqlite:./storage/veap.sqlite`, `sqlite://...`, `file:...`, or any `.sqlite`/`.db` suffix | better-sqlite3                                    |
| `:memory:`                                                                                | in-memory SQLite (development/tests only)         |

Notes:

- SQLite parent directories are created automatically; the file path is resolved from all four URL forms above.
- On serverless (Vercel, Lambda) SQLite paths are redirected to `/tmp` and the data does not survive cold starts. Use PostgreSQL for serverless production.
- Omitting `DATABASE_URL` registers no engine; the first `transaction()` or model query fails at call time.

## First run

```bash
# .env.local
DATABASE_URL="postgresql://veap:secret@localhost:5432/myapp"
```

The framework auto-initializes Knex at boot when `DATABASE_URL` is present:

```text
[veap:database] Auto-initializing Knex from DATABASE_URL with client: pg
[veap:database] Knex database instance registered.
```

Migration sources come from `withMigrations()` in the composition root (generated projects pass the app's migrations plus every plugin's). `MigrationServiceProvider` runs pending migrations during boot, so a fresh database is usable on first start.

## Migration workflow

```bash
veap make:migration create_products_table
```

Edit the generated file (`up` creates, `down` reverts), then restart the dev server - boot applies it. For production, either let boot run migrations (default) or run them in a release step and keep the boot-time pass as a no-op.

Schema patterns used across the framework:

```ts
await knex.schema.createTable("products", (table) => {
  table.increments("id").primary();
  table.string("name").notNullable();
  table.integer("price_cents").notNullable().defaultTo(0);
  table.integer("owner_id").unsigned().index();
  table.timestamps(true, true);
});
```

Polymorphic relations need two columns (see the ORM chapter):

```ts
table.integer("commentable_id").unsigned().notNullable();
table.string("commentable_type").notNullable();
```

and a `MorphMap` entry mapping the type alias to a model.

## Multiple environments

Keep one database per environment and one `ENCRYPTION_KEY` per environment:

- `.env.local` for development (never committed),
- platform environment variables for staging/production.

Because the encryption key encrypts secrets at rest (session tokens, plugin settings), changing it invalidates existing values; plan rotation with a re-encryption step if you need one.

## Verifying the setup

```ts
import { app } from "@veap/core/core/server";
import { Knex } from "@veap/core/database";

const knex = await app(Knex);
await knex.raw("select 1");
```

A successful `select 1` in a script (with `SKIP_VEAP_INIT` unset so providers boot) confirms connectivity. The failure modes are listed in [Troubleshooting](../troubleshooting.md).
