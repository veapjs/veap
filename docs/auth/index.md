# Authentication

Veap ships a complete session-based authentication system in `@veap/core`. It covers sign-in/sign-up, sessions with server-side validation, email verification, password reset with recovery codes, RBAC (roles and permissions), and extension points that 2FA plugins use.

## Mental model

- **Identity**: `users`, `roles`, `permissions` tables with pivot tables `users_to_roles`, `users_to_permissions`, `roles_to_permissions`.
- **Sessions**: opaque random tokens (Oslo base32) stored server-side; the raw token lives in a `session` cookie, the database stores its SHA-256-style hash. Validation hashes the cookie value and looks it up, checking expiry.
- **Facades**: server-action wrappers over six application services (`AuthService`, `SessionService`, `UserService`, `RbacService`, `PasswordResetService`, `EmailVerificationService`), bound in `AuthServiceProvider` and exposed from `@veap/core/auth/server`.
- **Crypto ports**: password hashing (`IPasswordHasher`, bcrypt adapter), token generation (`ITokenGenerator`, Oslo adapter) and secret-at-rest encryption (`ISecretCipher`, AES-GCM adapter with `ENCRYPTION_KEY`) are injectable ports.

## Where things live

| Concern                          | API (all server-side unless noted)                                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current session                  | `getCurrentSession()`                                                                                                                                                               |
| Login / signup / logout          | `signIn`, `signUp`, `signOut`, `finalizeLogin`                                                                                                                                      |
| Session management               | `generateSessionToken`, `createSession`, `invalidateSession`, `invalidateUserSessions`, `getUserSessions`, `invalidateOtherSessions`, `updateSessionMetadata`                       |
| Cookie helpers                   | `setSessionTokenCookie`, `deleteSessionTokenCookie`                                                                                                                                 |
| Users                            | `createUser`, `createOAuthUser`, `getUserById`, `getUserFromEmail`, `updateUserPassword`, `updateUserName`, `updateUserAwatar` (sic, kept for compatibility), recovery code helpers |
| Email verification               | `initEmailVerification`, `createEmailVerificationRequest`, `sendVerificationEmail`, `getUserEmailVerificationRequestFromRequest`, cookie helpers                                    |
| Password reset                   | `createPasswordResetSession`, `validatePasswordResetSessionToken`, `getCurrentPasswordResetSession`, `sendPasswordResetEmail`, cookie helpers                                       |
| RBAC                             | `getRoles`, `createRole`, `getPermissions`, `createPermission`, `assignPermissionToRole`, `assignRoleToUser`, ...                                                                   |
| Security checks                  | `checkSecurity(session, user, roles, permissions)`                                                                                                                                  |
| Validation schemas (client-safe) | `loginSchema`, `registerSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `verifyEmailSchema`, ...                                                                            |
| Types (client-safe)              | `User`, `Session`, `AuthSession`, `FullUser`, `AuthResponse`                                                                                                                        |

All of these come from `@veap/core/auth/server` unless marked client-safe (schemas and types also from `@veap/core/auth`).

## Reading the current session

```tsx
// Server Component
import { getCurrentSession } from "@veap/core/auth/server";

export default async function Header() {
  const { user, session } = await getCurrentSession();
  if (!user) return <a href="/signin">Sign in</a>;
  return <p>Signed in as {user.name}</p>;
}
```

`getCurrentSession()` is React-cached: one lookup per request no matter how many components call it. The returned `user` is a `FullUser`: the base record plus `roles`, `permissions` and any data added by registered augmenters. Sensitive fields (`password`, recovery code) are stripped before serialization.

## Signing in and out

Use the built-in actions from a client component:

```tsx
"use client";

import { signIn } from "@veap/core/auth/server";
import { loginSchema, type LoginInput } from "@veap/core/auth";

export function SignInForm() {
  async function onSubmit(formData: FormData) {
    const input = {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    } satisfies LoginInput;

    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) return;

    const result = await signIn(parsed.data);
    if (result.success) {
      // result.data: AuthResponse
      // status SUCCESS -> session established; CHALLENGE_REQUIRED -> 2FA flow
    }
  }

  return (
    <form action={onSubmit}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">Sign in</button>
    </form>
  );
}
```

`AuthResponse` is a discriminated union: `SUCCESS` (with session and user), `CHALLENGE_REQUIRED` (2FA plugins intercept here and redirect into their own flow), or `ERROR` (message). Signing out is `signOut()`.

## Auth events

Authentication publishes on the event bus: `system:auth:login`, `system:auth:signup`, `system:auth:session-created`, `system:auth:signed-out`, plus verification/reset events. Payloads carry the `Session` and `User`. Subscribe in a plugin's `init()`.

## In-depth pages

- [Sessions](./sessions.md): token lifecycle, cookies, device/session management.
- [Users and passwords](./users.md): creating users, OAuth users, password updates, recovery codes.
- [RBAC](./rbac.md): roles, permissions, checks in routes and code.
- [Extending auth](./extensibility.md): validators, security requirements, augmenters, 2FA integration points.
- [Email verification and password reset](./email-and-reset.md): the verification and reset flows end to end.
