# Sessions

Veap sessions are server-side records with an opaque token in a cookie named `session`.

## Token lifecycle

1. `generateSessionToken()` returns a random lowercase base32 token (Oslo adapter).
2. `createSession(token, userId, flags)` hashes the token (SHA-256 via `hashToken`) and stores the record with a 30-day expiry; returns the `Session`.
3. `setSessionTokenCookie(token, expiresAt)` writes the raw token to the cookie with matching expiry.
4. On each request, `getCurrentSession()` reads the cookie, hashes the value and looks the session up with its user. Expired sessions are removed and treated as anonymous.

```ts
import {
  generateSessionToken,
  createSession,
  setSessionTokenCookie,
} from "@veap/framework/auth/server";

const token = await generateSessionToken();
const session = await createSession(token, userId, {});
await setSessionTokenCookie(token, session.expiresAt);
```

You rarely do this by hand; `signIn`, `signUp`, `finalizeLogin` (and the Google/passkey flows) do exactly this sequence.

## Session record shape

```ts
interface Session {
  id: string;
  userId?: string;
  expiresAt: Date;
  metadata?: Record<string, any> | null; // SessionFlags live here
  // snake_case aliases accepted on read
}
```

`SessionFlags` is an open record stored in `metadata`. `updateSessionMetadata(flags)` merges the current session's metadata; 2FA plugins use it to mark verified state (which the security requirement layer then checks).

## Listing and revoking sessions

```ts
import {
  getUserSessions,
  invalidateSession,
  invalidateOtherSessions,
} from "@veap/framework/auth/server";

const sessions = await getUserSessions(userId, currentSessionId);
// UserSession: { id, createdAt, expiresAt, isCurrent }

await invalidateSession(sessionId); // one device
await invalidateOtherSessions(userId, current); // sign out everywhere else
await invalidateUserSessions(userId); // sign out everywhere (used after password reset)
```

Sign-out (`signOut()`) invalidates the current session and deletes the cookie, then publishes `system:auth:signed-out`.

## Cookies behind the port

Session services never import `next/headers` directly; they use the `ICookieStore` port (`COOKIE_STORE` token), whose default adapter wraps Next.js `cookies()`. If you host Veap outside Next.js you can rebind the port; in Next.js applications this is transparent.

## Properties and limits

- Sessions are per server process for augmentation purposes: `validateSessionToken` runs augmenters each time, so plugin-added user/session data stays fresh.
- There is no refresh-token mechanism; expiry is fixed at creation (30 days).
- Session fixation: because the token is regenerated on every login flow, reuse of old tokens is impossible after re-authentication.
