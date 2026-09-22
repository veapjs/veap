# @veap/framework

The core framework of the Veap ecosystem: a modular application framework built on Next.js App Router and React Server Components. One package provides the plugin system with a virtual router, an ActiveRecord-style ORM over Knex, authentication with RBAC, a Laravel-inspired service provider architecture with dependency injection, an event bus, and the `veap` CLI.

## Installation

Create a new application with the initializer (recommended):

```bash
bunx create-veap
```

or add the package to an existing Next.js project:

```bash
bun add @veap/framework
```

## Entry points

The package ships several entry points so that client bundles never pull in server code:

| Import path                                   | Purpose                                   |
| --------------------------------------------- | ----------------------------------------- |
| `@veap/framework`                                  | client-safe core: errors, events, logging |
| `@veap/framework/core/server`                      | Application, container, providers, config |
| `@veap/framework/auth`, `/auth/server`             | authentication, sessions, RBAC            |
| `@veap/framework/auth/models`                      | User, Session, Role, Permission models    |
| `@veap/framework/plugins` (+ `/server`, `/client`) | plugin system, registry, widgets          |
| `@veap/framework/plugins/models`                   | SystemPlugin, SystemUserWidget models     |
| `@veap/framework/router` (+ `/server`)             | virtual router, middlewares               |
| `@veap/framework/intl` (+ `/server`, `/client`)    | internationalization                      |
| `@veap/framework/communication`                    | mail transports and facades               |
| `@veap/framework/database`                         | ORM, relations, transactions, migrations  |
| `@veap/framework/storage`, `/settings`             | file storage, key-value settings          |
| `@veap/framework/settings/models`                  | Setting model                             |
| `@veap/framework/react`                            | client providers and hooks                |

## Minimal usage

```ts
// lib/veap.ts - the composition root
import { Application } from "@veap/framework/core/server";

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
veap eject <package>    # eject an installed plugin or template to local workspace
veap register          # re-sync lib/plugins.gen.ts
veap docker            # generate Docker configuration
```

See [docs/reference/cli.md](./docs/reference/cli.md) for full CLI commands and option flags.

## Development

```bash
bun install
bun run build   # tsc -> dist/
bun test        # vitest
```

Requires Node 22+ and Next.js 16 as a peer dependency.

## License

MIT
