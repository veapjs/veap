# ADR-003: AsyncLocalStorage for Database Transactions

## Status

Accepted

## Context

In Node.js, managing database transactions usually requires passing a `trx` (transaction object) explicitly through every layer of the application (Controller -> Service -> Repository -> Model). This litters the function signatures and breaks standard interfaces.

## Decision

Use Node.js `AsyncLocalStorage` to store the active transaction context. The `@veap/core/database` module exports a `transaction(async () => { ... })` wrapper. Any Knex query executed within this block will automatically use the active transaction.

## Consequences

**Positive:**

- Clean function signatures. Code doesn't need to know if it's running inside a transaction.
- Prevents accidental partial commits if an error is thrown deep in the stack.

**Negative:**

- Implicit state "magic" can confuse new developers.
- Requires careful handling in deeply nested async operations or when intentionally breaking out of the transaction scope.
