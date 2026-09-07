import type { Token } from "./token";

import type { VeapConfig } from "../config";

/**
 * Read-only access to the application config (`veap.config.ts`).
 *
 * Declared in the domain layer so application services can depend on the
 * contract without importing the jiti-based infrastructure loader.
 */
export interface IVeapConfigProvider {
  get(): Promise<VeapConfig>;
}

/**
 * Injection token for the application config (`veap.config.ts`) port.
 *
 * A global symbol keeps the token stable across HMR / dual-package
 * boundaries, the same reason the container keys class tokens with
 * `Symbol.for(...)`.
 */
export const VEAP_CONFIG: Token<IVeapConfigProvider> = Symbol.for(
  "veap:kernel:veap-config",
);
