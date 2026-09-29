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

### Transaction Propagation and Savepoints

1. **Default Propagation (`REQUIRED`)**:
   By default, calling `transaction()` inside an existing transaction callback detects the active transaction via `AsyncLocalStorage` and reuses it without creating a new database transaction.
   - If an inner call fails and throws, the entire outer transaction is marked for rollback.
   - The inner callback receives the existing `Knex.Transaction` instance.

2. **Isolated Nested Transactions (`Savepoints`)**:
   If you need partial rollback semantics (e.g. attempting an operation that might fail, catching the error, and continuing the rest of the outer transaction), specify `{ savepoint: true }`:

```typescript
await transaction(async () => {
  await Order.create({ id: 1 });

  try {
    await transaction(async () => {
      await Payment.charge(); // might fail
    }, { savepoint: true });
  } catch (error) {
    // Only Payment changes rolled back to the savepoint!
    // Order creation is preserved.
    await Order.update({ status: 'failed_payment' });
  }
});
```

When `{ savepoint: true }` is enabled:
- If called inside an existing transaction, a SQL `SAVEPOINT` is allocated using Knex's `trx.transaction()`.
- If an error is thrown within the savepoint callback, Knex executes `ROLLBACK TO SAVEPOINT`, keeping the outer transaction intact and allowing the outer code to catch and handle the error.
- If called when no transaction is currently active, a standard root database transaction is created.

## SQLite URL forms and directory handling

`DATABASE_URL` accepts all common SQLite forms: `sqlite:./storage/veap.sqlite`, `sqlite://./storage/veap.sqlite`, `file:...`, `file://...` and bare filenames. The resolver (`resolveSqliteFilename`) strips every prefix variant and **creates the parent directory when it does not exist**, because better-sqlite3 refuses to create directories itself (a fresh clone of a generated project has no `storage/` dir, since it is git-ignored). `:memory:` is passed through untouched. Relative paths resolve against the process working directory.

## Serverless SQLite Warning

If `DATABASE_URL` points to a local SQLite file but runs on Vercel/Serverless (where the filesystem is read-only), the database is silently redirected to `/tmp/`. This makes data ephemeral. For production, a PostgreSQL database is required.

## PostgreSQL TLS / SSL Configuration

In production (`NODE_ENV=production`), PostgreSQL connections enable TLS with certificate verification by default (`rejectUnauthorized: true`), protecting against MITM attacks.

Configuration options:
- **Disabling certificate verification (legacy/self-signed)**: Set `DATABASE_SSL_REJECT_UNAUTHORIZED=false` in `.env`, or append `?sslmode=no-verify` or `?rejectUnauthorized=false` to `DATABASE_URL`.
- **Custom CA Certificate**: Set `DATABASE_SSL_CA` in `.env` to a PEM certificate string.
- **Disabling SSL**: Append `?sslmode=disable` to `DATABASE_URL`.
- **Development SSL**: Append `?sslmode=require` or `?ssl=true` to `DATABASE_URL` to enable TLS during local development.
