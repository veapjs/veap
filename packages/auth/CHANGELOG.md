# @veap/auth

## 0.1.12

### Patch Changes

- Updated dependencies []:
  - @veap/database@0.1.10

## 0.1.11

### Patch Changes

- [`bece042`](https://github.com/veapjs/veap/commit/bece042e820444f2b6fe89b15df882e9c77b8750) Thanks [@codewebs-org](https://github.com/codewebs-org)! - refactor(auth): cleanup dead code, fix event typings, reorder boot migrations, and add client tests
  
  - Deduplicate `src/server.ts` to re-export root index entrypoint
  - Remove unused `AppError` import in `AuthService`
  - Remove unused `session` parameter in `performFullUserAugmentation` and deduplicate `augment.ts` re-exports in `logic.ts`
  - Fix event bus alignment: emit `system:auth:signup` alongside `system:auth:register`, emit `system:auth:signed-out` on logout, and declare missing 2FA and recovery code event types
  - Augment `@veap/kernel`'s `SystemEventsMap` with `AuthEventPayloads` for strongly typed event subscriptions
  - Run migrations before `isSystemInstalled` in `AuthServiceProvider.boot()` to prevent spurious database table errors on fresh installs
  - Add configurable `sessionEndpoint` to `AuthProvider` (defaults to `/api/auth/me`) and export `handleAuthMe` route handler helper from session facade
  - Add inferred types for MFA schemas (`TotpSetupInput`, `TotpVerifyInput`, `BackupCodeInput`)
  - Expose `validatePasswordResetSession` and `verifyPasswordResetSessionCode` from password reset facade
  - Add unit tests for `@veap/auth/client` (`AuthProvider`, `useUser`, `useAuthRoutes`), validation helpers, and `handleAuthMe`

## 0.1.10

### Patch Changes

- Fix session expiration calculation to use a fixed 7-day interval and prevent DST shifts

## 0.1.9

### Patch Changes

- chore: bump version
- Updated dependencies []:
  - @veap/database@0.1.9
  - @veap/kernel@0.2.2

## 0.1.8

### Patch Changes

- Security and architecture improvements in `@veap/auth`:
  
  - **Security (Server Action boundaries)**: Removed `"use server";` directive from internal backend facades (`user.facade.ts`, `rbac.facade.ts`, `password-reset.facade.ts`, `verification.facade.ts`, `session.facade.ts`) preventing unauthorized public HTTP endpoint generation by Next.js for sensitive functions like `getUserPasswordHash` and `assignRoleToUser`.
  - **Result<T> Contract in Actions**: Updated `signIn`, `signUp`, and `finalizeLogin` in `auth.actions.ts` to return proper failure `Result` (`{ success: false, error }`) instead of wrapping `ERROR` statuses in `ok(...)`.
  - **Lazy ENCRYPTION_KEY Validation**: Removed module-level top-level evaluation of `getEncryptionKey()` in `encryption.ts` to prevent build-time crashes when `ENCRYPTION_KEY` is not present during evaluation.
  - **isSystemInstalled Counting & Boot**: Fixed array count parsing in `isSystemInstalled()` for Knex/SQLite/Postgres results and added `await` in `AuthServiceProvider.boot()`.
  - **Dynamic Routes in checkSecurity**: Used `getAuthRoutes().signIn` instead of hardcoded `"/signin"` fallback redirect.
  - **RbacService Return Types**: Corrected `createRole` and `createPermission` in `RbacService` to return single `RoleRecord` and `PermissionRecord` instead of single-item arrays.
  - **ApplicationBuilder withAuth**: Added `composition.ts` implementing `withAuth()` fluent configuration method on `ApplicationBuilder`.
  - **Validation Message**: Fixed `registerSchema` username length error message to match `.min(3)`.
  - **Password Hasher Facades**: Delegated `hashPassword`, `verifyPasswordHash`, and `verifyPasswordStrength` to `PASSWORD_HASHER`.
  - **Bearer Token Support**: Added native `Authorization: Bearer <token>` support to `SessionService.getCurrentSession()`, allowing API and mobile clients (such as React Native / Expo) to authenticate without cookies. `AuthService.signIn`, `signUp`, and `finalizeLogin` now return the raw `token` in `AuthResponse`.

- Client/Server boundary separation and notification port architecture in `@veap/auth`:
  
  - **Client/Server separation**: Added dedicated `@veap/auth/client` (`AuthProvider`, `useUser`, `useAuth`) and `@veap/auth/server` entrypoints, preventing Node.js and database server symbols from leaking into browser bundles.
  - **Dependency Inversion (DIP) on notifications**: Decoupled `@veap/auth` from direct runtime dependency on `@veap/mail`. Introduced `IAuthNotificationService` port contract, `AUTH_NOTIFICATION_SERVICE` token, and `DefaultAuthNotificationService` adapter.
  - **Standalone auth notification helpers**: Exported `sendVerifyEmail`, `sendResetPassword`, `sendRecoveryCode`, and `send2FACode` helpers directly from `@veap/auth`, resolving the registered notification service or safely falling back to console/event bus.
  - **Domain events**: Added domain event signals (`system:auth:verification-requested`, `system:auth:password-reset:requested`) emitted through `IEventBus` when notification events occur.
- Updated dependencies [`a7f6a1f`]:
  - @veap/database@0.1.8
  - @veap/kernel@0.2.1

## 0.1.7

### Patch Changes

- Updated dependencies []:
  - @veap/kernel@0.2.0
  - @veap/database@0.1.7
  - @veap/mail@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies []:
  - @veap/kernel@0.1.6
  - @veap/database@0.1.6
  - @veap/mail@0.1.6

## 0.1.5

### Patch Changes

- fix: update versions and dependencies
- Updated dependencies []:
  - @veap/database@0.1.5
  - @veap/kernel@0.1.5
  - @veap/mail@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies []:
  - @veap/database@0.1.4
  - @veap/kernel@0.1.4
  - @veap/mail@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies []:
  - @veap/database@0.1.3
  - @veap/kernel@0.1.3
  - @veap/mail@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - @veap/database@0.1.2
  - @veap/kernel@0.1.2
  - @veap/mail@0.1.2

## 0.1.1

### Patch Changes

- Fix double-hashing bug in AuthService.signUp, clean up client validation bundle leaks, define AUTH_ROUTES token, dynamic auth route redirects, native Node.js ESM module resolution, and cold-start race protection:

  - Define and export `AUTH_ROUTES` IoC token (`Token<AuthRoutesConfig>`) within `@veap/auth` (`src/common/tokens.ts`, `src/common/routes.ts`, `src/common/index.ts`, `src/index.ts`), decoupling it from `@veap/kernel`.
  - Fix missing `.js` extensions across all relative module imports/exports in `src/` ensuring full compliance with native Node.js ESM loaders (`ERR_MODULE_NOT_FOUND` resolution).
  - Fix double hashing of user passwords during `AuthService.signUp` (preventing login failure for new accounts).
  - Remove ActiveRecord `User` database dependency from `src/validation/index.ts` to prevent backend leaks into client bundles; provide `isEmailAvailable` via `UserService` and `user.facade.ts`.
  - Guard `isSystemInstalled` in `AuthServiceProvider.boot()` with `isDatabaseInitialized()`.
  - Use dynamic configured routes from `getAuthRoutes()` for `sessionSignOut` and `EmailVerificationService` redirects.
  - Add cold-start bootstrapping promise wait in server facades (`user`, `rbac`, `password-reset`, `verification`).
  - Remove dead `swr` peerDependency from `package.json`.
  - Add `updateUserAvatar` and `getUserRecoveryCode` with backwards-compatible `@deprecated` aliases.
  - Add comprehensive `auth.service.test.ts` verifying full signup, email availability, and login flows.
- Updated dependencies []:
  - @veap/database@0.1.1
  - @veap/kernel@0.1.1
  - @veap/mail@0.1.1

## 0.1.0

### Minor Changes

- Initial public scaffold of the Veap auth.
