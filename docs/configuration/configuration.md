# Configuration

Veap reads configuration from two places: environment variables (validated by zod at boot) and `veap.config.ts` (application options, loaded lazily at runtime). This page documents every public option of both.

## veap.config.ts

Loaded from the project root (`veap.config.ts`, `veap.config.mjs` or `veap.config.js`), server only, jiti-based so TypeScript works without a build step. In production the result is cached in memory.

```ts
import type { VeapConfig } from "@veap/framework/core";

const config: VeapConfig = {
  privatePath: "/app",
  intl: {
    cookie: "VEAP_LOCALE",
    default: "en",
    locales: ["en", "pl"],
    timeZone: "Europe/Warsaw",
  },
  debug: false,
};

export default config;
```

Every option:

| Option          | Type       | Default                                                                                                                   | Description                                                                                                                          |
| --------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `privatePath`   | `string`   | `"/app"`                                                                                                                  | URL prefix for admin routes. Plugin `[prefix]` segments resolve to it; `getPathPrefix()` and the template/public-page logic read it. |
| `intl.cookie`   | `string`   | `"VEAP_LOCALE"`                                                                                                           | name of the cookie holding the user's locale                                                                                         |
| `intl.default`  | `string`   | `"en"`                                                                                                                    | fallback locale                                                                                                                      |
| `intl.locales`  | `string[]` | `["en", "de", "fr", "es", "it", "ja", "ko", "pt", "ru", "zh"]` per the core type comment; the intl constants use `["en"]` | supported locales (see note below)                                                                                                   |
| `intl.timeZone` | `string`   | `"UTC"`                                                                                                                   | default time zone for date and relative-time formatting                                                                              |
| `debug`         | `boolean`  | -                                                                                                                         | declared for application use; the framework's own debug logging is driven by `NODE_ENV`/`DEBUG` instead                              |

Note on `intl.locales`: the default in `domain/config` documents a broad list, while the intl module's own `DEFAULT_INTL_CONFIG` uses `["en"]`. Because the merge is `{ ...DEFAULT_CONFIG, ...loadedConfig }` per key, always set `locales` explicitly in your config; do not rely on either default.

If the file cannot be loaded, defaults apply with a warning; a broken config file never crashes the boot.

## Environment variables

Validated by `envSchema` (`ConfigService`) at first construction; a failing validation throws `Invalid environment variables` and stops the boot. Required: `ENCRYPTION_KEY` (see below). Everything else has defaults or is optional.

### Core

| Variable              | Type / default                                                   | Description                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | `"development" \| "production" \| "test"`, default `development` | standard                                                                                                                                                                              |
| `DATABASE_URL`        | URL, optional                                                    | connection string. `sqlite:`/`file:` prefixes or `.sqlite`/`.db` suffix select better-sqlite3; anything else selects PostgreSQL with automatic SSL in production                      |
| `ENCRYPTION_KEY`      | string, **required**                                             | base64 key decoding to exactly 16, 24 or 32 bytes (AES-128/192/256-GCM). Missing or wrong-length key fails the process immediately with a message including `openssl rand -base64 16` |
| `FILE_STORAGE_FOLDER` | default `"public/storage"`                                       | local storage provider folder                                                                                                                                                         |

### Mail

| Variable                                                | Description                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `MAIL_TRANSPORT`                                        | `smtp` (default), `console`, `custom`                              |
| `MAIL_SERVICE`                                          | Nodemailer service name, default `gmail`                           |
| `MAIL_USERNAME` / `MAIL_PASSWORD`                       | SMTP credentials                                                   |
| `MAIL_FROM_ADDRESS`                                     | default sender                                                     |
| `GOOGLE_SMTP_APP_USERNAME` / `GOOGLE_SMTP_APP_PASSWORD` | Google app password (takes precedence over MAIL_USERNAME/PASSWORD) |

### Intl

| Variable                                                                        | Description                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `VEAPCONFIG_INTL_COOKIE`, `VEAPCONFIG_INTL_DEFAULT`, `VEAPCONFIG_INTL_TIMEZONE` | override the corresponding `veap.config.ts` intl values |
| `NEXT_PUBLIC_INTL_TIMEZONE`, `NEXT_PUBLIC_TIMEZONE`, `TZ`                       | time zone fallback chain                                |

### Framework behavior

| Variable                                                 | Description                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `SKIP_VEAP_INIT`                                         | set `true` to skip `Application.bootstrap()` entirely (used by tooling)                |
| `NEXT_PHASE`, `NEXT_RUNTIME`                             | set by Next.js; `phase-production-build` makes bootstrap a no-op (do not set manually) |
| `VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`, `LAMBDA_TASK_ROOT` | serverless detection; SQLite redirects to `/tmp` with an ephemeral-data warning        |
| `DEBUG`                                                  | enables debug logging in production; `DEBUG=1` also unsilences CLI logs                |
| `VEAP_CLI`                                               | set by the CLI process itself; silences framework logs unless `DEBUG=1`                |

## Accessing config in code

```ts
import { app } from "@veap/framework/core/server";
import { ConfigService } from "@veap/framework/core/server";

// environment (validated, typed keys)
const config = await app(ConfigService);
const folder = config.get("FILE_STORAGE_FOLDER");

// veap.config.ts
import { getPathPrefix } from "@veap/framework/plugins/server";
const prefix = await getPathPrefix(); // privatePath

// or the port directly
const veapConfig = await app(IVeapConfigProvider); // via VEAP_CONFIG token
const cfg = await veapConfig.get();
```

## Next.js configuration

`next.config.ts` in generated projects transpiles the Veap workspace packages (`transpilePackages`) and keeps Turbopack settings. You otherwise configure Next.js as usual; Veap adds no custom `next.config` schema.
