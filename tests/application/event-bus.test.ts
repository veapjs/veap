import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventBus } from "../../src/application/events/event-bus";
import type { ILogger } from "../../src/domain/contracts/logger";

/**
 * EventBus - the pub/sub spine of the system.
 *
 * Covered behaviours: typed delivery of `SystemEventsMap` events, source
 * annotation, idempotent subscriptions, unsubscription, wildcard-tolerance
 * for plugin-owned events, handler isolation (one failing handler must not
 * break others) and re-throwing Next.js redirect signals.
 */
describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("delivers a typed event payload to a subscriber", async () => {
    const handler = vi.fn();
    bus.subscribe("system:auth:login", "sub-1", handler);

    await bus.publish("system:auth:login", {
      session: { id: "s1" } as never,
      user: { id: "u1" } as never,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe("system:auth:login");
    expect(event.payload.user.id).toBe("u1");
    expect(event.source).toBe("system");
    expect(typeof event.timestamp).toBe("number");
  });

  it("supports multiple subscribers on one event", async () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe("system:auth:login", "a", a);
    bus.subscribe("system:auth:login", "b", b);

    await bus.publish("system:auth:login", {
      session: { id: "s" } as never,
      user: { id: "u" } as never,
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("annotates the event with a custom source", async () => {
    const handler = vi.fn();
    bus.subscribe("system:auth:login", "sub", handler);

    await bus.publish(
      "system:auth:login",
      { session: null, user: null } as never,
      "google-plugin",
    );

    expect(handler.mock.calls[0][0].source).toBe("google-plugin");
  });

  it("is idempotent: re-subscribing the same subscriber id keeps a single handler", async () => {
    const handler = vi.fn();
    bus.subscribe("system:auth:login", "sub-1", handler);
    bus.subscribe("system:auth:login", "sub-1", handler);

    await bus.publish("system:auth:login", {
      session: { id: "s" } as never,
      user: { id: "u" } as never,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stops delivering after unsubscribe", async () => {
    const handler = vi.fn();
    bus.subscribe("system:auth:login", "sub-1", handler);
    bus.unsubscribe("system:auth:login", "sub-1");

    await bus.publish("system:auth:login", {
      session: { id: "s" } as never,
      user: { id: "u" } as never,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("tolerates plugin-owned string events outside SystemEventsMap", async () => {
    const handler = vi.fn();
    bus.subscribe("blog:post-created", "sub-1", handler);

    await bus.publish("blog:post-created" as never, { postId: 1 } as never);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].payload).toEqual({ postId: 1 });
  });

  it("publishing an event with no subscribers is a no-op", async () => {
    await expect(
      bus.publish("system:auth:login", {
        session: null,
        user: null,
      } as never),
    ).resolves.toBeUndefined();
  });

  it("isolates failing handlers: others still run, error is swallowed and logged", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("boom"));
    const healthy = vi.fn();
    bus.subscribe("system:auth:login", "bad", failing);
    bus.subscribe("system:auth:login", "good", healthy);

    const logger: ILogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    bus.setLogger(logger);

    await bus.publish("system:auth:login", {
      session: { id: "s" } as never,
      user: { id: "u" } as never,
    });

    expect(failing).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("re-throws Next.js redirect signals instead of swallowing them", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/signin;307;",
    });
    bus.subscribe("system:auth:login", "redirector", () => {
      throw redirectError;
    });

    await expect(
      bus.publish("system:auth:login", {
        session: { id: "s" } as never,
        user: { id: "u" } as never,
      }),
    ).rejects.toBe(redirectError);
  });

  it("clearAll removes every subscription", async () => {
    const handler = vi.fn();
    bus.subscribe("system:auth:login", "a", handler);
    bus.subscribe("system:auth:signup", "b", handler);
    bus.clearAll();

    await bus.publish("system:auth:login", {
      session: null,
      user: null,
    } as never);
    await bus.publish("system:auth:signup", {
      session: null,
      user: null,
    } as never);

    expect(handler).not.toHaveBeenCalled();
  });
});
