---
title: "Real-World Cookbook"
description: "Production-ready recipes for gate plugins, custom storage adapters, multi-tenant isolation, and auditing."
status: "Stable"
category: "Guides & Cookbook"
author: "Veap Core Team"
lastUpdated: "2026-03"
---

# Real-world cookbook

The Veap cookbook provides production-ready recipes for common architecture, security, and infrastructure requirements. Each recipe includes tested, end-to-end code samples adhering to framework conventions.

## Recipe 1: 2FA and onboarding gate plugin

Use a gate plugin when you must restrict access across all protected panel routes until a user fulfills an account requirement, such as completing two-factor authentication (2FA) setup or filling out profile onboarding fields.

### Architecture

The gate pattern relies on four components:

1. **Security requirement:** A callback registered via `registerSecurityRequirement` that inspects the current user on every authenticated request.
2. **Path exemption:** Logic within the requirement ensuring users are not redirected away from the gate page itself.
3. **Route override:** The onboarding page module exports `middlewares = [SkipSecurity, EnsuredUser]` to prevent the router from injecting `EnsuredAuth`.
4. **Completion action:** A Server Action that updates user state and redirects to the application dashboard.

### Plugin definition and registration

Create the plugin file in `plugins/onboarding-gate/plugin.ts`:

```ts
import type { IPlugin } from "@veap/core/plugins";
import { registerSecurityRequirement } from "@veap/core/auth/server";
import { getPathPrefix } from "@veap/core/plugins/server";
import { User } from "@veap/core/auth";

export const onboardingGatePlugin: IPlugin = {
  name: "onboarding-gate",
  version: "1.0.0",

  init: async () => {
    registerSecurityRequirement(async (_session, user, path) => {
      // 1. Unauthenticated users are handled by standard route guards
      if (!user) {
        return { satisfied: true };
      }

      // 2. Prevent infinite redirect loops on gate pages
      if (
        path &&
        (path.includes("/onboarding") || path.includes("/api/onboarding"))
      ) {
        return { satisfied: true };
      }

      // 3. Skip gate for system administrators
      if (user.roles?.includes("admin")) {
        return { satisfied: true };
      }

      // 4. Verify account completion condition
      const isComplete = Boolean((user as any).onboardingCompleted);
      if (!isComplete) {
        const prefix = await getPathPrefix();
        return {
          satisfied: false,
          redirect: `${prefix}/onboarding`,
          requirement: "onboarding-gate",
        };
      }

      return { satisfied: true };
    });
  },
};

export default onboardingGatePlugin;
```

### Gate page component

Create the onboarding page in `plugins/onboarding-gate/app/onboarding/page.tsx`:

```tsx
import { EnsuredUser, SkipSecurity } from "@veap/core/router/server";
import { completeOnboardingAction } from "./actions";

// Opt out of inherited EnsuredAuth to allow rendering while gate is unsatisfied
export const middlewares = [SkipSecurity, EnsuredUser];

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold mb-4">Complete your account setup</h1>
      <p className="text-muted-foreground mb-6">
        Please enter your company name and role to finish setting up your
        workspace.
      </p>

      <form action={completeOnboardingAction} className="space-y-4">
        <div>
          <label htmlFor="company" className="block text-sm font-medium">
            Company Name
          </label>
          <input
            id="company"
            name="company"
            type="text"
            required
            className="w-full border rounded px-3 py-2 mt-1"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-primary text-white py-2 rounded font-medium"
        >
          Finish Onboarding
        </button>
      </form>
    </div>
  );
}
```

### Completion Server Action

Create the completion handler in `plugins/onboarding-gate/app/onboarding/actions.ts`:

```ts
"use server";

import { getCurrentSession } from "@veap/core/auth/server";
import { transaction } from "@veap/core/database";
import { AppError } from "@veap/core";
import { redirect } from "next/navigation";
import { z } from "zod";

const onboardingSchema = z.object({
  company: z.string().min(2, "Company name must have at least 2 characters."),
});

export async function completeOnboardingAction(formData: FormData) {
  const { user } = await getCurrentSession();
  if (!user) {
    throw AppError.Unauthorized();
  }

  const parsed = onboardingSchema.safeParse({
    company: formData.get("company"),
  });

  if (!parsed.success) {
    throw AppError.BadRequest(parsed.error.errors[0].message);
  }

  await transaction(async () => {
    // Update user record
    await user.update({
      company: parsed.data.company,
      onboardingCompleted: true,
    });
  });

  redirect("/dashboard");
}
```

---

## Recipe 2: Secure file upload with MIME and size validation

File uploads must strictly validate both file size and MIME types before forwarding payloads to storage providers, preventing denial of service and malicious file uploads.

### Validation schema

Create a reusable upload validator using `zod` in `src/shared/upload-validator.ts`:

```ts
import { z } from "zod";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const fileUploadSchema = z.object({
  file: z
    .custom<File>((val) => val instanceof File, "A file is required.")
    .refine((file) => file.size > 0, "File cannot be empty.")
    .refine(
      (file) => file.size <= MAX_FILE_SIZE_BYTES,
      "File size must not exceed 5 MB.",
    )
    .refine(
      (file) => ALLOWED_MIME_TYPES.includes(file.type as any),
      `Invalid file format. Allowed formats: ${ALLOWED_MIME_TYPES.join(", ")}`,
    ),
});
```

### Upload Server Action

Create the upload Server Action in `src/actions/upload-avatar.ts`:

```ts
"use server";

import { getCurrentSession } from "@veap/core/auth/server";
import { container } from "@veap/core/core/server";
import { StorageService } from "@veap/core/storage";
import { transaction } from "@veap/core/database";
import { AppError } from "@veap/core";
import { fileUploadSchema } from "../shared/upload-validator";

export async function uploadAvatarAction(formData: FormData) {
  // 1. Authorize session
  const { user } = await getCurrentSession();
  if (!user) {
    throw AppError.Unauthorized("You must be logged in to upload files.");
  }

  // 2. Validate input
  const rawFile = formData.get("avatar");
  const validation = fileUploadSchema.safeParse({ file: rawFile });

  if (!validation.success) {
    throw AppError.BadRequest(validation.error.errors[0].message);
  }

  const file = validation.data.file;

  // 3. Upload via StorageService
  const storage = await container.resolve(StorageService);
  const result = await storage.upload(file);

  if ("error" in result) {
    throw AppError.BadRequest(`Storage error: ${result.error}`);
  }

  // 4. Update database record within an atomic transaction
  await transaction(async () => {
    // Delete previous avatar file if exists
    if (user.avatarUrl) {
      await storage.delete(user.avatarUrl);
    }

    await user.update({
      avatarUrl: result.url,
    });
  });

  return {
    success: true,
    url: result.url,
    size: result.size,
  };
}
```

---

## Recipe 3: Serverless (Vercel) vs. Docker (self-hosted) optimization

Veap applications run seamlessly on both serverless infrastructure (such as Vercel) and self-hosted containerized environments (such as Docker). However, each target requires different infrastructure adapters.

### Architecture comparison

| Capability           | Serverless (Vercel)                                                     | Docker (Self-Hosted)                                   |
| :------------------- | :---------------------------------------------------------------------- | :----------------------------------------------------- |
| **Database engine**  | Managed PostgreSQL (Neon, Supabase, RDS) with connection pooling.       | PostgreSQL container or persistent volume SQLite.      |
| **File storage**     | Cloud object storage (S3, Cloudflare R2, Vercel Blob).                  | Mounted volume or S3/R2 object storage.                |
| **Event bus**        | In-process per invocation; use webhooks or queues for background tasks. | Persistent process; handles background tasks reliably. |
| **Process lifespan** | Ephemeral; boots per cold-start.                                        | Long-running Node.js process.                          |

### Configuration for Vercel

On Vercel, serverless function filesystems are read-only except for `/tmp`. Ensure your environment points to external services:

```env
# .env.production (Vercel)
NODE_ENV=production
DATABASE_URL=postgresql://user:password@neon-db-host/dbname?sslmode=require&pgbouncer=true
ENCRYPTION_KEY=dGhpc2lzYTMyYnl0ZXNlY3JldGtleWZvcmVuY3J5cHRpb24=
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=eu-central-1
AWS_S3_BUCKET=my-app-uploads
```

<!-- prettier-ignore -->
> [!IMPORTANT]
> Because plugin facades require container initialization, root layouts and catch-all pages must maintain `export const dynamic = "force-dynamic"`. Do not remove this directive.

### Production Dockerfile

For self-hosted deployments, use this multi-stage `Dockerfile`:

```dockerfile
# 1. Dependency installation
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare bun@latest --activate
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# 2. Application build
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare bun@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# 3. Production runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create persistent storage folder
RUN mkdir -p public/storage && chown -R nextjs:nodejs public/storage

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

---

## Recipe 4: Isolated plugin testing with SQLite in-memory

When developing plugins, write automated integration tests using Vitest or Bun Test with an in-memory SQLite database (`:memory:`). This executes tests in milliseconds without disk pollution or external dependencies.

### Example plugin test suite

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { initDatabase, transaction, Model } from "@veap/core/database";
import { container } from "@veap/core/core/server";
import { eventBus } from "@veap/core/core";
import type { Knex } from "knex";

let knex: Knex;

// 1. Model definition for the test
interface ArticleAttributes {
  id: string;
  title: string;
  status: "draft" | "published";
}

class Article extends Model<ArticleAttributes> {
  static override table = "articles";
  static override fillable = ["title", "status"];
}

describe("BlogPlugin integration test", () => {
  beforeAll(async () => {
    // 2. Boot SQLite in-memory database
    knex = initDatabase({
      client: "better-sqlite3",
      connection: { filename: ":memory:" },
      useNullAsDefault: true,
    });

    // 3. Create schema
    await knex.schema.createTable("articles", (table) => {
      table.uuid("id").primary();
      table.string("title").notNullable();
      table.string("status").defaultTo("draft");
      table.timestamps(true, true);
    });
  });

  beforeEach(() => {
    // 4. Reset IoC container between tests
    container.clear();
  });

  afterAll(async () => {
    // 5. Clean up Knex connection pool
    await knex.destroy();
  });

  it("creates and retrieves article records", async () => {
    const article = await Article.create({
      title: "Hello World",
      status: "draft",
    });

    expect(article.id).toBeDefined();
    expect(article.title).toBe("Hello World");

    const found = await Article.findOrFail(article.id);
    expect(found.title).toBe("Hello World");
  });

  it("rolls back database state when a transaction fails", async () => {
    await expect(
      transaction(async () => {
        await Article.create({ title: "Temporary Post", status: "draft" });
        throw new Error("Simulated business logic failure");
      }),
    ).rejects.toThrow("Simulated business logic failure");

    const match = await Article.query()
      .where("title", "Temporary Post")
      .first();
    expect(match).toBeNull();
  });

  it("dispatches lifecycle events to EventBus", async () => {
    let capturedTitle = "";
    const subscriberId = "test-article-watcher";

    eventBus.subscribe(
      "model:created:articles",
      subscriberId,
      async (event) => {
        const model = event.payload.model as Article;
        capturedTitle = model.title;
      },
    );

    await Article.create({
      title: "Event Driven Article",
      status: "published",
    });

    expect(capturedTitle).toBe("Event Driven Article");
    eventBus.unsubscribe("model:created:articles", subscriberId);
  });
});
```

<!-- prettier-ignore -->
> [!TIP]
> Always execute `knex.destroy()` in an `afterAll` hook to prevent hanging database handles when running Vitest in watch mode.

---

## Recipe 5: Composing models with traits (`@veap/commentable`, `@veap/taggable`)

When building domain plugins, you often need to attach universal features like threaded commenting or tagging to your models without duplicating schema or business logic.

This recipe demonstrates how `blog-plugin` extends `BlogPost` with `@veap/commentable` and `@veap/taggable`.

### 1. Add dependencies and include migrations

Add the trait package to your plugin's `package.json`:

```json
{
  "dependencies": {
    "@veap/commentable": "workspace:*",
    "@veap/taggable": "workspace:*"
  }
}
```

Include the migrations provided by `@veap/commentable` in your plugin manifest or application runner:

```ts
import { commentableMigrations } from "@veap/commentable/migrations";
import { createBlogPostsTable } from "./migrations/create_blog_posts";

export const migrations = [createBlogPostsTable, ...commentableMigrations];
```

### 2. Compose traits onto your model

Apply functional mixins sequentially and define `static override morphAlias`:

```ts
// plugins/blog-plugin/src/models/BlogPost.ts
import { Model, type CastType } from "@veap/core/database";
import { Commentable } from "@veap/commentable";
import { Taggable } from "@veap/taggable";
import { User } from "@veap/core/auth/models";

export interface BlogPostAttributes {
  id: string;
  title: string;
  slug: string;
  content: string;
  authorId: string;
}

export class BlogPost extends Commentable(Taggable(Model<BlogPostAttributes>)) {
  static override table = "blog_posts";
  // Decouple polymorphic records in 'comments' from the table name:
  static override morphAlias = "post";

  author() {
    return this.belongsTo(User, "author_id");
  }
}
```

### 3. Querying and mutating trait data

Trait methods and custom query builder filters are automatically available on the model:

```ts
// 1. Eager load comments and tags in queries
const posts = await BlogPost.query()
  .withComments()
  .withTags()
  .whereHasComments()
  .get();

// 2. Add comments
const post = await BlogPost.findOrFail(postId);
const newComment = await post.addComment({
  content: "Great write-up on Veap traits!",
  authorId: currentUser.id,
  status: "approved",
});

// 3. Attach tags
await post.attachTag("typescript");
```

### 4. Rendering ready-made trait UI

Trait packages include pre-built UI components. In your post detail page, render `<CommentSection />` from `@veap/commentable/ui`:

```tsx
// plugins/blog-plugin/src/ui/PostDetail.tsx
import { CommentSection } from "@veap/commentable/ui";
import { BlogPost } from "../models/BlogPost";

export function PostDetail({ post, comments, currentUserId }: any) {
  return (
    <article className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      <div className="prose my-6">{post.content}</div>

      <hr className="my-8" />

      {/* Trait UI component */}
      <CommentSection
        commentableId={post.id}
        commentableType={BlogPost.morphAlias || BlogPost.table}
        comments={comments}
        currentUserId={currentUserId}
      />
    </article>
  );
}
```
