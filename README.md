# Veap Framework

The [Veap Framework](https://veap.pl) is a modular, enterprise-grade application framework for Next.js and Node.js.

Veap complements Next.js by providing robust backend architecture: an IoC dependency injection container, Active Record ORM, authentication and RBAC, schema migrations, internationalization, mail delivery, file storage, and an extensible CLI console.

## Ecosystem packages

The monorepo contains the core packages that form the Veap ecosystem:

| Package                                              | Purpose                                                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`@veap/kernel`](packages/kernel)                    | Foundation: IoC container, event bus, cache port, HTTP abstractions, config service, error handling, and the `veap` console CLI.        |
| [`@veap/database`](packages/database)                | Database: Knex integration, Active Record models, fluent query builder, relationships, and cross-dialect migrations.                    |
| [`@veap/auth`](packages/auth)                        | Security: Next.js Server Actions, session hashing, HTTP-only cookies, password hashing (bcrypt), encrypted secrets (AES-GCM), and RBAC. |
| [`@veap/intl`](packages/intl)                        | Localization: Request-aware locale negotiation, ICU message formatting, and client React context/hooks.                                 |
| [`@veap/mail`](packages/mail)                        | Mail delivery: Mailer port contracts, recipient normalization, and pluggable transport adapters.                                        |
| [`@veap/settings`](packages/settings)                | Settings: Persisted database key-value preferences with memory caching and schema management.                                           |
| [`@veap/storage`](packages/storage)                  | Storage: Unified file storage service, path-traversal security guards, and local/cloud provider contracts.                              |
| [`@veap/plugins`](packages/plugins)                  | Extensibility: Plugin discovery, lifecycle management, route trees, navigation, and UI widget extension points.                         |
| [`@veap/ui`](packages/ui)                            | UI components: Shared design system, React component library, and theme provider.                                                       |
| [`create-veap`](packages/create-veap)                | Scaffolding CLI: Interactive and non-interactive project generator for new Next.js + Veap applications.                                 |
| [`@veap/translatable`](packages/veap-translatable)   | ORM trait: Polymorphic multilingual model attribute translations.                                                                       |
| [`@veap/taggable`](packages/veap-taggable)           | ORM trait: Polymorphic tagging with localized tag names and query scopes.                                                               |
| [`@veap/categorizable`](packages/veap-categorizable) | ORM trait: Hierarchical polymorphic categorization and nested category trees.                                                           |
| [`@veap/commentable`](packages/veap-commentable)     | ORM trait: Polymorphic threaded comments, nested replies, and moderation workflows.                                                     |

## Quickstart

Clone the repository, install dependencies, and start the development servers:

```bash
bun install
bun dev
```

## Common tasks

| Task                                      | Command               |
| ----------------------------------------- | --------------------- |
| Install dependencies                      | `bun install`         |
| Start development servers                 | `bun dev`             |
| Build all packages and plugins            | `bun run build`       |
| Run workspace tests                       | `bun run test`        |
| Check formatting and linter (Biome)       | `bun run check`       |
| Fix formatting automatically (Biome)      | `bun run check:write` |
| Type-check the workspace                  | `bun run check:types` |
| Check architectural boundary invariants   | `bun run check:arch`  |
| Validate documentation links & navigation | `bun run check:docs`  |

## Repository structure

- `apps/` — Applications:
  - `apps/veap-docs` — Official documentation site ([veap.pl/docs](https://veap.pl/docs)).
  - `apps/01-basic` — Reference Next.js App Router application demonstrating Veap integration.
- `packages/` — Shared framework packages (`@veap/kernel`, `@veap/database`, `@veap/auth`, etc.).
- `plugins/` — Directory for local plugins and ejected workspace modules.
- `templates/` — Starter project templates consumed by `create-veap` (`01-basic`, `02-hono`).
- `docs/` — Documentation sources:
  - `docs/developer-docs/` — Public developer guides, tutorials, and API references.
  - `docs/maintainer-notes/` — Architecture design, package authoring guidelines, and CI/CD release runbooks.

## Scaffolding a new application

Use `create-veap` to initialize a new Veap project on top of Next.js:

```bash
# Interactive setup (prompts for project name and template)
bun create veap my-app

# Using an explicit template
bun create veap my-app --template 01-basic

# Non-interactive without running package install
bun create veap my-app --template 01-basic --skip-install

# Using a GitHub repository as the template source
bun create veap my-app --example https://github.com/veapjs/veap/tree/main/templates/01-basic
```

You can also run scaffolding with other package managers (`pnpm create veap`, `npx create-veap`, or `yarn create veap`).

## Documentation

- **Developer documentation:** Full guides, tutorials, and API reference at [https://veap.pl/docs](https://veap.pl/docs) or in [`docs/developer-docs/`](docs/developer-docs/).
- **Maintainer and author guide:** For instructions on extending the ecosystem, authoring new `@veap/*` packages, or managing releases, see [`docs/maintainer-notes/`](docs/maintainer-notes/).
- **Agent guidelines:** Operating rules and conventions for coding agents in [`AGENTS.md`](AGENTS.md).

## Versioning and releases

This monorepo uses [Changesets](https://github.com/changesets/changesets) for semver versioning and release changelogs:

```bash
# Create a changeset for your changes
bun run changeset

# Apply pending changesets and update package versions
bun run version-packages
```

Refer to the [Release & Versioning Runbook](docs/maintainer-notes/release-and-versioning.md) for detailed release automation procedures.

## License

MIT
