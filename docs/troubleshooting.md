# Troubleshooting

Errors grouped by the stage where they appear, with causes verified against the implementation.

## Boot and build

### `Context is not bound. PluginServiceProvider must boot before the plugins facades are used.`

A facade (`getPathPrefix`, plugin extensions, auth facades) ran while the container was not booted. The two real causes:

1. **During `next build`.** `NEXT_PHASE=phase-production-build` makes `Application.bootstrap()` exit immediately, so prerendering executes layouts without a live container. The root layout and catch-all page must keep `export const dynamic = "force-dynamic"`. Restoring it (or removing the page that force-prerenders) fixes the build. Full causal chain: framework decision record ADR-006.
2. **During runtime after a boot failure.** Scroll up: bootstrap crashed (usually the database) and the facades never bound. Fix the root error first.

### `Invalid environment variables`

The zod env schema rejected something. Most often `ENCRYPTION_KEY` is missing or does not decode to 16, 24 or 32 bytes. The error message includes the fix: `openssl rand -base64 16`.

## Database

### `Cannot open database because the directory does not exist`

The SQLite path's parent directory was unwritable or missing. The current resolver creates parent directories automatically; if you still see this, you are on an old build of `@veap/framework` or the path is on a read-only filesystem (serverless - use `/tmp`-backed PostgreSQL instead).

### `Failed to ensure migrations table` / migration failures at boot

`DATABASE_URL` points at an unreachable server, wrong credentials, or a read-only filesystem. Fix the connection string first; the migration runner retries on the next boot.

### `self-signed certificate in certificate chain` / `DEPTH_ZERO_SELF_SIGNED_CERT`

In production (`NODE_ENV=production`), Veap enables SSL certificate validation (`rejectUnauthorized: true`) by default for PostgreSQL connections. If your database provider (such as AWS RDS, Supabase, or a private cluster) uses a custom certificate authority, specify the CA path using `DATABASE_SSL_CA`:

```bash
DATABASE_SSL_CA=/path/to/server-ca.pem
```

For staging environments that lack valid certificate chains, you can explicitly disable certificate validation with `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.

### No database engine registered / `transaction()` throws

`DATABASE_URL` is unset. Add it to the environment; the provider registers no engine without it by design.

## Authentication and security

### `Too many sign-in attempts` / Rate limit error on login

`AuthService.signIn()` enforces brute-force protection: a maximum of 5 failed attempts per 15-minute window for any given IP address and email combination. Exceeding this threshold returns an error and rejects further sign-in attempts until the 15-minute window resets.

### Password reset session expired or locked

Password reset OTP codes expire after 15 minutes and allow up to 5 verification attempts. Submitting 5 invalid codes invalidates the reset session immediately to prevent online brute-force guessing. If a session is locked or expired, request a new password reset email.

### 403 Forbidden / Cross-origin request rejected

Protected endpoints using `verifySameOrigin(request)` compare the request `Origin` header against the expected `Host` and `X-Forwarded-Host`. Verify that your reverse proxy forwards headers correctly and that cross-origin scripts are not calling state-changing endpoints.

## Plugins and facades

### `Initialized with 0 plugins`

`lib/plugins.gen.ts` was regenerated with an empty list, or plugin registration was skipped. Re-run `veap register` (or re-add the plugin import in `lib/veap.ts`) and restart.
