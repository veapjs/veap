import { AppError } from "../../domain/errors/app-error";
import type { PluginRegistry } from "./registry";
import type { TemplateService } from "./templates";
import type { NavigationService } from "./navigation";

/**
 * Typed boundary between the plugins use cases and the modules that consume
 * them (facades, navigation, router, intl, presentation components).
 *
 * The composition root (`PluginServiceProvider`) resolves the concrete
 * services once at boot and binds them here - the same pattern as
 * `application/auth/context.ts`.
 */
export interface PluginsContext {
  registry: PluginRegistry;
  templates: TemplateService;
  navigation: NavigationService;
}

const globalForPluginsContext = globalThis as unknown as {
  __VEAP_PLUGINS_CONTEXT__?: PluginsContext;
};

/**
 * Binds the resolved plugins services. Called once by the composition root.
 */
export function bindPluginsContext(context: PluginsContext): void {
  globalForPluginsContext.__VEAP_PLUGINS_CONTEXT__ = context;
}

/**
 * Returns the bound plugins services.
 *
 * @throws If the plugins service provider has not booted yet.
 */
export function pluginsContext(): PluginsContext {
  const context = globalForPluginsContext.__VEAP_PLUGINS_CONTEXT__;
  if (!context) {
    throw AppError.Internal(
      "[Plugins] Context is not bound. PluginServiceProvider must boot before the plugins facades are used.",
    );
  }
  return context;
}
