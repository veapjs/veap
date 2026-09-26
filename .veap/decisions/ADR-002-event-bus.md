# ADR-002: Event Bus for Asynchronous Communication

## Status

Accepted

## Context

Plugins often need to react to actions that occur in other plugins (e.g., the Notifications plugin needs to know when a User registers). Using direct method calls creates hard, circular dependencies between plugins.

## Decision

Introduce a central `EventBus` in the Kernel. Plugins use `publish` to broadcast domain events, and other plugins use `subscribe` to react to them.

## Consequences

**Positive:**

- Extremely loose coupling between plugins.
- Easy to add new reactions to existing events without touching the publisher code.

**Negative:**

- Logic is harder to trace sequentially (spaghetti events).
- Because it uses in-memory `Promise.all`, it is not distributed. It executes synchronously within the Node process, but cannot scale out-of-the-box across multiple server nodes.
