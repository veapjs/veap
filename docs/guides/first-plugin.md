---
title: "Your First Plugin"
description: "Step-by-step tutorial: scaffold, register routes, render widgets, and persist data."
status: "New"
category: "Guides & Cookbook"
author: "Veap Core Team"
lastUpdated: "2026-03"
---

# Your first plugin

This guide builds a working plugin step by step: scaffold it, register a route, render a page, add a widget, and persist data. It uses only APIs documented in the [plugins chapter](../plugins/index.md) and the [reference](../reference/entry-points.md).

## Prerequisites

A generated Veap application (`create-veap`), dev server running (`bun dev`).

## 1. Scaffold

```bash
veap make:plugin notes
```

The generator creates a workspace package `plugins/notes-plugin` with a manifest, an entry file, and adds it to your package manager workspace. The CLI also automatically refreshes `lib/plugins.gen.ts` (or run `veap register` to re-sync manually).

In your application composition root (`lib/veap.ts`), `plugins` imported from `./plugins.gen` automatically include your new plugin.

## 2. The entry point and manifest

Each plugin declares itself through `IPlugin`:

```ts
// plugins/notes-plugin/src/index.ts
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverRoutes } from "@veap/framework/router";
import {
  createManifestFromPackageJson,
  type IPlugin,
} from "@veap/framework/plugins";
import pkg from "../package.json" with { type: "json" };

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "app");

const notesPlugin: IPlugin = {
  manifest: createManifestFromPackageJson(pkg),
  migrations: [],

  init: async () => {
    // optional: register services, subscribe to events
  },

  routeTree: async () =>
    discoverRoutes(appDir, (relPath) => import(`./app/${relPath}`)),
};

export default notesPlugin;
```

The metadata (`id`, `name`, `description`, dependencies) is maintained in `package.json` under the `"veap"` key:

```json
{
  "name": "@veap/notes-plugin",
  "version": "0.0.1",
  "veap": {
    "type": "plugin",
    "id": "notes-plugin",
    "name": "Notes Plugin",
    "description": "Personal notes module.",
    "enabled": true,
    "system": false,
    "hasSetup": false,
    "dependencies": []
  }
}
```

## 3. A route

Plugin routes follow App Router conventions inside `src/app/`. Create an admin page:

```tsx
// plugins/notes-plugin/src/app/[prefix]/notes/page.tsx
export default function NotesPage() {
  return <h1>Notes</h1>;
}
```

The `[prefix]` directory segment dynamically resolves to the configured private prefix (default: `/app`). Visit `/app/notes` in your browser to view the page.

## 4. Admin navigation

Add navigation in the plugin object so the page appears in the admin menu:

```ts
  navigation: {
    admin: {
      Notes: {
        title: "Notes",
        priority: 20,
        items: [
          { title: "My Notes", url: "/notes", icon: "file-text" },
        ],
      },
    },
  },
```

The admin layout and breadcrumb trail automatically pick up this navigation tree.

## 5. Widgets

Expose a widget that dashboard areas can render:

```tsx
// plugins/notes-plugin/src/ui/recent-notes-widget.tsx
export default async function RecentNotesWidget() {
  return <section className="rounded border p-4">Latest notes</section>;
}
```

Register the widget on the plugin definition:

```ts
  widgets: [
    {
      id: "recent-notes",
      name: "Recent Notes",
      area: "dashboard-stats",
      component: RecentNotesWidget,
      priority: 50,
    },
  ],
```

Any layout or page can render all registered widgets for an area using:

```tsx
import { ExtensionPoint } from "@veap/framework/plugins/server";

<ExtensionPoint target="dashboard" point="dashboard-stats" />;
```

## 6. Data

Use the ORM with a model inside the plugin and a migration:

```bash
veap make:migration create_notes_table
```

```ts
// the generated migration file
import type { Knex } from "@veap/framework/database";

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

Export migrations in your plugin's `migrations` array, or manage them at the app level.

```ts
// plugins/notes-plugin/src/models/note.ts
import { Model } from "@veap/framework/database";

export class Note extends Model {
  static table = "notes";
}
```

Read in the page (Server Component):

```tsx
// plugins/notes-plugin/src/app/[prefix]/notes/page.tsx
import { Note } from "../../../models/note";

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

import { transaction } from "@veap/framework/database";
import { Note } from "../models/note";

export async function createNote(title: string, body: string) {
  return transaction(async (trx) => {
    return Note.query(trx).insert({ title, body });
  });
}
```

## 7. Events and settings

Subscribe to system events or publish custom events in `init()`:

```ts
import { eventBus } from "@veap/framework/core";

// Inside init():
init: async () => {
  eventBus.subscribe("system:auth:user-registered", "notes-plugin", async (event) => {
    // create default welcome notes for new users
  });
},
```

Store plugin configuration through the settings service namespaced by plugin name (see [Settings](../services/settings.md)).

## Next steps

- Guard the admin area with route middlewares (`EnsuredAuth`) - [Middleware](../routing/middleware.md).
- Ship translations in the plugin - [Intl](../services/intl.md).
- Publish the plugin as its own npm package and install it with `veap add <package>`.
- Eject any installed third-party plugin or template to customize it locally with `veap eject <package>`.
