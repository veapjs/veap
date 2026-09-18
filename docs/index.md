# Veap Documentation

Veap is a modular application framework built on Next.js App Router and React Server Components. It provides a plugin system with a virtual router, an ActiveRecord-style ORM, built-in authentication with RBAC, and a Laravel-inspired service provider architecture with dependency injection.

This documentation covers `@veap/core` version **0.11.x**. Code in the repository is the source of truth; where this documentation and the code disagree, the code wins. Please report discrepancies.

## How the documentation is organized

- [Getting Started](./getting-started/introduction.md): install Veap, create a project, understand the project structure, run your first application.
- [Fundamentals](./fundamentals/architecture.md): the architecture, application lifecycle, dependency injection, Server Components and Server Actions in Veap, the event bus, request context.
- [Routing](./routing/routing.md): the virtual router, defining pages, layouts, error and loading boundaries, middleware, metadata, API routes.
- [Authentication](./auth/index.md): sessions, users, RBAC, extending the identity system.
- [Data](./data/database.md): the ORM, models, relations, transactions, migrations.
- [Plugins](./plugins/index.md): plugin architecture, lifecycle, extensions, widgets, hooks, templates.
- [Services](./services/communication.md): mail, file storage, settings, internationalization.
- [Configuration](./configuration/configuration.md): `veap.config.ts` options and environment variables.
- [Advanced](./advanced/veap-vs-nextjs.md): how Veap relates to Next.js, custom service providers.
- [Deployment](./deployment/production.md): production builds, environment variables, Docker, Vercel.
- [Guides](./guides/index.md): step-by-step, task-oriented walkthroughs (first plugin, CRUD, authentication, gate plugins, database setup, custom adapters, testing, real-world cookbook).
- [Troubleshooting](./troubleshooting.md): error messages and their causes.
- [Reference](./reference/entry-points.md): the public API of every entry point and the [CLI reference](./reference/cli.md).

## Suggested learning path

1. Read [Introduction](./getting-started/introduction.md) and [Installation](./getting-started/installation.md), then create your first project.
2. Read [Architecture](./fundamentals/architecture.md) to understand what happens when a request arrives.
3. Follow [Your first plugin](./guides/first-plugin.md) to add a feature of your own.
4. Use the [Reference](./reference/entry-points.md) and the topic chapters as you need them; when something fails, start with [Troubleshooting](./troubleshooting.md).

## Conventions used here

Examples are TypeScript and use the import paths that Veap actually exposes. Server-only APIs are marked as such; APIs safe for client components are noted. When an entry point requires a `"use server"` file or a `"use client"` file, the example shows the directive.
