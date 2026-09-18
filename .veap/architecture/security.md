# Security & RBAC (Role-Based Access Control)

Veap uses a strict, session-based authentication model powered by `@veap/core/auth`.

## Route Protection

Since Veap routes are dynamic (injected via `routeTree`), protection can happen at multiple levels:

1. **Middleware Level**: Global middleware can block paths based on URL prefixes (e.g., `veap.config.ts` → `privatePath`, default `/app`).
2. **Component Level**: Inside a plugin's page component, retrieve the session and enforce security requirements with `checkSecurity` (from `@veap/core/auth/server`); it returns a redirect target when roles/permissions are not satisfied.

## Server Action Protection

Every Server Action that modifies data must manually verify the user's session and permissions before proceeding. Do not assume that because the UI button was hidden, the Server Action is secure.

```typescript
import { getCurrentSession, hasPermission } from "@veap/core/auth/server";

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
