# @veap/database

## 0.1.10

### Patch Changes

- Fix JSON serialization in `serializeForStorage` to properly quote primitive strings (e.g. settings values) when targeting PostgreSQL JSON/JSONB columns.

## 0.1.9

### Patch Changes

- chore: bump version
- Updated dependencies []:
  - @veap/kernel@0.2.2

## 0.1.8

### Patch Changes

- Fix canonical logger token resolution in `@veap/database`:
  
  - **Logger Token**: Updated `DatabaseServiceProvider` to resolve logger via the canonical `LOGGER` token from `@veap/kernel` rather than raw symbol strings.
- Updated dependencies [`a7f6a1f`]:
  - @veap/kernel@0.2.1

## 0.1.7

### Patch Changes

- Updated dependencies []:
  - @veap/kernel@0.2.0

## 0.1.6

### Patch Changes

- Updated dependencies []:
  - @veap/kernel@0.1.6

## 0.1.5

### Patch Changes

- fix: update versions and dependencies
- Updated dependencies []:
  - @veap/kernel@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies []:
  - @veap/kernel@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies []:
  - @veap/kernel@0.1.3

## 0.1.2

### Patch Changes

- Register the full migration cycle with the `veap` console, and stop migrating the database behind a command's back.

  - `MigrationServiceProvider.commands()` contributes `make:migration`, `migrate`, `migrate:status` and `migrate:rollback`, so a host application that calls `.withMigrations(appMigrations)` gets the whole cycle.
  - `migrate` and `migrate:rollback` go through the console's confirmation gate: silent outside production, a `confirm()` in production, `--force` for an unattended run and `--no-interaction` resolving the prompt to "no" instead of hanging.
  - `make:migration {name} {--dir=path}` writes the migration into the project the console runs in, rejects a name that is not a plain identifier, refuses to overwrite an existing file, and regenerates the directory's `index.ts` for both `export default { … }` and named `up`/`down` modules — so hand-written migrations survive a regeneration.
  - `migrate:status {--scope=app}` compares the migrations the application registered with the rows recorded for the scope, and warns about recorded rows the application no longer declares.
  - `runMigrations()` returns `{ scope, ran, batch }` and `rollbackMigrations()` returns `{ scope, rolledBack }`, so the commands report what actually happened rather than a status derived from nothing.
  - `rollbackMigrations()` undoes a batch in the reverse of the applied order (`batch desc`, then `executed_at desc`), which is what the code always claimed to do.
  - `MigrationServiceProvider.boot()` skips its automatic migration under the console (`VEAP_CLI=1`): `veap list` must not touch the database, and applying migrations belongs to `veap migrate`.
- Updated dependencies []:
  - @veap/kernel@0.1.2

## 0.1.1

### Patch Changes

- Fix native Node.js ESM module resolution, global scopes in bulk updates, auto-increment primary keys, define DATABASE and APP_MIGRATIONS tokens, augment ApplicationBuilder with withMigrations, and add comprehensive ORM test coverage:

  - Define and export `DATABASE` (`Token<Knex>`) and `APP_MIGRATIONS` (`Token<any[]>`) IoC tokens within `@veap/database` (`src/tokens.ts`, `src/index.ts`), decoupling them from `@veap/kernel`.
  - Augment `ApplicationBuilder` from `@veap/kernel` via TypeScript Module Augmentation with `.withMigrations(migrations: any[])` and configure `MigrationsConfigProvider` and `MigrationServiceProvider`.
  - Update `MigrationServiceProvider` to register and resolve `APP_MIGRATIONS`.
  - Fix missing `.js` extensions across all relative module imports/exports in `dist/` ensuring full compliance with native Node.js ESM loaders (`ERR_MODULE_NOT_FOUND` resolution).
  - Add explicit subpath exports (`./migrations`, `./relations`) in `package.json`.
  - Fix `ModelQueryBuilder.update()` to apply `applyGlobalScopes()`, preventing unintentional updates to soft-deleted records or records outside multi-tenant global scopes.
  - Add support for auto-increment integer primary keys in `Model.prototype.save()` via `.returning(pk)`.
  - Prevent double JSON stringification in `casts.ts` when attributes are already formatted as JSON strings.
  - Align `ModelQueryBuilder.paginate()` with `PaginationResult` contract by returning both `page` and `currentPage`.
  - Enable transparent Knex QueryBuilder method delegation (`groupBy`, `having`, `distinct`, etc.) through `ModelQueryBuilder` proxy.
  - Scope PostgreSQL advisory transaction locks strictly to PostgreSQL clients, avoiding SQL syntax errors on SQLite and MySQL.
  - Implement `DatabaseServiceProvider.shutdown()` to properly destroy Knex connection pools on application/test teardown.
  - Automatically wire `EventDispatcher` and `LOGGER` in `DatabaseServiceProvider.boot()` when available in IoC container.
  - Add comprehensive test suites covering relations, eager loading, soft deletes, query builder delegation, safe casts, auto-increment keys, factories, and seeders (increasing test count from 34 to 48 passing tests).
- Updated dependencies []:
  - @veap/kernel@0.1.1

## 0.1.0

### Minor Changes

- Initial public scaffold of the Veap database.
