# Metadata

Veap supports Next.js metadata for virtual routes through per-route `generateMetadata` exports. There is no Veap-specific metadata API on top; the merged result is a standard Next.js `Metadata` object.

## Declaring metadata for a route

In a plugin page or layout module:

```tsx
// plugins/blog-plugin/src/app/blog/[slug]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Record<string, string>;
  searchParams: Record<string, string>;
}): Promise<Metadata> {
  const post = await Post.query().where("slug", params.slug).first();

  return {
    title: post?.title ?? "Post not found",
    description: post?.excerpt,
    openGraph: post
      ? { title: post.title, description: post.excerpt, type: "article" }
      : undefined,
  };
}
```

Note the difference from Next.js native routes: here `params` and `searchParams` arrive as **resolved plain objects**, not promises, because the virtual router resolves them before calling your generator.

## How merging works

`RouteTree.generateMetadata(path, searchParams)`:

1. Matches the path against the tree.
2. Collects every `generateMetadata` along the matched path (root, groups, dynamic levels, leaf).
3. Calls them in order with `{ params, searchParams }` and shallow-merges results; later (leaf) values override earlier ones for conflicting top-level keys.

The host catch-all route exports its own `generateMetadata` that awaits `initializeSystem()` and returns this merged metadata, so every URL handled by the virtual router gets correct head tags. Physical Next.js pages use Next.js's native `metadata`/`generateMetadata` exports unchanged.

## What is covered

Because the result is a standard `Metadata`, everything Next.js supports is usable: `title` (including templates and absolutes), `description`, `openGraph`, `twitter`, `robots`, `icons`, `alternates`, `verification`. None of it is intercepted or modified by Veap.

## Not currently provided

- No Veap API for sitemap.xml or robots.txt generation. Use Next.js's `app/sitemap.ts` and `app/robots.ts` file conventions in the host application, querying your models directly.
- No per-locale metadata resolution out of the box; if you localize metadata, read the locale from the intl config or cookie inside your generator.
