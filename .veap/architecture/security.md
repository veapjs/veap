# Security & RBAC (Role-Based Access Control)

Veap uses a strict, session-based authentication model powered by `@veap/framework/auth`.

## Route Protection

Since Veap routes are dynamic (injected via `routeTree`), protection can happen at multiple levels:

1. **Middleware Level**: Virtual router route middlewares (`EnsuredAuth`, `EnsuredUser`, `EnsuredGuest`). Routes declaring `auth = true`, `roles`, or `permissions` automatically receive `EnsuredAuth`. Unauthenticated visitors are redirected to the configured login path (`getAuthRoutes().signIn`, default `/signin`).
2. **Path-Aware Security Checks**: Security requirements and `checkSecurity(session, user, roles, permissions, fallbackRedirect, path)` are path-aware. Passing `x-pathname` allows registered security requirements (e.g. 2FA, onboarding) to inspect the URL and exempt their own pages from redirects.
3. **Gate Plugins & `SkipSecurity`**: Gate pages (e.g. `/2fa/setup`, `/onboarding`) must export the `SkipSecurity` middleware (from `@veap/framework/router`) paired with `EnsuredUser`. This suppresses the automatic injection of `EnsuredAuth` on the route, preventing infinite redirect loops while still ensuring the user is authenticated.
4. **Component Level**: Inside a plugin's page or layout component, retrieve the session and enforce security requirements with `checkSecurity` (from `@veap/framework/auth/server`); it returns a redirect target when roles/permissions are not satisfied.

## Server Action Protection

Every Server Action that modifies data must manually verify the user's session and permissions before proceeding. Do not assume that because the UI button was hidden, the Server Action is secure.

```typescript
import { getCurrentSession, hasPermission } from "@veap/framework/auth/server";

export async function deletePostAction(postId: string) {
  const { user } = await getCurrentSession();
  if (!user) {
    return { error: "Unauthorized" };
  }

  if (!hasPermission(user, "posts:delete")) {
    return { error: "Forbidden" };
  }

  // Proceed with deletion...
}
```

## Security Best Practices

- Never leak full User objects (which may include password hashes or salts) to the client components. Always pick only safe fields (id, name, email, avatar).
- Ensure all plugin interactions with the database are scoped to the authenticated user (e.g., `where('user_id', session.user.id)`).

## Encryption at Rest (ENCRYPTION_KEY)

Sensitive values (recovery codes, TOTP secrets) are encrypted with AES-GCM by `infrastructure/auth/utils/encryption` (exposed through the `ISecretCipher` port).

**Configuration contract (fail-fast, enforced at boot):**

- `ENCRYPTION_KEY` is **required - there is no default.** The application throws a readable startup error when it is missing.
- The value must be base64 and **decode to exactly 16, 24 or 32 bytes** (AES-128/192/256). A wrong length fails at module load, never as a cryptic `Invalid key length` on first encryption.
- Generate a key with: `openssl rand -base64 16`

This contract is pinned by unit tests (`tests/infrastructure/auth/encryption-key-validation.test.ts`).

## Password Hashing & Cryptography Configuration

User passwords are hashed using bcrypt via `BcryptPasswordHasher` (implementing `IPasswordHasher`).

**Configurable parameters:**
- `AUTH_BCRYPT_ROUNDS`: Number of salt rounds (default: `10`). Can be increased in production (e.g., `12`) via environment variables or DI configuration for higher computational cost, or decreased in automated test suites for faster test runs.
- `AUTH_PASSWORD_MIN_LENGTH`: Enforces minimum password character length upon validation (default: `8`).

## Database Transport Security (PostgreSQL TLS)

In production (`NODE_ENV=production`), PostgreSQL connections enforce TLS certificate validation (`rejectUnauthorized: true`).
- Opt-out via `DATABASE_SSL_REJECT_UNAUTHORIZED=false` or URL params (`?sslmode=no-verify`).
- Custom PEM certificates can be provided via `DATABASE_SSL_CA`.

## Login Brute-Force & Timing Attack Protection

`AuthService.signIn()` enforces defense-in-depth protections against credential stuffing and brute-force attacks:
- **Throttling:** Tracks failed login attempts per normalized email and per client IP (maximum 5 failed attempts in a 15-minute sliding window). Exceeding this limit temporarily blocks login requests.
- **Timing attack mitigation:** If an email is not registered in the database, `signIn()` executes a dummy bcrypt hash verification against a standard work-factor hash. This equalizes response latencies and eliminates timing-based user enumeration.

## Password Reset OTP & Account Enumeration Defense

The password reset and email verification subsystems enforce strict guessing and enumeration limits:
- **TTL:** OTP verification codes expire after **15 minutes** (reduced from 1 hour).
- **Attempt throttling:** Each reset session allows at most 5 failed verification attempts. Upon the 5th failure, the reset session is permanently deleted from the database and the cookie is cleared.
- **Uniform UX / Dummy sessions:** `createDummyPasswordResetSession` produces an ephemeral session when an unregistered email requests a reset. The user interface redirects identically to `/reset-password/verify-email`, preventing attackers from determining whether an email exists in the system.

## 2FA Challenge Token Architecture

When a user with two-factor authentication enabled submits correct primary credentials (password), `AuthService.signIn()` issues `status: "CHALLENGE_REQUIRED"`.
- An encrypted, 5-minute `httpOnly` cookie (`totp_login_challenge`) is issued containing the user ID and timestamp.
- The 2FA verification route (`/api/auth/totp/2fa-verify`) requires this cookie before accepting a 6-digit TOTP code. Calling the endpoint without passing primary credentials returns `401 Unauthorized`.
- Failed attempts are capped at 5; exceeding the limit destroys the challenge token, preventing brute-force attacks against 6-digit OTP codes.

## File Storage Security & Stored XSS Prevention

`LocalFileProvider` implements defensive file upload controls:
- **Disallowed extensions:** Blocks dangerous executable and web-interpretable extensions (`.html`, `.htm`, `.xhtml`, `.svg`, `.xml`, `.php`, `.phtml`, `.exe`, `.sh`, `.js`, etc.) from being written into public storage, eliminating Stored XSS vectors.
- **Filename sanitization:** Strips directory traversal sequences (`..`), null bytes (`\0`), and special characters from uploaded file basenames.
- **Path containment in delete():** Checks that target deletion paths stay strictly within `FILE_STORAGE_FOLDER` via normalized `path.relative` checks to block arbitrary file deletion.

## CSRF & Same-Origin Enforcement

State-changing HTTP requests (`POST`, `PUT`, `DELETE`, `PATCH`) in API route handlers can be validated with `verifySameOrigin(request)`:
- Checks `Sec-Fetch-Site` header (rejects `cross-site`).
- Verifies that the `Origin` header matches the `Host` or `X-Forwarded-Host` header.
- Safe read-only methods (`GET`, `HEAD`, `OPTIONS`) always pass.

## Trusted Proxy & IP Header Validation

`SessionService.getIPAddress()` securely resolves client IP addresses:
- Prioritizes direct reverse-proxy headers (`cf-connecting-ip`, `x-real-ip`, `x-client-ip`).
- Parses comma-separated `x-forwarded-for` header values and validates each entry against `node:net.isIP()`. Malformed or injection payloads are ignored, returning strictly a valid IP address or `null`.
