# Routing & Next.js Integration

Veap handles routing via a hybrid engine that marries the virtual plugin ecosystem with the Next.js physical filesystem.

## 1. Virtual Route Tree

Plugins declare their routes statically or rely on filesystem discovery during `bun dev`. These routes form the **Virtual Route Tree**.

Next.js intercepts all dynamic requests via the Catch-All route `app/[[...catchAll]]/page.tsx` and passes them to `VeapRouter`. The virtual router then:

- Matches the path.
- Executes the required middlewares.
- Builds the nested layout chain (including parallel `@slots`).

## 2. No Templates - Just Eject

Veap does not employ a proprietary template engine. If a developer wishes to override a plugin's layout (e.g., changing the admin sidebar), they must **eject** the plugin code into their workspace and edit it natively as standard React components.

## 3. Physical Page Integration (`withRouter`)

When developers create physical Next.js pages (e.g., `app/custom-page/page.tsx`), these pages naturally bypass the Virtual Router.

To bring physical pages back into the Veap ecosystem (to inherit layouts, sidebars, and middleware protection), developers must wrap the page export with the `withRouter` HOC:

```tsx
import { withRouter } from "@veap/core/router";

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

This pattern ensures the Next.js `/app` directory remains clean, while allowing standard React development seamlessly integrated with plugin-provided layouts.
