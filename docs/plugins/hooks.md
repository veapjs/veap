# Hooks

Hooks are a prioritized filter pipeline: given a point name, the registry collects handlers from all enabled plugins sorted by priority and chains them over a value.

## Registering and applying

```ts
// plugin A: transform data at a point
hooks: [
  {
    point: "blog:post:before_create",
    handler: async (data) => {
      if (!data.slug && data.title) data.slug = slugify(data.title);
      return data;
    },
    priority: 10,
  },
],
```

```ts
// plugin B (or app code): run the pipeline
import { applyPluginFilters } from "@veap/framework/plugins/server";

const prepared = await applyPluginFilters("blog:post:before_create", draftData);
```

Semantics:

- `applyPluginFilters<T>(point, data)` folds the value through every handler; each handler receives the previous result and returns the next.
- Priority sorts ascending, default 100.
- Only enabled plugins contribute.
- `hasPluginHooks(point)` checks existence without running anything.

## Event bus vs hooks

|         | Hooks                             | Event bus               |
| ------- | --------------------------------- | ----------------------- |
| Flow    | value in, value out (pipeline)    | fire and forget         |
| Order   | deterministic by priority         | concurrent              |
| Use for | transforming a payload before use | reacting after the fact |

The ORM's model lifecycle uses the event bus (notifications), while content pipelines (slug generation, sanitization, validation) use hooks. When both fit, prefer hooks for anything where the result matters.

## Well-known points

The kernel itself does not apply hooks at fixed points (extension points cover UI injection); hook points are declared by the domains that own a flow. The blog plugin is the reference example: `blog:post:before_create` and `blog:post:before_update`. When you define a point for other plugins to hook into:

1. Name it `domain:entity:stage` (for example `shop:order:before_create`).
2. Document the payload shape in your plugin's README.
3. Apply it with `applyPluginFilters` at exactly one place in your flow, before persistence.

## Cross-plugin imports

A plugin can also export plain functions and another plugin can import them via the package entry. Use hooks instead when you want loose coupling (the consumer should not know which plugins contribute), and direct imports when you own both plugins and the contract is stable.
