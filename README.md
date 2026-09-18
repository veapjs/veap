# @veap/core

The core framework of the Veap ecosystem: a modular application framework built on Next.js App Router and React Server Components. One package provides the plugin system with a virtual router, an ActiveRecord-style ORM over Knex, authentication with RBAC, a Laravel-inspired service provider architecture with dependency injection, an event bus, and the `veap` CLI.

## Installation

Create a new application with the initializer (recommended):

```bash
bunx create-veap
```

or add the package to an existing Next.js project:

```bash
bun add @veap/core
```

## Entry points

The package ships several entry points so that client bundles never pull in server code:

| Import path                                   | Purpose                                   |
| --------------------------------------------- | ----------------------------------------- |
| `@veap/core`                                  | client-safe core: errors, events, logging |
| `@veap/core/core/server`                      | Application, container, providers, config |
| `@veap/core/auth`, `/auth/server`             | authentication, sessions, RBAC            |
| `@veap/core/plugins` (+ `/server`, `/client`) | plugin system, registry, widgets          |
| `@veap/core/router` (+ `/server`)             | virtual router, middlewares               |
| `@veap/core/intl` (+ `/server`, `/client`)    | internationalization                      |
| `@veap/core/communication`                    | mail transports and facades               |
| `@veap/core/database`                         | ORM, relations, transactions, migrations  |
| `@veap/core/storage`, `/settings`             | file storage, key-value settings          |
| `@veap/core/react`                            | client providers and hooks                |

## Minimal usage

```ts
// lib/veap.ts - the composition root
import { Application } from "@veap/core/core/server";

const application = Application.configure()
  .withDatabase()
  .withAuth()
  .withPlugins(plugins)
  .withRouter()
  .create();

void application.bootstrap();
```

## Documentation

The complete documentation lives in this repository: [docs/index.md](./docs/index.md). It covers getting started, fundamentals, routing, authentication, the ORM, plugins, services, configuration, deployment, task-oriented guides, the full API reference, and troubleshooting.

## CLI

```bash
veap init              # scaffold framework files in an existing app
veap make:plugin       # scaffold a plugin
veap make:template     # scaffold a template
veap make:migration    # create a migration
veap add <plugin>      # install and register a plugin package
veap register          # re-sync lib/plugins.gen.ts
veap docker            # generate a Dockerfile
```

## Development

```bash
bun install
bun run build   # tsc -> dist/
bun test        # vitest
```

Requires Node 22+ and Next.js 16 as a peer dependency.

## License

MIT
