# Gate plugins: blocking routes until a condition is met

A gate is a plugin that blocks access to protected routes until the user satisfies some condition: completed onboarding, accepted terms, verified a second factor, paid an invoice. This guide assembles the pieces - security requirement, `SkipSecurity`, path exemption and lifecycle hooks - into one working pattern. For the underlying auth extension points see [Extending authentication](../auth/extensibility.md); for middleware semantics see [Middleware](../routing/middleware.md).

## When to reach for a gate

Use a gate when the condition is **account-level** (a property of the user, not of a specific page) and **transient** (once satisfied, it never applies again): onboarding, 2FA enrollment, terms acceptance. If the condition is page-specific ("this page requires a paid plan"), use `roles`/`permissions` or route middleware instead - do not model per-page logic as a global requirement.

## The four pieces

1. **A security requirement** that returns `{ satisfied: false, redirect }` while the condition holds. Registered via `registerSecurityRequirement`, it runs inside `checkSecurity` on every route protected by `EnsuredAuth`.
2. **Gate pages that opt out of the gate.** The wizard itself must be reachable while the gate is active. Pages that should be reachable declare `middlewares = [SkipSecurity, EnsuredUser]`, which stops the router from injecting `EnsuredAuth` for that route.
3. **Path exemption inside the requirement.** Some protected layouts call `checkSecurity` from their own component (outside the middleware pipeline), where `SkipSecurity` has no effect. The core passes the request path to every requirement, so the requirement can exempt its own pages explicitly.
4. **Lifecycle hooks** that create the pending state (`system:auth:signup`, `system:auth:email-verified`) and clear it when the gate condition is satisfied.

## Step 1: register the requirement in `init()`

```ts
import { eventBus } from "@veap/framework/core/server";
import { registerSecurityRequirement } from "@veap/framework/auth/server";
import { getPathPrefix } from "@veap/framework/plugins/server";
import type { IPlugin } from "@veap/framework/plugins";

const GATE_PAGES = ["onboarding"]; // last path segment(s) owned by the gate

const gatePlugin: IPlugin = {
  // ...
  init: async () => {
    registerSecurityRequirement(async (_session, user, path) => {
      try {
        if (!user) return { satisfied: true };

        // 1. Path exemption: never redirect a gate page onto itself.
        if (isGatePage(path)) return { satisfied: true };

        // 2. Account-level exemptions (admins, pre-verification users, ...).
        if (isAdmin(user)) return { satisfied: true };

        // 3. The actual condition.
        if (!(await isConditionSatisfied(user.id))) {
          const prefix = await getPathPrefix();
          return {
            satisfied: false,
            redirect: `${prefix}/onboarding`,
            requirement: "my-gate", // lets callers distinguish gates
          };
        }

        return { satisfied: true };
      } catch (error) {
        // Fail open: an infrastructure error must not lock everyone out.
        console.error("[MyGate] requirement failed:", error);
        return { satisfied: true };
      }
    });
  },
};
```

The requirement receives the request path as its third argument (`(session, user, path)`). The path comes from the router (which knows the matched route) and from protected layouts that forward the `x-pathname` header set by the proxy. Treat it as **advisory**: it may be absent on some call sites, so the exemption must be defensive.

## Step 2: exempt the gate pages from inherited protection

Panel layouts usually declare `auth = true`, and `collectAuthRequirements` merges that into every nested route. A gate page nested under such a layout would inherit `EnsuredAuth` - and with an active gate that means redirecting onto itself. Opt out on the page module:

```tsx
// app/[prefix]/onboarding/page.tsx
import { EnsuredUser, SkipSecurity } from "@veap/framework/router/server";

export const middlewares = [SkipSecurity, EnsuredUser];

export default async function OnboardingPage() {
  const { user } = await getCurrentSession();
  if (!user) redirect("/signin");

  const state = await getOnboardingState();
  if (state.completed) redirect("/app"); // reverse guard

  return <OnboardingWizard initialStep={state.currentStep} />;
}
```

`SkipSecurity` only suppresses the **automatic injection** of `EnsuredAuth`; `EnsuredUser` still requires a session. The page keeps protecting itself (session check plus the reverse guard), it just drops the global gate check for the duration of this route.

## Step 3: make path-blind call sites path-aware

Any component that calls `checkSecurity` directly (typically a protected layout) is **path-blind** unless it forwards a path: the requirement then cannot recognize gate pages and redirects onto them - an infinite layout loop, because the layout renders for the target page too. Forward the proxy's `x-pathname` header:

```tsx
// plugins/panel-plugin/src/app/[prefix]/layout.tsx
import { headers } from "next/headers";

const headersList = await headers();
const pathname = headersList.get("x-pathname") ?? undefined;

const security = await checkSecurity(
  session,
  user,
  ["admin", "user"],
  undefined,
  undefined,
  pathname, // <- path-aware: requirements can exempt gate pages
);
```

Without this, `SkipSecurity` on the gate page cannot save you: the layout's inline `checkSecurity` runs outside the middleware pipeline. This single omission was the cause of a real infinite-redirect loop; treat it as a hard requirement for every protected layout.

## Step 4: lifecycle hooks

The pending state should be created when the account enters the gated stage and consumed when it leaves:

```ts
// init(): create the pending state
eventBus.subscribe("system:auth:email-verified", "my-gate-verified", async (event) => {
  const userId = event.payload?.userId;
  if (!userId) return;
  await ensurePendingState(userId); // idempotent
  await eventBus.publish("my-gate:ready", { userId }, "my-gate-plugin");
});

// onDisable(): always clean up listeners
onDisable: async () => {
  eventBus.unsubscribe("system:auth:email-verified", "my-gate-verified");
},
```

Subscribe to `system:auth:email-verified` (not only `system:auth:signup`) - OAuth signups skip the password signup event, and the gate should engage exactly when the user can actually sign in.

## Landing the user on the gate after verification

After a successful email verification, auth-plugin asks its `auth:after_verify:redirect` filter where to land. A gate plugin supplies a hook instead of patching auth:

```ts
hooks: [
  {
    point: "auth:after_verify:redirect",
    handler: async (target: string, context: any) => {
      try {
        const userId = context?.userId;
        if (!userId) return target;
        if (!(await isConditionSatisfied(userId))) return "/onboarding";
      } catch (error) {
        console.error("[MyGate] redirect filter failed:", error);
      }
      return target;
    },
  },
],
```

The handler receives the current target as the first argument and a context (`{ userId, email }`) as the second; return the target unchanged when the gate does not apply. Only enabled plugins' hooks run - keep the plugin enabled via the plugin manager for the hook to take effect.

## Checklist

- [ ] Requirement registered in `init()`, path-exempt, role-exempt, **fail-open**.
- [ ] Gate pages export `middlewares = [SkipSecurity, EnsuredUser]` and carry their own session check plus a reverse guard.
- [ ] Every protected layout that calls `checkSecurity` inline forwards `x-pathname`.
- [ ] Pending state created idempotently on `system:auth:email-verified`; listeners removed in `onDisable()`.
- [ ] Post-verification landing via the `auth:after_verify:redirect` hook (optional but expected UX).
- [ ] Requirement returns a `requirement: "my-gate"` discriminator so other gates can coexist.
