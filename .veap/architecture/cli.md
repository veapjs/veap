# Veap CLI

The CLI is bundled with the core package (`@veap/framework`, `packages/veap`): the `veap` binary (`packages/veap/bin/veap.js`) runs the compiled entry `dist/infrastructure/cli/index.js` via Node. There is no separate `@veap/cli` package. The CLI is built with `cac` and runs TypeScript sources through `jiti`.

## Domain-Driven Architecture

In Veap, CLI commands are NOT centralized in a single folder. Commands are localized to their respective domain modules, ensuring encapsulation:

- **Plugins Domain** (`packages/veap/src/infrastructure/plugins/cli/`): Houses the implementations for `add`, `eject`, `make:plugin` (`generate-plugin`) and `make:template` (`generate-template`).
- **Database Domain** (`packages/veap/src/infrastructure/database/cli/`): Houses the `make:migration` command (`generate-migration`).
- **Kernel** (`packages/veap/src/infrastructure/cli/`): Handles global lifecycle commands like `init` and `docker`.

Commands are registered dynamically during the application boot phase: the `CliService` program is registered in the IoC container, and `ServiceProvider.boot()` methods append their domain commands to it (see `PluginsServiceProvider` and `MigrationServiceProvider`).

## Core Commands

1. **`veap init [name]`**: Scaffolds a new project using `create-veap` (see _Project Scaffolding_ below). `name` is optional - when omitted (or other details), the CLI asks interactively. Options: `--docker`, `--skip-install` and `--pm <manager>`.
2. **`veap add <plugin>`**: Installs a plugin from npm (or a Git source with `--local`). Automatically calls `veap register` afterward.
3. **`veap register`**: The most critical internal command. It scans the workspace `package.json` for installed dependencies, identifies which ones are Veap plugins (based on naming and metadata), and regenerates `lib/plugins.gen.ts`. This file is used by the Kernel to load plugins at runtime.
4. **`veap make:*`**: Scaffolds new resources inside the local project: plugins (`make:plugin`), templates (`make:template`), and native app migrations (`make:migration`).
5. **`veap eject <package>`**: Copies an installed npm plugin or template directly into the local `/plugins` or `/templates` directory for manual customization.
6. **`veap docker`**: Generates Docker configuration (Dockerfile, compose.yml, .dockerignore).

## Project Scaffolding (create-veap)

`create-veap` no longer ships a duplicated Next.js boilerplate. The pipeline is:

1. **Scaffold** - runs the official `create-next-app@latest` (runner follows the chosen package manager: `bun create`, `pnpm dlx`, `yarn dlx`, `npx`) with explicit non-interactive flags (`--ts --tailwind --app --eslint --react-compiler --import-alias "@/*" --skip-install --yes`). Next/React/TypeScript/Tailwind versions come from CNA, so generated apps stay current with the framework.
2. **Overlay** - copies only the veap-owned files over the CNA output: root layout (`force-dynamic` contract), `not-found.tsx`, router catch-all page, API catch-all pipeline, storage route, `lib/veap.ts` bootstrap, `lib/plugins.gen.ts`, `next.config.ts`, the design-system `globals.css`, and an `AGENTS.md` carrying Veap agent knowledge (contracts, conventions, commands) into every generated project.
3. **Mutate** - merges veap dependencies into `package.json` (CNA-provided versions win; only `@types/node` is pinned), writes a starter `.env` with a **freshly generated random 16-byte `ENCRYPTION_KEY`** (the fail-fast contract of `@veap/framework` - there is no fallback) and a SQLite dev `DATABASE_URL`, appends storage entries to `.gitignore`.
4. **Finalize** - package-manager pinning and workspace config, optional Docker files, then a single dependency install.

The stubs directory (`stubs/overlay-full`) contains only veap-specific files; CNA boilerplate (`tsconfig.json`, `postcss.config.mjs`, `package.json`) is intentionally not duplicated there. There is no "bare" variant - every generated project is the full plugin-enabled setup.

**Interactive mode:** invoked without arguments, the CLI prompts for the project name and asks about Docker configuration. All prompts fall back to safe defaults on non-TTY (CI) - scripts never hang; pass flags (`--docker`/`--no-docker`, `--pm`) to stay fully non-interactive.

**Project name rules (npm):** the name is validated as an npm package name - lowercase, max 214 chars, no leading `.`/`_`. Scoped names (`@scope/name`) are supported: the project folder receives the base name while `package.json` gets the full scoped name (restored by the mutation step, since CNA derives the package name from the folder and would drop the scope). Reserved scopes and names - the framework's own `@veap` namespace, `next`, `react`, `vercel` and friends - are rejected.

## `plugins.gen.ts`

This generated file acts as a static bridge between the dynamic npm dependencies and the Next.js runtime (which requires explicit imports for bundling). **Never modify this file manually.**
