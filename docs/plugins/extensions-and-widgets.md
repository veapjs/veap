# Extensions and widgets

Extensions and widgets let plugins inject user interfaces into host components without any direct imports from the host application. The host declares _where_ using extension points and widget areas, plugins declare _what_, and the kernel resolves the composition at render time with role-based access control (RBAC).

## Extension points (server)

An extension point renders extensions registered for a given `target` and `point` pair. You can render multiple injected components or select a single component using the `mode` property.

```tsx
// host component (your app or another plugin)
import { ExtensionPoint } from "@veap/framework/plugins/server";

export function ArticleFooter() {
  return (
    <footer>
      <ExtensionPoint target="article" point="footer-actions" />
    </footer>
  );
}
```

A plugin registers an extension in its `IPlugin` declaration:

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

### Extension point properties

| Prop              | Type                     | Default      | Description                                                                                   |
| ----------------- | ------------------------ | ------------ | --------------------------------------------------------------------------------------------- |
| `target`          | `string`                 | -            | Host component or view identifier (for example, `"app"`, `"article"`, `"posts.edit"`).        |
| `point`           | `string`                 | -            | Slot location within the target (for example, `"navbar"`, `"footer"`, `"sidebar"`).           |
| `mode`            | `"single" \| "multiple"` | `"multiple"` | Resolution strategy. In `"single"` mode, only the highest-priority extension renders.         |
| `props`           | `any`                    | -            | Context object spread into each injected extension component as React props.                  |
| `className`       | `string`                 | -            | CSS class names applied to the container wrapper element.                                     |
| `as`              | `React.ElementType`      | `"div"`      | Wrapper element (for example, `"section"`, `"nav"`). Unused in `"single"` mode unless styled. |
| `children`        | `React.ReactNode`        | -            | Idiomatic JSX fallback rendered when no extensions match or when RBAC checks fail.            |
| `fallback`        | `React.ReactNode`        | `null`       | Alternative fallback prop rendered when no extensions match.                                  |
| `includeDisabled` | `boolean`                | `false`      | Whether to include extensions from disabled plugins.                                          |

The alias `PluginExtensionPoint` is exported as an alternative name for `ExtensionPoint`.

### Rendering modes: single vs multiple

The `mode` prop determines how collisions between multiple plugins targeting the same slot are resolved.

#### Multiple mode (default)

When `mode="multiple"`, all matching extensions are sorted by their `priority` and rendered sequentially inside the wrapper container:

```tsx
<ExtensionPoint
  target="article"
  point="footer-actions"
  mode="multiple"
  as="div"
  className="flex items-center gap-4"
/>
```

#### Single mode and fallback components

When building extensible page shells such as navigation headers or footers, you typically want only **one** component to occupy the slot. Setting `mode="single"` tells Veap to select the single extension with the highest priority (the lowest `priority` number).

If no plugins provide an extension for that slot, or if the user lacks the required roles or permissions, the extension point renders its `children` (or `fallback` prop) as the default UI:

```tsx
// app/layout.tsx or components/layout-shell.tsx
import { ExtensionPoint } from "@veap/framework/plugins/server";
import { DefaultAppFooter } from "./default-footer";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>

      {/* Render the highest priority plugin footer, or fall back to DefaultAppFooter */}
      <ExtensionPoint target="app" point="footer" mode="single">
        <DefaultAppFooter />
      </ExtensionPoint>
    </div>
  );
}
```

In `mode="single"`, if neither `as` nor `className` is specified, Veap renders the extension component directly into the tree without an extraneous wrapper element.

### Passing context to extensions

The host view can pass dynamic domain context (such as the active model or form handler) to injected components via the `props` attribute:

```tsx
// Host component: app/[prefix]/posts/[id]/page.tsx
import { ExtensionPoint } from "@veap/framework/plugins/server";
import { Post } from "@veap/framework/database";

export default async function EditPostPage({
  params,
}: {
  params: { id: string };
}) {
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

The plugin component receives `post` as a standard React prop:

```tsx
// Plugin component: plugins/seo-plugin/src/ui/seo-sidebar-box.tsx
import type { Post } from "@veap/framework/database";

interface SeoSidebarProps {
  post: Post;
}

export default function SeoSidebarBox({ post }: SeoSidebarProps) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <h3 className="text-sm font-semibold">SEO Analysis</h3>
      <p className="text-muted-foreground text-xs">
        Slug: {post.slug || "None"}
      </p>
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
    roles: ["admin", "super-admin"], // OR condition: user must have at least one role
    permissions: ["posts:delete"], // AND condition: user must have all listed permissions
  },
];
```

When evaluating access:

1. **Roles check**: If a `roles` array is provided, the user must have **at least one** matching role (`roles.some(...)`).
2. **Permissions check**: If a `permissions` array is provided, the user must possess **all** listed permissions (`permissions.every(...)`).
3. If the user does not satisfy the criteria, the extension is omitted from rendering. If all extensions are filtered out, the fallback is displayed.

### Priority and ordering

Extensions and widgets are sorted ascending by their `priority` number:

- Lower numbers render earlier: an extension with `priority: 10` renders above `priority: 50`.
- In `mode="single"`, the extension with the lowest priority number wins and replaces all other candidates.
- Extensions without an explicit `priority` default to `100`.

## Widget areas (server)

Widgets are the dashboard-oriented variant: they live in named areas and carry layout hints.

```tsx
import { WidgetArea } from "@veap/framework/plugins/server";

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

`WidgetArea` props mirror extension points (`area` instead of `target`/`point`). The `WidgetComposer` component (also from `@veap/framework/plugins/server`) composes an area into a configurable grid with per-user drag-and-drop state persisted through the `user_widgets` table.

## Client components

In interactive Client Components (marked with `"use client"`), use `ExtensionPointClient` from `@veap/framework/plugins/client`:

```tsx
"use client";

import { ExtensionPointClient } from "@veap/framework/plugins/client";

export function RichTextEditorToolbar({ editor }: { editor: any }) {
  return (
    <div className="flex items-center gap-2 border-b p-2">
      {/* Core formatting buttons */}
      <button onClick={() => editor.toggleBold()}>Bold</button>
      <button onClick={() => editor.toggleItalic()}>Italic</button>

      {/* Dynamic plugin buttons injected here */}
      <ExtensionPointClient
        target="editor"
        point="toolbar"
        props={{ editor }}
        className="ml-auto flex items-center gap-2"
      />
    </div>
  );
}
```

`ExtensionPointClient` supports the same `mode?: "single" | "multiple"`, `children`, and `fallback` props.

### Custom client rendering with `usePluginExtensions`

If you need programmatic control over how extensions are structured or wrapped on the client:

```tsx
"use client";

import { usePluginExtensions } from "@veap/framework/plugins/client";

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

The hook automatically re-fetches extensions whenever plugins are enabled, disabled, or updated.

## Well-known points used by the platform

| Target          | Point                               | Used for                                                 |
| --------------- | ----------------------------------- | -------------------------------------------------------- |
| `app`           | `before-content`, `after-content`   | Injected around the whole application in the root layout |
| `app`           | `navbar`, `footer`                  | Common slots for layout shell header and footer          |
| `panel`         | `plugin-setup-dialogs`              | Setup dialogs for plugins with `hasSetup`                |
| dashboard areas | `dashboard-stats`, `dashboard-main` | Admin dashboard widgets                                  |

Your own targets and points are first-class: pick a target identifier (usually the component name) and point names that describe the slot (`"sidebar-top"`, `"header-actions"`).

## Hooks vs extensions

Use extensions and widgets for user interface composition. Use hooks (see [Hooks](./hooks.md)) for data transformation pipelines. If you find yourself rendering HTML from a hook, use an extension instead.
