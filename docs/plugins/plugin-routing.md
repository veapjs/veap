# Routing in plugins

Plugin routes come from the `routeTree` property. The standard implementation discovers a tree from the plugin's `app/` directory using App Router file conventions:

```ts
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverRoutes } from "@veap/framework/router";

routeTree: async () => {
  const appDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "app",
  );
  return discoverRoutes(appDir, (relPath) => import(`./app/${relPath}`));
},
```

`discoverRoutes` returns a `RouteNode`; returning a function keeps discovery lazy (runs once when the router first builds the merged tree). A `RouteTree` instance is also accepted.

## Public and admin routes

Admin pages live under a `[prefix]` segment, which the router resolves to the configured private path (default `/app`) via `resolveMagicPrefix`:

```text
plugins/panel-plugin/src/app/
├── page.tsx                    # public: site home contribution
├── pricing/
│   └── page.tsx                # public: /pricing
└── [prefix]/
    ├── layout.tsx              # admin shell (sidebar etc.)
    ├── page.tsx                # admin: /app
    └── settings/
        └── page.tsx            # admin: /app/settings
```

`buildRouteTree(true)` (used by the host catch-all) includes the resolved admin routes; protection still comes from the chain (`auth`, `roles`, `permissions` exports), so admin layouts typically declare `export const auth = true`.

## What pages receive

Virtual pages receive resolved props:

```tsx
export default async function Page({
  params, // { slug: "hello" } for [slug]
  searchParams, // { q: "veap" } for ?q=veap
  context, // VeapMiddlewareContext: path, roles, permissions after middleware
  config, // active template config
  breadcrumbs, // BreadcrumbItem[] resolved for this path
}) {
  return <div>{params.slug}</div>;
}
```

## Nested layouts, boundaries, slots

Everything App Router supports is honored per segment: `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `default.tsx`, route groups `(group)`, parallel slots `@slot`, dynamic `[param]`, catch-all `[...path]`, optional catch-all `[[...path]]`. Layouts can export protection; pages can export `middlewares` arrays. See [Routing](../routing/routing.md) and [Defining routes](../routing/defining-routes.md).

## Homepage detection

`getPluginsWithHomepage()` (from `@veap/framework/router/server`) lists plugins whose tree matches `/` exactly. The framework uses it to decide which plugin owns the site root; a plugin page at `app/page.tsx` claims the homepage.

## Route cache invalidation

In production the merged tree is cached under `"router:tree"`. The router service subscribes to `system:plugin:toggle` and `system:plugins:init:end` and clears the cache, so enabling or disabling a plugin changes routing without a redeploy. During development the tree rebuilds per request.

## Programmatic route trees

For fully code-defined trees:

```ts
import { RouteTree } from "@veap/framework/router";

routeTree: () => {
  const tree = new RouteTree();
  tree.addTree({
    segment: "",
    page: HomePage,
    children: [{ segment: "docs", layout: DocsLayout, children: docsChildren }],
  });
  return tree.getRoot();
},
```

`id` properties on nodes enable template overrides (a template can replace the component for a given route id, including `${id}/layout` keys for layouts).
