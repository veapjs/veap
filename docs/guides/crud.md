# Build a CRUD feature

This guide assembles the pieces from the fundamentals into one complete feature: list, create, edit and delete with the ORM, Server Actions and validation. It assumes a generated Veap application.

## The model and migration

```bash
veap make:migration create_tasks_table
veap make:plugin tasks   # if the feature lives in a plugin; otherwise use app code
```

```ts
// migrations: create_tasks_table
import type { Knex } from "@veap/framework/database";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("tasks", (table) => {
    table.increments("id").primary();
    table.integer("user_id").unsigned().notNullable().index();
    table.string("title").notNullable();
    table.boolean("done").notNullable().defaultTo(false);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("tasks");
}
```

```ts
// src/models/task.ts (app) or plugins/tasks-plugin/src/models/task.ts
import { Model } from "@veap/framework/database";

export class Task extends Model {
  static table = "tasks";
}
```

## Listing (Server Component)

```tsx
// routes or page
import { Task } from "../../models/task";

export default async function TasksPage() {
  const tasks = await Task.query().orderBy("created_at", "desc").limit(50);

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  );
}
```

`Model.query()` returns a Knex-backed query builder; reads need no transaction.

## Validation

Use the zod version the app already has (a Veap peer dependency):

```ts
import { z } from "zod";

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
```

## Create and update (Server Actions)

```ts
"use server";

import { revalidatePath } from "next/cache";
import { transaction } from "@veap/framework/database";
import { AppError } from "@veap/framework/core/server";
import { getCurrentUser } from "@veap/framework/auth/server";
import { Task } from "../../models/task";
import { createTaskSchema } from "../validation/task";

export async function createTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw AppError.Unauthorized();

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
  });
  if (!parsed.success) {
    throw AppError.Validation("Invalid task title");
  }

  await transaction(async (trx) => {
    await Task.query(trx).insert({
      user_id: user.id,
      title: parsed.data.title,
    });
  });

  revalidatePath("/tasks");
}

export async function toggleTask(id: number) {
  const user = await getCurrentUser();
  if (!user) throw AppError.Unauthorized();

  await transaction(async (trx) => {
    const task = await Task.query(trx).where({ id, user_id: user.id }).first();
    if (!task) throw AppError.NotFound("Task not found");

    await Task.query(trx)
      .where({ id })
      .update({ done: !task.done, updated_at: new Date() });
  });

  revalidatePath("/tasks");
}
```

Notes on the pattern:

- Authorization is explicit: the action checks the session user and scopes every query by `user_id`.
- Every write runs inside `transaction()`; the transaction handle `trx` is passed to `Model.query(trx)` so all statements share it.
- Errors thrown as `AppError` are mapped by the framework; `AppError.Validation` surfaces as a validation failure to the client.
- `revalidatePath` is Next.js's own API and works as usual on physical routes.

## Delete

```ts
"use server";

import { revalidatePath } from "next/cache";
import { transaction } from "@veap/framework/database";
import { AppError } from "@veap/framework/core/server";
import { getCurrentUser } from "@veap/framework/auth/server";
import { Task } from "../../models/task";

export async function deleteTask(id: number) {
  const user = await getCurrentUser();
  if (!user) throw AppError.Unauthorized();

  await transaction(async (trx) => {
    const deleted = await Task.query(trx).where({ id, user_id: user.id }).del();
    if (deleted === 0) throw AppError.NotFound("Task not found");
  });

  revalidatePath("/tasks");
}
```

## The form

```tsx
// tasks form component (server component is enough)
import { createTask } from "../actions/task";

export function NewTaskForm() {
  return (
    <form action={createTask}>
      <input name="title" required maxLength={200} />
      <button type="submit">Add</button>
    </form>
  );
}
```

For interactive updates, call the actions from client components with `useTransition` or wire them to `react-hook-form` (both are peer dependencies Veap already expects).

## Pagination

The query builder exposes Knex primitives directly:

```tsx
const page = Math.max(1, Number(searchParams.get("page") ?? 1));
const perPage = 20;

const tasks = await Task.query()
  .orderBy("created_at", "desc")
  .limit(perPage)
  .offset((page - 1) * perPage);

const [{ count }] = await Task.query().count({ count: "*" });
```

## Checklist

- Reads: plain `Model.query()`, scoped by owner or role.
- Writes: always `transaction(async (trx) => ...)`, passing `trx` to every query.
- Validation: zod schema at the action boundary; throw `AppError.Validation` with a message.
- Authorization: `getCurrentUser()` (or `requireUser()`/`requirePermission()` facades) before mutating.
- Refresh: `revalidatePath` after successful mutations on physical routes.
