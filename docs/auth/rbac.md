# RBAC (roles and permissions)

Veap's RBAC is simple and explicit: users get roles, roles get permissions, users can also have direct permissions. Checks require "at least one role" and "all permissions".

## Data model

Tables created by core migrations:

- `roles` (id, name, description)
- `permissions` (id, name, description)
- `roles_to_permissions` (role_id, permission_id)
- `users_to_roles` (user_id, role_id)
- `users_to_permissions` (user_id, permission_id)

Permission names are free-form strings; the convention used across Veap plugins is `resource:action` (for example `post:create`, `settings:read`).

## Managing roles and permissions

All functions are server-side facades from `@veap/core/auth/server`:

```ts
import {
  createRole,
  createPermission,
  getRoles,
  getPermissions,
  assignPermissionToRole,
  revokePermissionFromRole,
  assignRoleToUser,
  revokeRoleFromUser,
  assignPermissionToUser,
  revokePermissionFromUser,
  getUserRbacData,
} from "@veap/core/auth/server";

await createRole("editor", "Can edit content");
await createPermission("post:create", "Allow creating posts");
await assignPermissionToRole(editorRole.id, perm.id);
await assignRoleToUser(user.id, editorRole.id);
```

`getUserRbacData(userId)` returns the user's roles and permissions in one call; it is also what feeds the core RBAC augmenter on every session validation.

## Checking in routes

Declarative, collected along the layout chain:

```tsx
// page.tsx or layout.tsx
export const auth = true;
export const roles = ["admin", "editor"]; // at least one
export const permissions = ["post:create"]; // all required
```

The virtual router turns these into `EnsuredAuth`; failures redirect (pages) or return 401 JSON (API). See [Middleware](../routing/middleware.md).

## Checking in code

```ts
import { getCurrentSession, checkSecurity } from "@veap/core/auth/server";

const { session, user } = await getCurrentSession();
const result = await checkSecurity(session, user, ["admin"], ["settings:read"]);
if (!result.satisfied) {
  // result.redirect tells you where the router would send the user
}
```

Semantics of `checkSecurity`:

- Missing user: not satisfied.
- Roles: satisfied if the user has **at least one** of the required roles.
- Permissions: satisfied if the user has **all** required permissions.
- Registered security requirements (2FA, email verification) run afterwards and can still veto.

## Navigation filtering

Navigation items and extension points accept `roles`/`permissions` and are filtered per user before rendering:

```ts
// in a plugin's navigation definition
navigation: {
  admin: {
    Content: {
      title: "Content",
      priority: 10,
      items: [
        { title: "Posts", url: "/posts", icon: "file-text", permissions: ["post:create"] },
      ],
    },
  },
}
```

The same filter shape applies to plugin `widgets` and `extensions`. This hides UI, but always pair it with route-level checks; filtering is presentation, not enforcement.

## RBAC and the first user

The installer flow creates the first user as `admin`. The panel plugin ships the UI for managing roles, permissions and user assignments under the admin area.
