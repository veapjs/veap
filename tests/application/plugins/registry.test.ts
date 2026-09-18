import { beforeEach, describe, expect, it, vi } from "vitest";
import { PluginRegistry } from "../../../src/application/plugins/registry";
import { applyPluginFilters } from "../../../src/application/plugins/facade";
import { bindPluginsContext } from "../../../src/application/plugins/context";
import type { IPlugin } from "../../../src/domain/plugins/types";
import type {
  IMigrationRunner,
  IPluginRepository,
  PluginRecord,
} from "../../../src/domain/plugins/repositories/plugin.repository";
import type { IEventBus } from "../../../src/domain/contracts/event-bus";
import type { ILogger } from "../../../src/domain/contracts/logger";

class InMemoryPluginRepository implements IPluginRepository {
  public records = new Map<string, PluginRecord>();

  async findAll(): Promise<PluginRecord[]> {
    return Array.from(this.records.values());
  }

  async findById(id: string): Promise<PluginRecord | null> {
    return this.records.get(id) ?? null;
  }

  async upsertStatus(
    id: string,
    status: Partial<PluginRecord>,
    meta?: { system?: boolean },
  ): Promise<PluginRecord> {
    const existing = this.records.get(id) ?? {
      id,
      enabled: false,
      installed: false,
      lastStep: null,
      system: meta?.system ?? false,
    };
    const updated = { ...existing, ...status };
    this.records.set(id, updated);
    return updated;
  }

  async seed(plugins: PluginRecord[]): Promise<void> {
    for (const p of plugins) {
      if (!this.records.has(p.id)) {
        this.records.set(p.id, p);
      }
    }
  }

  async updateConfig(_id: string, _config: any): Promise<void> {}
  async getConfig<T>(_id: string): Promise<T | null> {
    return null;
  }
}

describe("PluginRegistry", () => {
  let repository: InMemoryPluginRepository;
  let migrationRunner: IMigrationRunner;
  let eventBus: IEventBus;
  let logger: ILogger;
  let registry: PluginRegistry;

  beforeEach(() => {
    repository = new InMemoryPluginRepository();
    migrationRunner = {
      run: vi.fn(async () => {}),
    };
    eventBus = {
      publish: vi.fn(async () => {}),
      subscribe: vi.fn(() => () => {}),
    };
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    registry = new PluginRegistry(
      repository,
      migrationRunner,
      eventBus,
      logger,
    );
  });

  describe("Registration", () => {
    it("registers plugins into the registry", () => {
      const plugin: IPlugin = {
        manifest: { id: "test-plugin", name: "Test Plugin" },
      };

      registry.register(plugin);
      expect(registry.getPlugins()).toHaveLength(1);
      expect(registry.getPlugins()[0].manifest.id).toBe("test-plugin");
    });

    it("recursively registers nested plugins", () => {
      const childPlugin: IPlugin = {
        manifest: { id: "child-plugin", name: "Child Plugin" },
      };
      const parentPlugin: IPlugin = {
        manifest: { id: "parent-plugin", name: "Parent Plugin" },
        plugins: [childPlugin],
      };

      registry.register(parentPlugin);
      expect(registry.getPlugins()).toHaveLength(2);
      const ids = registry.getPlugins().map((p) => p.manifest.id);
      expect(ids).toContain("parent-plugin");
      expect(ids).toContain("child-plugin");
    });
  });

  describe("Topological Dependency Sorting & Initialization", () => {
    it("initializes plugins in correct dependency order", async () => {
      const initOrder: string[] = [];

      const pluginA: IPlugin = {
        manifest: { id: "plugin-a", name: "Plugin A", system: true },
        init: async () => {
          initOrder.push("plugin-a");
        },
      };

      const pluginB: IPlugin = {
        manifest: {
          id: "plugin-b",
          name: "Plugin B",
          system: true,
          dependencies: ["plugin-a"],
        },
        init: async () => {
          initOrder.push("plugin-b");
        },
      };

      const pluginC: IPlugin = {
        manifest: {
          id: "plugin-c",
          name: "Plugin C",
          system: true,
          dependencies: ["@veap/plugin-b"], // scoped package name resolved
        },
        init: async () => {
          initOrder.push("plugin-c");
        },
      };

      // Register out of order (C, then B, then A)
      registry.register(pluginC);
      registry.register(pluginB);
      registry.register(pluginA);

      await registry.init();

      expect(initOrder).toEqual(["plugin-a", "plugin-b", "plugin-c"]);
    });

    it("detects circular dependencies and throws an AppError", async () => {
      const plugin1: IPlugin = {
        manifest: {
          id: "plugin-1",
          name: "Plugin 1",
          system: true,
          dependencies: ["plugin-2"],
        },
      };

      const plugin2: IPlugin = {
        manifest: {
          id: "plugin-2",
          name: "Plugin 2",
          system: true,
          dependencies: ["plugin-1"],
        },
      };

      registry.register(plugin1);
      registry.register(plugin2);

      await expect(registry.init()).rejects.toThrow(/circular dependency/i);
    });
  });

  describe("Hooks and Filters", () => {
    it("sorts hooks by priority (lower number runs earlier)", async () => {
      const plugin: IPlugin = {
        manifest: { id: "hook-plugin", name: "Hook Plugin", system: true },
        hooks: [
          {
            point: "transform:data",
            priority: 50,
            handler: (data) => `${data}-mid`,
          },
          {
            point: "transform:data",
            priority: 10,
            handler: (data) => `${data}-first`,
          },
          {
            point: "transform:data",
            // default priority 100
            handler: (data) => `${data}-last`,
          },
        ],
      };

      registry.register(plugin);
      await registry.init();

      const hooks = await registry.getHooks("transform:data");
      expect(hooks).toHaveLength(3);
      expect(hooks[0].priority).toBe(10);
      expect(hooks[1].priority).toBe(50);
      expect(hooks[2].priority).toBeUndefined();
    });

    it("applies filters sequentially folding the value through handlers", async () => {
      const plugin: IPlugin = {
        manifest: { id: "filter-plugin", name: "Filter Plugin", system: true },
        hooks: [
          {
            point: "calculate:total",
            priority: 1,
            handler: (val: number, ctx: { discount: number }) =>
              val - ctx.discount,
          },
          {
            point: "calculate:total",
            priority: 2,
            handler: (val: number) => val * 1.2, // add 20% VAT
          },
        ],
      };

      registry.register(plugin);
      await registry.init();

      bindPluginsContext({
        registry,
        templates: {} as any,
        navigation: {} as any,
      });

      const initialValue = 100;
      const context = { discount: 10 };
      // (100 - 10) = 90; 90 * 1.2 = 108
      const finalResult = await applyPluginFilters(
        "calculate:total",
        initialValue,
        context,
      );

      expect(finalResult).toBe(108);
    });
  });

  describe("Extensions with RBAC", () => {
    it("filters extensions based on user roles and permissions", async () => {
      const plugin: IPlugin = {
        manifest: { id: "ext-plugin", name: "Extension Plugin", system: true },
        extensions: [
          {
            target: "dashboard",
            point: "widgets",
            component: (() => null) as any,
          },
          {
            target: "dashboard",
            point: "widgets",
            roles: ["admin"],
            component: (() => null) as any,
          },
          {
            target: "dashboard",
            point: "widgets",
            permissions: ["posts:delete"],
            component: (() => null) as any,
          },
        ],
      };

      registry.register(plugin);
      await registry.init();

      // Guest/user without admin role or delete permission
      const regularExts = await registry.getExtensions("dashboard", "widgets", false, {
        roles: ["user"],
        permissions: ["posts:read"],
      });
      expect(regularExts).toHaveLength(1);

      // Admin user
      const adminExts = await registry.getExtensions("dashboard", "widgets", false, {
        roles: ["admin"],
        permissions: ["posts:read"],
      });
      expect(adminExts).toHaveLength(2);

      // User with all permissions
      const privilegedExts = await registry.getExtensions("dashboard", "widgets", false, {
        roles: ["admin"],
        permissions: ["posts:read", "posts:delete"],
      });
      expect(privilegedExts).toHaveLength(3);
    });
  });
});
