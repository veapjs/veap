# Environment variables

Veap applications inherit two environments: the Node.js process environment (`.env`, `.env.local`, `.env.production`) read by Next.js, and the validated schema inside `ConfigService`. This page lists every variable the framework reads and what happens when it is missing.

## Required

### ENCRYPTION_KEY

```bash
# .env.local
ENCRYPTION_KEY=<base64 of 16, 24 or 32 bytes>
```

- Used for AES-GCM secret encryption (session tokens at rest, plugin settings).
- Validated by zod. Missing, undecodable, or wrong-length keys stop the process at boot with an error that prints the fix (`openssl rand -base64 16`).
- Generate one per environment. Rotating it invalidates existing encrypted values.

## Database

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
# or
DATABASE_URL="sqlite:./storage/veap.sqlite"
```

- Prefixes `sqlite:`, `sqlite://`, `file:`, `file://`, or a `.sqlite`/`.db` suffix select better-sqlite3; the parent directory is created automatically. `:memory:` works everywhere except serverless.
- On Vercel/Lambda the filesystem is read-only outside `/tmp`, so SQLite files are redirected to `/tmp/<basename>` with a warning that the data is ephemeral. Use PostgreSQL for serverless production.
- PostgreSQL connections enable SSL automatically when `NODE_ENV=production`.
- If `DATABASE_URL` is unset the database provider registers no engine and `transaction()` fails at call time.

## Mail

| Variable                                                | Notes                                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `MAIL_TRANSPORT`                                        | `smtp` (default) or `console`. `custom` is a token slot for your own `IMailer` provider. |
| `MAIL_SERVICE`                                          | Nodemailer service preset, default `gmail`                                               |
| `MAIL_USERNAME` / `MAIL_PASSWORD`                       | SMTP login                                                                               |
| `MAIL_FROM_ADDRESS`                                     | fallback `from` for outgoing mail                                                        |
| `GOOGLE_SMTP_APP_USERNAME` / `GOOGLE_SMTP_APP_PASSWORD` | override MAIL_USERNAME/MAIL_PASSWORD                                                     |

Console transport prints the composed message to the logger; it is the default choice for local development and tests.

## Intl

| Variable                                                  | Notes                                         |
| --------------------------------------------------------- | --------------------------------------------- |
| `VEAPCONFIG_INTL_COOKIE`                                  | overrides `intl.cookie` from `veap.config.ts` |
| `VEAPCONFIG_INTL_DEFAULT`                                 | overrides `intl.default`                      |
| `VEAPCONFIG_INTL_TIMEZONE`                                | overrides `intl.timeZone`                     |
| `NEXT_PUBLIC_INTL_TIMEZONE`, `NEXT_PUBLIC_TIMEZONE`, `TZ` | client-side time zone fallback                |

## Framework switches

| Variable                               | Effect                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKIP_VEAP_INIT=true`                  | `Application.bootstrap()` returns immediately; for scripts and tooling that import app code without a runtime                                                 |
| `NEXT_PHASE=phase-production-build`    | set by `next build`; bootstrap skips plugin boot so prerendering does not need a live container (see the force-dynamic contract below and in Troubleshooting) |
| `VERCEL=1`, `AWS_LAMBDA_FUNCTION_NAME` | serverless detection: SQLite redirect, storage warnings                                                                                                       |
| `DEBUG`                                | production debug logging; `DEBUG=1` unsilences CLI output                                                                                                     |
| `VEAP_CLI`                             | set by the Veap CLI; framework logs stay quiet unless DEBUG is set                                                                                            |

## File storage

| Variable              | Notes                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `FILE_STORAGE_FOLDER` | root folder of the local storage provider, default `public/storage`. Served by the built-in `/storage/[...path]` route. |

## Never commit real values

`.env` files with real credentials must stay out of version control. The scaffolder adds `.env*` to `.gitignore` and generates a random `ENCRYPTION_KEY` into `.env.local` at project creation.
