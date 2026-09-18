import type { ILogger } from "../../domain/contracts/logger";
import type {
  EventHandler,
  SystemEvent,
  SystemEventsMap,
} from "../../domain/events/types";
import type { IEventBus } from "../../domain/contracts/event-bus";
import { Injectable } from "../../domain/contracts/ioc";

/**
 * EventBus (Pub/Sub) - Global Singleton Pattern.
 *
 * Logging goes through the `ILogger` port injected by the composition root
 * (see `KernelServiceProvider`), keeping this file free of infrastructure
 * imports. Before injection - i.e. before the system boots - only `debug`
 * calls can occur and they are dropped; the `warn` path in `publish()` is
 * unreachable until subscribers exist, which requires a booted system.
 */
@Injectable()
export class EventBus implements IEventBus {
  private handlers: Map<string, Map<string, EventHandler>> = new Map();

  private _logger: ILogger | null = null;

  /**
   * Composition-root hook: injects the logging adapter. Called exactly once
   * by `KernelServiceProvider.register()`; not part of the `IEventBus`
   * contract, so consumers never see it.
   */
  public setLogger(logger: ILogger): void {
    this._logger = logger;
  }

  /** Silent fallback: pre-boot logs are debug-only noise by definition. */
  private get log(): ILogger {
    return (
      this._logger ?? {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      }
    );
  }

  public subscribe<K extends keyof SystemEventsMap>(
    eventType: K | (string & {}),
    subscriberId: string,
    handler: EventHandler<SystemEventsMap[K]>,
  ): void {
    const type = eventType as string;
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Map());
    }
    const eventHandlers = this.handlers.get(type);

    // IDEMPOTENCY: Don't re-subscribe if ID already exists for this event
    if (eventHandlers?.has(subscriberId)) {
      return;
    }

    eventHandlers?.set(subscriberId, handler as EventHandler);
    this.log.debug(
      "veap:event",
      `Subscriber "${subscriberId}" added for "${String(eventType)}"`,
    );
  }

  public unsubscribe(eventType: string, subscriberId: string): void {
    this.handlers.get(eventType)?.delete(subscriberId);
    this.log.debug(
      "veap:event",
      `Subscriber "${subscriberId}" removed from "${eventType}"`,
    );
  }

  public clearAll(): void {
    this.log.debug("veap:event", "Resetting all listeners...");
    this.handlers.clear();
  }

  public async publish<K extends keyof SystemEventsMap>(
    eventType: K | (string & {}),
    payload: SystemEventsMap[K],
    source: string = "system",
  ): Promise<void> {
    const type = eventType as string;
    const eventHandlers = this.handlers.get(type);
    if (!eventHandlers) return;

    const handlers = Array.from(eventHandlers.values());

    // Only log essential publish events to keep console clean
    if (
      process.env.NODE_ENV !== "production" &&
      !type.startsWith("system:plugins:")
    ) {
      this.log.debug(
        "veap:event",
        `Publishing "${String(eventType)}" to ${handlers.length} subscribers`,
      );
    }

    const event: SystemEvent<SystemEventsMap[K]> = {
      type: type,
      payload,
      timestamp: Date.now(),
      source,
    };

    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error: any) {
          // Re-throw Next.js redirect errors to allow them to work
          if (error?.digest?.startsWith("NEXT_REDIRECT")) {
            throw error;
          }
          this.log.warn(
            "veap:event",
            `Handler Error for ${String(eventType)}:`,
            error,
          );
        }
      }),
    );
  }
}

// Ensure global singleton
const globalForEventBus = globalThis as unknown as {
  __VEAP_EVENT_BUS__: EventBus | undefined;
};

export const eventBus = globalForEventBus.__VEAP_EVENT_BUS__ || new EventBus();

globalForEventBus.__VEAP_EVENT_BUS__ = eventBus;
