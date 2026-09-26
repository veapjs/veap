# Veap Architecture Overview

Veap is a modular CMS / SaaS framework built on **Next.js (App Router)** and **React 19**.

## Core Concept: The Plugin Pattern

The main architectural premise of Veap is the **Plugin Pattern**. All business logic, authorization, database schemas, and even routes are encapsulated inside independent plugins.

Next.js acts strictly as a host. Its `app/[[...catchAll]]/page.tsx` catches all HTTP requests and immediately delegates them to the `VeapRouter` - a dynamic routing engine that constructs a virtual route tree from all active plugins.

## Architecture Layers

The `@veap/framework` package (`packages/veap/src`) follows a Clean Architecture layout. Dependencies point **inward**, from delivery and infrastructure towards the domain.

1. **Host Application (`app/`)**: The Next.js shell. Responsible for basic setup, `initializeSystem()`, and delegating requests.
2. **Domain (`packages/veap/src/domain`)**: The innermost layer. Pure contracts and primitives with no framework, transport or I/O dependencies: errors (`AppError`, `Result`), event contracts (`SystemEvent`, `SystemEventsMap`, `EventHandler`) and ports (`ICacheProvider`, `ILogger`, `IConfigService`, `IEventBus`), plus the `VeapConfig` shape.
3. **Application (`packages/veap/src/application`)**: Orchestration that depends only on domain contracts - e.g. the in-memory `EventBus` implementing `IEventBus`.
4. **Infrastructure (`packages/veap/src/infrastructure`)**: Adapters for the outside world: the IoC container (the `@Injectable`/`@Inject` decorators it consumes are domain contracts - `domain/contracts/ioc.ts`), service providers, configuration (env schema + `veap.config` loader), cache adapters, the console logger, the CLI, and the composition root (`Application` / `ApplicationBuilder`). This is the only layer allowed to import concrete modules.
5. **Presentation (`packages/veap/src/presentation`)**: Delivery concerns: React hooks/providers and HTTP-facing helpers such as the server-action error handler and the domain-code → HTTP-status mapping.
6. **Built-in modules (per bounded context)**: Auth, Database, Router, Intl, Plugins, Settings, Storage and Communication no longer live in a single `modules/` folder - each one is split across the four layers above (e.g. `domain/auth`, `application/auth`, `infrastructure/auth`, `presentation/auth`). Public entry points for each module live in `packages/veap/src/entries/`.
7. **Plugins (`plugins/*`)**: Independent npm packages containing business logic (e.g., `auth-plugin`, `blog-plugin`). Note: In Veap, the terms "Module" and "Plugin" are used interchangeably for extensions, but core modules live in the four layers under `packages/veap/src`, never in a `src/modules` folder.
8. **Templates (`templates/*`)**: Visual themes that implement the `ITemplate` interface to provide layouts and route overrides.

## The Dependency Rule

Imports may only point inward: `presentation → infrastructure → application → domain`.

- The **domain** layer must never import from `infrastructure`, `presentation`, or `modules`.
- Concrete adapters are selected in **infrastructure**; the **composition root** (`packages/veap/src/infrastructure/composition/application.ts`) is the single place that wires module providers into the application.
- HTTP is a presentation concern: `AppError` carries a transport-agnostic `ErrorCode`, and `presentation/errors/http-status.ts` maps codes to status codes.

## Public Entry Points

`@veap/framework` organizes its public surface into explicit, bounded-context entry points defined in `package.json` and backed by `src/entries/*` barrels:

- **Kernel Root**:
  - `@veap/framework` (aliased as `@veap/framework/core`) → client-safe primitives (domain errors, event contracts, the event bus, logging, the config service).
  - `@veap/framework/core/server` → adds the composition root (`ApplicationBuilder`), IoC container, providers, config loader and CLI service.
- **Bounded Contexts & Domain Subpaths**:
  - Auth: `@veap/framework/auth` (types/ports), `@veap/framework/auth/server` (facades/actions), `@veap/framework/auth/models` (ActiveRecord entities: `User`, `Session`, etc.).
  - Plugins: `@veap/framework/plugins`, `@veap/framework/plugins/server`, `@veap/framework/plugins/client`, `@veap/framework/plugins/models` (`SystemPlugin`, `SystemUserWidget`).
  - Routing: `@veap/framework/router`, `@veap/framework/router/server` (middlewares, matcher, pipeline).
  - Data: `@veap/framework/database` (ORM `Model`, query builder, transactions, migrations).
  - Internationalization: `@veap/framework/intl`, `@veap/framework/intl/client`, `@veap/framework/intl/server`.
  - Services: `@veap/framework/communication`, `@veap/framework/storage`, `@veap/framework/settings`, `@veap/framework/settings/models` (`Setting`).
  - Client Presentation: `@veap/framework/react` (hooks and providers).

The entry files (`src/index.ts`, `src/server.ts`) and the per-module barrels in `src/entries/` are the only files allowed to re-export across layers. No layer-internal file may import an entry barrel or use `@veap/framework/...` self-imports.
