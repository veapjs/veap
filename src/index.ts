/**
 * Public, client-safe entry point of `@veap/core`.
 *
 * Exposes the framework primitives that are safe to import from both the
 * server and the browser: domain errors, event contracts, the event bus,
 * logging, configuration types and the environment config service.
 */
export * from "./domain/config/index";
export * from "./domain/errors/types";
export * from "./domain/errors/app-error";
export * from "./domain/errors/result";
export * from "./domain/events/types";
export * from "./domain/contracts/index";
export * from "./application/events/index";
export * from "./infrastructure/logging/index";
export * from "./infrastructure/config/config.service";
