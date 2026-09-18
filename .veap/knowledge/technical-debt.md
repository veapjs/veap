# Technical Debt

## 1. Event Bus Global Strings

The `EventBus` currently allows publishing using generic strings in some contexts, meaning typos in event names won't always trigger TypeScript compilation errors.
**Goal**: Enforce strict `keyof SystemEventsMap` on all `publish` and `subscribe` calls globally.

## 2. In-Memory Event Bus Scaling

The Event Bus is an in-memory class instance. While this is fast and simple, it means events are not shared across server instances if the application is scaled horizontally (e.g., multiple Node instances or edge functions).
**Goal**: Evaluate if a Redis or message queue adapter is needed for distributed pub/sub in the future.

## 3. Global Bootstrapping Promise in Dev Mode

In Next.js development mode (HMR - Hot Module Replacement), the global variable `__VEAP_BOOTSTRAPPING_PROMISE__` can sometimes be cleared or misaligned when the server reloads, causing plugins to attempt re-initialization and throw locked database errors.
