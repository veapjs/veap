# Installation

This guide walks you through setting up requirements, scaffolding a new
application, and running the development environment.

## Requirements

Ensure your environment meets the following requirements before proceeding:

- Node.js 22 or newer (generated projects declare `"engines": { "node": ">=22" }`).
- A package manager: Bun, pnpm, npm, or Yarn. The scaffolder auto-detects it;
  examples throughout this documentation use Bun.
- A database. SQLite works out of the box for local development; PostgreSQL is
  recommended for production environments.

## Creating a project

You can scaffold a new Veap project using `create-veap` with your preferred
package manager:

```bash
bun create veap [name]
# or
npm create veap [name]
# or
pnpm create veap [name]
# or
yarn create veap [name]
```

Alternatively, you can execute the scaffolder directly through your package
runner:

```bash
bunx create-veap [name]
# or
npx create-veap [name]
```

When you omit the project name in an interactive terminal, `create-veap` prompts
you for a name. You can also pass the project name directly as an argument:

```bash
bun create veap my-app
```

During initialization, `create-veap` asks whether you want to include optional
Docker configuration (`Dockerfile`, `compose.yml`, and `.dockerignore`). You can
preselect or bypass this prompt using the `--docker` or `--no-docker` flag.
In non-interactive environments (such as CI), Docker generation is skipped
by default unless `--docker` is explicitly supplied.

The project name must follow npm package naming rules (lowercase, no leading dot
or underscore, maximum 214 characters). Scoped names such as `@acme/my-app` are
supported; the project folder uses the base name while `package.json` retains the
full scoped name.

### Command options

The scaffolder supports the following options:

| Flag             | Description                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `--docker`       | Generate Docker configuration (`Dockerfile`, `compose.yml`, `.dockerignore`).            |
| `--no-docker`    | Skip Docker configuration and the interactive prompt.                                    |
| `--skip-install` | Do not run the package manager install step.                                             |
| `--pm <manager>` | Use a specific package manager (`bun`, `pnpm`, `npm`, `yarn`) instead of auto-detection. |
| `--pnpm`         | Force pnpm as package manager.                                                           |
| `--bun`          | Force Bun as package manager.                                                            |
| `--npm`          | Force npm as package manager.                                                            |
| `--yarn`         | Force Yarn as package manager.                                                           |

`create-veap` automatically detects the running package manager from the
execution command (such as `bun create`, `pnpm create`, `npm create`, or
`yarn create`) and environment variables without prompting for selection. To
explicitly choose a different package manager than the runner (for example, if
you execute `bun create veap my-app` but want the generated project to use
`pnpm`), pass the corresponding flag:

```bash
bun create veap my-app --pnpm
```

Under the hood, the scaffolder runs the official `create-next-app` with
TypeScript, Tailwind CSS, ESLint, React Compiler, the App Router, and an `@/*`
import alias, then layers Veap configuration and dependencies on top.

The scaffolder explicitly passes your chosen package manager (`--use-bun`,
`--use-pnpm`, `--use-yarn`, `--use-npm`) to `create-next-app`. If your package
manager runner encounters network or IPv6 timeouts (such as Bun's known IPv6
resolution issues on Windows when downloading tarballs), `create-veap`
automatically falls back to `npx` to download and generate the initial Next.js
files while preserving your chosen package manager configuration.

The `veap` CLI (from `@veap/framework`) delegates to the same scaffolding flow:

```bash
bun veap init [name]
```

## First run

Start the development server after creating your project:

```bash
cd my-app
bun dev
```

On the first request the application:

1. Runs core migrations and app migrations against `DATABASE_URL` (default: a
   local SQLite database file at `storage/veap.sqlite`; the framework creates the
   directory if needed).
2. Registers and boots service providers (kernel, database, auth, storage,
   communication, intl, router, settings, plugins).
3. Verifies whether the system is installed (at least one user exists). On a
   fresh database, the install wizard takes over (provided by the installer
   plugin included in the scaffold).

Open [http://localhost:3000](http://localhost:3000) and complete the setup
wizard. After that you can sign in and reach the admin panel under the configured
private path, `/app` by default.

## Environment variables

The generated `.env` file contains standard configuration:

```bash
# Application encryption key (required for token hashing and session signing)
ENCRYPTION_KEY=...

# Database connection
DATABASE_CLIENT=sqlite3
DATABASE_URL=./storage/veap.sqlite
```

When switching to PostgreSQL in production, update `DATABASE_CLIENT` to `pg`
and provide a Postgres connection URL:

```bash
DATABASE_CLIENT=pg
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
```
