---
title: "Database Connection"
description: "Knex query engine integration, SQLite and PostgreSQL drivers, and scoped connection management."
status: "Stable"
category: "Data & ORM"
author: "Veap Core Team"
lastUpdated: "2026-03"
---

# Database overview

Veap uses Knex as the query engine, with two client targets: `better-sqlite3` for SQLite and `pg` for PostgreSQL. On top of Knex it provides an ActiveRecord-style ORM (the `Model` class), a schema builder for migrations, and a scoped transaction mechanism.

## Connecting

`DatabaseServiceProvider` (registered by `.withDatabase()`) creates the Knex instance from `DATABASE_URL` at boot:

- URLs starting with `sqlite:` / `file:` or ending in `.sqlite` / `.db` select `better-sqlite3`. All prefix forms (`sqlite:./storage/veap.sqlite`, `sqlite://...`, `file:...`) are understood, and the parent directory is created automatically.
- Anything else selects `pg`, with SSL enabled automatically in production (unless the URL contains `sslmode=disable`).

<!-- prettier-ignore -->
> [!NOTE]
> On serverless platforms (Vercel, AWS Lambda) where `/var/task` is read-only, Veap automatically detects the environment and redirects relative SQLite database files to `/tmp`. Because `/tmp` is ephemeral and cleared between function cold starts, persistent production deployments must use a PostgreSQL `DATABASE_URL`.

The instance is registered in the container under the token `DATABASE` (and string token `"Knex"`) and also set as the global instance used by the ORM.

```env
# development
DATABASE_URL="sqlite:./storage/veap.sqlite"

# production
DATABASE_URL="postgresql://user:pass@host:5432/veap?sslmode=require"
```

You can also initialize a connection manually with `initDatabase({ client, connection })` from `@veap/framework/database`, which accepts driver shortcuts (`"postgres" | "sqlite" | "mysql"`). Note that `mysql` support in `initDatabase` maps to `mysql2`, but migrations and tests target SQLite and PostgreSQL.

## The three layers

| Layer                  | Import                                                                  | Use for                                                                        |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [ORM models](./orm.md) | `Model`, `User`, ... from `@veap/framework/database` and model packages | 95% of data access; ActiveRecord API with relations, casts, scopes, and traits |
| Query builder          | `Model.query()` returns `ModelQueryBuilder` (Knex underneath)           | everything the static helpers do not cover; `toKnex()` for raw escape hatch    |
| Raw access             | `dbClient("users").where(...)`, `dbClient.raw(sql)`                     | migrations, exotic queries                                                     |

## Transactions

All writes that must be atomic go through `transaction()`, which uses `AsyncLocalStorage` so any ORM call made inside the callback automatically joins the active transaction, including nested `transaction()` calls:

```ts
import { transaction } from "@veap/framework/database";

await transaction(async (trx) => {
  const user = await User.create({ email, name });
  await Profile.create({ userId: user.id });
  // any model query in this async context uses trx automatically
});
```

Details and pitfalls in [Transactions](./transactions.md).

## Migrations

Migrations are plain objects `{ name, up(db, schema), down? }`, tracked per scope (`core`, `app`, or a plugin id) in a `migrations` table, executed in a transaction with a Postgres advisory lock. The CLI generates files and the runner executes them at boot; see [Migrations](./migrations.md).

## Where data lives

- Core owns `users`, `sessions`, `roles`, `permissions`, pivots, `password_reset_sessions`, `email_verification_sessions`, `plugins`, `templates`, `settings`, `user_widgets`.
- Plugins own their own tables (created by their migrations) and their own models.
- Models for core entities are exported from the models entries: `@veap/framework/auth/models` (`User`, `Session`, `Role`, `Permission`, `PasswordResetSession`, `EmailVerification`), `@veap/framework/plugins/models` (`SystemPlugin`, `SystemUserWidget`), `@veap/framework/settings/models` (`Setting`).
