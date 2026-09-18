# Installation

## Requirements

- Node.js 22 or newer (the generated project declares `"engines": { "node": ">=22" }`)
- A package manager: bun, pnpm, npm or yarn. The scaffolder auto-detects it; bun is used in most examples.
- A database. SQLite works out of the box for development; PostgreSQL is recommended for production.

## Creating a project

```bash
bunx create-veap
```

With no arguments the command asks for a project name and whether to include Docker configuration. You can also pass the name directly:

```bash
bunx create-veap my-app
```

The project name must be a valid npm package name (lowercase, no leading dot or underscore, max 214 characters). Scoped names such as `@acme/my-app` are supported; the project folder uses the base name and the full scoped name is written into `package.json`.

Flags:

| Flag             | Description                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `--docker`       | Generate Docker configuration (Dockerfile, compose.yml, .dockerignore).                  |
| `--no-docker`    | Skip Docker configuration and the interactive prompt.                                    |
| `--skip-install` | Do not run the package manager install step.                                             |
| `--pm <manager>` | Use a specific package manager (`bun`, `pnpm`, `npm`, `yarn`) instead of auto-detection. |

Under the hood the scaffolder runs the official `create-next-app` with TypeScript, Tailwind CSS, ESLint, React Compiler, the App Router and an `@/*` import alias, then adds Veap-specific files and dependencies on top. Next.js, React and TypeScript versions come from `create-next-app`, so generated projects are not pinned to versions from this documentation.

The `veap` CLI (from `@veap/core`) delegates to the same flow:

```bash
veap init [name]
```

## First run

```bash
cd my-app
bun dev
```

On the first request the application:

1. Runs core migrations and app migrations against `DATABASE_URL` (default: a local SQLite file at `storage/veap.sqlite`; the framework creates the directory if needed).
2. Registers and boots service providers (kernel, database, auth, storage, communication, intl, router, settings, plugins).
3. Checks whether the system is installed, meaning at least one user exists. On a fresh database the install wizard takes over (provided by the installer plugin included in the scaffold).

Open [http://localhost:3000](http://localhost:3000) and complete the setup wizard. After that you can sign in and reach the admin panel under the configured private path, `/app` by default.

## Environment variables

The scaffolder generates a `.env` with a fresh random `ENCRYPTION_KEY`. Validation is strict: the key must decode to 16, 24 or 32 bytes, and a missing or invalid key stops the process at boot. To generate one manually:

```bash
openssl rand -base64 16
```

The full list of environment variables Veap reads is described in [Environment variables](../configuration/environment-variables.md).

## Building for production

Veap applications are Next.js applications. Production build and runtime use the standard Next.js commands:

```bash
bun run build
bun run start
```

Deployment specifics (Docker, Vercel, PostgreSQL) are covered in [Deployment](../deployment/production.md).
