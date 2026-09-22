# Request context

Every request-scoped value in Veap is read through ports bound by the framework for the duration of one request: `IHttpRequestContext` (headers, URL, method) and `ICookieStore` (cookies). Application code never imports `next/headers` directly; that keeps services testable and the framework swappable.

## Ports involved

```ts
import { REQUEST_CONTEXT, COOKIE_STORE } from "@veap/framework/core/server";
import type {
  IHttpRequestContext,
  ICookieStore,
} from "@veap/framework/core/server";
```

`IHttpRequestContext` exposes:

| Member         | Description                                     |
| -------------- | ----------------------------------------------- |
| `url`          | full request URL string                         |
| `method`       | HTTP method                                     |
| `headers`      | read-only header access (`get(name)`)           |
| `cookies`      | the `ICookieStore` for this request             |
| `params`       | route parameters resolved by the virtual router |
| `searchParams` | `URLSearchParams` of the query string           |

`ICookieStore` exposes the familiar cookie API: `get(name)`, `set(name, value, options)`, `delete(name)`. Options follow the standard `ResponseCookie` shape (`httpOnly`, `secure`, `sameSite`, `maxAge`, `path`).

The framework adapter binds these ports at the start of each request (Next.js `NextRequestContext` implementation in the infrastructure layer) and unbinds them at the end. There is no ambient import: the same `IHttpRequestContext` token resolves inside Server Components, Server Actions, route middlewares and API handlers.

## Reading the request

```tsx
// inside a Server Component or route middleware
import { app } from "@veap/framework/core/server";
import { REQUEST_CONTEXT } from "@veap/framework/core/server";

export default async function Page() {
  const ctx = await app(REQUEST_CONTEXT);
  const userAgent = ctx.headers.get("user-agent");
  const page = ctx.searchParams.get("page") ?? "1";
  return (
    <p>
      page {page} for {userAgent}
    </p>
  );
}
```

## Cookies

```ts
import { app } from "@veap/framework/core/server";
import { COOKIE_STORE } from "@veap/framework/core/server";

// read
const store = await app(COOKIE_STORE);
const theme = store.get("theme");

// write (Server Actions and route handlers only)
store.set("theme", "dark", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365,
});

// delete
store.delete("theme");
```

Writing cookies is allowed only in mutation contexts (Server Actions, API handlers, route middlewares returning a response). Reading is allowed anywhere inside a request. Setting a cookie during a Server Component render throws in Next.js, and Veap does not mask that.

## Headers

Read headers through the request context (`ctx.headers.get(name)`). Setting response headers happens by returning a `Response` from an API handler or middleware, not by mutating the context.

## Params and search params

Route parameters come from the virtual router and are attached to the context (`ctx.params`). For a dynamic segment `posts/[id]` the resolved value lands in `ctx.params.id`. Query strings are always available via `ctx.searchParams`.

## Why not next/headers

The indirection exists for three reasons:

1. **Testability.** Services depending on `REQUEST_CONTEXT` and `COOKIE_STORE` take fake implementations in unit tests; no Next.js runtime needed (the auth services in `@veap/framework` are tested exactly this way).
2. **Framework neutrality.** The domain and application layers of `@veap/framework` do not reference Next.js; only the infrastructure adapter does. Swapping the adapter swaps the runtime.
3. **One binding point.** Session, password-reset and email-verification services share the same cookie abstraction, so cookie behavior (flags, name, deletion) is consistent framework-wide.

## Restrictions

- The ports are request-scoped: calling `app(REQUEST_CONTEXT)` outside a request (boot, background job, build) throws. For background work, pass the values you need as plain arguments before leaving the request.
- Cookies have the Next.js size and count limits (about 4 KB per cookie).
- `ctx.headers` is read-only; mutating it has no effect.
