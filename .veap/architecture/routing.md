# Routing & Next.js Integration

Veap handles routing via a hybrid engine that marries the virtual plugin ecosystem with the Next.js physical filesystem.

## 1. Virtual Route Tree

Plugins declare their routes statically or rely on filesystem discovery during `bun dev`. These routes form the **Virtual Route Tree**.

Next.js intercepts requests via the Catch-All route `app/[[...catchAll]]/page.tsx` and passes them to `VeapRouter`. The virtual router then:

- Matches the path.
- Executes the required middlewares.
- Builds the nested layout chain (including parallel `@slots`).

## 2. App Shell Slots & ExtensionPoints

Visual customization and layout injection are decoupled from monolithic themes:

- **App Shell Slots**: The host application layout (`app/layout.tsx`) declares modular extension points (e.g. `<ExtensionPoint target="app" point="navbar" mode="single" />`).
- **Priority Resolution**: Plugins register extensions targeting these points. When `mode="single"` is configured, Veap renders the extension with the highest priority (lowest numerical value), falling back to the host application's default markup (children) if no plugins match.
- **Multi-Plugin Widgets**: Multiple plugins can contribute widgets to the same slot (e.g., sidebar widgets, status bars, dashboards) when `mode="multiple"` (the default) is used.

## 3. Physical Page Shadowing & Customization

Because Veap sits on top of standard Next.js App Router conventions:

- **Route Shadowing**: If an application wants to replace or customize a plugin page (e.g. `/signin` or `/blog/[slug]`), the developer simply creates a physical file at that path in the Next.js app folder (e.g. `app/(auth)/signin/page.tsx`). Next.js serves the physical file directly, naturally shadowing and bypassing the catch-all virtual route.
- **Ejecting Plugins**: When deeper modifications to plugin internals or schema migrations are desired, developers can run `veap eject <plugin>` to copy the package into `plugins/` for direct local editing.

## 4. Physical Page Integration (`withRouter`)

When developers create physical Next.js pages but still want them to inherit virtual plugin layouts, breadcrumbs, and middleware protection:

```tsx
import { withRouter } from "@veap/framework/router";

export default withRouter(
  async function CustomPage() {
    return <div>My physical page content</div>;
  },
  {
    path: "/app/custom", // The virtual path to match against the route tree for layout inheritance
    roles: ["admin"], // Optional extra security requirements
  },
);
```

## 5. Route Rewrites

Veap's Virtual Router supports internal path rewrites via `RouteTree.addRewrite(from, to)` and `RouterService.addRewrite(from, to)`:

- **Transparent Mapping**: When a user accesses an incoming path (e.g. `/logowanie`), the Virtual Router resolves the rewrite target (`/signin`) and matches the corresponding plugin component without issuing an HTTP redirect.
- **Configurable Domain Paths**: Core domains (like `AuthServiceProvider`) use rewrites to allow applications to customize public URLs (e.g., in `Application.configure().withAuth({ routes: { signIn: "/logowanie" } })`) while plugins continue to use canonical directory paths (`signin/page.tsx`).
