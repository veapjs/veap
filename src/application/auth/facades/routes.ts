import type { AuthRoutesConfig } from "../../../domain/auth/types";
import { getAuthRoutes as getRoutesFromContext } from "../context";

/**
 * Returns the currently configured authentication routes.
 */
export function getAuthRoutes(): AuthRoutesConfig {
  return getRoutesFromContext();
}
