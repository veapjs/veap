# Coding Conventions

## Isolation

- A plugin should NEVER directly write to the database tables of another plugin using raw SQL.
- A plugin should NEVER import internal files from another plugin's `src/` directory. Only import from the public `exports` defined in `package.json`.

## Terminology

- **Module** and **Plugin** are synonymous in the Veap ecosystem. Prefer "Plugin" when referring to the technical package and "Module" when exposing UI to the user (e.g. in the dashboard).

## Transactions

- Do not manually pass `trx` (Knex transaction) variables between functions.
- Wrap operations in `@veap/framework/database`'s `transaction` function, which automatically manages the transaction context using Node's `AsyncLocalStorage`.

## Layered Architecture (`packages/veap/src`)

- New core code belongs in `domain/`, `application/`, `infrastructure/` or `presentation/`, exposed through the barrels in `src/entries/` (or `src/index.ts` / `src/server.ts`). Never resurrect a `src/modules` or `src/core` folder.
- Imports point inward only: `presentation → infrastructure → application → domain`. The domain layer must not import from any other layer.
- Application services never import ORM models or call `app()`; they depend on domain ports (repositories) injected via `@Inject(TOKEN)`. `app()` is acceptable only in the composition root, `src/entries/*` and server actions (`presentation/*/actions/*`).
- Facades read a composition-bound typed context (`authContext()`, `pluginsContext()`) instead of resolving services ad hoc - see ADR-006.
