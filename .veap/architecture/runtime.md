# Runtime and Request Lifecycle

## Application Bootstrap (Cold Start)

1. Next.js starts and handles the first request (e.g., to `app/layout.tsx`).
2. `initializeSystem()` is called (cached by React).
3. `app.bootstrap()` runs and initializes the configured Service Providers.
   - If any provider throws during `register()` or `boot()`, the critical error is logged and re-thrown (failing fast instead of silently leaving the system in a half-initialized state).
   - Next.js control flow exceptions (`NEXT_REDIRECT`, `NEXT_NOT_FOUND`) are re-thrown cleanly without logging.
   - The bootstrapping promise is cleared on failure, allowing subsequent requests to attempt self-healing initialization.
4. Core migrations are executed and `system:start` event is published.
5. `PluginServiceProvider` fetches activation states from the DB, sorts plugins topologically by dependencies, and runs `migrations` -> `onMigrate` -> `onEnable` -> `init`.
6. Plugins and extension points are registered and the system is ready.

## Request Lifecycle

1. HTTP Request arrives at Next.js `app/[[...catchAll]]/page.tsx` (unless shadowed by a physical Next.js page).
2. `VeapRouter` receives the request.
3. The virtual route tree is constructed (`buildRouteTree`) by merging all active plugins' `routeTree`s.
4. The router matches the URL path (`matchRecursive`).
5. Relevant middlewares, layouts, and RBAC checks (roles/permissions) are applied.
6. The matched plugin's React Server Component (`page.tsx`) is rendered.
7. Next.js streams the HTML response.
