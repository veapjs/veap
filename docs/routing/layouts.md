# Layouts and slots

Layouts wrap pages and nested route segments. Veap supports layouts through native Next.js root and directory layouts, declarative public layouts (`.withSiteLayout()`), plugin route-tree layouts, and modular UI slot injection using `ExtensionPoint`.

## Root layout (physical)

`app/layout.tsx` is the real Next.js root layout and the boot seam of the application:

```tsx
import { I18nProvider } from "@veap/framework/intl/server";
import { ExtensionPoint, getPathPrefix } from "@veap/framework/plugins/server";
import { AppProvider } from "@veap/framework/react";
import {
  getCurrentSession,
  isSystemInstalled,
} from "@veap/framework/auth/server";
import { initializeSystem } from "@/lib/veap";

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

Key points to understand:

- `export const dynamic = "force-dynamic"` is required. Without it, `next build` prerenders `/_not-found` during the build phase, bootstrap intentionally skips provider boot, and context-bound helpers throw `Context is not bound`. This is a deliberate trade-off (framework decision record ADR-006).
- `ExtensionPoint target="app"` lets plugins inject content around the whole application without modifying this file.
- `AppProvider` wraps the tree in theme, tooltip, toaster and auth contexts (client). `initialSession` seeds the client auth context from the server-side session lookup.
- Notice that `app/layout.tsx` contains no visual navbar or footer. Visual public shells are decoupled from the root layout so that administrative surfaces (such as the admin panel) remain clean.

## Declarative public layouts with withSiteLayout()

To provide a consistent header, navigation bar, and footer across both physical public pages and virtual plugin pages (such as `/blog` from `@veap/blog-plugin`), configure a site layout in your composition root:

```tsx
// lib/veap.ts
import { Application } from "@veap/framework/core/server";
import { SiteLayout } from "@/components/site-layout";
import { plugins } from "./plugins.gen";

export const app = Application.configure()
  .withDatabase()
  .withAuth()
  .withRouter()
  .withSiteLayout(SiteLayout)
  .withPlugins(plugins)
  .create();
```

When you declare `.withSiteLayout(SiteLayout)`:

1. **Virtual public routes**: The Veap router binds `SiteLayout` to the `(site)` route group in `RouteTree`. Any plugin route that lives within `(site)` (for example, `/blog`, `/blog/[slug]`) automatically renders inside `SiteLayout`.
2. **Admin panel isolation**: Routes under `[prefix]` (for example, `/app/*` provided by `@veap/panel-plugin`) never inherit `SiteLayout`. They render inside their own panel shell without duplicate navbars or footers.
3. **Physical public routes**: Organize your host application's public pages in `app/(site)/` (for example, `app/(site)/page.tsx` and `app/(site)/layout.tsx`) so that native Next.js pages and virtual plugin pages share the exact same UI shell.

## Modular shells with ExtensionPoint

Rather than relying on closed, monolithic theme templates, Veap applications compose their public and administrative shells using standard React components alongside `<ExtensionPoint />`.

Plugins can inject navigation headers, footers, or announcement banners into predefined application slots. Using `mode="single"`, the host application provides default components as fallback children. If an installed plugin registers a higher-priority component for that slot, it replaces the default:

```tsx
// components/site-layout.tsx
import { ExtensionPoint } from "@veap/framework/plugins/server";
import { DefaultNavbar } from "@/components/default-navbar";
import { DefaultFooter } from "@/components/default-footer";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-between">
      {/* Plugin can override navbar; otherwise renders DefaultNavbar */}
      <ExtensionPoint target="app" point="navbar" mode="single">
        <DefaultNavbar />
      </ExtensionPoint>

      <main className="flex-1 w-full">{children}</main>

      {/* Plugin can override footer; otherwise renders DefaultFooter */}
      <ExtensionPoint target="app" point="footer" mode="single">
        <DefaultFooter />
      </ExtensionPoint>
    </div>
  );
}
```

When multiple plugins provide an extension for the same single-mode slot, the kernel selects the one with the lowest `priority` value (for example, `priority: 10` takes precedence over `priority: 50`).

## Plugin route-tree layouts

Any directory in a plugin's `app/` tree can provide `layout.tsx`; the discovered node receives a `layout` property. At render time the router builds the nested tree from the matched layout chain, innermost first:

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
| `children` | The wrapped subtree                                   |
| `params`   | Matched route parameters                              |
| `context`  | `VeapMiddlewareContext` after middleware              |
| slot props | Resolved parallel slot subtrees, one prop per `@slot` |

Layout modules may export `auth`, `roles`, `permissions` and `middlewares`, which apply to every route beneath them.

## Boundaries per level

Each layout level can provide `loading.tsx` and `error.tsx`. The router wraps the subtree at that level in a React `Suspense` boundary (with the loading component as fallback) and a `RouterErrorBoundary`. A `not-found.tsx` at any level handles partial matches beneath it.

## Overriding plugin UI with Next.js file shadowing

Because Veap is an additive layer on top of Next.js App Router, host applications do not need template override systems to customize plugin user interfaces.

Next.js file-system routing takes precedence over the catch-all virtual router. If a plugin provides a page at `/signin` or `/blog/[slug]`, you can override its UI simply by creating a physical Next.js file at `app/(auth)/signin/page.tsx` or `app/(site)/blog/[slug]/page.tsx`.

The physical Next.js page renders your custom UI, while retaining full access to the plugin's backend services, models, and Server Actions.

## Physical pages with withRouter

A physical Next.js page can opt into the virtual router to inherit layouts, slots, and route protection:

```tsx
import { withRouter } from "@veap/framework/router";

export default withRouter(async function CustomPage() {
  return <div>My Custom Physical Page</div>;
}, "/app/custom");
```

The second argument is a path or a configuration object `{ path, roles, permissions, middlewares }`. If omitted, the path is inferred from the `x-invoke-path` header (set for you by `proxy.ts`). See [Physical pages and withRouter](./physical-pages.md).
