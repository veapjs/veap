/**
 * Client-side events for plugin state changes.
 *
 * When a plugin is toggled via the manager, we need a way to
 * notify all interested client components (ExtensionPointClient,
 * WidgetAreaClient, etc.) so they can re-fetch their data without
 * requiring a full page refresh.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Subscribe to plugin state changes.
 * Returns an unsubscribe function.
 */
export function onPluginsChanged(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Notify all subscribers that a plugin was toggled.
 */
export function notifyPluginsChanged(): void {
  // biome-ignore lint/suspicious/useIterableCallbackReturn: <ignore>
  listeners.forEach((cb) => cb());
}
