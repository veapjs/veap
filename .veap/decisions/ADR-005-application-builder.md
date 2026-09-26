# ADR-005: Laravel-Like Application Builder for Initialization

## Status

Accepted

## Context

Previously, initializing Veap required developers to manually pass an array of core `ServiceProvider`s (like `AuthServiceProvider`, `DatabaseServiceProvider`) and manage a complex Promise-based lock in `lib/veap.ts` to prevent race conditions during Next.js Hot Module Replacement (HMR). This made the configuration file cluttered and intimidating.

## Decision

We implemented a fluent `ApplicationBuilder` pattern (inspired by Laravel 11's `bootstrap/app.php`).

1. **Semantic Opt-In**: The `Application.configure()` builder provides semantic methods like `.withDatabase()`, `.withAuth()`, and `.withPlugins(plugins)` to optionally load specific core domain capabilities.
2. **Encapsulation**: The complex Next.js locking and booting logic (`g.__VEAP_BOOTSTRAPPING_PROMISE__`) has been encapsulated entirely within the `Application.bootstrap()` method inside `@veap/framework`.
3. **No Redundancy**: Redundant initialization scripts like `lib/client.ts` were removed because their logic (e.g., ORM connection) is already properly handled by `DatabaseServiceProvider.boot()`.

## Consequences

- **Positive:** `lib/veap.ts` is extremely minimal and declarative.
- **Positive:** Improved DX-developers can opt out of core systems (like Database or Auth) just by omitting a fluent method call.
- **Negative:** The actual list of providers is slightly hidden inside the builder methods, though they remain fully transparent in the source code.
