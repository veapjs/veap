# Your first plugin

This guide builds a working plugin step by step: scaffold it, register a route, render a page, add a widget, and persist data. It uses only APIs documented in the [plugins chapter](../plugins/index.md) and the [reference](../reference/entry-points.md).

## Prerequisites

A generated Veap application (`create-veap`), dev server running (`bun dev`).

## 1. Scaffold

```bash
veap make:plugin notes
```

The generator creates a workspace package `plugins/notes-plugin` with a manifest, an entry file and a routes directory. Register it in the application (the CLI prints the exact step, or run `veap add`/`veap register` for an external package):

```ts
// lib/veap.ts (generated, adjusted)
import NotesPlugin from "../plugins/notes-plugin/src/index";

const plugins = [/* generated entries..., */ NotesPlugin];
```

and rebuild the generated registry if your project uses `plugins.gen.ts` (`veap register` refreshes it).

## 2. The manifest

Each plugin declares itself:

```ts
// plugins/notes-plugin/src/index.ts
import type { VeapPlugin } from "@veap/core/plugins";

const NotesPlugin: VeapPlugin = {
  manifest: {
    name: "notes",
    version: "0.1.0",
    description: "Personal notes",
  },
  boot() {
    // optional: register services, subscribe to events
  },
};

export default NotesPlugin;
```

The exact manifest fields are validated by `PluginManifestSchema` (`name`, `version`, `description`, optional navigation, extensions, widgets, hooks).

## 3. A route

Plugin routes are discovered from the plugin's routes directory. Create a page:

```tsx
// plugins/notes-plugin/src/routes/page.tsx
export default function NotesPage() {
  return <h1>Notes</h1>;
}
```

With the dev server running, visit `/<plugin prefix>/notes` (the default prefix is the plugin name under `privatePath`). Route conventions match Next.js: dynamic segments `[id]`, catch-all `[...slug]`, optional catch-all `[[...slug]]` - see [Plugin routing](../plugins/plugin-routing.md).

## 4. Admin navigation

Add navigation in the manifest so the page appears in the admin menu:

```ts
manifest: {
  name: "notes",
  version: "0.1.0",
  navigation: [
    { label: "Notes", path: "/notes" },
  ],
},
```

`getVeapPluginNavigationGrouped()` (server) exposes this to templates; breadcrumbs are derived from the same tree.

## 5. Widgets

Expose a widget another surface can render:

```tsx
// plugins/notes-plugin/src/widgets/recent-notes.tsx
export default async function RecentNotesWidget() {
  return <section>Latest notes</section>;
}
```

Register the widget in the manifest (widgets section) and render it anywhere with:

```tsx
import { PluginExtensionPoint } from "@veap/core/plugins/server";

<PluginExtensionPoint name="dashboard.widgets" />;
```

Every enabled plugin's widget registered for that point renders there - see [Extensions and widgets](../plugins/extensions-and-widgets.md).

## 6. Data

Use the ORM with a model inside the plugin and a migration:

```bash
veap make:migration create_notes_table
```

```ts
// the generated migration file
import type { Knex } from "@veap/core/database";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("notes", (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable();
    table.string("title").notNullable();
    table.text("body");
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("notes");
}
```

```ts
// plugins/notes-plugin/src/models/note.ts
import { Model } from "@veap/core/database";

export class Note extends Model {
  static table = "notes";
}
```

Read in the page (Server Component):

```tsx
// plugins/notes-plugin/src/routes/page.tsx
import { Note } from "../models/note";

export default async function NotesPage() {
  const notes = await Note.query().orderBy("created_at", "desc").limit(10);
  return (
    <ul>
      {notes.map((n) => (
        <li key={n.id}>{n.title}</li>
      ))}
    </ul>
  );
}
```

Write in a Server Action wrapped in a transaction:

```ts
"use server";

import { transaction } from "@veap/core/database";
import { Note } from "../models/note";

export async function createNote(title: string, body: string) {
  return transaction(async (trx) => {
    return Note.query(trx).insert({ title, body });
  });
}
```

## 7. Events and settings

Subscribe to system events in `boot()`:

```ts
boot() {
  eventBus.subscribe("system:auth:user-registered", (event) => {
    // create default notes for new users
  });
}
```

Store plugin configuration through the settings service namespaced by plugin name (see [Settings](../services/settings.md)).

## Next steps

- Guard the admin area with route middlewares (`EnsuredAuth`) - [Middleware](../routing/middleware.md).
- Ship translations in the plugin - [Intl](../services/intl.md).
- Publish the plugin as its own npm package and install it with `veap add`.
