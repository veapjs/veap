# Server Actions

Server Actions are Next.js's mechanism for server-side mutations, and Veap uses them as-is: mark a file (or function) with `"use server"` and call it from forms or event handlers. Veap adds conventions on top: auth actions, RBAC actions and plugin actions are all Server Actions, and there is a standard error-result pattern.

## Declaring an action

```ts
// plugins/tasks-plugin/src/actions/tasks.ts
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

Constraints come from Next.js/React: arguments and return values must be serializable; actions are POST endpoints exposed by your application, so validate all input.

## Validating input

Veap ships zod schemas for its own auth flows and exports them from the client-safe auth entry, so client components can reuse them:

```ts
import { loginSchema, registerSchema } from "@veap/framework/auth";
```

For your own actions, parse input inside the action:

```ts
"use server";

import { z } from "zod";
import { AppError } from "@veap/framework/core";

const createTaskSchema = z.object({ title: z.string().min(1).max(200) });

export async function createTask(formData: FormData) {
  const parsed = createTaskSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) {
    throw AppError.Validation("Invalid task title");
  }
  // ...
}
```

## The Result pattern

Veap's own actions never throw for expected failures; they return a `Result`:

```ts
type Result<T> =
  | { success: true; data: T; error?: never }
  | {
      success: false;
      error: { code: ErrorCode; message: string; details?: unknown };
      data?: never;
    };
```

The built-in auth actions use it (`signIn`, `signUp`, `signOut`, `finalizeLogin` from `@veap/framework/auth/server`), converting thrown errors through `handleActionError`:

- `AppError` becomes `{ success: false, error: { code, message, details } }`.
- Unexpected `Error`s are logged and returned as `INTERNAL_SERVER_ERROR`.
- Next.js control-flow errors (`NEXT_REDIRECT`, `NEXT_NOT_FOUND`) are re-thrown so redirects and 404s keep working.

Recommended shape for your actions:

```ts
"use server";

import { ok, type Result } from "@veap/framework/core";
import { handleActionError } from "@veap/framework/core/server";
import { AppError } from "@veap/framework/core";
import { Task } from "../models/Task";

export async function toggleTask(id: string): Promise<Result<boolean>> {
  try {
    const task = await Task.find(id);
    if (!task) throw AppError.NotFound("Task not found");
    task.done = !task.done;
    await task.save();
    return ok(true);
  } catch (e) {
    return handleActionError(e, "Tasks:Toggle");
  }
}
```

## Authentication and authorization in actions

A Server Action is an unauthenticated public POST endpoint until you check caller identity. Always verify authentication and permissions using Veap's auth facades:

```ts
"use server";

import { requireUser, requireRole, requirePermission } from "@veap/framework/auth/server";
import { AppError } from "@veap/framework/core";
import { Task } from "../models/Task";

export async function deleteTask(id: string) {
  // Enforces authentication; throws AppError.Unauthorized() if guest
  const user = await requireUser();

  // Enforces role-based or permission-based authorization; throws AppError.Forbidden()
  await requireRole("admin");
  // Alternatively: await requirePermission("tasks.delete");

  const task = await Task.find(id);
  if (!task) {
    throw AppError.NotFound("Task not found");
  }

  await task.delete();
}
```

For confirm-style flows (require the password again before a sensitive action), the client hook `useConfirmAction` from `@veap/framework/react` drives the confirmation dialog protocol over the event bus, and your server code verifies with `verifyPasswordHash` from `@veap/framework/auth/server`.

## Same-Origin and CSRF protection

Next.js automatically enforces Origin headers on Server Actions. When building custom Route Handlers (`app/api/.../route.ts`) or hybrid endpoints that perform state-changing mutations, validate request provenance with `verifySameOrigin`:

```ts
import { verifySameOrigin } from "@veap/framework/auth/server";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // Checks Origin, Host, and Sec-Fetch-Site headers; throws AppError.Forbidden if cross-origin
  verifySameOrigin(request);

  // ... process mutation safely
  return NextResponse.json({ success: true });
}
```

## Cookies, headers and redirects

Inside actions (like in RSC), use Next.js primitives or Veap's port-backed helpers:

- Session cookie handling is part of the session facade: `setSessionTokenCookie`, `deleteSessionTokenCookie`.
- `redirect("/somewhere")` from `next/navigation` works and is recognized by the error handler.
- Reading headers: `(await headers()).get("x-forwarded-for")` or `getIPAddress()` from the session facade (which safely validates IP formatting and resolves trusted proxy headers).

## Revalidation

Veap does not add its own revalidation API; use Next.js:

- `revalidatePath("/tasks")` after mutations,
- `revalidateTag(...)` if you tag Next.js fetch caches yourself.

The framework's internal caches (settings, route tree) are invalidated automatically (settings writes update the cache; plugin toggles publish events that the router service listens to and clears its cached tree).

## Calling actions from Client Components

```tsx
"use client";

import { createTask } from "../actions/tasks";

export function TaskForm() {
  return (
    <form
      action={async (formData) => {
        await createTask(formData);
      }}
    >
      <input name="title" />
      <button type="submit">Add</button>
    </form>
  );
}
```

Or with `useTransition` for pending state and with `useActionState` for result handling, exactly as Next.js documents.

## Common mistakes

- Forgetting `"use server"` at the top of the actions file; the import then pulls server code into the client bundle.
- Returning class instances (ORM models) from actions; return `toJSON()` output or primitives.
- Trusting `formData` without validation.
- Calling actions that write to the DB without a session check.
