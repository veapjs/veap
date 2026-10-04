# Physical pages and withRouter

Physical pages in Next.js App Router live directly in your application's `app/`
directory. While most pages in a modular Veap system are virtual routes provided
by plugins, physical pages let you build custom application routes while still
inheriting virtual layouts, role-based protection, and navigation breadcrumbs
through the `withRouter` Higher-Order Component (HOC).

## Overview

The `withRouter` HOC wraps any physical React Server Component page and mounts
it through `VeapRouter`.

When a visitor requests a physical page wrapped with `withRouter`:

1. Next.js routes the request to the physical file in your `app/` directory.
2. The `withRouter` wrapper intercepts rendering and discovers the compiled
   virtual route tree using `buildRouteTree(true)`.
3. The wrapper resolves the incoming route path from your configuration or the
   `x-invoke-path` header.
4. `VeapRouter` executes configured middlewares, verifies role and permission
   requirements, and evaluates the matching layout chain.
5. `VeapRouter` injects your physical component as the innermost leaf of the
   resolved layout tree.

This architecture lets physical pages sit inside plugin-managed layouts, such
as the administrative panel shell provided by `panel-plugin`, without
converting your page into a separate plugin package.

## Basic usage

Wrap your physical page export with `withRouter`. Pass the component as the
first argument and the target virtual route path as the second argument.

```tsx
// app/landing/page.tsx (physical Next.js page)
import { withRouter } from "@veap/framework/router";

export default withRouter(async function LandingPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Welcome to the App Shell</h1>
      <p className="mt-2 text-muted-foreground">
        This physical page renders inside the matching virtual layout chain.
      </p>
    </div>
  );
}, "/landing");
```

## The WithRouterConfig object

Instead of a plain string path, you can pass a configuration object to
customize security and middleware execution for the physical page.

```ts
export interface WithRouterConfig {
  path?: string;
  roles?: string[];
  permissions?: string[];
  middlewares?: any[];
}
```

The configuration object supports the following options:

- `path`: The virtual route path matched against the compiled route tree. If
  you omit this property, `withRouter` reads the path from the `x-invoke-path`
  request header.
- `roles`: An array of role identifiers (for example, `["admin"]`). Visitors
  lacking the required role receive an unauthorized redirect or error view.
- `permissions`: An array of permission keys required to access the page.
- `middlewares`: Custom middleware functions executed before the page mounts.

The following example configures role-based access control and custom
middleware for an administrative overview page:

```tsx
// app/[prefix]/reports/page.tsx
import { withRouter } from "@veap/framework/router";
import { auditLogMiddleware } from "@/lib/middleware/audit";

async function ReportsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Confidential Audit Reports</h1>
    </div>
  );
}

export default withRouter(ReportsPage, {
  roles: ["admin"],
  permissions: ["reports:view"],
  middlewares: [auditLogMiddleware],
});
```

## Administrative pages under [prefix]

Administrative pages in Veap reside under dynamic prefix routes such as
`app/[prefix]/...` to adapt to the configured `privatePath` (for example, `/app`
or `/admin`).

When writing physical pages inside `app/[prefix]/`:

1. Do not hardcode a static `path` string in your `WithRouterConfig`. The prefix
   value varies depending on application settings.
2. Allow `withRouter` to infer the path automatically through request headers.
3. Configure your Next.js middleware in `proxy.ts` to propagate the invoked path
   to downstream Server Components.

### Configuring proxy.ts for path inference

Your application's `proxy.ts` file acts as Next.js edge middleware. It must
forward the incoming pathname in the `x-invoke-path` and `x-pathname` request
headers so that `withRouter` can inspect the full URL path at request time.

```ts
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;

  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-invoke-path", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

<!-- prettier-ignore -->
> [!IMPORTANT]
> If `proxy.ts` does not forward `x-invoke-path`, `withRouter` falls back to
> `"/"`. On routes under `[prefix]`, this causes the router to match the root
> landing layout rather than the administrative panel shell.

## Virtual route tree registration

`VeapRouter` matches the invoked path against the compiled virtual route tree
to assemble layout chains, breadcrumbs, and error boundaries.

If a physical page uses `withRouter` on a path that does not exist in the
virtual route tree:

- The route matcher marks the lookup as a partial match (`isExact === false`).
- Instead of showing the full layout shell, the router renders the nearest
  `notFound` boundary around your component.

To prevent this issue, declare matching segments in an in-app host extension
plugin using `routeTree`.

### Declaring route segments in a host plugin

Create a host extension plugin that registers the segment structure and
breadcrumb resolver for your physical pages.

```ts
// lib/host-plugin.ts
import type { IPlugin } from "@veap/framework/plugins";
import { Project } from "@/lib/models/project";

export const hostPlugin: IPlugin = {
  manifest: {
    id: "host-app-extension",
    name: "Host App Extension",
    version: "1.0.0",
    description: "Registers host application physical pages and navigation",
    system: true,
    enabled: true,
  },
  navigation: {
    admin: {
      "Project Management": {
        priority: 10,
        items: [
          {
            title: "Projects",
            url: "/projects",
            icon: "solar:folder-open-broken",
            priority: 0,
          },
        ],
      },
    },
  },
  routeTree: async () => {
    return {
      segment: "[prefix]",
      children: [
        {
          segment: "projects",
          breadcrumb: () => "Projects",
          children: [
            {
              segment: "[slug]",
              breadcrumb: async ({ params }: any) => {
                const resolved = await params;
                const project = await Project.query()
                  .where("slug", resolved?.slug)
                  .first();
                return project?.name || "Project Details";
              },
            },
          ],
        },
      ],
    };
  },
};
```

Register this host plugin in `veap.config.ts`:

```ts
// veap.config.ts
import { defineConfig } from "@veap/framework";
import { hostPlugin } from "./lib/host-plugin";

export default defineConfig({
  plugins: [hostPlugin],
});
```

With the segment declared in `routeTree`:

- `VeapRouter` successfully matches `/app/projects` or `/admin/projects`.
- The physical page inherits the administrative sidebar and top header.
- Breadcrumbs dynamically render using your declared resolvers.
- Sidebar menu items highlight the active route accurately.

## Props passed to your component

The `withRouter` wrapper forwards resolved route data directly to your page
component:

```ts
interface PhysicalPageProps<TParams = any> {
  params: TParams;
  searchParams: Record<string, string | string[] | undefined>;
  breadcrumbs: Array<{ label: string; url?: string }>;
  context: any;
}
```

- `params`: Route parameters resolved by the matcher (for example,
  `{ prefix: "app", slug: "core-platform" }`).
- `searchParams`: A plain object containing query string values. The
  `withRouter` wrapper automatically awaits the Next.js `searchParams` promise
  before passing it to your component.
- `breadcrumbs`: The hierarchical breadcrumb list resolved by the router.
- `context`: The post-middleware execution context.

```tsx
// app/[prefix]/projects/[slug]/page.tsx
import { withRouter } from "@veap/framework/router";
import { notFound } from "next/navigation";
import { Project } from "@/lib/models/project";

async function ProjectDetailPage({ params, breadcrumbs }: any) {
  const resolved = await params;
  const project = await Project.query()
    .where("slug", resolved.slug)
    .first();

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-3xl font-bold">{project.name}</h1>
      <p className="text-muted-foreground">{project.description}</p>
    </div>
  );
}

export default withRouter(ProjectDetailPage, {
  roles: ["admin", "user"],
});
```

## When to use physical pages vs virtual pages

Choosing between physical and virtual pages depends on where your feature
lives and how you distribute it across projects.

| Requirement | Recommended approach |
| --- | --- |
| Feature is distributed as a reusable package across applications | Virtual route inside a plugin's `app/` directory |
| Feature is specific to the current host application | Physical page in Next.js `app/` |
| Physical page needs admin sidebar, layouts, and breadcrumbs | Physical page wrapped with `withRouter` |
| Static public landing page with zero layout overhead | Plain physical Next.js page without `withRouter` |

## Caveats and best practices

Keep the following considerations in mind when building physical pages:

- **Dynamic rendering requirement:** Pages wrapped with `withRouter` execute
  dynamically at request time. Do not attempt to statically prerender a page
  wrapped with `withRouter`.
- **Always declare virtual segments for layout inheritance:** When adding
  pages under `app/[prefix]/`, always register matching segments in a host
  plugin's `routeTree` so the router knows how to wrap them.
- **Enforce data-level ownership in Server Actions:** `withRouter` guards the
  page entry point, but you must still authorize mutations in your Server
  Actions by verifying `user.id` against the database record.
