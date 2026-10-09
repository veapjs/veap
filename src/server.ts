/**
 * Server-only entry point of `@veap/framework`.
 *
 * Re-exports everything from the client-safe entry point plus the pieces that
 * require a Node/Server runtime: the composition root (`Application`), the
 * IoC container and providers, the config loader and the CLI service.
 */

export * from "./index";
export * from "./infrastructure/cli/service";
export * from "./infrastructure/composition/index";
export * from "./presentation/errors/index";
