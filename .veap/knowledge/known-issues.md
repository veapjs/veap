# Known Issues & Inconsistencies

## Serverless SQLite Redirect

When `DATABASE_URL` uses SQLite in a Vercel/Serverless environment, the filesystem is read-only. The database initializer silently catches this and redirects the SQLite file to the `/tmp/` directory to prevent crashing.
**Impact**: The database becomes completely ephemeral across cold starts. A PostgreSQL instance is required for production deployments.

## "Modules" vs "Plugins" Terminology

The core framework architecture uses the concept of a `PluginRegistry`. However, UI elements (like the Manager plugin) and some compatibility wrappers (like `getModule()`) refer to them as "Modules". They are technically the exact same entity (`IPlugin`).

## Fixed: 13-byte ENCRYPTION_KEY fallback

**Resolved.** Both the `utils/encryption` fallback (`bXlfc2VjdXJlX2tleQ==`, decoded to 13 bytes while AES-128 requires 16) and its duplicate default in `envSchema` were removed. Every `encryptString` on a deployment without `ENCRYPTION_KEY` set crashed with `RangeError: Invalid key length` (recovery codes, TOTP).

**Impact of the fix:** no data migration is needed - data "protected" by the broken fallback never encrypted successfully, and deployments that had a valid key keep working unchanged. Deployments relying on the fallback now fail fast at boot with a readable error (see _Encryption at Rest_ in `architecture/security.md`).

## Fixed: Swallowed errors during Application.bootstrap()

**Resolved.** Previously, `Application.bootstrap()` caught errors during provider registration/booting, logged a warning, but continued execution. This caused silent initialization failures and left applications in an unstable half-booted state.

**Impact of the fix:** Bootstrap now logs critical errors and re-throws them immediately, preserving Next.js control flow exceptions (`NEXT_REDIRECT`, `NEXT_NOT_FOUND`). The bootstrapping promise is reset upon failure so subsequent requests can attempt self-healing recovery.

## Fixed: PostgreSQL TLS certificate verification in production

**Resolved.** Production PostgreSQL connections previously defaulted to `rejectUnauthorized: false` when TLS was active, disabling server certificate verification.

**Impact of the fix:** TLS connections now enforce `rejectUnauthorized: true` by default in production. Environments requiring self-signed certificates can opt out via `DATABASE_SSL_REJECT_UNAUTHORIZED=false` or URL parameters (`?sslmode=no-verify`), or supply custom CA bundles via `DATABASE_SSL_CA`.

## Fixed: PluginRegistry split-brain on database write failure

**Resolved.** In `PluginRegistry.updateStatus()`, database persistence failures during status updates were logged as warnings without rolling back in-memory status.

**Impact of the fix:** State transitions (`enabled`/`installed`) now roll back in-memory state and re-throw when DB persistence fails, guaranteeing consistency between runtime memory and shared database state across worker processes.

## Fixed: Installer takeover after initial setup (VULN-01)

**Resolved.** `installer-plugin` Server Actions (`finishInstallation`, `runSystemMigrations`, `checkDbConnection`, `getAvailableModules`) did not check whether the system was already installed.

**Impact of the fix:** All installer actions now assert `!await isSystemInstalled()`, returning an error or throwing immediately if called after initial installation.

## Fixed: Missing authorization in plugin Server Actions (VULN-02)

**Resolved.** Server Actions in `rbac-plugin`, `manager-plugin`, `panel-plugin`, and `blog-plugin` previously assumed middleware protection, allowing unauthenticated callers to invoke actions via direct POST requests.

**Impact of the fix:** All sensitive Server Actions now verify caller authentication and require appropriate administrative roles (`admin`) or specific permissions (`system:rbac`, `system:plugins`).

## Fixed: TOTP 2FA bypass and brute-force (VULN-03)

**Resolved.** The `/api/auth/totp/2fa-verify` route accepted `userId` and `code` without validating that password verification had occurred, and had no rate limiting on OTP attempts.

**Impact of the fix:** Primary authentication now issues a 5-minute encrypted challenge token (`totp_login_challenge`), verified by the 2FA route with a maximum of 5 attempts before challenge destruction.

## Fixed: Media deletion IDOR (VULN-04)

**Resolved.** `DELETE /api/media/delete` allowed any authenticated user to delete media items belonging to other users.

**Impact of the fix:** Deletions now verify resource ownership (`authorId === session.user.id`) or require the `admin` role or `media:delete` permission.

## Fixed: File upload Stored XSS and Path Traversal (VULN-05)

**Resolved.** `LocalFileProvider` permitted arbitrary file extensions (including `.html`, `.svg`, `.php`) into public storage and lacked strict relative path containment in `delete()`.

**Impact of the fix:** Dangerous extensions are blocked at upload time, filenames are sanitized, and deletions enforce strict directory boundaries.

## Fixed: OTP brute-force and user enumeration (SEC-01 & VULN-06)

**Resolved.** Password reset OTP codes had a 1-hour expiration with no attempt limits, and `/forgot-password` returned different responses for existing vs non-existent emails.

**Impact of the fix:** OTP TTL reduced to 15 minutes, failed verification attempts are capped at 5 before session cancellation, and dummy reset sessions provide identical UX regardless of account existence.

## Fixed: Login brute-force and timing attacks (SEC-02)

**Resolved.** `AuthService.signIn()` lacked throttling, and non-existent emails returned immediately without executing password verification.

**Impact of the fix:** IP- and email-based rate limiting (5 attempts per 15 min) plus dummy bcrypt hashing on unknown accounts equalizes latency and blocks brute-force attacks.
