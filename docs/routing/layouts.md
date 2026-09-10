# Layouts

Layouts wrap pages and nested segments. Veap supports layouts in three places: the physical Next.js root layout, plugin route-tree layouts, and template layouts for public pages.

## Root layout (physical)

`app/layout.tsx` is the real Next.js root layout and the boot seam of the application:

```tsx
import { I18nProvider } from "@veap/core/intl/server";
import { ExtensionPoint, getPathPrefix } from "@veap/core/plugins/server";
import { AppProvider } from "@veap/core/react";
import { getCurrentSession, isSystemInstalled } from "@veap/core/auth/server";
import { initializeSystem } from "@/lib/veap";

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  await initializeSystem();
  const installed = await isSystemInstalled();
  const session = installed
    ? await getCurrentSession()
    : { session: null, user: null };
  const pathPrefix = await getPathPrefix();

  return (
    <html lang="en">
      <body>
        <I18nProvider>
          <AppProvider initialSession={session} prefix={pathPrefix}>
            <ExtensionPoint target="app" point="before-content" />
            {children}
            <ExtensionPoint target="app" point="after-content" />
          </AppProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
```

Points to keep:

- `export const dynamic = "force-dynamic"` is required. Without it, `next build` prerenders `/_not-found` during the build phase, bootstrap intentionally skips provider boot, and context-bound helpers throw `Context is not bound`. This is a deliberate trade-off (framework decision record ADR-006).
- `ExtensionPoint target="app"` lets plugins inject content around the whole application without touching this file.
- `AppProvider` wraps the tree in theme, tooltip, toaster and auth contexts (client). `initialSession` seeds the client auth context from the server-side session lookup.

## Plugin route-tree layouts

Any directory in a plugin's `app/` tree can provide `layout.tsx`; the discovered node gets a `layout` property. At render time the router builds the nested tree from the matched layout chain, innermost first:

```tsx
// plugins/shop-plugin/src/app/shop/layout.tsx
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="shop-shell">
      <aside>...</aside>
      <main>{children}</main>
    </div>
  );
}
```

Layouts receive:

| Prop       | Content                                               |
| ---------- | ----------------------------------------------------- |
| `children` | the wrapped subtree                                   |
| `params`   | matched route params                                  |
| `context`  | `VeapMiddlewareContext` after middleware              |
| slot props | resolved parallel slot subtrees, one prop per `@slot` |

Layout modules may export `auth`, `roles`, `permissions` and `middlewares`, applying to every route beneath them.

## Boundaries per level

Each layout level can also provide `loading.tsx` and `error.tsx`; the router wraps the subtree at that level in a Suspense boundary (with the loading component as fallback) and a `RouterErrorBoundary`. `not-found.tsx` at any level is used for partial matches beneath it.

## Template layouts (public pages)

When the URL is outside the private prefix and no plugin layout matched, the active template's `layout` wraps the page. Templates are `ITemplate` objects with a `layout` component receiving `config`, `breadcrumbs` and `children`; the template system is described in [Templates](../plugins/templates.md). The `/setup` path is excluded from template wrapping, and a page already wrapped by a plugin layout is not double-wrapped.

## Physical pages with withRouter

A physical Next.js page can opt into the virtual router to inherit layouts, slots and protection:

```tsx
import { withRouter } from "@veap/core/router";

export default withRouter(async function CustomPage() {
  return <div>My Custom Physical Page</div>;
}, "/app/custom");
```

The second argument is a path or a config object `{ path, roles, permissions, middlewares }`. If omitted, the path is inferred from the `x-invoke-path` header (set for you by `proxy.ts`). See [Physical pages and withRouter](./physical-pages.md).
