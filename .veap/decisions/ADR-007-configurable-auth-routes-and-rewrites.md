# ADR-007: Configurable Auth Routes & Virtual Router Rewrites

## Status

Accepted

## Context

Previously, authentication routes (`/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`) were hardcoded across multiple layers:
1. Virtual router route middlewares (`EnsuredAuth`, `EnsuredUser`) redirected strictly to `"/signin"`.
2. Server actions (`loginAction`, `logoutAction`, `signupAction`, password reset flows) had hardcoded redirects (`/`, `/login`, `/verify-email`), causing inconsistencies and 404 errors.
3. UI components (`LoginForm`, `SignUpForm`) had hardcoded `<Link href="/signin">` and `<Link href="/forgot-password">`.
4. Applications could not localize authentication paths (e.g., `/logowanie`, `/rejestracja`), prefix them (e.g., `/auth/login`), or adjust them to match corporate naming conventions.

## Decision

We introduced a unified, full-stack configuration and rewriting architecture:

1. **Contract & Types (`domain/auth/types`)**:
   - Defined `AuthRoutesConfig` (`signIn`, `signUp`, `forgotPassword`, `resetPassword`, `verifyEmail`, `afterLogin`, `afterLogout`) with `DEFAULT_AUTH_ROUTES`.
   - Defined `AuthConfig` (`{ routes?: Partial<AuthRoutesConfig> }`).

2. **Server-Side Single Source of Truth (`AuthServiceProvider` & `withAuth`)**:
   - `Application.configure().withAuth(config?: AuthConfig)` accepts configuration at bootstrap.
   - `AuthServiceProvider` binds resolved routes to `AuthContext` and registers the `AUTH_ROUTES` DI token in the IoC container.
   - Exposes `getAuthRoutes()` in `@veap/framework/auth/server`.

3. **Virtual Router Rewrites (`RouteTree` & `RouterService`)**:
   - Added rewrite registration (`addRewrite(from, to)`, `setRewrites`, `resolveRewrite(path)`) to `RouteTree` and `RouterService`.
   - `AuthServiceProvider.boot()` automatically registers rewrites for any custom routes mapping them transparently to the virtual plugin routes (e.g., `/logowanie` → `/signin`), preserving plugin isolation and eliminating visible HTTP redirects.

4. **Server Middleware & Actions**:
   - `EnsuredAuth` and `EnsuredUser` use `getAuthRoutes().signIn`.
   - Server Actions (`loginAction`, `logoutAction`, `signupAction`) use configured redirect targets.

5. **Client Hydration & UI Links**:
   - `app/layout.tsx` hydrates `AppProvider` and `AuthProvider` with `authRoutes`.
   - `AuthProvider` exposes `useAuthRoutes()`.
   - `@veap/auth-plugin` client forms (`LoginForm`, `SignUpForm`) dynamically resolve links using `useAuthRoutes()`.

## Consequences

- **Positive:** Full flexibility for URL localization (i18n) and custom routing without changing plugin files.
- **Positive:** Complete elimination of hardcoded auth route redirects across middlewares and server actions.
- **Positive:** Full alignment between server-side redirection rules and client-side navigation links.
- **Positive:** General route rewrite capability now available in `RouteTree` and `RouterService` for other plugins.
