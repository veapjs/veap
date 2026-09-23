# Your first application

This page walks from a fresh scaffold to a working page rendered through the virtual router, a Server Action, and a database model. It uses the CLI generators so you see the standard workflow.

## 1. Create and boot the project

```bash
bun create veap my-app
cd my-app
bun dev
```

Complete the setup wizard at [http://localhost:3000](http://localhost:3000). The wizard creates the first user (an admin). After finishing you can sign in; the admin panel lives under `/app`.

## 2. Generate a plugin

```bash
bun veap make:plugin tasks
```

This creates `plugins/tasks-plugin` and registers it in `lib/plugins.gen.ts`. A generated plugin already declares a manifest (built from its `package.json` via `createManifestFromPackageJson`), an empty `app/` route directory, and a default export implementing `IPlugin`.

## 3. Add a database model and migration

Create the table first:

```bash
bun veap make:migration create_tasks_table
```

Fill in the generated file in `plugins/tasks-plugin/src/migrations/`:

```ts
import type { Schema } from "@veap/framework/database";

export default {
  name: "create_tasks_table",
  async up(_db: any, schema: Schema) {
    await schema.createTable("tasks", (table) => {
      table.uuid("id").primaryKey();
      table.text("title").notNull();
      table.boolean("done").notNull().default(false);
      table.text("user_id").notNull();
      table.timestamps();
    });
  },
  async down(_db: any, schema: Schema) {
    await schema.dropTableIfExists("tasks");
  },
};
```

Now the model, `plugins/tasks-plugin/src/models/Task.ts`:

```ts
import { Model } from "@veap/framework/database";

export interface TaskAttributes {
  id: string;
  title: string;
  done: boolean;
  userId: string;
}

export class Task extends Model<TaskAttributes> {
  static override table = "tasks";
  static override fillable = ["title", "done", "user_id"];
}
```

Restart `bun dev`. The kernel runs the plugin's migrations the next time the plugin initializes (and whenever you toggle the plugin on, it runs pending migrations first).

## 4. Add a page to the plugin's route tree

Create `plugins/tasks-plugin/src/app/page.tsx`:

```tsx
export default async function TasksPage() {
  const tasks = await Task.query()
    .orderBy("created_at", "desc")
    .limit(20)
    .get();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Tasks</h1>
      <ul className="mt-4 space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="rounded border p-3">
            {task.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Because the plugin discovers routes from its `app/` directory (`discoverRoutes`), this page is served at `/tasks` by the virtual router once the plugin is enabled. The page is a React Server Component: it runs on the server, can query the database directly, and needs no data-fetching API.

## 5. Add a Server Action

Create `plugins/tasks-plugin/src/actions/tasks.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { Task } from "../models/Task";

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  await Task.create({ title, done: false });

  revalidatePath("/tasks");
}
```

And a form on the page:

```tsx
import { createTask } from "../actions/tasks";

export default async function TasksPage() {
  const tasks = await Task.query()
    .orderBy("created_at", "desc")
    .limit(20)
    .get();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Tasks</h1>

      <form action={createTask} className="mt-4 flex gap-2">
        <input name="title" className="rounded border px-3 py-2" />
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded px-4 py-2"
        >
          Add
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="rounded border p-3">
            {task.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 6. Protect the page

Require a signed-in user by exporting `auth` from the page module:

```tsx
// plugins/tasks-plugin/src/app/page.tsx
export const auth = true;
```

The virtual router wraps the route with its authentication middleware; unauthenticated visitors are redirected to `/signin`. You can also export `roles` and `permissions` for RBAC checks. Details in [Route protection](../routing/middleware.md#route-protection).

## 7. Build

```bash
bun run build
bun run start
```

That is the whole loop: plugin, migration, model, page, action. The rest of the documentation covers each area in depth:

- [Routing](../routing/routing.md) for segments, layouts, boundaries and metadata
- [Server Components](../fundamentals/server-components.md) and [Server Actions](../fundamentals/server-actions.md)
- [Models and the ORM](../data/orm.md)
- [Plugins](../plugins/index.md) for the full manifest, lifecycle and registration flow
