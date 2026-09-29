# Technical Debt

## 1. Event Bus Global Strings

The `EventBus` currently allows publishing using generic strings in some contexts, meaning typos in event names won't always trigger TypeScript compilation errors.
**Goal**: Enforce strict `keyof SystemEventsMap` on all `publish` and `subscribe` calls globally.

## 2. In-Memory Event Bus Scaling

The Event Bus is an in-memory class instance. While this is fast and simple, it means events are not shared across server instances if the application is scaled horizontally (e.g., multiple Node instances or edge functions).
**Goal**: Evaluate if a Redis or message queue adapter is needed for distributed pub/sub in the future.

## 3. Global Bootstrapping Promise in Dev Mode

In Next.js development mode (HMR - Hot Module Replacement), the global variable `__VEAP_BOOTSTRAPPING_PROMISE__` coordinates lazy initialization across concurrent requests.
**Status**: Failure cleanup was introduced to reset the promise if a provider throws, allowing subsequent requests to retry initialization rather than being trapped in an uncaught rejection state. Full HMR cache-invalidation for dynamic module reloading remains an area for further refinement.

## 4. CSRF Protection for Custom Route Handlers

While session cookies specify `SameSite: "lax"` and Server Actions in Next.js automatically enforce `Origin` / `Host` verification, classic API Route Handlers (`app/api/...`) performing state-changing operations (`POST`, `PUT`, `DELETE`) rely on individual route logic.
**Status**: Implemented `verifySameOrigin(request: Request)` helper exported from `@veap/framework/auth/server` that validates `Sec-Fetch-Site` and `Origin` / `Host` consistency. Further work can provide an optional higher-order route middleware wrapper for plug-and-play handler protection.
