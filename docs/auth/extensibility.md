# Extending authentication

The auth system was designed for plugins like the bundled 2FA modules (TOTP, passkeys, Google OAuth). This page documents the extension points and shows how they combine.

## Interception during login: auth validators

`registerAuthValidator(validator)` registers a check that runs after credentials verify but before the session is created. Returning an `AuthResponse` short-circuits login:

```ts
import { registerAuthValidator } from "@veap/framework/auth/server";
import type { AuthResponse } from "@veap/framework/auth";

registerAuthValidator(async (userId): Promise<AuthResponse | null> => {
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

registerSecurityRequirement(async (session, user) => {
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

- `registerPasswordResetValidator(fn)` intercepts password reset completion (2FA during reset).
- `registerEmailVerificationValidator(fn)` intercepts email verification flows.

## Identity augmentation

Augmenters attach plugin data to identities at session validation time:

```ts
import {
  registerIdentityAugmenter,
  registerSessionAugmenter,
} from "@veap/framework/auth/server";

registerIdentityAugmenter(async (user) => ({
  profileCompletion: await computeProfileCompletion(user.id),
}));

registerSessionAugmenter(async (session) => ({
  deviceTrusted: await isDeviceTrusted(session.id),
}));
```

`registerIdentityAugmenter` results merge into the `FullUser` returned by `getCurrentSession()`; `registerSessionAugmenter` results merge into the `Session`. There is also `registerPasswordResetSessionAugmenter` for reset sessions. Augmenters run on every session validation, so keep them fast (or cache inside).

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

## Registration timing

Register validators, requirements and augmenters in your plugin's `init()` (runs during plugin initialization on every boot), or in a service provider's `boot()`. The registries are global sets keyed on `globalThis`, so re-registration on hot reload is safe (a `Set` deduplicates identical function references; closures from HMR may accumulate in dev, which is harmless).
