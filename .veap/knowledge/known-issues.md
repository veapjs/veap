# Known Issues & Inconsistencies

## Serverless SQLite Redirect

When `DATABASE_URL` uses SQLite in a Vercel/Serverless environment, the filesystem is read-only. The database initializer silently catches this and redirects the SQLite file to the `/tmp/` directory to prevent crashing.
**Impact**: The database becomes completely ephemeral across cold starts. A PostgreSQL instance is required for production deployments.

## "Modules" vs "Plugins" Terminology

The core framework architecture uses the concept of a `PluginRegistry`. However, UI elements (like the Manager plugin) and some compatibility wrappers (like `getModule()`) refer to them as "Modules". They are technically the exact same entity (`IPlugin`).

## Fixed: 13-byte ENCRYPTION_KEY fallback

**Resolved.** Both the `utils/encryption` fallback (`bXlfc2VjdXJlX2tleQ==`, decoded to 13 bytes while AES-128 requires 16) and its duplicate default in `envSchema` were removed. Every `encryptString` on a deployment without `ENCRYPTION_KEY` set crashed with `RangeError: Invalid key length` (recovery codes, TOTP).

**Impact of the fix:** no data migration is needed - data "protected" by the broken fallback never encrypted successfully, and deployments that had a valid key keep working unchanged. Deployments relying on the fallback now fail fast at boot with a readable error (see _Encryption at Rest_ in `architecture/security.md`).
