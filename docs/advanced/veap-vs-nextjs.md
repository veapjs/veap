# Veap vs Next.js

Veap runs on Next.js App Router and React Server Components. It does not replace the Next.js runtime; it adds an application layer on top of it. This page states precisely what is inherited, what is wrapped, and what behaves differently. Every claim below is backed by the implementation in this package's `src/`.

## What Veap inherits from Next.js unchanged

- **Rendering model.** Server Components, Client Components, the `"use client"` and `"use server"` directives, Suspense streaming, Server Actions over POST - all are native Next.js 16 / React 19 behavior. Veap adds no transpiler or runtime shim.
- **File conventions that Veap does not intercept.** `app/globals.css`, `public/`, `next.config.ts`, standard metadata exports on physical pages: these work exactly as in a plain Next.js app.
- **Development server and build.** `next dev` (Turbopack) and `next build`. There is no `veap build` or `veap start`; production is `next build` followed by `next start`, or the platform adapter (`vercel`, Docker via `veap docker`).

## What Veap wraps

### Routing

Next.js App Router stays in charge of physical files. Veap adds a second, virtual router:

- Plugin routes are discovered from each plugin's filesystem (`discoverRoutes`), compiled into a `RouteTree`, and matched at request time by the catch-all page `app/[[...catchAll]]/page.tsx` and API route `app/api/[...catchAll]/route.ts`.
- The optional catch-all means plain Next.js pages still take precedence for their exact paths; the virtual router resolves everything else. Two sources of truth for one URL is a real constraint: a physical `app/page.tsx` and a plugin route for `/` cannot coexist (the scaffolder removes CNA's `app/page.tsx` for exactly this reason).
- Layouts come from the template system (`buildLayoutTree`), not from nested physical `layout.tsx` files.

### Middleware

Next.js middleware (`proxy.ts`) runs first and can rewrite or block requests. Veap route middlewares (`EnsuredAuth`, `EnsuredGuest`, `EnsuredUser` and custom ones) run inside the Veap pipeline, after the match, with access to the container. They are two different layers at two different times; Veap does not merge them.

### Cookies, headers, request context

Next.js exposes `cookies()` and `headers()` from `next/headers`. Veap wraps them in ports (`ICookieStore`, `IHttpRequestContext`) bound per request. Application code that imports `next/headers` directly works, but bypasses testability and the framework contract; the built-in auth services use only the ports.

### Configuration

Veap keeps `next.config.ts` for Next.js concerns and adds `veap.config.ts` for application concerns (`privatePath`, intl defaults, debug). Environment variables are validated by zod in `ConfigService` at boot; an invalid `ENCRYPTION_KEY` kills the process in plain Next.js terms.

## What Veap adds that Next.js does not have

| Capability           | Implementation                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Plugin system        | `VeapPlugin` manifests, `PluginServiceProvider`, registry with enable/disable and config, generated `lib/plugins.gen.ts`                   |
| Virtual router       | `RouteTree` + matcher + route discovery from plugin directories                                                                            |
| Templates            | layout tree built per route from template metadata (`buildLayoutTree`)                                                                     |
| Dependency injection | Laravel-style container, `app(Token)`, service providers with `register()`/`boot()`                                                        |
| ORM                  | ActiveRecord `Model` over Knex, relations (including polymorphic via `MorphMap`), `transaction()` as the write path, code-first migrations |
| Auth with RBAC       | sessions, users, roles, permissions, email verification, password reset - all via ports and facades                                        |
| Event bus            | typed publish/subscribe with zod-validated payloads, system events (`system:auth:*` and friends)                                           |
| Settings and storage | namespaced settings service; local file storage with a serving route                                                                       |
| CLI                  | `veap` binary: init, make:plugin/template/migration, add/register, docker                                                                  |

## What behaves differently from a plain Next.js app

1. **Boot and the build phase.** `Application.bootstrap()` runs once per server process and is skipped during `next build` (`NEXT_PHASE=phase-production-build`). Plugin facades are therefore unavailable during prerendering, and pages touching them must be dynamic (`force-dynamic` in the root layout and catch-all page - the scaffolder sets this up; removing it breaks the build with `Context is not bound`).
2. **The catch-all is load-bearing.** `app/[[...catchAll]]` handles unmatched URLs. Deleting it removes all plugin routes; adding a physical page at the same URL shadows the plugin route.
3. **Writes go through `transaction()`.** The ORM's write path expects a Knex transaction; direct `knex.insert(...)` outside one is not the supported pattern.
4. **Auth events are typed.** Legacy string events (`auth:*`) are gone; subscribe to `system:auth:*` through the event bus.
5. **Errors are `AppError`.** Framework code throws `AppError` with machine codes; the presentation layer maps them to HTTP responses and Server Action results.

## What Veap deliberately does not provide

- A custom build command or bundler (Next.js owns this).
- Public cache/revalidation APIs (caching exists internally for settings and plugins; there is no user-facing `revalidate` equivalent).
- Route groups, parallel routes or intercepting routes in the _virtual_ router. Physical Next.js files keep supporting them; the virtual router supports static, dynamic, catch-all and optional catch-all segments only.
