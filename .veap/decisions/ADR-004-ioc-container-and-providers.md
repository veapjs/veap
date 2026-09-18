# ADR-004: IoC Container & Dependency Injection

## Status

Accepted

## Context

As the Veap Core grew, singletons like EventBus, SettingsService, and Logger were exposed as statically exported instances. This led to cyclic dependencies (where core files accidentally imported database models), made testing difficult, and created "code smells" that broke the clean architecture of a domain-driven framework.

## Decision

We implemented a lightweight Dependency Injection (DI) system inside @veap/core:

1. **Providers (ServiceProvider)**: Each domain registers its services via providers (e.g., KernelServiceProvider, SettingsServiceProvider).
2. **IoC Container (Container)**: A central registry that instantiates and holds singletons.
3. **app() Helper**: A Laravel-inspired helper function app(Token) that acts as a wrapper around the container for use outside of constructor injection (such as in React Server Components or Server Actions).

## Consequences

- **Positive:** No cyclic dependencies in the core. Modules are isolated. Testing is easier because dependencies can be mocked in the container.
- **Positive:** Improved Developer Experience via app(MyService) resolving dependencies smoothly in Next.js Server environments.
- **Negative:** Slightly more boilerplate (creating a Provider, using @Injectable()) when creating new global core services.
- **Constraint:** Next.js HMR (Fast Refresh) in dev mode constantly re-executes files. The Container itself must be stored in globalThis to prevent the wiping of all singleton instances (like EventBus subscriptions) on every hot reload.
- **Constraint:** Next.js isolates Server Components and API Route Handlers into separate worker contexts/bundles (Dual-Package Hazard). To guarantee that the IoC container resolves exactly the same Singleton across these boundaries, class tokens are internally mapped using `Symbol.for("veap:ioc:" + ClassName)`. This ensures that even if Webpack creates two different constructor references for `PluginRegistry`, they resolve to the same underlying instance.
