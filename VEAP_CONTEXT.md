# Veap Core Context

`@veap/core` is the unified application framework foundation of the Veap ecosystem, built on Next.js 16, React 19, and TypeScript.

## Core principles

- **Clean Architecture layers**: organized strictly into `domain` → `application` → `infrastructure` → `presentation` (see [ADR-006](.veap/decisions/ADR-006-clean-architecture-layers.md)).
- **Relative imports within package**: internal source files use relative imports (`../..`), never self-referencing `@veap/core/...` package imports.
- **Explicit public exports**: public APIs are exported strictly through entry point barrels under `src/entries/*` and mapped in `package.json`.
- **Inversion of Control (IoC)**: Laravel-style dependency injection container with typed tokens (`Token<T>`) and Service Providers (`KernelServiceProvider`, `DatabaseServiceProvider`, etc.).
- **AsyncLocalStorage Transactions**: atomic database writes wrap Knex queries inside `transaction(async (trx) => { ... })` via Node's `AsyncLocalStorage`.
- **Fail-fast security**: `ENCRYPTION_KEY` validation on startup requiring 16, 24, or 32 bytes (AES-128/192/256-GCM).
- **Virtual Router**: catch-all routes (`app/[[...catchAll]]` and `app/api/[...catchAll]`) dispatching to plugin-defined route trees and middlewares.
- **Event-driven communication**: typed `EventBus` with schema validation for system events (`system:start`, `system:auth:*`, etc.).

## Source of truth

1. **Source code**: `src/` is the ultimate source of truth.
2. **Architecture specifications**: `.veap/architecture/` (internal technical memory).
3. **Architecture Decision Records**: `.veap/decisions/` (`ADR-001` to `ADR-006`).
4. **Public documentation**: `docs/` (user and developer-facing documentation).
5. **Test suite**: `tests/` (verifies architectural contracts and regressions).

## Development rules

- **No Parallel Abstractions**: Always extend existing contracts and primitives (`EventBus`, `ExtensionPoint`, `transaction`, `app()`) rather than inventing duplicate mechanisms.
- **Preserve Layering**: Domain must never depend on application, infrastructure, or presentation.
- **Maintain Test Coverage**: Every architectural addition or bugfix must be accompanied by unit/integration tests in `tests/`.
