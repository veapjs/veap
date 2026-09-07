import type { Token } from "./token";

/**
 * Logging port.
 *
 * Domain and application layers depend on this abstraction. Concrete
 * adapters (e.g. `ConsoleLogger`) live in the infrastructure layer.
 */
export interface ILogger {
  debug(group: string, message: string, ...args: any[]): void;
  info(group: string, message: string, ...args: any[]): void;
  warn(group: string, message: string, ...args: any[]): void;
  error(group: string, message: string, ...args: any[]): void;
}

/**
 * Injection token for the logging port.
 *
 * A global symbol keeps the token stable across HMR / dual-package
 * boundaries, the same reason the container keys class tokens with
 * `Symbol.for(...)`.
 */
export const LOGGER: Token<ILogger> = Symbol.for("veap:kernel:logger");
