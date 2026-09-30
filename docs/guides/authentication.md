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

Auth needs the database: the provider registers the user/session/role models'
migrations through the migration system.

### Customizing authentication routes

By default, authentication endpoints use canonical paths (`/signin`, `/signup`,
`/forgot-password`, `/reset-password`, `/verify-email`, `/app`). You can customize
any of these routes directly in `withAuth()`:

```ts
Application.configure()
  .withDatabase()
  .withAuth({
    routes: {
      signIn: "/logowanie",
      signUp: "/rejestracja",
      forgotPassword: "/odzyskaj-haslo",
      resetPassword: "/nowe-haslo",
      verifyEmail: "/weryfikacja-email",
      afterLogin: "/app/dashboard",
      afterLogout: "/logowanie",
    },
  })
  .create();
```

When you define custom paths, the Virtual Router registers transparent rewrites
(for example, `/logowanie` rewrites to `/signin`). Incoming requests render the
underlying plugin page without issuing HTTP 30x redirects. Server middleware
(`EnsuredAuth`), Server Actions, and client components (`useAuthRoutes()`)
automatically read from this single source of truth.


## Sign-up and sign-in (Server Actions)

Framework Server Actions are exported from `@veap/framework/auth/server`:

```tsx
"use server";

import { loginAction, registerAction } from "@veap/framework/auth/server";
// call these directly from forms, or wrap them:
```

A minimal sign-in page:

```tsx
// app or plugin page
import { loginAction } from "@veap/framework/auth/server";

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

Under the hood: zod validation schemas from `@veap/framework/auth` validate credentials, `AuthService` verifies the password hash through the `PASSWORD_HASHER` port, protects against timing attacks using dummy hash verification, enforces brute-force throttling (5 attempts per 15-minute window), and `SessionService` creates a session and sets an httpOnly cookie through `COOKIE_STORE`.

## Reading the current user

In Server Components and actions:

```tsx
import { getCurrentUser, requireUser } from "@veap/framework/auth/server";

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

import { useUser } from "@veap/framework/react";

export function UserBadge() {
  const user = useUser();
  if (!user) return null;
  return <span>{user.email}</span>;
}
```

`useUser()` reads from `AuthProvider`, which the root provider tree (`AppProvider`) hydrates with the server session.

## Guarding routes

Two layers are available:

1. **Route middlewares** in the Veap pipeline - `EnsuredAuth`, `EnsuredGuest`, `EnsuredUser` from `@veap/framework/router/server`. Attach them to plugin routes; they run before the page renders and redirect unauthenticated visitors to the configured login path (`getAuthRoutes().signIn`, default `/signin`).
2. **Facades in the page/action** - `requireUser()`, `requireRole("admin")`, `requirePermission("posts.edit")`. Throwing `AppError.Forbidden` renders the error boundary with the mapped status.

Prefer middlewares for coarse area guards and facades for fine-grained checks inside the handler.

## Roles and permissions

```ts
import {
  hasRole,
  hasPermission,
  assignRole,
  revokeRole,
} from "@veap/framework/auth/server";

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
  verifyResetCode,
  resetPassword,
} from "@veap/framework/auth/server";
```

- `sendVerificationEmail(email)` creates a token and sends the message through the configured mail transport (`MAIL_TRANSPORT=console` prints it locally instead of sending).
- `verifyEmail(email, code)` confirms the address.
- **Password reset (OTP flow):**
  1. `await sendPasswordResetEmail(email)` creates a 6-character OTP (15-minute TTL), writes a signed `veap_reset_session` cookie, and dispatches the email. If the account does not exist, a dummy session is generated to prevent user enumeration.
  2. `const verifiedToken = await verifyResetCode(code)` validates the code from the user input against the session cookie. It permits up to 5 attempts before locking the session.
  3. `await resetPassword(verifiedToken, newPassword)` changes the password, invalidates active user sessions, and clears the reset cookie.
- Messages are built by the auth mailables and sent through the `IMailer` port; see [Email and reset](../auth/email-and-reset.md).

## Sign-out

```ts
import { logoutAction } from "@veap/framework/auth/server";
// or the facade:
import { logout } from "@veap/framework/auth/server";
```

`logout()` destroys the session row and clears the cookie through the port.

## Extending

- Swap `PASSWORD_HASHER` to change hashing (see [Custom providers](../advanced/custom-providers.md)).
- Add profile fields by extending the user model and repository bindings (see [Extending auth](../auth/extensibility.md)).
- React to registrations with `eventBus.subscribe("system:auth:user-registered", ...)`.
