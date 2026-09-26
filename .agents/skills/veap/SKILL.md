---
name: veap
description: Guide for Veap development, architectural rules, and system understanding. Use this whenever working on the Veap framework, creating plugins, or modifying core logic.
---

# Veap Development Skill

You are a core developer working on Veap.

Before implementing any change, follow this mental model:

1. **Identify the architectural layer** (Is it Core, Plugin, Template, or Next.js host?).
2. **Identify the owning package** (Which plugin or core module owns this data/logic?).
3. **Search for an existing abstraction** (Do not reinvent the wheel).
4. **Check plugin boundaries** (Plugins must be fully isolated npm packages).
5. **Check dependency direction** (Define dependencies in `manifest.dependencies` inside `package.json` or `veap.dependencies`).
6. **Check public API boundaries** (Import from `@veap/framework/...` not internal paths).
7. **Check relevant architecture documentation** (in `.veap/architecture/`).
8. **Inspect the actual source implementation** (Code is the ultimate source of truth).
9. **Implement the smallest architecture-consistent change**.
10. **Run validation** (Build, Typecheck, tests).

## Critical Architectural Rules

- **Never create a parallel abstraction** if an existing one can be extended (e.g. use `EventBus`, `ExtensionPoint`, `Widget`).
- **Never bypass plugin communication mechanisms**. Plugins should communicate via Public API, Event Bus, or UI Extensions.
- **Never import internal APIs** from another package.
- **Never modify public APIs** without explicit user approval.
- **Transactions:** Always use `await transaction(async () => { ... })` from `@veap/framework/database` instead of passing `trx` objects around.
- **Routing:** Do not add hardcoded files to `app/`. Define routes inside the plugin using `discoverRoutes` and `routeTree`.

## Where to find knowledge

The `.veap/` directory in this package acts as the technical memory of the project. Read these files when you need context:

- **Context & Principles:** `VEAP_CONTEXT.md`
- **General overview:** `.veap/architecture/overview.md`
- **Monorepo & Packages:** `.veap/architecture/packages.md`
- **Plugins (Modules):** `.veap/architecture/plugins.md`
- **Event Bus:** `.veap/architecture/events.md`
- **Database & ORM:** `.veap/architecture/database.md`
- **Lifecycle & Runtime:** `.veap/architecture/runtime.md`
- **Clean Architecture Layers:** `.veap/decisions/ADR-006-clean-architecture-layers.md`

Whenever you make a significant architectural decision or discover a new pattern, update the relevant files in `.veap/architecture/` or create an ADR in `.veap/decisions/`.
