import type { Token } from "./token";

import type { EventHandler, SystemEventsMap } from "../events/types";

/**
 * Options for publishing events.
 */
export interface PublishOptions {
  /**
   * If true, errors thrown by event handlers are re-thrown instead of
   * swallowed. If multiple handlers fail, an AggregateError is thrown.
   */
  strict?: boolean;
}

/**
 * Event bus port (publish/subscribe).
 *
 * Consumers depend on this contract instead of the concrete in-memory bus,
 * keeping the application layer decoupled from the delivery mechanism.
 */
export interface IEventBus {
  subscribe<K extends keyof SystemEventsMap>(
    eventType: K | (string & {}),
    subscriberId: string,
    handler: EventHandler<SystemEventsMap[K]>,
  ): void;

  unsubscribe(eventType: string, subscriberId: string): void;

  clearAll(): void;

  publish<K extends keyof SystemEventsMap>(
    eventType: K | (string & {}),
    payload: SystemEventsMap[K],
    source?: string,
    options?: PublishOptions,
  ): Promise<void>;

  publishStrict<K extends keyof SystemEventsMap>(
    eventType: K | (string & {}),
    payload: SystemEventsMap[K],
    source?: string,
  ): Promise<void>;
}

/**
 * Injection token for the event bus port.
 *
 * A global symbol keeps the token stable across HMR / dual-package
 * boundaries, the same reason the container keys class tokens with
 * `Symbol.for(...)`.
 */
export const EVENT_BUS: Token<IEventBus> = Symbol.for("veap:kernel:event-bus");
