# Testing Guide

Testing in Veap is fast and straightforward because the framework is built on a Ports and Adapters (hexagonal) architecture and an Inversion of Control (IoC) container. Domain logic, ORM models, Server Actions, and plugins can be thoroughly tested in isolation without running a Next.js HTTP server.

This guide explains how to write unit and integration tests using standard runners such as Vitest or Bun Test.

## Testing philosophy

- **Decoupled from the runtime:** Core services depend on interfaces (`IHttpRequestContext`, `ICookieStore`, `IMailer`, `ICacheProvider`), not concrete Next.js APIs (`cookies()`, `headers()`).
- **Container-driven:** You can swap any service or port with a mock by registering it in the container before running a test.
- **In-memory database:** SQLite in-memory databases (`:memory:`) provide instant, zero-cleanup test isolation for ORM queries and transactions.

---

## 1. Setting up the container and test lifecycle

The global `container` stores singleton instances. To prevent state leakage across tests, clear and reset bindings in lifecycle hooks:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { container } from "@veap/core/core/server";

describe("MyService", () => {
  beforeEach(() => {
    // Clear container registrations and cached singletons
    container.clear();
  });

  it("resolves isolated instances", async () => {
    // Register test doubles or test-specific instances
  });
});
```

<!-- prettier-ignore -->
> [!NOTE]
> `container.clear()` is designed specifically for automated testing and full worker reboots. Never call it in production application code.

---

## 2. Mocking request ports

When testing Server Actions, services, or middleware that inspect incoming HTTP requests or manipulate cookies, mock `REQUEST_CONTEXT` and `COOKIE_STORE`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  container,
  COOKIE_STORE,
  REQUEST_CONTEXT,
} from "@veap/core/core/server";
import type { ICookieStore, IHttpRequestContext } from "@veap/core/core/server";

export function createFakeCookieStore(
  initialCookies: Record<string, string> = {},
): ICookieStore {
  const map = new Map<string, string>(Object.entries(initialCookies));
  return {
    get: (name: string) =>
      map.has(name) ? { name, value: map.get(name)! } : undefined,
    getAll: () =>
      Array.from(map.entries()).map(([name, value]) => ({ name, value })),
    has: (name: string) => map.has(name),
    set: (name: string, value: string) => {
      map.set(name, value);
      return undefined as any;
    },
    delete: (name: string) => {
      map.delete(name);
      return undefined as any;
    },
  };
}

export function createFakeRequestContext(
  overrides: Partial<IHttpRequestContext> = {},
): IHttpRequestContext {
  const headers = new Headers(
    overrides.headers ? Object.entries(overrides.headers) : [],
  );
  return {
    url: overrides.url ?? "http://localhost:3000/app/dashboard",
    method: overrides.method ?? "GET",
    headers,
    cookies: overrides.cookies ?? createFakeCookieStore(),
    params: overrides.params ?? {},
    searchParams: overrides.searchParams ?? new URLSearchParams(),
  };
}

describe("Auth action test", () => {
  beforeEach(() => {
    container.clear();

    const fakeCookies = createFakeCookieStore();
    container.register({
      token: COOKIE_STORE,
      useValue: fakeCookies,
      singleton: true,
    });

    container.register({
      token: REQUEST_CONTEXT,
      useValue: createFakeRequestContext({ cookies: fakeCookies }),
      singleton: true,
    });
  });

  it("reads and writes cookies through the port", async () => {
    const cookies = await container.resolve<ICookieStore>(COOKIE_STORE);
    cookies.set("session_token", "test-token-123");

    expect(cookies.get("session_token")?.value).toBe("test-token-123");
  });
});
```

---

## 3. Testing ORM models with SQLite in-memory

You can test ActiveRecord models and database transactions using an in-memory SQLite database:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase, transaction, Model } from "@veap/core/database";
import type { Knex } from "knex";

let knex: Knex;

export interface ItemAttributes {
  id: string;
  name: string;
}

export class Item extends Model<ItemAttributes> {
  static override table = "items";
  static override fillable = ["name"];
}

beforeAll(async () => {
  // Initialize in-memory SQLite connection
  knex = initDatabase({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });

  // Run test migrations or create tables directly
  await knex.schema.createTable("items", (table) => {
    table.uuid("id").primary();
    table.string("name").notNullable();
    table.timestamps(true, true);
  });
});

afterAll(async () => {
  await knex.destroy();
});

describe("Item model", () => {
  it("creates and retrieves records", async () => {
    const item = await Item.create({ name: "Widget" });
    expect(item.id).toBeDefined();
    expect(item.name).toBe("Widget");

    const found = await Item.find(item.id);
    expect(found?.name).toBe("Widget");
  });

  it("rolls back transactions on error", async () => {
    await expect(
      transaction(async () => {
        await Item.create({ name: "Temporary" });
        throw new Error("Simulated failure");
      }),
    ).rejects.toThrow("Simulated failure");

    const count = await Item.query().where("name", "Temporary").count();
    expect(count).toBe(0);
  });
});
```

---

## 4. Testing event bus subscribers

When testing event publication or plugin event listeners:

```ts
import { describe, it, expect, vi } from "vitest";
import { eventBus } from "@veap/core";

describe("Event bus integration", () => {
  it("delivers events to subscribers", async () => {
    const handler = vi.fn();
    const subscriberId = "test-subscriber";
    eventBus.subscribe("system:start", subscriberId, async (event) => {
      handler(event.payload);
    });

    await eventBus.publish("system:start", { runtime: "nodejs" });

    expect(handler).toHaveBeenCalledWith({ runtime: "nodejs" });
    eventBus.unsubscribe("system:start", subscriberId);
  });
});
```

---

## 5. Testing route middlewares

Veap route middlewares (`VeapMiddleware`) accept `VeapMiddlewareContext` and a `next` callback. You can test authorization logic and short-circuit redirects directly:

```ts
import { describe, it, expect, vi } from "vitest";
import type { VeapMiddleware, VeapMiddlewareContext } from "@veap/core/router";

export const ensureAdmin: VeapMiddleware = async (context, next) => {
  if (!context.roles?.includes("admin")) {
    return { redirect: "/unauthorized" };
  }
  return next();
};

describe("ensureAdmin middleware", () => {
  it("blocks non-admin users", async () => {
    const next = vi.fn();
    const context: VeapMiddlewareContext = {
      path: "/app/secret",
      params: {},
      searchParams: new URLSearchParams(),
      roles: ["user"],
    };

    const result = await ensureAdmin(context, next);
    expect(result).toEqual({ redirect: "/unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() for admin users", async () => {
    const next = vi.fn().mockResolvedValue("rendered-page");
    const context: VeapMiddlewareContext = {
      path: "/app/secret",
      params: {},
      searchParams: new URLSearchParams(),
      roles: ["admin"],
    };

    const result = await ensureAdmin(context, next);
    expect(result).toBe("rendered-page");
    expect(next).toHaveBeenCalledOnce();
  });
});
```
