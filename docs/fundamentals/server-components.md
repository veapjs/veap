# Server Components

Veap does not replace or wrap React Server Components; it runs on Next.js App Router, so RSC behaves as Next.js documents it. This page covers how RSC interacts with Veap-specific pieces: bootstrapping, the session, DI, the ORM, and which entry points are safe to import where.

## Which components are Server Components

In App Router every component is a Server Component unless it imports something marked `"use client"` or opts in with a `"use client"` directive at the top of its file. Plugin pages discovered by the virtual router are Server Components by default:

```tsx
// plugins/my-plugin/src/app/page.tsx
export default async function Page() {
  const user = (await getCurrentSession()).user;
  return <p>Hello {user?.name ?? "stranger"}</p>;
}
```

## What a Server Component can do in Veap

- `await initializeSystem()` if you are outside the standard layout/catch-all flow (the generated routes already do it; it is cached per request, so calling it again is free).
- Read the session with `getCurrentSession()` from `@veap/framework/auth/server`. It is wrapped in React `cache`, so multiple components in one request share one lookup.
- Resolve services with `await app(Service)`.
- Query the database directly with the ORM; there is no separate fetching layer.
- Render other Server Components and pass plain, serializable props to Client Components.
- Read cookies and headers through Next.js primitives (`cookies()`, `headers()`).

## What a Server Component cannot do

- No hooks, no browser APIs, no event listeners.
- No passing functions or class instances to Client Components, only serializable data. This is why `getCurrentSession()` returns plain objects (the session service explicitly strips non-serializable fields and spreads results into fresh objects).
- No writes that must be user-initiated mutations; use a [Server Action](./server-actions.md).

## Server vs client entry points

This matters more than in plain Next.js, because Veap's server entry points import `server-only` modules (the container, the ORM, adapters):

| Needs                                                        | Import from                              |
| ------------------------------------------------------------ | ---------------------------------------- |
| Session, users, RBAC facades and actions                     | `@veap/framework/auth/server`            |
| Types, validation schemas, ports (client-safe)               | `@veap/framework/auth`                   |
| Navigation, registry facades, `ExtensionPoint`, `WidgetArea` | `@veap/framework/plugins/server`         |
| `usePathPrefix`, client extension widgets                    | `@veap/framework/plugins/client`         |
| `I18nProvider` (server, auto-detects locale)                 | `@veap/framework/intl/server`            |
| `useTranslation` and other hooks                             | `@veap/framework/intl` or `/intl/client` |
| `Application`, `container`, `app()`                          | `@veap/framework/core/server`            |
| `AppError`, `eventBus`, logging, types                       | `@veap/framework/core`                   |
| `Model`, migrations, `transaction`                           | `@veap/framework/database` (server only) |

Importing a server entry into a client component fails at build time; prefer the client-safe entry or pass data down as props.

## Passing data to Client Components

```tsx
// app/tasks/page.tsx (Server Component)
import { TaskList } from "./task-list";
import { Task } from "@/plugins/tasks-plugin/src/models/Task";

export default async function Page() {
  const tasks = await Task.query()
    .orderBy("created_at", "desc")
    .limit(20)
    .get();
  return <TaskList tasks={tasks.map((t) => t.toJSON())} />;
}
```

```tsx
// app/tasks/task-list.tsx (Client Component)
"use client";

export function TaskList({
  tasks,
}: {
  tasks: { id: string; title: string }[];
}) {
  return (
    <ul>
      {tasks.map((t) => (
        <li key={t.id}>{t.title}</li>
      ))}
    </ul>
  );
}
```

The ORM's `toJSON()` exists exactly for this boundary: it returns plain objects with camelCase aliases and strips `hidden` fields (the built-in `User` model hides `password` and `recovery_code`).

## Server Components and the virtual router

Plugin pages receive props from the router:

```ts
interface PluginPageProps {
  params: any; // matched route params
  searchParams: any; // URL query parameters
  context?: VeapMiddlewareContext; // path, roles, permissions after middleware
}
```

A page uses them like Next.js params, except they arrive already resolved:

```tsx
export default async function Page({ params, searchParams }) {
  const post = await Post.query().where("slug", params.slug).first();
  return <article>{/* ... */}</article>;
}
```

Physical Next.js pages can join the same world with `withRouter` (see [Physical pages and withRouter](../routing/physical-pages.md)).
