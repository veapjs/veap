# Introduction

Veap is a framework for building modular full-stack applications on top of Next.js App Router and React Server Components. It takes the Next.js runtime as-is and adds the application-level pieces that a typical Next.js project ends up building by hand: a plugin system, a virtual router, an ORM, authentication with RBAC, an event bus, dependency injection, and a CLI.

## What Veap provides

Veap (`@veap/core`) is a single npm package with several entry points. The main capabilities are:

- **Application bootstrap and dependency injection.** A Laravel-style `Application` builder registers service providers, which populate an IoC container. Server code resolves services through `app(Service)` instead of constructing them by hand.
- **A virtual router.** Your Next.js app contains one catch-all route. Plugins declare route trees (usually discovered from their own `app/` directory), and the Veap router merges those trees and renders pages, layouts, error boundaries and parallel slots at runtime.
- **A plugin system.** A plugin is an npm package that declares a manifest, optional migrations, navigation, widgets, extensions, hooks and translations. The kernel registers plugins, syncs their enabled/installed state to the database and initializes them in dependency order.
- **An ORM.** An ActiveRecord-style `Model` base class over Knex, with relations (including polymorphic ones), casts, scopes, soft deletes, factories and model events.
- **Authentication.** Session-based auth with bcrypt password hashing, Oslo-based token generation, email verification, password reset, 2FA extension points, and roles and permissions (RBAC).
- **An event bus.** An in-process publish/subscribe bus with a typed event map for system events and model lifecycle events.
- **Support services.** File storage with provider registration, key/value settings, mail with pluggable transports, and internationalization with server and client translation APIs.
- **A CLI** (`veap`) for scaffolding projects, plugins, templates and migrations, plus Docker configuration.

## What Veap does not provide

- Veap does not replace Next.js routing. Your Next.js `app/` directory still works exactly as Next.js intends; the virtual router runs inside a catch-all route and inside plugin-provided route trees. Physical Next.js pages can opt into the virtual router with `withRouter`.
- Veap does not provide a `veap build` or `veap start` command. Building and running an application uses the standard Next.js commands (`next build`, `next start`), usually through your package.json scripts.
- Veap does not ship its own caching or revalidation API. The framework uses an internal cache provider for settings and the route tree cache; for your own data caching you use React's `cache` and Next.js caching primitives directly.
- Veap does not provide a form library. Forms are built with Server Actions and standard HTML form handling.

## Entry points

Because Veap distinguishes between server-only and client-safe code, the package exposes several entry points instead of one barrel. The ones you will use most:

| Entry point        | Import path                                       | Use it for                                                   |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------ |
| Core (client-safe) | `@veap/core/core`                                 | `AppError`, `eventBus`, logging helpers, config types        |
| Core (server)      | `@veap/core/core/server`                          | `Application`, `container`, `app()`, providers               |
| Auth (client-safe) | `@veap/core/auth`                                 | validation schemas, auth types, ports                        |
| Auth (server)      | `@veap/core/auth/server`                          | `getCurrentSession`, auth facades, server actions            |
| Router             | `@veap/core/router`                               | `VeapRouter`, `discoverRoutes`, route tree types             |
| Router (server)    | `@veap/core/router/server`                        | `buildRouteTree`, API middlewares                            |
| Plugins            | `@veap/core/plugins`                              | `IPlugin`, `createManifestFromPackageJson`                   |
| Plugins (server)   | `@veap/core/plugins/server`                       | registry facades, navigation, `ExtensionPoint`, `WidgetArea` |
| Plugins (client)   | `@veap/core/plugins/client`                       | `usePathPrefix`, client extension components                 |
| Database           | `@veap/core/database`                             | `Model`, `Schema`, migrations, `transaction`                 |
| Communication      | `@veap/core/communication`                        | `sendMail`, mailables, mail DTOs                             |
| Storage            | `@veap/core/storage`                              | `StorageService`, `LocalFileProvider`                        |
| Settings           | `@veap/core/settings`                             | `SettingsService`                                            |
| Intl               | `@veap/core/intl`, `/intl/server`, `/intl/client` | `I18nProvider`, `useTranslation`, `getTranslation`           |
| React              | `@veap/core/react`                                | `AppProvider`, `useUser`, `useConfirmAction`                 |

The full list, with every export, is in the [Entry points reference](../reference/entry-points.md).

## Where to go next

- [Installation](./installation.md) walks you through creating a project.
- [Project structure](./project-structure.md) explains what the scaffolder generates.
- [Architecture](../fundamentals/architecture.md) explains how the pieces fit together at runtime.
