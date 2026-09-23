import { beforeEach, describe, expect, it } from "vitest";
import { AuthCallbackRegistry } from "../../../src/application/auth/registry";
import {
  checkSecurity,
  registerAuthValidator,
  registerSecurityRequirement,
  unregisterAuthValidator,
  unregisterSecurityRequirement,
} from "../../../src/application/auth/logic";
import {
  augmentSession,
  registerSessionAugmenter,
  unregisterSessionAugmenter,
} from "../../../src/application/auth/augment";
import type { FullUser, Session } from "../../../src/domain/auth/types";

describe("AuthCallbackRegistry", () => {
  let registry: AuthCallbackRegistry<() => string>;

  beforeEach(() => {
    registry = new AuthCallbackRegistry();
  });

  it("registers and unregisters handlers by string ID", () => {
    const fn1 = () => "one";
    const fn2 = () => "two";

    registry.register("plugin-a", fn1);
    registry.register("plugin-b", fn2);

    expect(registry.size).toBe(2);
    expect(registry.has("plugin-a")).toBe(true);
    expect(Array.from(registry).map((fn) => fn())).toEqual(["one", "two"]);

    const removed = registry.unregister("plugin-a");
    expect(removed).toBe(true);
    expect(registry.size).toBe(1);
    expect(registry.has("plugin-a")).toBe(false);
    expect(Array.from(registry).map((fn) => fn())).toEqual(["two"]);
  });

  it("replaces handler when registered under the same ID (idempotency)", () => {
    const fn1 = () => "old";
    const fn2 = () => "new";

    registry.register("plugin-a", fn1);
    expect(registry.size).toBe(1);

    registry.register("plugin-a", fn2);
    expect(registry.size).toBe(1);

    const results = Array.from(registry).map((fn) => fn());
    expect(results).toEqual(["new"]);
  });

  it("supports anonymous registrations (backward compatibility)", () => {
    const fn1 = () => "anon1";
    const fn2 = () => "anon2";

    registry.register(fn1);
    registry.register(fn2);
    expect(registry.size).toBe(2);

    registry.unregister(fn1);
    expect(registry.size).toBe(1);
    expect(Array.from(registry).map((fn) => fn())).toEqual(["anon2"]);
  });
});

describe("Auth Lifecycle Teardown (Integration)", () => {
  const dummySession: Session = {
    id: "session-1",
    userId: "user-1",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  };

  const dummyUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    roles: ["user"],
    permissions: [],
  } as unknown as FullUser;

  it("registers and unregisters security requirement using string ID", async () => {
    const requirementId = "test:passkey-2fa";

    registerSecurityRequirement(requirementId, async () => {
      return {
        satisfied: false,
        redirect: "/auth/passkey/verify",
      };
    });

    // When registered: checkSecurity should fail
    const blockedResult = await checkSecurity(dummySession, dummyUser);
    expect(blockedResult.satisfied).toBe(false);
    expect(blockedResult.redirect).toBe("/auth/passkey/verify");

    // Unregister
    const removed = unregisterSecurityRequirement(requirementId);
    expect(removed).toBe(true);

    // After unregister: checkSecurity should pass
    const passResult = await checkSecurity(dummySession, dummyUser);
    expect(passResult.satisfied).toBe(true);
  });

  it("registers and unregisters session augmenter using string ID", async () => {
    const augmenterId = "test:passkey-session";

    registerSessionAugmenter(augmenterId, async () => {
      return { passkey_verified: true } as any;
    });

    const augmented = await augmentSession(dummySession);
    expect((augmented as any).passkey_verified).toBe(true);

    // Unregister
    unregisterSessionAugmenter(augmenterId);

    const plainSession = await augmentSession(dummySession);
    expect((plainSession as any).passkey_verified).toBeUndefined();
  });

  it("unregisters auth validator by string ID", () => {
    const validatorId = "test:auth-validator";

    registerAuthValidator(validatorId, async () => null);
    const removed = unregisterAuthValidator(validatorId);
    expect(removed).toBe(true);
  });
});
