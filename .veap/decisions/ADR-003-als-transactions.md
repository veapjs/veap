# ADR-003: AsyncLocalStorage for Database Transactions

## Status

Accepted

## Context

In Node.js, managing database transactions usually requires passing a `trx` (transaction object) explicitly through every layer of the application (Controller -> Service -> Repository -> Model). This litters the function signatures and breaks standard interfaces.

## Decision

Use Node.js `AsyncLocalStorage` to store the active transaction context. The `@veap/framework/database` module exports a `transaction(async () => { ... }, options?)` wrapper. Any Knex query executed within this block will automatically use the active transaction.

- **Propagation:** By default (`Propagation: REQUIRED`), nested calls detect the active transaction in ALS and reuse it. An error inside the nested callback causes the entire outer transaction to roll back.
- **Savepoints:** Callers requiring isolated partial rollbacks can specify `{ savepoint: true }`. When called inside an existing transaction, a SQL `SAVEPOINT` is allocated via `trx.transaction(...)`. A caught failure inside this block rolls back only to the savepoint without aborting the outer transaction.

## Consequences

**Positive:**

- Clean function signatures. Code doesn't need to know if it's running inside a transaction.
- Prevents accidental partial commits if an error is thrown deep in the stack.
- Flexible nesting semantics: default shared transaction for atomic compound operations, with opt-in savepoints for recoverable steps.

**Negative:**

- Implicit state "magic" can confuse new developers.
- Requires careful handling in deeply nested async operations or when intentionally breaking out of the transaction scope.
