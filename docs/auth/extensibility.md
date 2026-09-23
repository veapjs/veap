# Extending authentication

The auth system was designed for plugins like the bundled 2FA modules (TOTP, passkeys, Google OAuth). This page documents the extension points and shows how they combine.

## Interception during login: auth validators

`registerAuthValidator(id, validator)` registers a check that runs after credentials verify but before the session is created. Providing a string ID enables safe updates and teardown. Returning an `AuthResponse` short-circuits login:

```ts
import { registerAuthValidator } from "@veap/framework/auth/server";
import type { AuthResponse } from "@veap/framework/auth";

registerAuthValidator("totp", async (userId): Promise<AuthResponse | null> => {
  const settings = await totpSettings(userId);
  if (settings?.enabled) {
    return {
      status: "CHALLENGE_REQUIRED",
      type: "totp",
      userId,
    };
  }
  return null; // not intercepted
});
```

This is exactly how the TOTP and passkey plugins inject their challenge. After the challenge succeeds, the plugin calls `finalizeLogin(userId, flags)` to create the session with verification flags attached.

## Security requirements: post-login gates

Validators decide _whether you get a session_; security requirements decide _whether an existing session may proceed_. They run inside `checkSecurity` on every protected route:

```ts
import { registerSecurityRequirement } from "@veap/framework/auth/server";

registerSecurityRequirement("totp-gate", async (session, user) => {
  if (!user.emailVerifiedAt) {
    return { satisfied: false, redirect: "/verify-email" };
  }
  if (await totpRequiredButNotVerified(session, user)) {
    return { satisfied: false, redirect: "/verify-2fa" };
  }
  return null; // no opinion
});
```

Return `{ satisfied: false, redirect }` to block, `null` to allow. Requirements must be defensive: throwing inside one is caught and logged (treated as "no opinion") so a broken plugin cannot lock everyone out.

Requirements also receive the request path as a third argument (`(session, user, path)`), so a gate can exempt its own pages. Combining requirements with `SkipSecurity` and lifecycle hooks into a full "block routes until a condition is met" plugin is documented in [Gate plugins](../guides/gate-plugins.md).

## Same pattern for reset and verification flows

- `registerPasswordResetValidator(id, fn)` intercepts password reset completion (for example, 2FA during password reset).
- `registerEmailVerificationValidator(id, fn)` intercepts email verification flows.

Each function accepts an optional string ID for explicit lifecycle tracking.

## Identity augmentation

Augmenters attach plugin data to identities at session validation time:

```ts
import {
  registerIdentityAugmenter,
  registerSessionAugmenter,
} from "@veap/framework/auth/server";

registerIdentityAugmenter("profile-completion", async (user) => ({
  profileCompletion: await computeProfileCompletion(user.id),
}));

registerSessionAugmenter("trusted-devices", async (session) => ({
  deviceTrusted: await isDeviceTrusted(session.id),
}));
```

`registerIdentityAugmenter` results merge into the `FullUser` returned by `getCurrentSession()`; `registerSessionAugmenter` results merge into the `Session`. There is also `registerPasswordResetSessionAugmenter` for reset sessions. Augmenters run on every session validation, so keep them fast (or cache inside).

## Explicit teardown in `onDisable()`

When administrators deactivate a plugin in production or during runtime reloads, any registered auth checks must be cleanly removed. Without unregistering, handlers remain in process memory and continue blocking users or redirecting to deactivated plugin routes.

Veap provides unregistration helpers corresponding to each registration method:

```ts
import {
  unregisterAuthValidator,
  unregisterSecurityRequirement,
  unregisterSessionAugmenter,
  unregisterIdentityAugmenter,
  unregisterPasswordResetValidator,
  unregisterEmailVerificationValidator,
} from "@veap/framework/auth/server";
```

Call the appropriate teardown function inside your plugin's `onDisable()` hook using the same ID passed during registration:

```ts
const plugin: IPlugin = {
  manifest,

  init: async () => {
    registerAuthValidator("my-plugin", async (userId) => {
      // login challenge logic
    });
    registerSecurityRequirement("my-plugin", async (session, user) => {
      // route access gate logic
    });
    registerSessionAugmenter("my-plugin", async (session) => {
      // session metadata
    });
  },

  onDisable: async () => {
    unregisterAuthValidator("my-plugin");
    unregisterSecurityRequirement("my-plugin");
    unregisterSessionAugmenter("my-plugin");
  },
};
```

Using a string ID guarantees:
- **Idempotency:** Re-registering with the same ID replaces the previous handler instead of duplicating it in memory.
- **Clean teardown:** Calling `unregister*(id)` reliably removes the specific handler without needing to preserve function references in module scope.

## Reusing the crypto ports

Plugins must not hash or encrypt ad hoc. Inject the ports:

- `IPasswordHasher` (`PASSWORD_HASHER`): `hash`, `verify`, `validateStrength` - used by the action-confirm plugin to re-verify passwords.
- `ITokenGenerator` (`TOKEN_GENERATOR`): `generateOtp`, `generateRecoveryCode`, `generateSessionToken`, `hashToken`.
- `ISecretCipher` (`SECRET_CIPHER`): `encrypt` / `decryptToString` - used to store TOTP secrets and passkey material.

Resolve them with `app(IPasswordHasher)` etc., or register replacements for the whole application.

## 2FA flow end to end (how the built-ins do it)

1. User enables 2FA; the plugin stores its secret encrypted via `SECRET_CIPHER`, registers a session augmenter and an auth validator.
2. At login, the validator returns `CHALLENGE_REQUIRED` with its type and a `tempToken`.
3. The plugin's challenge page verifies the code (its own API route), then calls `finalizeLogin(userId, flags)` - the exported auth action - which creates the session and publishes `system:auth:session-created`.
4. The session's flags let the security requirement allow subsequent requests.
5. If the plugin is ever disabled, its `onDisable()` cleans up its validators, requirements, and augmenters so users are not blocked.

## Registration timing

Register validators, requirements, and augmenters in your plugin's `init()` hook (which executes during plugin initialization on every boot) or in a service provider's `boot()` method. Always supply a unique string ID (typically your plugin ID or `plugin-id:feature`) to enable safe re-registration during development and explicit cleanup in `onDisable()`.
