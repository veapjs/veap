# Extensions and widgets

Extensions and widgets are how plugins inject UI into host components without any import from the host. The host declares _where_ (extension points, widget areas), plugins declare _what_, and the kernel resolves the composition at render time with RBAC filtering.

## Extension points (server)

An extension point renders all extensions registered for a `target` + `point` pair:

```tsx
// host component (your app or another plugin)
import { ExtensionPoint } from "@veap/core/plugins/server";

export function ArticleFooter() {
  return (
    <footer>
      <ExtensionPoint target="article" point="footer-actions" />
    </footer>
  );
}
```

A plugin registers an extension:

```ts
// in the IPlugin object
extensions: [
  {
    id: "share-buttons",
    target: "article",
    point: "footer-actions",
    component: ShareButtons,      // React component (async server components allowed)
    priority: 10,                 // lower renders first (default 100)
    roles: ["editor"],            // optional RBAC filter
    permissions: ["article:share"],
    metadata: { variant: "compact" },
  },
],
```

`ExtensionPoint` props: `target`, `point`, `className`, `props` (spread into each extension component), `fallback` (rendered when nothing matches), `as` (container element, default `div`), `includeDisabled` (include extensions of disabled plugins, default false). The alias `PluginExtensionPoint` is the long name for the same component.

Extensions receive the user's roles/permissions from `getCurrentSession()` and are filtered before render.

## Widget areas (server)

Widgets are the dashboard-oriented variant: they live in named areas and carry layout hints.

```tsx
import { WidgetArea } from "@veap/core/plugins/server";

<WidgetArea area="dashboard-stats" className="grid grid-cols-4 gap-4" />;
```

```ts
widgets: [
  {
    id: "blog-stats",
    name: "Blog Stats",
    area: "dashboard-stats",
    component: BlogStatsWidget,
    priority: 20,
    defaultColSpan: 2,
    defaultRowSpan: 1,
    roles: ["admin"],
  },
],
```

`WidgetArea` props mirror extension points (`area` instead of `target`/`point`). The `WidgetComposer` component (also from `@veap/core/plugins/server`) composes an area into a configurable grid with per-user drag-and-drop state persisted through the `user_widgets` table.

## Client components

For client-rendered composition the client entry exposes `ExtensionPointClient` / `WidgetAreaClient` (aliases `ExtensionPoint`, `WidgetArea`) and the hooks `usePluginExtensions` / `usePluginWidgets` from `@veap/core/plugins/client`. These fetch the same data through server actions (`getPluginExtensionsAction`, `getPluginWidgetsAction`) and re-render when plugins change (the client module exports `notifyPluginsChanged` for that).

## Well-known points used by the platform

| Target          | Point                               | Used for                                                 |
| --------------- | ----------------------------------- | -------------------------------------------------------- |
| `app`           | `before-content`, `after-content`   | injected around the whole application in the root layout |
| `panel`         | `plugin-setup-dialogs`              | setup dialogs for plugins with `hasSetup`                |
| dashboard areas | `dashboard-stats`, `dashboard-main` | admin dashboard widgets                                  |

Your own targets and points are first-class: pick a target id (usually the component's name) and point names that describe the slot (`"sidebar-top"`, `"header-actions"`).

## Hooks vs extensions

Use extensions/widgets for UI. Use hooks (see [Hooks](./hooks.md)) for data transformation pipelines. If you find yourself rendering HTML from a hook, it should have been an extension.
