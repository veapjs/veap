# Event Bus

The Event Bus (`packages/veap/src/application/events/event-bus.ts`) provides asynchronous, decoupled communication between plugins.

## Implementation Details

- The port `IEventBus` lives in the domain layer (`domain/contracts/event-bus.ts`); the in-memory implementation lives in the application layer.
- It is a fully Dependency Injected class decorated with `@Injectable()`.
- The pre-created global singleton (`eventBus`) is exposed in the IoC container by `KernelServiceProvider` under the domain token `EVENT_BUS`; the `EventBus` class token remains as a backwards-compatibility alias to the same instance. Its logger is injected via the composition-root hook `EventBus.setLogger(ILogger)`.
- Events are strictly typed via the `SystemEventsMap` interface.
- **Execution:** Publishing an event executes all listeners in parallel using `Promise.all()`.
- **Error Handling:** Errors in listeners are caught and logged as warnings, ensuring they do not crash the publisher (except for Next.js `NEXT_REDIRECT` errors, which are re-thrown to allow server-side redirects).

## Usage Examples

```typescript
import { app, EVENT_BUS } from "@veap/core/core/server";
// Or the shared singleton:
// import { eventBus } from "@veap/core/core";

// Resolve the event bus via its domain token (app(EventBus) also works)
const eventBus = await app(EVENT_BUS);

// Publishing (payload shape comes from SystemEventsMap)
await eventBus.publish("system:auth:email-verified", { userId, email });

// Subscribing (second argument is the subscriber id, used for idempotency)
eventBus.subscribe(
  "system:auth:email-verified",
  "my-plugin-id",
  async (event) => {
    console.log(event.payload.userId);
  },
);
```

Core event names per domain are typed in `packages/veap/src/domain/*/events.ts` (e.g. `system:auth:login`, `system:auth:signup`). Arbitrary strings are still tolerated for plugin-own events (e.g. `blog:post-created`); core-domain publishers always use the typed `system:` names.
