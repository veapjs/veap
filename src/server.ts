/**
 * Server-only entry point of `@veap/core`.
 *
 * Re-exports everything from the client-safe entry point plus the pieces that
 * require a Node/Server runtime: the composition root (`Application`), the
 * IoC container and providers, the config loader and the CLI service.
 */
export * from "./index";

// Domain
export * from "./domain/events/types";

// Infrastructure
export * from "./infrastructure/composition/index";
export * from "./infrastructure/config/index";
export * from "./infrastructure/ioc/index";
export * from "./infrastructure/providers/index";
export * from "./infrastructure/cli/service";

// Presentation (server actions / HTTP error mapping)
export * from "./presentation/errors/index";
