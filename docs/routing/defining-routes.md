# Defining routes

This page shows each segment type in the virtual router with the plugin `app/` directory layout and what the page receives.

## Static and nested routes

```text
plugins/blog-plugin/src/app/
├── page.tsx              -> /
└── blog/
    ├── page.tsx          -> /blog
    └── archive/
        └── page.tsx      -> /blog/archive
```

A `page.tsx` at the plugin root maps to the site root (`/`); plugins with a root page are listed by `getPluginsWithHomepage()`.

## Dynamic segments

```text
app/blog/
├── page.tsx              -> /blog
└── [slug]/
    └── page.tsx          -> /blog/hello-world  (params.slug === "hello-world")
```

```tsx
export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await Post.query().where("slug", params.slug).first();
  return <h1>{post?.title}</h1>;
}
```

Dynamic segments match exactly one URL part.

## Catch-all and optional catch-all

```text
app/docs/
└── [...path]/
    └── page.tsx          -> /docs/a/b/c  (params.path === "a/b/c")
```

Catch-all requires at least one segment. Optional catch-all matches zero or more:

```text
app/
└── [[...catchAll]]/
    └── page.tsx          -> / and /anything/at/all
```

This is exactly how the host shell forwards URLs to `VeapRouter`.

## Route groups

```text
app/
├── (marketing)/
│   ├── layout.tsx        # applies to marketing pages, not in the URL
│   └── about/
│       └── page.tsx      -> /about
└── (shop)/
    └── cart/
        └── page.tsx      -> /cart
```

Group segments never consume URL parts. Their layouts, protection and metadata still apply along the chain.

## Parallel routes

```text
app/
├── layout.tsx
├── @sidebar/
│   ├── page.tsx          # rendered for "/" in the sidebar slot
│   └── settings/
│       └── page.tsx      # rendered for /settings in the sidebar slot
├── @modal/
│   └── default.tsx       # fallback when no slot page matches
└── page.tsx
```

The layout receives each slot as a prop named after the slot: `<Layout>{children}<SidebarProp/></Layout>`. Slots are matched independently against the path remaining after that layout level; a slot with no match renders its `default` component or nothing.

## Route protection with exports

Page, layout and route modules can declare protection, which the router collects from the whole layout chain:

```tsx
// plugins/panel-plugin/src/app/[prefix]/settings/page.tsx
export const auth = true; // require a session
export const roles = ["admin"]; // at least one of these roles
export const permissions = ["settings:read"]; // ALL of these permissions

export default async function SettingsPage() {
  /* ... */
}
```

Semantics after collection (`EnsuredAuth` middleware): unauthenticated users are redirected to `/signin`; authenticated users failing role/permission checks are redirected to the security check's redirect target (or `/signin`). API routes return `401` JSON instead of redirecting.

`EnsuredGuest` (redirects signed-in users away) and `EnsuredUser` (session required, no RBAC) are exported from `@veap/core/router` for use in `middlewares` arrays.

## Custom middleware

```ts
// any module; referenced from page/layout/route or node.middlewares
import type { VeapMiddleware } from "@veap/core/plugins";

export const requestLogger: VeapMiddleware = async (ctx, next) => {
  const start = Date.now();
  const result = await next();
  console.log(`${ctx.path} took ${Date.now() - start}ms`);
  return result;
};
```

```tsx
// page.tsx
import { requestLogger } from "./middleware";
export const middlewares = [requestLogger];
export default function Page() {
  /* ... */
}
```

The context (`VeapMiddlewareContext`) carries `params`, `searchParams`, `path`, `roles`, `permissions`. Call `next()` to continue; return something else to short-circuit. API middleware has signature `(request, context, next) => Promise<Response>`. See [Middleware](./middleware.md).

## API routes

```text
plugins/blog-plugin/src/app/api/
└── blog/
    └── posts/
        └── route.ts      -> /api/blog/posts
```

```ts
// route.ts
export async function GET(request: Request, ctx: { params: any }) {
  const posts = await Post.query().latest().limit(10).get();
  return Response.json(posts.map((p) => p.toJSON()));
}

export async function POST(request: Request, ctx: { params: any }) {
  const body = await request.json();
  const post = await Post.create(body);
  return Response.json(post.toJSON(), { status: 201 });
}
```

The host catch-all (`app/api/[...catchAll]/route.ts`) matches `/api/**` against the merged tree, collects middlewares and protection exactly like pages, and dispatches to the method handler export. Unmatched methods return `405`; unmatched paths return `404`.

## Metadata

Page and layout modules can export `generateMetadata`; the router merges them along the matched path (leaf wins for conflicting keys):

```tsx
import type { Metadata } from "next";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Record<string, string>;
  searchParams: Record<string, string>;
}): Promise<Metadata> {
  const post = await Post.query().where("slug", params.slug).first();
  return { title: post?.title ?? "Post" };
}
```

The host catch-all calls `tree.generateMetadata(path, searchParams)` for every URL, so metadata works for virtual routes without per-URL files.

## Breadcrumbs

Route nodes accept a `breadcrumb` (string, `BreadcrumbItem`, array, or async function receiving page props). `getPluginBreadcrumbs(path)` walks the path prefix by prefix, resolving breadcrumbs and falling back to navigation titles. See the plugin chapter for usage.
