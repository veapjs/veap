# Error, loading and not-found boundaries

The virtual router supports the same boundary files as the App Router, discovered from plugin `app/` directories and applied per matched level.

## loading.tsx

A `loading.tsx` next to or above a page wraps that subtree in a `<Suspense fallback={<Loading/>}>` boundary. The router builds boundaries from the layout chain: each level with a `loading` component wraps everything beneath it.

```tsx
// plugins/shop-plugin/src/app/shop/loading.tsx
export default function Loading() {
  return <div className="animate-pulse p-6">Loading shop...</div>;
}
```

Because plugin pages are async Server Components, Suspense boundaries give you streaming per segment.

## error.tsx

`error.tsx` marks a subtree for client-side error handling. The router wraps the subtree in `RouterErrorBoundary` (a client component). Your component receives `{ error, reset }`:

```tsx
"use client";

export default function ShopError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div role="alert">
      <p>Something went wrong in the shop.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

`reset` remounts the subtree. Without a custom component the boundary renders a styled default panel with the error message and a retry button.

## not-found.tsx

When a URL matches only partially (no page at the leaf), the router looks for a `notFound` component starting at the matched node and walking outward through the layout chain. This lets a plugin define a themed 404 for its whole segment:

```tsx
// plugins/shop-plugin/src/app/not-found.tsx
export default function ShopNotFound() {
  return <p>This page does not exist in the shop.</p>;
}
```

If nothing declares one, a built-in minimal 404 panel renders with the requested path. The host `app/not-found.tsx` handles URLs that never reach the virtual router (Next.js-level 404s).

## Redirects

`redirect()` from `next/navigation` works in pages, middlewares and actions. The framework re-throws redirect digest errors wherever it catches broadly (bootstrap, event bus, action error handler), so redirects propagate correctly. `notFound()` behaves the same through the `NEXT_NOT_FOUND` digest.

## Where boundaries do not apply

- The root layout itself is not wrapped by `RouterErrorBoundary`; the host `app/error.tsx` is the outermost catch.
- API routes have no React boundaries; errors in route handlers surface as Next.js 500 responses. Wrap handlers yourself or use the API middleware pipeline for consistent JSON errors.
