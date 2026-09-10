# Troubleshooting

Errors grouped by the stage where they appear, with causes verified against the implementation.

## Boot and build

### `Context is not bound. PluginServiceProvider must boot before the plugins facades are used.`

A facade (`getPathPrefix`, plugin templates, auth facades) ran while the container was not booted. The two real causes:

1. **During `next build`.** `NEXT_PHASE=phase-production-build` makes `Application.bootstrap()` exit immediately, so prerendering executes layouts without a live container. The root layout and catch-all page must keep `export const dynamic = "force-dynamic"`. Restoring it (or removing the page that force-prerenders) fixes the build. Full causal chain: framework decision record ADR-006.
2. **During runtime after a boot failure.** Scroll up: bootstrap crashed (usually the database) and the facades never bound. Fix the root error first.

### `Invalid environment variables`

The zod env schema rejected something. Most often `ENCRYPTION_KEY` is missing or does not decode to 16, 24 or 32 bytes. The error message includes the fix: `openssl rand -base64 16`.

## Database

### `Cannot open database because the directory does not exist`

The SQLite path's parent directory was unwritable or missing. The current resolver creates parent directories automatically; if you still see this, you are on an old build of `@veap/core` or the path is on a read-only filesystem (serverless - use `/tmp`-backed PostgreSQL instead).

### `Failed to ensure migrations table` / migration failures at boot

`DATABASE_URL` points at an unreachable server, wrong credentials, or a read-only filesystem. Fix the connection string first; the migration runner retries on the next boot.

### No database engine registered / `transaction()` throws

`DATABASE_URL` is unset. Add it to the environment; the provider registers no engine without it by design.

## Plugins and facades

### `Initialized with 0 plugins`

`lib/plugins.gen.ts` was regenerated with an empty list, or plugin registration was skipped. Re-run `veap register` (or re-add the plugin import in `lib/veap.ts`) and restart.

### Facade throws at build time only

See `Context is not bound` above - the build-phase contract. Facades are request-time APIs.

## Mail

### Mail does not arrive

`MAIL_TRANSPORT` defaults to `smtp` with `MAIL_SERVICE=gmail`; missing credentials fail silently in logs. For local work set `MAIL_TRANSPORT=console` to print messages instead of sending, and verify `MAIL_USERNAME`/`MAIL_PASSWORD` (or the `GOOGLE_SMTP_APP_*` overrides).

## Routing

### 404 for a plugin route

Check, in order: the plugin is in `plugins.gen.ts` and boots (`Initialized with N plugins`), the route file sits in the plugin's routes directory following [naming conventions](./routing/defining-routes.md), and no physical page in `app/` shadows the URL (physical pages win; the catch-all gets only unmatched paths).

### `app/page.tsx` conflicts with the catch-all

A physical `app/page.tsx` and the optional catch-all both claim `/`. Next.js rejects this at build. The scaffolder removes CNA's page before copying the overlay; if you added one manually, remove it or scope it under a different segment.

## Storage

### Files not served

The local provider serves `FILE_STORAGE_FOLDER` (default `public/storage`) through `/storage/[...path]`. If the built-in route was removed from `app/storage/`, restore it, or bind a custom `IStorageProvider`.

## Where to look next

- Boot logs (`[veap:bootstrap]`, `[veap:database]`, `[veap:plugins]`) print the failing stage.
- `DEBUG=1` (or `DEBUG=veap:*`) turns on debug logs in production.
- The force-dynamic and layering contracts are documented in the framework decision records (ADR documents kept in the Veap development repository).
