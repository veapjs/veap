<!-- BEGIN:veap-core-agent-rules -->

# Veap Core AI Agent Instructions

Welcome to the `@veap/framework` package. This package is the unified foundation of the Veap framework, providing the plugin system, virtual router, ActiveRecord ORM, authentication with RBAC, dependency injection container, event bus, and the `veap` CLI.

## 1. Technical Memory & Context

Before making architectural modifications, generating features, or resolving issues in `@veap/framework`, you **MUST**:

1. Read [`VEAP_CONTEXT.md`](./VEAP_CONTEXT.md) in this package directory.
2. Explore the [`.veap/`](./.veap/) technical memory directory:
   - [`.veap/architecture/`](./.veap/architecture/) (Technical specifications: runtime, routing, database, events, plugins, etc.)
   - [`.veap/conventions/`](./.veap/conventions/) (Coding, exports, server actions, naming, testing conventions)
   - [`.veap/decisions/`](./.veap/decisions/) (Architecture Decision Records - ADR-001 through ADR-006)
   - [`.veap/knowledge/`](./.veap/knowledge/) (Known issues and technical debt)
3. Consult [`docs/`](./docs/) for public user/developer-facing contracts and API references.

## 2. Core Architectural Directives

- **Clean Architecture Layers (ADR-006)**:
  - Source code strictly flows: `domain` → `application` → `infrastructure` → `presentation`.
  - Never import outer layers from inner layers (e.g. `domain` must never import from `infrastructure`).
  - **No Self-Imports**: Never use `@veap/framework/...` inside `packages/veap/src/`. Use relative imports (`../../`).
- **Entry Points & Exports**:
  - All public exports must pass through `src/entries/*` or root barrels (`src/index.ts`, `src/server.ts`).
  - Keep client-safe and server-only entry points strictly isolated.
- **Database Safety**:
  - All database mutations must use `transaction(async (trx) => { ... })` from `src/infrastructure/database/orm/connection.ts`.
  - Never instantiate unmanaged database transactions or pass raw transactions manually across services.
- **IoC Container**:
  - Use `@Injectable()` and `@Inject(TOKEN)` with typed tokens from `src/domain/contracts/token.ts` (`DATABASE`, `APP_PLUGINS`, `APP_MIGRATIONS`, etc.).
  - Never create static singletons when an abstraction can be registered in `container`.
- **Validation**:
  - Run `bun run test` (Vitest) after modifying code to verify zero regressions across all 12 test suites.

<!-- END:veap-core-agent-rules -->
