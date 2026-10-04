# Building native host applications

Native host applications build their models, business logic, migrations, and
administrative interfaces directly in the Next.js application repository,
without distributing features into separate plugin packages.

This guide walks through creating a full-featured native application with
ActiveRecord models, migrations, Server Actions, and administrative pages
wrapped with `withRouter`.

## Architecture overview

In a modular plugin architecture, plugins encapsulate their own migrations,
models, and virtual routes. In a native host application, the application shell
owns all domain logic directly.

The native architecture organizes code into standard application directories:

- `lib/models/`: Domain models extending Veap's `Model` class.
- `migrations/`: Code-first database schema migrations.
- `app/actions/`: Server Actions handling mutations and authorization.
- `app/[prefix]/`: Physical administrative pages wrapped with `withRouter`.
- `lib/host-plugin.ts`: An in-app extension plugin providing sidebar navigation,
  dashboard widgets, and virtual route tree definitions.
- `proxy.ts`: Edge middleware propagating routing headers to Server Components.

This structure gives you the full convenience of a traditional monolithic
Next.js application while retaining Veap's administrative shell, authentication,
RBAC, and database tooling.

## 1. Define native database migrations

Native migrations live in the application root's `migrations/` directory. The
framework's `DatabaseServiceProvider` automatically discovers and executes
pending migrations during application bootstrap.

Create a migration file, for example
`migrations/20261004_create_projects_and_tasks.ts`:

```ts
// migrations/20261004_create_projects_and_tasks.ts
import type { Schema } from "@veap/framework/database";

export const name = "20261004_create_projects_and_tasks";

export async function up(db: any, schema: Schema) {
  const hasProjects = await schema.hasTable("projects");
  if (!hasProjects) {
    await schema.createTable("projects", (table) => {
      table.increments("id").primaryKey().notNull();
      table.text("user_id").notNull();
      table.text("name").notNull();
      table.text("slug").notNull();
      table.text("description");
      table.text("color").default("indigo").notNull();
      table.text("status").default("active").notNull();
      table.timestamp("created_at").defaultNow().notNull();
      table.timestamp("updated_at");
    });
  }

  const hasTasks = await schema.hasTable("tasks");
  if (!hasTasks) {
    await schema.createTable("tasks", (table) => {
      table.increments("id").primaryKey().notNull();
      table.text("user_id").notNull();
      table.integer("project_id").notNull();
      table.text("title").notNull();
      table.text("description");
      table.text("status").default("todo").notNull();
      table.text("priority").default("medium").notNull();
      table.text("due_date");
      table.text("assignee").default("Team Member").notNull();
      table.timestamp("created_at").defaultNow().notNull();
      table.timestamp("updated_at");
    });
  }
}

export async function down(db: any, schema: Schema) {
  await schema.dropTableIfExists("tasks");
  await schema.dropTableIfExists("projects");
}
```

## 2. Define native models

Create your ActiveRecord models in `lib/models/`. Models extend `Model` and
define database relations, table mappings, and fillable attributes.

```ts
// lib/models/project.ts
import { Model } from "@veap/framework/database";
import { Task } from "./task";

export interface ProjectAttributes {
  id?: number;
  user_id: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export class Project extends Model {
  static override table = "projects";
  static override autoUuid = false;

  static override fillable = [
    "user_id",
    "name",
    "slug",
    "description",
    "color",
    "status",
  ];

  async tasks(): Promise<any[]> {
    if (!this.id) return [];
    return await Task.query()
      .where("project_id", this.id)
      .orderBy("id", "asc")
      .get();
  }
}
```

Define the associated `Task` model in `lib/models/task.ts`:

```ts
// lib/models/task.ts
import { Model } from "@veap/framework/database";
import { Project } from "./project";

export interface TaskAttributes {
  id?: number;
  user_id: string;
  project_id: number;
  title: string;
  description?: string | null;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  due_date?: string | null;
  assignee?: string;
  created_at?: string;
  updated_at?: string;
}

export class Task extends Model {
  static override table = "tasks";
  static override autoUuid = false;

  static override fillable = [
    "user_id",
    "project_id",
    "title",
    "description",
    "status",
    "priority",
    "due_date",
    "assignee",
  ];

  async project(): Promise<any | null> {
    if (!this.project_id) return null;
    return await Project.query().where("id", this.project_id).first();
  }
}
```

## 3. Implement secure Server Actions

Server Actions handle mutations triggered from your user interfaces. Always
enforce user session authentication and record-level authorization within every
action.

```ts
// app/actions/projects.ts
"use server";

import { getCurrentSession } from "@veap/framework/auth/server";
import { transaction } from "@veap/framework/database";
import { getPathPrefix } from "@veap/framework/plugins/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Project } from "@/lib/models/project";
import { Task } from "@/lib/models/task";

export async function createProject(formData: FormData): Promise<void> {
  const { user } = await getCurrentSession();
  if (!user?.id) {
    throw new Error("Unauthorized: Please sign in to create a project.");
  }

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const color = String(formData.get("color") || "indigo");

  if (!name) {
    throw new Error("Project name is required.");
  }

  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  await transaction(async () => {
    await Project.create({
      user_id: user.id,
      name,
      slug: `${baseSlug}-${Date.now().toString().slice(-4)}`,
      description: description || null,
      color,
      status: "active",
    });
  });

  const prefix = await getPathPrefix();
  revalidatePath(`${prefix}/projects`);
  redirect(`${prefix}/projects`);
}

export async function deleteProject(projectId: number): Promise<void> {
  const { user } = await getCurrentSession();
  if (!user?.id) {
    throw new Error("Unauthorized: Please sign in.");
  }

  // Verify ownership before deleting
  const project = await Project.query()
    .where("id", projectId)
    .where("user_id", user.id)
    .first();

  if (!project) {
    throw new Error("Project not found or access denied.");
  }

  await transaction(async () => {
    await Task.query()
      .where("project_id", projectId)
      .where("user_id", user.id)
      .delete();
    await Project.query()
      .where("id", projectId)
      .where("user_id", user.id)
      .delete();
  });

  const prefix = await getPathPrefix();
  revalidatePath(`${prefix}/projects`);
  redirect(`${prefix}/projects`);
}
```

## 4. Register the host extension plugin

To connect your native pages and models with the administrative panel, create a
lightweight in-app host plugin. This plugin provides:

- Admin sidebar navigation links (`navigation.admin`).
- Dashboard widgets (for example, in the `dashboard-stats` slot).
- Virtual route tree definitions so that `withRouter` pages inherit panel
  layouts, headers, and breadcrumbs without rendering not-found boundaries.

```ts
// lib/host-plugin.ts
import { getCurrentSession } from "@veap/framework/auth/server";
import type { IPlugin, ModuleNavigation } from "@veap/framework/plugins";
import ProjectsSummaryWidget from "@/components/projects-summary-widget";
import { Project } from "@/lib/models/project";

export const hostProjectsNavigation: ModuleNavigation = {
  admin: {
    "Project Management": {
      priority: 10,
      items: [
        {
          title: "Projects",
          url: "/projects",
          icon: "solar:folder-open-broken",
          priority: 0,
        },
        {
          title: "Tasks",
          url: "/tasks",
          icon: "solar:checklist-minimalistic-broken",
          priority: 10,
        },
      ],
    },
  },
};

export const hostProjectsPlugin: IPlugin = {
  manifest: {
    id: "host-projects-extension",
    name: "Host Projects Extension",
    version: "1.0.0",
    description: "Registers host application physical pages and navigation",
    system: true,
    enabled: true,
  },
  navigation: hostProjectsNavigation,
  widgets: [
    {
      id: "host-projects-stats",
      name: "Native Projects Stats",
      area: "dashboard-stats",
      component: ProjectsSummaryWidget,
      priority: 10,
      defaultColSpan: 2,
      defaultRowSpan: 1,
    },
  ],
  routeTree: async () => {
    return {
      segment: "[prefix]",
      children: [
        {
          segment: "projects",
          breadcrumb: () => "Projects",
          children: [
            {
              segment: "[slug]",
              breadcrumb: async ({ params }: any) => {
                const p = await params;
                try {
                  const { user } = await getCurrentSession();
                  if (!user?.id || !p?.slug) return "Project Details";
                  const project = await Project.query()
                    .where("slug", p.slug)
                    .where("user_id", user.id)
                    .first();
                  return project?.name || "Project Details";
                } catch {
                  return "Project Details";
                }
              },
            },
          ],
        },
        {
          segment: "tasks",
          breadcrumb: () => "Tasks",
        },
      ],
    };
  },
};
```

Register this host plugin in your `veap.config.ts`:

```ts
// veap.config.ts
import { defineConfig } from "@veap/framework";
import { hostProjectsPlugin } from "./lib/host-plugin";

export default defineConfig({
  plugins: [hostProjectsPlugin],
});
```

## 5. Build physical pages with withRouter

Place your administrative pages in `app/[prefix]/` and wrap each component with
`withRouter`. This ensures the page renders inside the administrative shell
while retaining Next.js App Router conventions.

```tsx
// app/[prefix]/projects/page.tsx
import { getCurrentSession } from "@veap/framework/auth/server";
import { getPathPrefix } from "@veap/framework/plugins/server";
import { withRouter } from "@veap/framework/router";
import Link from "next/link";
import { deleteProject } from "@/app/actions/projects";
import { Project } from "@/lib/models/project";

async function AdminProjectsPage() {
  const prefix = await getPathPrefix();
  const { user } = await getCurrentSession();

  const projects = user?.id
    ? await Project.query()
        .where("user_id", user.id)
        .orderBy("id", "desc")
        .get()
    : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <Link
          href={`${prefix}/tasks`}
          className="text-sm text-primary hover:underline"
        >
          View Tasks
        </Link>
      </div>

      <div className="grid gap-4">
        {projects.map((project: any) => (
          <div
            key={project.id}
            className="flex items-center justify-between border rounded-lg p-4"
          >
            <div>
              <Link
                href={`${prefix}/projects/${project.slug}`}
                className="font-semibold text-lg hover:underline"
              >
                {project.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {project.description}
              </p>
            </div>

            <form
              action={async () => {
                "use server";
                await deleteProject(project.id);
              }}
            >
              <button
                type="submit"
                className="text-sm text-destructive hover:underline"
              >
                Delete
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

export default withRouter(AdminProjectsPage, {
  roles: ["admin", "user"],
});
```

Create the detail page in `app/[prefix]/projects/[slug]/page.tsx`:

```tsx
// app/[prefix]/projects/[slug]/page.tsx
import { getCurrentSession } from "@veap/framework/auth/server";
import { withRouter } from "@veap/framework/router";
import { notFound } from "next/navigation";
import { Project } from "@/lib/models/project";

async function AdminProjectDetailPage({ params }: any) {
  const resolved = await params;
  const { user } = await getCurrentSession();

  if (!resolved?.slug || !user?.id) {
    notFound();
  }

  // Scoped lookup prevents accessing projects owned by other users
  const project = await Project.query()
    .where("slug", resolved.slug)
    .where("user_id", user.id)
    .first();

  if (!project) {
    notFound();
  }

  const tasks = await project.tasks();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{project.name}</h1>
      <p className="text-muted-foreground">{project.description}</p>

      <h2 className="text-xl font-semibold">Tasks ({tasks.length})</h2>
      <ul className="space-y-2">
        {tasks.map((task: any) => (
          <li key={task.id} className="border rounded p-3 text-sm">
            {task.title} &mdash; <strong>{task.status}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default withRouter(AdminProjectDetailPage, {
  roles: ["admin", "user"],
});
```

## 6. Configure proxy.ts for path propagation

Ensure your application root's `proxy.ts` forwards `x-invoke-path` and
`x-pathname` so that `withRouter` resolves the active route path:

```ts
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;

  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-invoke-path", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

## Summary of best practices

Follow these guidelines when building native applications with Veap:

1. **Keep domain code in standard Next.js folders:** Store models in
   `lib/models/`, migrations in `migrations/`, and actions in `app/actions/`.
2. **Always declare routeTree in host plugins:** When using physical pages
   under `app/[prefix]/`, register the segment hierarchy in your host plugin so
   the router resolves layouts, breadcrumbs, and active navigation states.
3. **Enforce user isolation at the query level:** Never rely solely on URL
   protection. Query records using `.where("user_id", user.id)` in both page
   renderers and Server Actions.
4. **Wrap physical admin pages with withRouter:** Pass `{ roles: [...] }` to
   protect entry points with session verification and role enforcement.
