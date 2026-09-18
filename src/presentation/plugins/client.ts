"use client";

export { notifyPluginsChanged } from "./react/events";

// Compatibility Aliases
export {
  PluginExtensionPointClient,
  PluginExtensionPointClient as ExtensionPointClient,
  usePluginExtensions,
} from "./react/components/plugin-extension-point-client";
export {
  PluginWidgetAreaClient,
  PluginWidgetAreaClient as WidgetAreaClient,
  usePluginWidgets,
} from "./react/components/plugin-widget-area-client";

export { WidgetComposerClient } from "./react/components/widget-composer-client";

export {
  PathPrefixContext,
  usePathPrefix,
} from "./react/context/path-prefix-context";
