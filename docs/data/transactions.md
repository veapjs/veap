# Transactions

Veap's transaction helper uses Node's `AsyncLocalStorage`, so the active transaction follows your async call chain automatically. You never pass a transaction object through your code.

## Basic usage

```ts
import { transaction } from "@veap/framework/database";
import { User } from "@veap/framework/auth/models";

await transaction(async () => {
  const user = await User.create({ email, name });
  await Session.create({ userId: user.id, expiresAt });
  // committed together; rolled back if anything throws
});
```

Inside the callback, `getKnex()` (used by every model query, the schema builder and repositories) returns the active transaction instead of the pool. That is the entire mechanism: all ORM and repository calls in the async context join the transaction without any parameter threading.

## Nesting

Nested `transaction()` calls reuse the outer transaction instead of creating savepoints:

```ts
await transaction(async () => {
  await transferFunds();
  await transaction(async () => {
    await auditLog(); // same trx as above
  });
});
```

If the inner callback throws, the exception propagates and the outer transaction rolls back as usual.

## Accessing the transaction object

The callback receives the Knex transaction for raw statements:

```ts
await transaction(async (trx) => {
  await trx.raw("UPDATE counters SET value = value + 1 WHERE key = ?", [
    "posts",
  ]);
  await Post.create({ title: "Hello" }); // joins trx via AsyncLocalStorage
});
```

`getActiveTransaction()` (from `@veap/framework/database`) returns the current transaction or `undefined` for inspection in library code.

## Rules and pitfalls

- **Do not hold the transaction across unrelated requests or long-running work.** Keep callbacks short; no `await fetch()` to third parties inside.
- **Mixing engines breaks isolation.** Code that resolves `"Knex"` from the container directly and calls `knex.transaction(...)` manually bypasses `AsyncLocalStorage`; models would then run outside that transaction. Always use the `transaction()` helper for ORM work.
- **Migrations run in their own transaction.** The migration runner wraps each batch in a transaction; you cannot wrap `runMigrations` in your own.
- **SQLite caveats.** better-sqlite3 serializes writes; long transactions block other writers. PostgreSQL is the recommended production engine for write-heavy workloads.

## Where the framework itself uses transactions

- The migration runner: each migration batch is atomic, with `pg_advisory_xact_lock` for Postgres.
- Plugin enabling/disabling: migrations for the plugin run in the registry's toggle flow.
- Auth services create users and related records in transactions via repositories.

A practical rule that falls out of this document: treat `transaction()` as the only write path for multi-step operations, and single-statement `create`/`save` calls as already atomic.
