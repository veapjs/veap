# Application lifecycle

A Veap application is a Next.js process that boots a Veap container exactly once per server instance. This page documents the full lifecycle: what happens when the process starts, during a request, and how the pieces fail if the contract is broken.

## Boot

`Application.bootstrap()` (called from `lib/veap.ts` in generated projects) does, in order:

1. **Guard clauses.** Returns immediately when `SKIP_VEAP_INIT=true` or `NEXT_PHASE=phase-production-build`. The build phase skip is deliberate: `next build` prerenders pages without a live server, so the container is not booted and plugin facades are unavailable during build (see the force-dynamic contract below).
2. **Kernel provider.** `KernelProvider.register()` registers environment validation, `ConfigService`, logging, cache, the event bus, the IOC container itself, and the database provider.
3. **Database initialization.** When `DATABASE_URL` is present, Knex is created, registered under the `DATABASE` token, and migration sources are prepared.
4. **Domain providers.** Auth, communication, storage, settings, intl and plugins providers register their services and facades.
5. **Plugin discovery.** `lib/plugins.gen.ts` (generated) supplies the plugin list; `PluginServiceProvider` instantiates them, boots each plugin's `boot()` in order, and wires routes, widgets, hooks and event subscriptions into the virtual router.
6. **Contexts bound.** After boot, request-time facades (`authContext()`, `pluginsContext()`, `communicationContext()`) are bound. Before that, any facade call throws `Context is not bound`.

Boot happens lazily on the first request that touches the container, not at import time. Because Next.js may spawn multiple server workers, each worker boots its own container; the container is process-wide and single-tenant.

## Request lifecycle

For each request through the Veap pipeline (the catch-all page and API route in `app/`):

```text
Next.js route match (app/[[...catchAll]] or app/api/[...catchAll])
   |
   veap route middlewares (pipeline, in registration order)
   |
   router matcher (virtual router: plugin routes + template routes)
   |
   route handler: React Server Component or JSON response
   |
   layout tree (root layout + template layouts + plugin widget areas)
   |
   response to the client
```

1. `proxy.ts` (Next middleware) runs first for matching paths and can rewrite or short-circuit.
2. The catch-all page/API route calls `runPipeline()`, executing registered middlewares in order. A middleware may return a response, short-circuiting the pipeline.
3. `RouterService` resolves the path against the virtual router (plugin-registered routes, static and dynamic segments, 404 otherwise).
4. The matched route's component renders as a React Server Component. Request-scoped values are read through ports (`IHttpRequestContext`, `ICookieStore`) bound by the framework adapter for the duration of the request.
5. Layouts compose: Next.js root layout, then the template system builds the layout tree from the matched route's template metadata, inserting plugin widget areas.

Server Actions and API route handlers work through the same container: they call `app(Token)` or facades, which resolve from the already-booted container.

## Request context and the force-dynamic contract

The request context (headers, cookies, URL) is backed by Next.js request APIs. Next.js requires that any page reading them be dynamically rendered; Veap's generated `app/layout.tsx` and catch-all page therefore declare `export const dynamic = "force-dynamic"`.

This is a load-bearing contract:

- Removing `force-dynamic` lets Next prerender `/_not-found` and other static pages at build time. Prerendering executes the layout outside a request, the context port is unbound, and the build fails with `Context is not bound. PluginServiceProvider must boot before the plugins facades are used.`
- Adding new root-level files that Next tries to prerender (custom `not-found.tsx`, for example) must respect the same contract: the root layout must stay force-dynamic, or the page must not touch request-scoped APIs.

The full causal chain and trade-off are documented in the framework decision records (ADR-006, kept in the Veap development repository).

## Shutdown

There is no explicit shutdown hook. Next.js owns the process lifetime; the Veap container is garbage-collected with the process. In-flight database connections close when the runtime tears down the server. Plugins do not get a `shutdown()` callback.

## What can fail and why

| Symptom                                                    | Cause                                                                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Context is not bound. PluginServiceProvider must boot...` | Facade called during build-phase prerender, or bootstrap crashed earlier (check logs above the error)                        |
| `Invalid environment variables`                            | `ENCRYPTION_KEY` missing or wrong length, or another env-schema violation                                                    |
| `Cannot open database...`                                  | SQLite path in an unwritable location (serverless), or `DATABASE_URL` points at an unreachable server                        |
| Empty plugins after boot (`Initialized with 0 plugins`)    | `lib/plugins.gen.ts` regenerated with an empty list, or plugin `boot()` threw and the error was swallowed earlier in the log |
