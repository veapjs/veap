# Authentication walkthrough

A practical end-to-end pass over auth in a Veap app: sign-up, sign-in, guarding pages, and recovery flows. The API details live in the [auth chapter](../auth/index.md); this guide ties them into pages and forms.

## Enable auth

The generated composition root already includes auth:

```ts
Application.configure()
  .withDatabase()
  .withAuth() // users, sessions, RBAC, verification, reset
  .create();
```

Auth needs the database: the provider registers the user/session/role models' migrations through the migration system.

## Sign-up and sign-in (Server Actions)

Framework Server Actions are exported from `@veap/core/auth/server`:

```tsx
"use server";

import { loginAction, registerAction } from "@veap/core/auth/server";
// call these directly from forms, or wrap them:
```

A minimal sign-in page:

```tsx
// app or plugin page
import { loginAction } from "@veap/core/auth/server";

export default function LoginPage() {
  return (
    <form action={loginAction}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">Sign in</button>
    </form>
  );
}
```

Under the hood: zod validation schemas from `@veap/core/auth` validate credentials, `AuthService` verifies the password hash through the `PASSWORD_HASHER` port, `SessionService` creates a session and sets an httpOnly cookie through `COOKIE_STORE`.

## Reading the current user

In Server Components and actions:

```tsx
import { getCurrentUser, requireUser } from "@veap/core/auth/server";

export default async function ProfilePage() {
  const user = await getCurrentUser(); // AuthUser | null
  if (!user) {
    // render a guest view or redirect
  }
  return <p>Signed in as {user.email}</p>;
}
```

For pages that must not render for guests at all:

```tsx
const user = await requireUser(); // throws AppError.Unauthorized
```

In client components:

```tsx
"use client";

import { useUser } from "@veap/core/react";

export function UserBadge() {
  const user = useUser();
  if (!user) return null;
  return <span>{user.email}</span>;
}
```

`useUser()` reads from `AuthProvider`, which the root provider tree (`AppProvider`) hydrates with the server session.

## Guarding routes

Two layers are available:

1. **Route middlewares** in the Veap pipeline - `EnsuredAuth`, `EnsuredGuest`, `EnsuredUser` from `@veap/core/router/server`. Attach them to plugin routes; they run before the page renders and redirect or reject early.
2. **Facades in the page/action** - `requireUser()`, `requireRole("admin")`, `requirePermission("posts.edit")`. Throwing `AppError.Forbidden` renders the error boundary with the mapped status.

Prefer middlewares for coarse area guards and facades for fine-grained checks inside the handler.

## Roles and permissions

```ts
import {
  hasRole,
  hasPermission,
  assignRole,
  revokeRole,
} from "@veap/core/auth/server";

// grant
await assignRole(userId, "editor");

// check in an action
if (!(await hasPermission(userId, "posts.publish"))) {
  throw AppError.Forbidden();
}
```

Roles and permissions are stored through `RbacService`; the full API, Server Action protection patterns, API route middlewares, and the event flow (`system:auth:*`) are in [RBAC](../auth/rbac.md).

## Email verification and password reset

Both flows are facade-driven and mail-backed:

```ts
import {
  sendVerificationEmail,
  verifyEmail,
  sendPasswordResetEmail,
  resetPassword,
} from "@veap/core/auth/server";
```

- `sendVerificationEmail(email)` creates a token and sends the message through the configured mail transport (`MAIL_TRANSPORT=console` prints it locally instead of sending).
- `verifyEmail(email, code)` confirms the address.
- `sendPasswordResetEmail(email)` + `resetPassword(token, newPassword)` complete recovery.
- Messages are built by the auth mailables and sent through the `IMailer` port; see [Email and reset](../auth/email-and-reset.md).

## Sign-out

```ts
import { logoutAction } from "@veap/core/auth/server";
// or the facade:
import { logout } from "@veap/core/auth/server";
```

`logout()` destroys the session row and clears the cookie through the port.

## Extending

- Swap `PASSWORD_HASHER` to change hashing (see [Custom providers](../advanced/custom-providers.md)).
- Add profile fields by extending the user model and repository bindings (see [Extending auth](../auth/extensibility.md)).
- React to registrations with `eventBus.subscribe("system:auth:user-registered", ...)`.
