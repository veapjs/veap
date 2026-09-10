# Physical pages and withRouter

Most pages in a Veap application are virtual: they live in plugins and are rendered by the catch-all. When you need a physical Next.js page (for example a custom landing page in the app shell), `withRouter` lets it inherit the virtual router's layouts, parallel slots, middleware and protection.

## Basic usage

```tsx
// app/landing/page.tsx (physical page)
import { withRouter } from "@veap/core/router";

export default withRouter(async function LandingPage() {
  return <div>Welcome</div>;
}, "/landing");
```

The page is served by Next.js at `/landing`, but rendering goes through `VeapRouter` with the physical component injected as the leaf. Concretely, the virtual tree is matched at the given path, its layout chain wraps your component, its middlewares and auth requirements run, and parallel slots resolve.

## Path resolution

The second argument can be:

- a string path (as above), or
- a config object:

```tsx
export default withRouter(CustomPage, {
  path: "/app/custom",
  roles: ["admin"],
  permissions: ["custom:view"],
  middlewares: [auditTrail],
});
```

- omitted. Then the path is inferred from the `x-invoke-path` header, which `proxy.ts` sets for you. Prefer explicit paths; header-based inference depends on the runtime.

## What your component receives

The wrapped component receives the same props a virtual page gets: `params`, `searchParams`, `breadcrumbs`, and the post-middleware `context`. `searchParams` is awaited by the wrapper (Next.js passes a promise here), so your component receives plain values.

## When to use which

| Situation                                                 | Use                                  |
| --------------------------------------------------------- | ------------------------------------ |
| Feature belongs to a plugin, needs plugin lifecycle       | virtual route in the plugin's `app/` |
| One-off page owned by the app shell                       | physical page, plain Next.js         |
| Physical page that must inherit plugin layouts/protection | physical page + `withRouter`         |

## Caveats

- `withRouter` pages render at request time (the router is dynamic); a physical page that must stay statically prerendered should not use it.
- The configured `path` should exist in the virtual tree (or the catch-all-style fallback of your plugin tree); otherwise the match is partial and the not-found UI wraps your page.
