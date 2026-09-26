# Database and ORM

Veap uses **Knex.js** with a custom ActiveRecord-like implementation (Eloquent ORM).

## Connection and Ownership

- The Kernel initializes Knex based on the `DATABASE_URL` environment variable.
- Knex instance is globally available via `getKnex()`.
- **Data Ownership:** Each plugin owns its database tables. A plugin defines its models and migrations. Other plugins must use the owner plugin's exported Services/Models instead of writing raw SQL to foreign tables.
- **Native App Migrations:** The physical Next.js application can define its own migrations in the `/migrations` folder. These are executed before plugin migrations via `.withMigrations(appMigrations)` on the `ApplicationBuilder` in `lib/veap.ts`.

## Transactions

Veap uses `AsyncLocalStorage` to manage transactions implicitly, avoiding the need to pass `trx` objects through every function layer.

```typescript
import { transaction } from "@veap/framework/database";

await transaction(async () => {
  // All Model queries inside this block automatically use the transaction
  await User.create({...});
  await Profile.create({...});
});
```

## SQLite URL forms and directory handling

`DATABASE_URL` accepts all common SQLite forms: `sqlite:./storage/veap.sqlite`, `sqlite://./storage/veap.sqlite`, `file:...`, `file://...` and bare filenames. The resolver (`resolveSqliteFilename`) strips every prefix variant and **creates the parent directory when it does not exist**, because better-sqlite3 refuses to create directories itself (a fresh clone of a generated project has no `storage/` dir, since it is git-ignored). `:memory:` is passed through untouched. Relative paths resolve against the process working directory.

## Serverless SQLite Warning

If `DATABASE_URL` points to a local SQLite file but runs on Vercel/Serverless (where the filesystem is read-only), the database is silently redirected to `/tmp/`. This makes data ephemeral. For production, a PostgreSQL database is required.
