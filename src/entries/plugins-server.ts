// Re-export client-safe plugins

// Core: Registry & Templates
export * from "../application/plugins/registry";
export * from "../application/plugins/templates";
// Core: Compatibility Aliases
export {
  applyPluginFilters as applyFilters,
  getPluginConfig as getModuleConfig,
  getPluginStatus as getModule,
  getPluginStatus as getModuleStatus,
  getPluginsStatus as getModules,
  hasPluginExtension as hasExtension,
  hasPluginHooks as hasHooks,
  togglePluginState as toggleModuleState,
  updatePluginConfig as updateModuleConfig,
} from "../application/plugins/registry";
export { PluginManifestSchema as ModuleManifestSchema } from "../domain/plugins/types";
export * from "./plugins";
// Navigation
export * from "../application/plugins/breadcrumbs";
export { getPluginBreadcrumbs as getBreadcrumbs } from "../application/plugins/breadcrumbs";
export {
  getVeapPluginNavigationGrouped as getVeapModuleNavigationGrouped,
  getPathPrefix,
  getPluginNavigation as getPublicNavigation,
} from "../application/plugins/navigation";
// UI (Server versions)
export {
  PluginExtensionPoint,
  PluginExtensionPoint as ExtensionPoint,
} from "../presentation/plugins/react/components/plugin-extension-point";
export {
  PluginWidgetArea,
  PluginWidgetArea as WidgetArea,
} from "../presentation/plugins/react/components/plugin-widget-area";
export { WidgetComposer } from "../presentation/plugins/react/components/widget-composer";
