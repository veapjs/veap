import { Inject, Injectable } from "../../domain/contracts/ioc";

import { AppError } from "../../domain/errors/app-error";
import type { IEventBus } from "../../domain/contracts/event-bus";
import type { ILogger } from "../../domain/contracts/logger";
import type { IPlugin } from "../../domain/plugins/types";
import {
  MIGRATION_RUNNER,
  PLUGIN_REPOSITORY,
  type IMigrationRunner,
  type IPluginRepository,
  type PluginRuntimeStatus,
} from "../../domain/plugins/repositories/plugin.repository";
import { EVENT_BUS, LOGGER } from "../../domain/contracts";

/**
 * Normalizes an npm dependency string (e.g. "@veap/media-plugin") to a registered plugin id (e.g. "media-plugin").
 */
const resolveDependencyId = (depId: string): string =>
  depId.replace(/^@[^/]+\//, "");

@Injectable()
export class PluginRegistry {
  private plugins = new Map<string, IPlugin>();
  private pluginStatus = new Map<string, PluginRuntimeStatus>();
  private processingPlugins = new Set<string>();
  private initPromise: Promise<void> | null = null;
  private initialized = false;

  constructor(
    @Inject(PLUGIN_REPOSITORY) private readonly repository: IPluginRepository,
    @Inject(MIGRATION_RUNNER)
    private readonly migrationRunner: IMigrationRunner,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /** Lookup a plugin by id, falling back to the npm-name form. */
  private findPlugin(id: string): IPlugin | undefined {
    return this.plugins.get(id) ?? this.plugins.get(resolveDependencyId(id));
  }

  public register(plugin: IPlugin) {
    if (this.plugins.has(plugin.manifest.id)) {
      // return;
    }

    this.plugins.set(plugin.manifest.id, plugin);

    // Rekurencyjna rejestracja wtyczek zależnych
    if (plugin.plugins && Array.isArray(plugin.plugins)) {
      for (const nested of plugin.plugins) {
        this.register(nested);
      }
    }

    if (process.env.NODE_ENV === "development") {
      // In development, we want to allow re-registration to pick up HMR changes
      this.plugins.set(plugin.manifest.id, plugin);
    }
  }

  private async updateStatus(
    id: string,
    update: {
      enabled?: boolean;
      installed?: boolean;
      lastStep?: string | null;
    },
  ) {
    const current = this.pluginStatus.get(id) || {
      enabled: false,
      installed: false,
      lastStep: null,
    };

    const next = { ...current, ...update };
    this.pluginStatus.set(id, next);

    if (update.lastStep !== undefined && update.lastStep !== null) {
      this.logger.info("PluginRegistry", `"${id}" step: ${update.lastStep}`);
    }

    try {
      await this.repository.upsertStatus(id, update, {
        system: this.plugins.get(id)?.manifest.system ?? false,
      });
    } catch (e) {
      this.logger.warn("PluginRegistry", `DB status sync failed for ${id}:`, e);
    }
  }

  private async updateStep(id: string, step: string | null) {
    await this.updateStatus(id, { lastStep: step });
  }

  private sortPlugins(plugins: IPlugin[]): IPlugin[] {
    const sorted: IPlugin[] = [];
    const visited = new Set<string>();
    const processing = new Set<string>();

    const visit = (plugin: IPlugin) => {
      if (visited.has(plugin.manifest.id)) return;
      if (processing.has(plugin.manifest.id)) {
        throw AppError.Internal(
          `Circular dependency detected: ${plugin.manifest.id}`,
        );
      }

      processing.add(plugin.manifest.id);

      const dependencies = plugin.manifest.dependencies || [];
      for (const depId of dependencies) {
        const depPlugin = this.findPlugin(depId);
        if (depPlugin) {
          visit(depPlugin);
        } else {
          this.logger.warn(
            "PluginRegistry",
            `Missing dependency: ${depId} for plugin ${plugin.manifest.id}`,
          );
        }
      }

      processing.delete(plugin.manifest.id);
      visited.add(plugin.manifest.id);
      sorted.push(plugin);
    };

    // First, visit system plugins
    for (const plugin of plugins) {
      if (plugin.manifest.system) {
        visit(plugin);
      }
    }

    // Then visit the rest
    for (const plugin of plugins) {
      visit(plugin);
    }

    return sorted;
  }

  public async init() {
    // if (this.initialized && process.env.NODE_ENV !== "development") return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        await this.eventBus.publish("system:plugins:init:start", {
          timestamp: Date.now(),
        });

        // 1. Sync with database
        const pluginValues = Array.from(this.plugins.values()).map(
          (plugin) => ({
            id: plugin.manifest.id,
            enabled: plugin.manifest.system ?? false,
            installed: plugin.manifest.system ?? false,
            system: plugin.manifest.system ?? false,
          }),
        );

        if (pluginValues.length > 0) {
          try {
            await this.repository.seed(pluginValues);
          } catch (_e) {
            // Ignore errors if table doesn't exist yet during bootstrap
          }
        }

        // 2. Fetch current status from DB
        try {
          const dbPlugins = await this.repository.findAll();
          for (const dbp of dbPlugins) {
            this.pluginStatus.set(dbp.id, {
              enabled: dbp.enabled || dbp.system,
              installed: dbp.installed || dbp.system,
              lastStep: dbp.lastStep,
            });
          }
        } catch (_e) {
          for (const plugin of this.plugins.values()) {
            this.pluginStatus.set(plugin.manifest.id, {
              enabled: plugin.manifest.system ?? false,
              installed: true,
              lastStep: null,
            });
          }
        }

        // 3. Sort plugins by dependencies
        const sortedPlugins = this.sortPlugins(
          Array.from(this.plugins.values()),
        );

        // 4. Initialize enabled plugins
        for (const plugin of sortedPlugins) {
          const status = this.pluginStatus.get(plugin.manifest.id);
          if (status?.enabled) {
            if (plugin.migrations && plugin.migrations.length > 0) {
              await this.migrationRunner.run(
                plugin.manifest.id,
                plugin.migrations as any,
              );
            }

            if (!status.installed) {
              await this.updateStep(plugin.manifest.id, "Installing...");
              if (plugin.onMigrate) await plugin.onMigrate();
              if (plugin.onEnable) await plugin.onEnable();

              await this.updateStatus(plugin.manifest.id, {
                installed: true,
                lastStep: null,
              });
            }

            if (plugin.init) await plugin.init();
          }
        }

        this.initialized = true;

        this.logger.info(
          "veap:plugins",
          `Initialized with ${this.plugins.size} plugins`,
        );

        await this.eventBus.publish("system:plugins:init:end", {
          timestamp: Date.now(),
          pluginCount: this.plugins.size,
        });
      } catch (error) {
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  public getPlugins() {
    return Array.from(this.plugins.values());
  }

  public getEnabledPlugins() {
    return this.getPlugins().filter((p) => {
      const status = this.pluginStatus.get(p.manifest.id);
      return status?.enabled ?? false;
    });
  }

  public getPlugin(id: string) {
    return this.plugins.get(id);
  }

  public async getPluginsStatus() {
    try {
      const dbPlugins = await this.repository.findAll();
      const dbStatusMap = new Map(dbPlugins.map((p) => [p.id, p]));

      return this.getPlugins().map((p) => {
        const dbp = dbStatusMap.get(p.manifest.id);
        const memStatus = this.pluginStatus.get(p.manifest.id);

        return {
          ...p.manifest,
          enabled: dbp?.enabled ?? memStatus?.enabled ?? false,
          installed: dbp?.installed ?? memStatus?.installed ?? false,
          lastStep: memStatus?.lastStep ?? dbp?.lastStep ?? null,
        };
      });
    } catch (_e) {
      // Fallback for bootstrap phase
      return this.getPlugins().map((p) => {
        const status = this.pluginStatus.get(p.manifest.id);
        return {
          ...p.manifest,
          enabled: status?.enabled ?? false,
          installed: status?.installed ?? false,
          lastStep: status?.lastStep ?? null,
        };
      });
    }
  }

  public async getPluginStatus(id: string) {
    const plugin = this.plugins.get(id);
    if (!plugin) return null;

    const memStatus = this.pluginStatus.get(id);
    const isProcessing = this.processingPlugins.has(id);

    try {
      const dbp = await this.repository.findById(id);

      return {
        ...plugin.manifest,
        enabled: dbp?.enabled ?? memStatus?.enabled ?? false,
        installed: dbp?.installed ?? memStatus?.installed ?? false,
        // In production, the DB is the only shared truth between processes.
        // We use DB's lastStep first, then memory, then "Processing..." indicator.
        lastStep:
          dbp?.lastStep ??
          memStatus?.lastStep ??
          (isProcessing ? "Processing..." : null),
      };
    } catch (_e) {
      // Fallback to in-memory if DB fails
      return {
        ...plugin.manifest,
        enabled: memStatus?.enabled ?? false,
        installed: memStatus?.installed ?? false,
        lastStep:
          memStatus?.lastStep ?? (isProcessing ? "Processing..." : null),
      };
    }
  }

  public async getHooks(point: string) {
    const hooks = [];
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks) {
        hooks.push(...plugin.hooks.filter((h) => h.point === point));
      }
    }
    // Items without priority default to 100 to appear later
    return hooks.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  public async getExtensions(
    target: string,
    point: string,
    includeDisabled = false,
    context?: { roles?: string[]; permissions?: string[] },
  ) {
    const extensions = [];
    const pluginsToScan = includeDisabled
      ? this.getPlugins()
      : this.getEnabledPlugins();

    for (const plugin of pluginsToScan) {
      if (plugin.extensions) {
        extensions.push(
          ...plugin.extensions.filter((e) => {
            if (e.target !== target || e.point !== point) return false;
            if (context) {
              const userRoles = context.roles || [];
              const userPermissions = context.permissions || [];
              if (e.roles && e.roles.length > 0) {
                if (!e.roles.some((role) => userRoles.includes(role))) {
                  return false;
                }
              }
              if (e.permissions && e.permissions.length > 0) {
                if (
                  !e.permissions.every((perm) => userPermissions.includes(perm))
                ) {
                  return false;
                }
              }
            }
            return true;
          }),
        );
      }
    }
    // Items without priority default to 100 to appear later
    return extensions.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  public async getWidgets(
    area: string,
    context?: { roles?: string[]; permissions?: string[] },
  ) {
    const widgets = [];
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.widgets) {
        widgets.push(
          ...plugin.widgets.filter((w) => {
            if (w.area !== area) return false;
            if (context) {
              const userRoles = context.roles || [];
              const userPermissions = context.permissions || [];
              if (w.roles && w.roles.length > 0) {
                if (!w.roles.some((role) => userRoles.includes(role))) {
                  return false;
                }
              }
              if (w.permissions && w.permissions.length > 0) {
                if (
                  !w.permissions.every((perm) => userPermissions.includes(perm))
                ) {
                  return false;
                }
              }
            }
            return true;
          }),
        );
      }
    }
    // Items without priority default to 100 to appear later
    return widgets.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  private async delay(ms = 500) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL ||
      process.env.NEXT_RUNTIME === "edge"
    )
      return;

    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async togglePlugin(id: string, enabled: boolean, context?: any) {
    const plugin = this.findPlugin(id);
    if (!plugin) throw AppError.Internal(`Plugin ${id} not found`);

    // Canonicalize to the registered id so status lookups match
    id = plugin.manifest.id;

    const currentStatus = this.pluginStatus.get(id);
    if (currentStatus?.enabled === enabled) return;

    // Zapobieganie nieskończonej rekurencji (cyklom zależności)
    if (this.processingPlugins.has(id)) {
      return;
    }

    this.processingPlugins.add(id);

    try {
      if (enabled) {
        // activation process

        // 1. Check if the plugin requires any plugins
        await this.updateStep(id, "Checking dependencies...");
        await this.delay();
        const dependencies = plugin.manifest.dependencies || [];

        // 2. Aktywacja pluginów wymaganych
        for (const depId of dependencies) {
          const depPlugin = this.findPlugin(depId);
          const canonicalDepId =
            depPlugin?.manifest.id ?? resolveDependencyId(depId);
          const depStatus = this.pluginStatus.get(canonicalDepId);
          if (!depStatus?.enabled) {
            const depName = depPlugin?.manifest.name || canonicalDepId;

            await this.updateStep(
              id,
              `Waiting for dependency activation: ${depName}`,
            );
            // Recursive call for dependencies
            await this.togglePlugin(canonicalDepId, true, context);
            await this.delay();
          }
        }

        // 3. Before running the onEnable hook, we perform migrations
        if (plugin.migrations?.length) {
          await this.updateStep(id, "Migrating the database...");
          await this.delay();
          await this.migrationRunner.run(id, plugin.migrations as any);
        }

        // 4. Once migrations are complete, run the onEnable hook
        if (plugin.onEnable) {
          await this.updateStep(id, "Running the onEnable hook...");
          await this.delay();
          await plugin.onEnable(context);
        }

        // 5. Finally, we turn on the plugin
        await this.updateStatus(id, {
          enabled: true,
          installed: true,
          lastStep: null,
        });
        await this.delay();
      } else {
        // deactivation process

        // 1. Check for plugins that depend on us (automatic deactivation "upwards")
        // We MUST deactivate dependents FIRST, otherwise they would be broken when we disable ourselves
        // Match both the canonical id and the scoped npm-name form
        const dependents = Array.from(this.plugins.values()).filter((p) =>
          p.manifest.dependencies?.some(
            (dep) => resolveDependencyId(dep) === resolveDependencyId(id),
          ),
        );
        for (const dependent of dependents) {
          const depStatus = this.pluginStatus.get(dependent.manifest.id);
          if (
            depStatus?.enabled &&
            !this.processingPlugins.has(dependent.manifest.id)
          ) {
            await this.updateStep(
              id,
              `Deactivating dependent plugin: ${dependent.manifest.name}`,
            );
            await this.togglePlugin(dependent.manifest.id, false, context);
            await this.delay();
          }
        }

        // 2. Run the onDisable hook
        if (plugin.onDisable) {
          await this.updateStep(id, "Running onDisable hook...");
          await this.delay();
          await plugin.onDisable();
        }

        // 3. Run the rollback migrations
        if (plugin.migrations?.length) {
          await this.updateStep(id, "Rolling back database migrations...");
          await this.delay();
          try {
            await this.migrationRunner.rollback(id, plugin.migrations as any);
          } catch (e) {
            this.logger.error(
              "PluginRegistry",
              `Rollback failed for ${id}:`,
              e,
            );
          }
        }

        // 4. Disable the plugin itself
        await this.updateStatus(id, { enabled: false, lastStep: null });
        await this.delay();

        // 5. Finally, proceed to deactivate unused dependencies
        const dependencies = plugin.manifest.dependencies || [];
        for (const depId of dependencies) {
          const depPlugin = this.findPlugin(depId);
          const canonicalDepId =
            depPlugin?.manifest.id ?? resolveDependencyId(depId);
          const depStatus = this.pluginStatus.get(canonicalDepId);
          if (depStatus?.enabled) {
            // Check if anyone else is using this dependency (excluding those in the middle of deactivation)
            const otherDependents = Array.from(this.plugins.values()).some(
              (p) =>
                p.manifest.id !== id &&
                this.pluginStatus.get(p.manifest.id)?.enabled &&
                !this.processingPlugins.has(p.manifest.id) &&
                p.manifest.dependencies?.some(
                  (dep) =>
                    resolveDependencyId(dep) ===
                    resolveDependencyId(canonicalDepId),
                ),
            );

            if (!otherDependents) {
              const depName = depPlugin?.manifest.name || canonicalDepId;

              await this.updateStep(
                id,
                `Cleaning up unused dependency: ${depName}`,
              );
              await this.togglePlugin(canonicalDepId, false, context);
              await this.delay();
            }
          }
        }
      }

      // Important: init() is only called if we are ENABLING
      if (enabled && plugin.init) await plugin.init();

      // Ensure lastStep is cleared at the end of a SUCCESSFUL toggle
      await this.updateStep(id, null);
    } catch (error) {
      this.logger.warn(
        "veap:plugins",
        `Error toggling plugin ${id}: ${(error as Error).message}`,
      );
      await this.updateStep(id, `Error: ${(error as Error).message}`);
      throw error;
    } finally {
      this.processingPlugins.delete(id);

      // Final safety clear: if we're not in an error state, make sure lastStep is null
      const finalStatus = this.pluginStatus.get(id);
      if (
        finalStatus?.lastStep &&
        !finalStatus.lastStep.startsWith("Error:") &&
        !finalStatus.lastStep.includes("...")
      ) {
        await this.updateStep(id, null);
      }
    }

    await this.eventBus.publish("system:plugin:toggle", {
      pluginId: id,
      isEnabled: enabled,
    });
  }

  public async hasHooks(point: string): Promise<boolean> {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks?.some((h) => h.point === point)) return true;
    }
    return false;
  }

  public async hasExtension(target: string, point?: string): Promise<boolean> {
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.extensions) {
        if (
          plugin.extensions.some(
            (e) => e.target === target && (point ? e.point === point : true),
          )
        )
          return true;
      }
    }
    return false;
  }

  public async getConfig<T>(id: string): Promise<T | null> {
    try {
      const record = await this.repository.findById(id);
      return record?.config ? (JSON.parse(record.config) as T) : null;
    } catch {
      return null;
    }
  }

  public async updateConfig(id: string, config: any) {
    try {
      await this.repository.updateConfig(id, JSON.stringify(config));
    } catch (_e) {}
  }
}

// ─── Backwards-compatible re-exports ─────────────────────────────────────────
// The implementations live in `facade.ts`; this keeps
// `export * from "../application/plugins/registry"` in the entry barrels
// working for all module-level helpers.
export {
  registerPlugins,
  ensurePluginsInitialized,
  applyPluginFilters,
  togglePluginState,
  hasPluginHooks,
  hasPluginExtension,
  getPluginConfig,
  updatePluginConfig,
  getPluginsStatus,
  getPluginStatus,
} from "./facade";
