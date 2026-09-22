# Settings

Settings are a persistent key/value store with JSON values and an in-memory cache. The kernel uses it internally (active template id, plugin config storage goes through the plugin repository), and your application and plugins can use it for their own flags and configuration.

## API

```ts
import { SettingsService } from "@veap/framework/settings";
import { app } from "@veap/framework/core/server";

const settings = await app(SettingsService);

// read (generic; null when absent)
const announcement = await settings.get<string>("announcement");

// write (any JSON value)
await settings.set("announcement", { text: "Downtime tonight", level: "warn" });

// delete and bulk clear
await settings.remove("announcement");
await settings.clear(); // removes everything; clears the cache
```

Keys are free-form strings; Veap's own keys use a `namespace:name` convention (`system:template`). Values are stored as JSON in the `settings` table.

## Caching behavior

`get` checks the `CACHE_PROVIDER` (in-memory by default) first, then the repository, caching hits. `set` and `remove` update both. Consequences:

- Reads are cheap and per-process; a write from one server instance does not evict another instance's cache. Multi-instance deployments should treat settings as slowly-changing configuration or add a pub/sub invalidation of their own.
- `clear()` clears the whole cache provider (not only settings keys) with the default memory provider.

## Template and plugin configuration

- The active template is stored under `system:template` (see [Templates](../plugins/templates.md)); `TemplateService.setActive` writes it.
- Plugin config is stored per plugin in the `plugins` table (`config` JSON), not in settings: use `getPluginConfig(id)` / `updatePluginConfig(id, config)` from `@veap/framework/plugins/server`.
- Template config is stored in the `templates` table similarly, surfaced via `getTemplateConfig` / `updateTemplateConfig`.

## The Setting model

```ts
import { Setting } from "@veap/framework/settings/models";

const rows = await Setting.query().whereLike("key", "blog:%").get();
```

Direct model access bypasses the cache; prefer `SettingsService` in application code and reserve model queries for maintenance scripts.
