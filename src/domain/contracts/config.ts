import type { Token } from "./token";

/**
 * Environment configuration port.
 *
 * The contract is deliberately generic: the concrete environment schema
 * (zod, process.env, …) belongs to the infrastructure layer, which may wrap
 * it with typed keys. At this seam only untyped access is guaranteed.
 */
export interface IConfigService {
  get(key: string): any;
  getAll(): Record<string, any>;
}

/**
 * Injection token for the environment configuration port.
 *
 * A global symbol keeps the token stable across HMR / dual-package
 * boundaries, the same reason the container keys class tokens with
 * `Symbol.for(...)`.
 */
export const CONFIG_SERVICE: Token<IConfigService> =
  Symbol.for("veap:kernel:config");
