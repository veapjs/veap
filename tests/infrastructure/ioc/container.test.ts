import { describe, expect, it, vi } from "vitest";

import { Container } from "../../../src/infrastructure/ioc/container";
import { Injectable, Inject } from "../../../src/domain/contracts/ioc";
import { AppError } from "../../../src/domain/errors/app-error";

/**
 * IoC Container - the composition mechanics of the whole system.
 *
 * Covered behaviours: value/factory/class registrations, singleton caching,
 * auto-wiring via `design:paramtypes`, explicit `@Inject` tokens for
 * interface ports, factory `inject` lists, missing-token errors, the
 * `import type` → `Object` guard, and Laravel-style `make`/`app` helpers.
 */
describe("Container", () => {
  it("resolves a useValue registration", async () => {
    const container = new Container();
    const TOKEN = Symbol.for("test:value");
    container.register({ token: TOKEN, useValue: 42 });

    await expect(container.resolve<number>(TOKEN)).resolves.toBe(42);
  });

  it("caches singletons across resolves", async () => {
    const container = new Container();
    const TOKEN = Symbol.for("test:factory");
    let constructions = 0;
    container.register({
      token: TOKEN,
      useFactory: () => {
        constructions += 1;
        return { id: constructions };
      },
      singleton: true,
    });

    const first = await container.resolve(TOKEN);
    const second = await container.resolve(TOKEN);

    expect(constructions).toBe(1);
    expect(second).toBe(first);
  });

  it("creates a new instance on every resolve when singleton is false", async () => {
    const container = new Container();
    const TOKEN = Symbol.for("test:transient");
    container.register({
      token: TOKEN,
      useFactory: () => ({}),
      singleton: false,
    });

    const first = await container.resolve(TOKEN);
    const second = await container.resolve(TOKEN);

    expect(second).not.toBe(first);
  });

  it("resolves factory dependencies via the inject list", async () => {
    const container = new Container();
    const CONFIG = Symbol.for("test:config");
    const SERVICE = Symbol.for("test:service");
    container.register({ token: CONFIG, useValue: { env: "test" } });
    container.register({
      token: SERVICE,
      useFactory: (config: { env: string }) => ({ env: config.env }),
      inject: [CONFIG],
    });

    await expect(container.resolve(SERVICE)).resolves.toEqual({
      env: "test",
    });
  });

  it("auto-wires @Injectable classes from design:paramtypes metadata", async () => {
    const container = new Container();

    class Repo {
      public findById() {
        return "repo-data";
      }
    }

    @Injectable()
    class Service {
      constructor(public readonly repo: Repo) {}
    }

    container.register({ token: Repo, useClass: Repo, singleton: true });
    container.register({ token: Service, useClass: Service });

    const service = await container.resolve(Service);
    expect(service.repo.findById()).toBe("repo-data");
  });

  it("honours @Inject tokens for interface ports that TS erases from metadata", async () => {
    const container = new Container();
    const LOGGER = Symbol.for("test:logger");

    interface ILogger {
      log(msg: string): void;
    }

    @Injectable()
    class Service {
      constructor(@Inject(LOGGER) public readonly logger: ILogger) {}
    }

    container.register({
      token: LOGGER,
      useValue: { log: (msg: string) => msg },
    });
    container.register({ token: Service, useClass: Service });

    const service = await container.resolve(Service);
    expect(service.logger.log("hi")).toBe("hi");
  });

  it("auto-instantiates unregistered classes with resolvable dependencies", async () => {
    const container = new Container();

    class Dependency {
      public value = "dep";
    }

    // @Injectable() makes TS emit design:paramtypes for the constructor -
    // undecorated classes carry no metadata for the container to read.
    @Injectable()
    class Consumer {
      constructor(public readonly dependency: Dependency) {}
    }

    container.register({ token: Dependency, useClass: Dependency });

    const consumer = await container.resolve(Consumer);
    expect(consumer.dependency.value).toBe("dep");
  });

  it("throws AppError INTERNAL for a missing symbol token", async () => {
    const container = new Container();
    const MISSING = Symbol.for("test:missing");

    const error = await container.resolve(MISSING).catch((e) => e as Error);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("INTERNAL_SERVER_ERROR");
    expect((error as AppError).message).toContain(
      "No provider found for token",
    );
  });

  it("guards against `import type` dependencies that erase to the Object token", async () => {
    const container = new Container();

    interface Port {
      ok(): boolean;
    }

    @Injectable()
    class Broken {
      // Simulates a dependency imported only via `import type`: its value is
      // erased, so `design:paramtypes` records `Object`.
      constructor(public readonly port: Port) {}
    }

    // Register with an explicit class whose paramtypes entry is `Object`
    // (no @Inject, no value import of an implementation).
    const error = await container.resolve(Broken).catch((e) => e as Error);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).message).toContain("`Object` token");
  });

  it("exposes has() and clear()", async () => {
    const container = new Container();
    const TOKEN = Symbol.for("test:has");
    expect(container.has(TOKEN)).toBe(false);

    container.register({ token: TOKEN, useValue: 1, singleton: true });
    expect(container.has(TOKEN)).toBe(true);

    await container.resolve(TOKEN);
    container.clear();
    // has() still sees the registration, but the cached instance is gone.
    expect(container.has(TOKEN)).toBe(true);
  });

  it("supports the Laravel-style make() alias and app() helper", async () => {
    const { app } = await import("../../../src/infrastructure/ioc/container");
    const TOKEN = Symbol.for("test:app-helper");
    app().register({ token: TOKEN, useValue: "resolved" });

    await expect(app().make(TOKEN)).resolves.toBe("resolved");
    await expect(app(TOKEN)).resolves.toBe("resolved");
  });
});
