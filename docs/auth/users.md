# Users and passwords

## Creating users

```ts
import { createUser } from "@veap/framework/auth/server";

const user = await createUser(
  "jane@example.com",
  "jane",
  "correct-horse-battery",
);
```

`createUser(email, username, password)`:

- validates the username via `verifyUsernameInput` (uniqueness/format checks through the user service),
- hashes the password with the `PASSWORD_HASHER` port (bcrypt, cost 10),
- encrypts a generated recovery code with the `SECRET_CIPHER` port and stores it,
- creates the user record and returns the `User`.

`createOAuthUser(email, name, image?)` creates a user without a password (OAuth flows use it); `getUserPasswordHash` returns `null` for such accounts, and sign-in with password correctly fails.

## Types

```ts
interface User {
  id: string;
  email: string;
  name: string;
  password: string | null; // hash; stripped from serialized output
  image: string | null;
  recovery_code: any; // encrypted bytes; stripped from serialized output
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

type FullUser = User &
  Record<string, any> & { roles: UserRole[]; permissions: UserPermission[] };
```

`FullUser` is what `getCurrentSession()` returns: the base user plus RBAC data plus anything registered augmenters add.

## Updating users

| Function                                              | Purpose                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `updateUserPassword(userId, password)`                | validates strength, hashes and stores                           |
| `updateUserName(userId, name)`                        | renames                                                         |
| `updateUserAwatar(userId, image)`                     | sets the avatar URL (function name preserved for compatibility) |
| `updateUserEmailAndSetEmailAsVerified(userId, email)` | email migration for OAuth flows                                 |
| `setUserAsEmailVerifiedIfEmailMatches(userId, email)` | verification, only if the email still matches                   |

## Recovery codes

Every user has one recovery code, generated at signup, encrypted at rest (AES-GCM) and returned in plaintext exactly once:

```ts
import {
  getUserRecoverCode,
  resetUserRecoveryCode,
} from "@veap/framework/auth/server";

const code = await getUserRecoverCode(userId); // decrypts; null if absent
const fresh = await resetUserRecoveryCode(userId); // regenerates, returns new plaintext
```

The plaintext recovery code is also the secret used during password reset verification (16-character base32, matching `recoveryCodeVerifySchema`).

## The User model

The persistence model (`@veap/framework/auth/models`) is an ORM model with relations you can eager-load:

```ts
import { User } from "@veap/framework/auth/models";

const users = await User.query()
  .with("roles", "permissions", "sessions")
  .orderBy("created_at", "desc")
  .limit(50)
  .get();
```

`hidden = ["password", "recovery_code"]` keeps secrets out of `toJSON()`, which is what makes it safe to pass user objects toward the client.

## Password rules

- Strength check (`validateStrength`): length between 8 and 255 (the same rule `registerSchema` enforces client-side).
- Hashing is bcrypt cost 10 through the port; swapping to argon2 means registering a different `IPasswordHasher` adapter, not touching services.
