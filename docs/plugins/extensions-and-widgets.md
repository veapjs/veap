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

`ExtensionPoint` props:

| Prop              | Type                | Default | Description                                                                |
| ----------------- | ------------------- | ------- | -------------------------------------------------------------------------- |
| `target`          | `string`            | —       | Host component or view identifier (e.g. `"article"`, `"posts.edit"`)       |
| `point`           | `string`            | —       | Slot location within the target (e.g. `"sidebar"`, `"footer-actions"`)     |
| `props`           | `any`               | —       | Context object spread into each injected extension component               |
| `className`       | `string`            | —       | CSS class names applied to the container wrapper element                   |
| `as`              | `React.ElementType` | `"div"` | Wrapper element (e.g. `"section"`, `"ul"`, `"nav"`)                        |
| `fallback`        | `React.ReactNode`   | `null`  | Rendered when no extensions match or when the user fails RBAC checks       |
| `includeDisabled` | `boolean`           | `false` | Whether to include extensions from disabled plugins                        |

The alias `PluginExtensionPoint` is exported as an alternative name for `ExtensionPoint`.

### Passing context to extensions

The host view can pass dynamic domain context (such as the active model or form handler) to injected components via the `props` attribute:

```tsx
// Host component: app/[prefix]/posts/[id]/page.tsx
import { ExtensionPoint } from "@veap/core/plugins/server";
import { Post } from "@veap/core/database";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const post = await Post.findOrFail(params.id);

  return (
    <div className="grid grid-cols-3 gap-6">
      <main className="col-span-2">
        <h1>Editing: {post.title}</h1>
      </main>

      {/* Render sidebar extensions with the post passed as context */}
      <aside>
        <ExtensionPoint
          target="posts.edit"
          point="sidebar"
          props={{ post }}
          as="section"
          className="space-y-4"
        />
      </aside>
    </div>
  );
}
```

The plugin component simply receives `post` as a standard React prop:

```tsx
// Plugin component: plugins/seo-plugin/src/ui/seo-sidebar-box.tsx
import type { Post } from "@veap/core/database";

interface SeoSidebarProps {
  post: Post;
}

export default function SeoSidebarBox({ post }: SeoSidebarProps) {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <h3 className="font-semibold text-sm">SEO Analysis</h3>
      <p className="text-xs text-muted-foreground">Slug: {post.slug || "None"}</p>
    </div>
  );
}
```

### RBAC evaluation rules

Extensions and widgets can be protected by user roles and permissions:

```ts
extensions: [
  {
    id: "danger-zone",
    target: "posts.edit",
    point: "sidebar",
    component: DangerZoneComponent,
    roles: ["admin", "super-admin"],      // OR condition: user must have at least one role
    permissions: ["posts:delete"],         // AND condition: user must have all listed permissions
  },
]
```

When evaluating access:
1. **Roles check**: If `roles` array is provided, the user must have **at least one** matching role (`roles.some(...)`).
2. **Permissions check**: If `permissions` array is provided, the user must possess **all** listed permissions (`permissions.every(...)`).
3. If the user does not satisfy the criteria, the extension is omitted from rendering. If all extensions are filtered out, the `fallback` prop is displayed.

### Priority and ordering

Extensions and widgets are sorted ascending by their `priority` number:
- Lower numbers render earlier: an extension with `priority: 10` renders above `priority: 50`.
- Extensions without an explicit `priority` default to `100` and appear at the end.

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

In interactive Client Components (marked with `"use client"`), use `ExtensionPointClient` from `@veap/core/plugins/client`:

```tsx
"use client";

import { ExtensionPointClient } from "@veap/core/plugins/client";

export function RichTextEditorToolbar({ editor }: { editor: any }) {
  return (
    <div className="flex items-center gap-2 p-2 border-b">
      {/* Core formatting buttons */}
      <button onClick={() => editor.toggleBold()}>Bold</button>
      <button onClick={() => editor.toggleItalic()}>Italic</button>

      {/* Dynamic plugin buttons injected here */}
      <ExtensionPointClient
        target="editor"
        point="toolbar"
        props={{ editor }}
        className="flex items-center gap-2 ml-auto"
      />
    </div>
  );
}
```

### Custom client rendering with `usePluginExtensions`

If you need programmatic control over how extensions are structured or wrapped on the client:

```tsx
"use client";

import { usePluginExtensions } from "@veap/core/plugins/client";

export function CustomNavigationMenu() {
  const extensions = usePluginExtensions("navigation", "menu-items");

  return (
    <ul className="flex flex-col gap-1">
      {extensions.map((ext) => {
        const Component = ext.component;
        return (
          <li key={ext.id} className="nav-item">
            <Component />
          </li>
        );
      })}
    </ul>
  );
}
```

The hook automatically re-fetches extensions whenever plugins are enabled, disabled, or updated via `onPluginsChanged`.

## Well-known points used by the platform

| Target          | Point                               | Used for                                                 |
| --------------- | ----------------------------------- | -------------------------------------------------------- |
| `app`           | `before-content`, `after-content`   | injected around the whole application in the root layout |
| `panel`         | `plugin-setup-dialogs`              | setup dialogs for plugins with `hasSetup`                |
| dashboard areas | `dashboard-stats`, `dashboard-main` | admin dashboard widgets                                  |

Your own targets and points are first-class: pick a target id (usually the component's name) and point names that describe the slot (`"sidebar-top"`, `"header-actions"`).

## Hooks vs extensions

Use extensions/widgets for UI composition. Use hooks (see [Hooks](./hooks.md)) for data transformation pipelines. If you find yourself rendering HTML from a hook, it should be an extension.
