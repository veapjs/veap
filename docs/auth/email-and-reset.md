# Email verification and password reset

Both flows follow the same shape: create a server-side request record, send a code by mail, store a cookie pointing at the request, verify the code, then complete. This page documents the exported API and the flow; the UI screens come from the auth plugin.

## Email verification

On signup, `AuthService` automatically creates and sends a verification request. To manage it manually:

```ts
import {
  createEmailVerificationRequest,
  sendVerificationEmail,
  setEmailVerificationRequestCookie,
  deleteEmailVerificationRequestCookie,
  getUserEmailVerificationRequestFromRequest,
  deleteUserEmailVerificationRequest,
  initEmailVerification,
} from "@veap/core/auth/server";
```

Flow:

1. `createEmailVerificationRequest(userId, email)` creates a record with a 6-character OTP and expiry, deletes prior requests for the user, and returns it.
2. `sendVerificationEmail(email, code)` delivers the code through the mailable `sendVerifyEmail` (localized subject/body, sent via the configured mail transport).
3. `setEmailVerificationRequestCookie(request)` stores the request id in a cookie so the verification page can find it; `getUserEmailVerificationRequestFromRequest()` reads both.
4. Verifying the code calls `setUserAsEmailVerifiedIfEmailMatches(userId, email)` and cleans up the request and cookie.

`initEmailVerification()` is called by `AuthServiceProvider` at boot (when the system is installed) to perform housekeeping, such as ensuring pending verification state is consistent.

## Password reset

```ts
import {
  createPasswordResetSession,
  validatePasswordResetSessionToken,
  getCurrentPasswordResetSession,
  setPasswordResetSessionTokenCookie,
  deletePasswordResetSessionTokenCookie,
  invalidateUserPasswordResetSessions,
  sendPasswordResetEmail,
  setPasswordResetSessionAsEmailVerified,
} from "@veap/core/auth/server";
```

Flow:

1. User submits their email (`forgotPasswordSchema`). The app creates a reset session: `createPasswordResetSession(token, userId, email)` and mails the code via `sendPasswordResetEmail(email, code)` (mailable `sendResetPassword`).
2. The user proves email ownership by entering the code; the request is marked email-verified.
3. The user then proves identity with their recovery code (16-character, validated by `recoveryCodeVerifySchema` and decrypted from storage).
4. `updateUserPassword(userId, newPassword)` sets the new password, `invalidateUserPasswordResetSessions(userId)` and `invalidateUserSessions(userId)` kill reset and login sessions, and the reset cookie is deleted.
5. Events fire along the way: `system:auth:password-reset:requested` and `system:auth:password-reset:completed`.

`getCurrentPasswordResetSession()` returns `{ session, user }` for the current reset flow (cookie-based), mirroring `getCurrentSession()`.

## Recovery codes in the reset flow

The recovery code doubles as the ownership proof: it is generated at signup, shown once, and stored encrypted. The reset flow's `verify-recovery` step compares the entered code against the decrypted value. Users who lose both their password and recovery code cannot self-recover; an admin must intervene (the panel plugin's user management covers this).

## Mail prerequisites

These flows send real mail only when the communication subsystem is configured. In development set `MAIL_TRANSPORT=console` to print codes to the server log instead of sending email:

```env
MAIL_TRANSPORT=console
```

See [Mail](../services/communication.md) for SMTP configuration and custom transports.
