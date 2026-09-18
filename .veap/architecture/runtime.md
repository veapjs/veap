# Runtime and Request Lifecycle

## Application Bootstrap (Cold Start)

1. Next.js starts and handles the first request (e.g., to `app/layout.tsx`).
2. `initializeSystem()` is called (cached by React).
3. `app.bootstrap()` runs and initializes the configured Service Providers.
4. Core migrations are executed and `system:start` event is published.
5. `PluginServiceProvider` fetches activation states from the DB, sorts plugins topologically by dependencies, and runs `migrations` -> `onMigrate` -> `onEnable` -> `init`.
6. Templates are registered and the system is ready.

## Request Lifecycle

1. HTTP Request arrives at Next.js `app/[[...catchAll]]/page.tsx`.
2. `VeapRouter` receives the request.
3. The virtual route tree is constructed (`buildRouteTree`) by merging all active plugins' `routeTree`s.
4. The router matches the URL path (`matchRecursive`).
5. Relevant middlewares, layouts, and RBAC checks (roles/permissions) are applied.
6. The matched plugin's React Server Component (`page.tsx`) is rendered.
7. Next.js streams the HTML response.
