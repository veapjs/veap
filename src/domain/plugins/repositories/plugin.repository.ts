import type { IPlugin } from "../types";

/**
 * Persisted status of a plugin (mirrors the `plugins` table).
 */
export interface PluginStatusRecord {
  id: string;
  enabled: boolean;
  installed: boolean;
  system: boolean;
  /** Raw JSON string of the plugin config, or `null`. */
  config?: string | null;
  lastStep?: string | null;
}

/**
 * In-memory status overlay kept by the registry between DB syncs.
 */
export interface PluginRuntimeStatus {
  enabled: boolean;
  installed: boolean;
  lastStep?: string | null;
}

/** Payload used when a plugin row does not exist yet and must be created. */
export interface UpsertPluginStatusRecord {
  enabled?: boolean;
  installed?: boolean;
  lastStep?: string | null;
}

/**
 * Plugin status persistence port.
 *
 * The registry (application layer) depends on this abstraction only; the
 * ActiveRecord implementation lives in
 * `infrastructure/plugins/repositories`.
 */
export interface IPluginRepository {
  /** Returns all persisted plugin statuses. */
  findAll(): Promise<PluginStatusRecord[]>;

  /** Returns the persisted status of a single plugin, or `null`. */
  findById(id: string): Promise<PluginStatusRecord | null>;

  /**
   * Bulk-seeds statuses for newly registered plugins.
   * Existing rows are left alone except that `system` is re-merged.
   */
  seed(
    values: Array<{
      id: string;
      enabled: boolean;
      installed: boolean;
      system: boolean;
    }>,
  ): Promise<void>;

  /**
   * Updates the status of a plugin, creating the row if it does not exist.
   * `system` of the new row is taken from the registered plugin manifest.
   */
  upsertStatus(
    id: string,
    update: UpsertPluginStatusRecord,
    defaults: { system: boolean },
  ): Promise<void>;

  /** Stores the raw JSON plugin config. */
  updateConfig(id: string, configJson: string): Promise<void>;
}

/** Injection token for the plugin repository port. */
export const PLUGIN_REPOSITORY = Symbol.for("veap:plugins:repository");

/**
 * Migration runner port.
 *
 * Registry only needs "apply" and "revert" for a plugin's migration list;
 * the concrete knex-based runner is an infrastructure detail.
 */
export interface IMigrationRunner {
  run(scope: string, migrations: any[]): Promise<void>;
  rollback(scope: string, migrations: any[]): Promise<void>;
}

/** Injection token for the migration runner port. */
export const MIGRATION_RUNNER = Symbol.for("veap:plugins:migration-runner");

/** Convenience type re-export so consumers can name the contract. */
export type { IPlugin };
