# Event bus

Veap ships an in-process publish/subscribe event bus. It is a global singleton (stored on `globalThis` to survive HMR), exposed client-safe through `@veap/core/core` as `eventBus` and injectable server-side through the `IEventBus` port (`EVENT_BUS` token). "In-process" is the key limitation: events do not cross server instances, and they do not reach the browser automatically.

## Publishing and subscribing

```ts
import { eventBus } from "@veap/core/core";

// Subscribe: (eventType, subscriberId, handler)
eventBus.subscribe("user:signup:after", "my-plugin", async (event) => {
  console.log(event.payload, event.timestamp, event.source);
});

// Publish: (eventType, payload, source?)
await eventBus.publish("user:signup:after", { userId: "u_1" }, "my-plugin");

// Unsubscribe by eventType + subscriberId
eventBus.unsubscribe("user:signup:after", "my-plugin");
```

Semantics:

- Subscribing twice with the same subscriber id for the same event type is a no-op (idempotent), which makes re-registration safe.
- Handlers run concurrently (`Promise.all`). A handler error does not break other handlers; it is logged as a warning, except `NEXT_REDIRECT` digest errors, which are re-thrown so `redirect()` keeps working inside handlers.
- The `SystemEvent` envelope is `{ type, payload, timestamp, source }`.
- In development every publish logs a debug line (except `system:plugins:*`); in production publishing is silent.

## Typed events

`SystemEventsMap` in `domain/events/types.ts` declares payload types for system events, and the subscribe/publish signatures are typed against it (`K extends keyof SystemEventsMap`, with `(string & {})` escape hatch for custom event names). Notable built-in events:

| Event                                                                                              | Payload                                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `system:start`                                                                                     | `{ runtime }`                                                       |
| `system:not-installed`                                                                             | `{ timestamp }`                                                     |
| `system:plugins:init:start` / `system:plugins:init:end`                                            | `{ timestamp, pluginCount? }`                                       |
| `system:plugin:toggle`                                                                             | `{ pluginId, isEnabled }`                                           |
| `system:template:toggle`                                                                           | `{ templateId, isEnabled }`                                         |
| `router:request`                                                                                   | `{ path, searchParams, params, matchedNode, timestamp }` (dev only) |
| `action:confirm:request` / `:ack` / `:response`                                                    | confirmation dialog protocol (see below)                            |
| `system:auth:login`, `system:auth:signup`, `system:auth:session-created`, `system:auth:signed-out` | `{ session, user }` / `{ user }`                                    |
| `system:auth:validate-factors`                                                                     | `{ userId, email }`                                                 |
| `system:auth:password-reset:requested` / `:completed`                                              | `{ userId, email }` / `{ userId }`                                  |
| `system:auth:verification-requested`, `system:auth:email-verified`                                 | `{ userId, email }`                                                 |

## Model lifecycle events

The ORM publishes two events around every lifecycle transition: a per-table event and a generic one.

```ts
// When a BlogPost is created:
eventBus.subscribe("model:created:blog_posts", "audit", handler); // table-specific
eventBus.subscribe("model:created", "audit", handler); // all tables
```

Events: `saving`/`saved`, `creating`/`created`, `updating`/`updated`, `deleting`/`deleted`, `restoring`/`restored`. The payload is `{ model, event, table }`. Model instance hooks (methods like `saving()` on the model class) run first and can cancel the operation by returning `false`; bus events fire after the hook step. See [Model events](../data/orm.md#model-events).

## Cross-runtime warning

Because the bus is in-process:

- In serverless deployments each instance has its own bus; subscribers registered in one instance never see publishes from another. Subscribe in `init()` of plugins or in provider `boot()` (which run in every instance), not in modules that load once per instance.
- Client components can use the bus for browser-internal protocols (the confirmation dialog protocol works this way), but a server publish never reaches a client subscriber or vice versa.

## Confirmation protocol example

`useConfirmAction()` (client) publishes `action:confirm:request`. The action-confirm plugin's dialog (client) subscribes, acks, collects the password/passkey, then publishes `action:confirm:response`. The hook resolves its promise with the response, falling back to native `window.confirm` if no dialog acked within 500 ms. This shows the intended pattern: the bus coordinates UI components within one runtime.
