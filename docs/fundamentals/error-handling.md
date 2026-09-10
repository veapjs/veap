# Error handling

Veap standardizes on one error type, `AppError`, and one serialization shape for server-to-client failures. React and Next.js boundaries handle the rest.

## AppError

`AppError` is a domain error carrying a transport-agnostic `ErrorCode`. It is client-safe and exported from `@veap/core/core`.

```ts
import { AppError } from "@veap/core/core";

throw AppError.NotFound("Task not found");
throw AppError.Unauthorized(); // default message "Unauthorized"
throw AppError.Forbidden();
throw AppError.BadRequest("Invalid input");
throw AppError.Validation("Invalid email", { field: "email" });
throw AppError.Conflict("Email already registered");
throw AppError.RateLimited();
throw AppError.Internal("Unexpected failure");
```

Every instance exposes:

| Property     | Type        | Meaning                                                                                                                          |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `code`       | `ErrorCode` | `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_SERVER_ERROR`, `VALIDATION_ERROR` |
| `message`    | string      | human-readable message                                                                                                           |
| `details`    | unknown     | optional structured context                                                                                                      |
| `isAppError` | true        | marker used by the logger and error handler                                                                                      |

`toJSON()` returns `{ success: false, error: { code, message, details } }`, which is exactly what the `Result` error variant carries.

## The Result pattern for Server Actions

Server Actions should not throw for expected failures, because the thrown message is what reaches the client. Veap's pattern (used by its own auth actions and recommended for yours):

```ts
"use server";

import { ok, type Result } from "@veap/core/core";
import { handleActionError } from "@veap/core/core/server";

export async function doWork(): Promise<Result<WorkOutput>> {
  try {
    return ok(await doWorkInternal());
  } catch (e) {
    return handleActionError(e, "MyModule:DoWork");
  }
}
```

`handleActionError`:

1. Re-throws Next.js control-flow errors (digest `NEXT_REDIRECT` or `NEXT_NOT_FOUND`) so redirects and 404s behave.
2. Converts `AppError` to its JSON.
3. Logs and converts unexpected errors to `INTERNAL_SERVER_ERROR` (message included), both server-side only.

On the client, check `result.success` before using `result.data`.

## Boundaries in the app shell

The generated application ships the Next.js boundaries you know:

- `app/error.tsx` (client component): global error UI with retry, back, dashboard links, digest display and a collapsible stack trace. It also heuristically distinguishes database and authorization errors for better messaging.
- `app/not-found.tsx`: global 404.

Keep `export const dynamic = "force-dynamic"` in `not-found.tsx` and the layout: prerendering `/_not-found` during `next build` boots no providers (bootstrap skips the build phase), and context-bound helpers in the layout would throw `Context is not bound`.

## Not found inside the virtual router

When the merged route tree does not fully match a URL, the router renders the nearest `notFound` component: the matched node's, else walking the layout chain outward, else a built-in minimal 404 panel. This means plugin sub-trees can define their own `not-found.tsx`-style components on their route nodes.

Route-level `error` components on `RouteNode`s are wrapped in `RouterErrorBoundary` (client) with an optional custom `fallback` and a working reset.

## Validation errors

Veap's own flows throw `AppError.Validation(...)`. Zod schema failures inside actions should be converted (see the example in [Server Actions](./server-actions.md)); the schema objects themselves (for example `loginSchema`) are client-safe so client components can pre-validate.

## Redirects as errors

`redirect()` from `next/navigation` works by throwing. Veap explicitly re-throws redirect digest errors in three places: the action error handler, the event bus, and the bootstrap error boundary, so a `redirect()` inside a middleware, event handler or action behaves normally. Never catch bare `Error`s around `redirect()` calls without re-throwing digest errors.

## Logging

```ts
import { logger } from "@veap/core/core/server";
import { error, warn, info, debug } from "@veap/core/core"; // function style

logger.error("my-plugin", "Something failed", err);
```

Groups (`"my-plugin"`) are color-coded per group in dev. Debug logs are dropped in production unless `DEBUG=1`; everything is silenced when `VEAP_CLI=1` unless `DEBUG=1`. The `error()` helper recognizes `AppError`s in the first argument position and appends the error code to the message.

## Production checklist

- Actions return `Result`, never raw thrown messages for expected failures.
- Unexpected exceptions land in `app/error.tsx` (digest shown), so keep server logs searchable.
- Never leak `details` that could help an attacker; it is serialized to clients.
