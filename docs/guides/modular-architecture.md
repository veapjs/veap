# Modular Architecture ("A la Carte" Usage)

Veap provides an "A la Carte" architecture that lets you pick and choose exactly
which components you need for your project without pulling in the entire framework.

Whether you want a lightweight ActiveRecord ORM for an Express microservice,
an enterprise authentication and storage engine for a native Next.js application,
or a full modular CMS and plugin runtime, each package works independently.

---

## Ecosystem Packages

The Veap ecosystem is divided into decoupled packages:

| Package | Responsibility | Standalone Usage |
| :--- | :--- | :---: |
| **`@veap/kernel`** | Inversion of Control (IoC), `ServiceProvider`, `EventBus`, `ConfigService`, and structured logging. Zero runtime dependencies. | Yes (Node.js, Bun) |
| **`@veap/database`** | Knex-powered ActiveRecord ORM (`Model`), relations, polymorphic morph maps, ambient `AsyncLocalStorage` transactions, and migration runner. | Yes (Express, CLI, Fastify, Next.js) |
| **`@veap/storage`** | File storage abstraction (`LocalDiskStorage`, `S3Storage`, `MemoryStorage`) and Next.js route handler helpers. | Yes (any Node.js / Next.js app) |
| **`@veap/auth`** | User/Session models, AES-GCM encrypted cookies, Bcrypt/Argon2id hashing, Oslo token generation, RBAC rules, and Next.js Server Actions. | Yes (native Next.js App Router) |
| **`@veap/plugins`** | Extensibility layer: `IPlugin`, `PluginRegistry`, `<ExtensionPoint />` slots, filter/action hooks, and virtual router (`RouteTree`, `discoverRoutes`). | Optional (modular SaaS & plugins) |
| **`@veap/framework`** | Metapackage aggregating all modules under `Application.configure()`. Provides 100% backward compatibility for existing plugins. | Full monolithic stack |

---

## Scenario 1: Using `@veap/database` as a Standalone ORM

You can use `@veap/database` in any backend project (such as Express, Fastify, or a CLI script) as an ActiveRecord ORM without importing Next.js or the Veap kernel.

### 1. Installation

Install `@veap/database`:

```bash
bun add @veap/database knex better-sqlite3 # or pg
```

### 2. Initializing the Database

Initialize your database connection during application startup:

```ts
import { initDatabase, transaction } from "@veap/database";

// SQLite (auto-detects or creates local file)
initDatabase("sqlite://./app.sqlite");

// Or PostgreSQL
// initDatabase("postgresql://postgres:secret@localhost:5432/my_database");
```

### 3. Defining ActiveRecord Models

Define models extending the `Model` base class:

```ts
import { Model } from "@veap/database";

export interface ArticleAttributes {
  id?: string;
  title: string;
  content: string;
  views?: number;
  created_at?: Date;
  updated_at?: Date;
}

export class Article extends Model<ArticleAttributes> {
  static override table = "articles";
  static override autoUuid = true;
}
```

### 4. Querying and Transactions

Run queries with ActiveRecord syntax and automatic ambient transactions:

```ts
// Create a new record
const article = await Article.create({
  title: "Building Microservices with Veap ORM",
  content: "Using @veap/database standalone...",
  views: 0,
});

// Find by ID or run chainable queries
const found = await Article.find(article.id);
const trending = await Article.where("views", ">", 100).orderBy("views", "desc").get();

// Ambient transaction with automatic rollback on error
await transaction(async () => {
  article.setAttribute("views", 101);
  await article.save();

  // Any error thrown here automatically rolls back the transaction
});
```

---

## Scenario 2: Native Next.js App with Auth & Storage

You can build a native Next.js application using standard App Router conventions, leveraging `@veap/auth`, `@veap/database`, and `@veap/storage` without the virtual router or plugin runtime.

### 1. Installation

```bash
bun add @veap/database @veap/auth @veap/storage
```

### 2. Database & Auth Setup

Create a file `lib/auth.ts`:

```ts
import { initDatabase } from "@veap/database";
import { initAuth, getCurrentSession, checkSecurity } from "@veap/auth/server";

// Initialize database
initDatabase(process.env.DATABASE_URL || "sqlite://./storage/app.sqlite");

// Initialize auth context with default routes and in-memory caches
await initAuth({
  routes: {
    signIn: "/login",
    afterLogin: "/dashboard",
  },
});

export { getCurrentSession, checkSecurity };
```

### 3. Using Auth in Server Components

Protect pages directly in Next.js Server Components:

```tsx
// app/dashboard/page.tsx
import { getCurrentSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { session, user } = await getCurrentSession();

  if (!session || !user) {
    redirect("/login");
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
      <p>Email: {user.email}</p>
    </main>
  );
}
```

### 4. File Storage in Server Actions

Use the standalone `storage` facade for file management:

```ts
// app/actions/avatar.ts
"use server";

import { storage } from "@veap/storage";
import { getCurrentSession } from "@/lib/auth";

export async function uploadAvatar(formData: FormData) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  const file = formData.get("avatar") as File;
  const result = await storage.upload(file);

  if ("error" in result) {
    throw new Error(result.error);
  }

  return { url: result.url };
}
```

---

## Scenario 3: The Full Modular Monolith (`@veap/framework`)

When you want an extensible application with third-party plugins, admin panels, and dynamic route stitching, use the full `@veap/framework` metapackage.

```ts
// lib/veap.ts
import { Application } from "@veap/framework/core/server";
import { BlogPlugin } from "@veap/blog-plugin";
import { PanelPlugin } from "@veap/panel-plugin";

export const app = Application.configure()
  .withDatabase()
  .withAuth()
  .withStorage()
  .withPlugins([BlogPlugin, PanelPlugin])
  .withRouter()
  .create();

export async function initializeSystem() {
  await app.bootstrap();
}
```

Existing plugins and code continue to import from `@veap/framework/*` without any changes, while benefiting from the modular underlying packages.
