# Production

This page covers building and running a Veap application in production: the build command, required environment, deployment targets and what changes at runtime.

## Build and start

Veap does not wrap the Next.js CLI. Production is standard Next.js:

```bash
next build
next start
```

In the generated project the scripts are already wired:

```bash
bun run build   # next build (app), builds the veap workspace first in the monorepo
bun run start   # next start
```

During `next build`, `Application.bootstrap()` detects `NEXT_PHASE=phase-production-build` and exits immediately. Prerendered pages therefore cannot use plugin facades; pages that touch the container must be dynamic. The scaffolder sets `export const dynamic = "force-dynamic"` on the root layout and the catch-all page. Removing it fails the build with `Context is not bound. PluginServiceProvider must boot before the plugins facades are used.`

## Environment variables

Required in production:

| Variable         | Notes                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL recommended. SQLite works but the file must live on persistent storage (not `/tmp` on serverless). |
| `ENCRYPTION_KEY` | base64 of 16, 24 or 32 bytes. Rotating it invalidates existing encrypted values.                              |

Typical mail setup: `MAIL_TRANSPORT=smtp`, `MAIL_SERVICE`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`.

The full list with behavior notes is in [Environment variables](../configuration/environment-variables.md).

## Deployment targets

### Vercel

- Deploy the Next.js app; set `DATABASE_URL`, `ENCRYPTION_KEY` and mail variables in project environment variables.
- The framework detects `VERCEL=1` and adjusts: SQLite files are redirected to `/tmp` with a warning that they are ephemeral - use PostgreSQL (or a hosted SQLite with persistence) for real data.
- Plugin facades are unavailable during build; the catch-all page and root layout stay dynamic. Static assets under `public/` are unaffected.

### Docker

`veap docker` scaffolds a Dockerfile matched to your package manager (see `applyDockerfileForPackageManager`). The image runs `next build` and `next start` inside the container; mount a volume for the SQLite file if you use one, or point `DATABASE_URL` at an external database.

### Node server

`next start` on any Node 22+ host behind a reverse proxy. Set `NODE_ENV=production`; SSL for PostgreSQL is enabled automatically in production when the driver supports it.

## Runtime behavior to expect

- **One container per process.** Next.js may run multiple workers; each boots its own Veap container on first request. There is no cross-process state besides the database and storage.
- **Logging.** Framework logs use scoped names (`veap:bootstrap`, `veap:database`, `veap:plugins`, ...). Debug logs appear when `DEBUG` is set; otherwise production logs are quiet.
- **Errors.** Thrown `AppError`s map to HTTP codes (`AppError.NotFound` to 404, `AppError.Unauthorized` to 401, ...). Unexpected errors render the app error boundary (`app/error.tsx`); missing routes render `app/not-found.tsx`.
- **Migrations.** They run when `MigrationServiceProvider` boots (part of `withDatabase()`), using the migration sources passed to `withMigrations()`. Ensure the database user can create tables at boot time, or run migrations in a release step instead.
- **File storage.** The local provider writes to `FILE_STORAGE_FOLDER` (default `public/storage`) and serves files from `/storage/[...path]`. On read-only filesystems (serverless), bind a different `IStorageProvider` or use object storage.

## Pre-deploy checklist

1. `ENCRYPTION_KEY` set and stable across deploys.
2. `DATABASE_URL` reachable; migrations strategy decided (boot-time or release step).
3. `next build` passes without `Context is not bound` (means the force-dynamic contract is intact).
4. Mail transport configured and testable (`MAIL_TRANSPORT=console` in staging first).
5. `public/` assets and any persistent storage volume accounted for.
