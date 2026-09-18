# Templates

Templates are themes for the public side of the application. A template provides a layout and optional component overrides; the kernel applies it to pages outside the private prefix that are not already wrapped by a plugin layout.

## The ITemplate contract

```ts
import type { ITemplate } from "@veap/core/plugins";

const minimalTemplate: ITemplate = {
  id: "minimal",
  name: "Minimal",
  description: "A clean public theme",
  version: "1.0.0",
  author: "You",
  thumbnail: "/templates/minimal/thumbnail.png",

  locales: {
    en: () => import("./locales/en"),
    pl: () => import("./locales/pl"),
  },

  layout: TemplateLayout, // (props: { children, config, breadcrumbs }) => JSX

  overrides: {
    // route id -> component (from routeTree node ids)
    "blog/[slug]": CustomPostPage,
    // layout override: "<id>/layout"
    "blog/[slug]/layout": CustomPostLayout,
  },

  configSchema: myZodSchema, // optional, for settings UI
  defaultConfig: { postsPerPage: 10 },
};
```

## Registering and activating

```ts
// lib/veap.ts
import { default as MinimalTemplate } from "@veap/minimal-template";

Application.configure()
  // ...
  .withTemplates([MinimalTemplate])
  .create();
```

Templates register into `TemplateService` (like plugins, synced with the `templates` table). Exactly one template is active, stored in settings under `system:template`; the first registered template is the fallback. Activation and config editing are surfaced by the panel plugin under admin settings.

```ts
import {
  getActiveTemplate,
  setActiveTemplate,
  getTemplateConfig,
  updateTemplateConfig,
} from "@veap/core/plugins/server";
```

`getActiveTemplate()` and `getTemplateConfig(id)` are React-cached per request.

## How the router applies templates

In `buildLayoutTree` (the render pipeline):

1. `getActiveTemplate()` resolves the active template.
2. The URL is compared with the private prefix (`privatePath`, default `/app`); only public URLs get the template.
3. If the matched route tree has no layout of its own (and the path is not `/setup`), the template's `layout` wraps the content with `config` and `breadcrumbs`.
4. Overrides: when a route node (or layout level) declares an `id` and the template maps that id in `overrides`, the template's component replaces the original. Page override key: the node id. Layout override key: `${id}/layout`.
5. `getTemplateConfig(id)` merges `defaultConfig` with the saved JSON config (saved wins), and the merged object is passed to pages as the `config` prop.

## Writing a template layout

```tsx
// templates/minimal/src/layout.tsx
import Link from "next/link";
import { getPluginNavigation } from "@veap/core/plugins/server";
import type { BreadcrumbItem } from "@veap/core/plugins";

export default function MinimalLayout({
  children,
  config,
  breadcrumbs,
}: {
  children: React.ReactNode;
  config: any;
  breadcrumbs?: BreadcrumbItem[];
}) {
  return (
    <div className="min-h-screen">
      <header>{/* navigation from getPluginNavigation("public") */}</header>
      {breadcrumbs && <nav>{/* breadcrumb trail */}</nav>}
      <main>{children}</main>
      <footer>{/* ... */}</footer>
    </div>
  );
}
```

The layout is a Server Component; it can use the full server API (session, navigation, intl).

## Creating one

```bash
bun veap make:template my-template
```

scaffolds the package under `templates/`. Add it to `.withTemplates([...])` and activate it in the panel.

## Ejecting an installed template

To customize an installed npm template package directly in your local workspace:

```bash
bunx veap eject @veap/minimal-template
```

The CLI:
1. Clones the template source repository into your local `templates/minimal-template` directory.
2. Updates your root `package.json` dependency to `"workspace:*"`.
3. Links the local template package via your package manager without registering it in `lib/plugins.gen.ts`.

## Relationship with plugins

Templates restyle; plugins provide features. A template should not register widgets or extensions (it is not a plugin); the override map is its only way to change existing screens, and it keeps plugin behavior intact because only the presentation swaps.
