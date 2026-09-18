import { SystemPlugin } from "../models/SystemPlugin";
import type {
  IPluginRepository,
  PluginStatusRecord,
  UpsertPluginStatusRecord,
} from "../../../domain/plugins/repositories/plugin.repository";

/**
 * `IPluginRepository` adapter backed by the `SystemPlugin` ActiveRecord model
 * and the raw `plugins` table for bulk seeding.
 *
 * This is the only place that knows how plugin statuses are persisted, so the
 * registry can be tested with an in-memory fake.
 */
export class ActiveRecordPluginRepository implements IPluginRepository {
  async findAll(): Promise<PluginStatusRecord[]> {
    const rows = await SystemPlugin.all();
    return rows.map((row) => ({
      id: row.id as string,
      enabled: Boolean(row.enabled),
      installed: Boolean(row.installed),
      system: Boolean(row.system),
      config: row.config ?? null,
      lastStep: row.lastStep ?? null,
    }));
  }

  async findById(id: string): Promise<PluginStatusRecord | null> {
    const row = await SystemPlugin.find(id);
    if (!row) return null;

    return {
      id,
      enabled: Boolean(row.enabled),
      installed: Boolean(row.installed),
      system: Boolean(row.system),
      config: row.config ?? null,
      lastStep: row.lastStep ?? null,
    };
  }

  async seed(
    values: Array<{
      id: string;
      enabled: boolean;
      installed: boolean;
      system: boolean;
    }>,
  ): Promise<void> {
    if (values.length === 0) return;

    const { getKnex } = await import("../../database");
    const knex = getKnex();

    await knex("plugins")
      .insert(
        values.map((p) => ({
          id: p.id,
          enabled: p.enabled,
          installed: p.installed,
          system: p.system,
        })),
      )
      .onConflict("id")
      .merge(["system"]);
  }

  async upsertStatus(
    id: string,
    update: UpsertPluginStatusRecord,
    defaults: { system: boolean },
  ): Promise<void> {
    const existing = await SystemPlugin.find(id);

    if (existing) {
      if (update.enabled !== undefined)
        existing.setAttribute("enabled", update.enabled);
      if (update.installed !== undefined)
        existing.setAttribute("installed", update.installed);
      if (update.lastStep !== undefined)
        existing.setAttribute("lastStep", update.lastStep);
      existing.setAttribute("updatedAt", new Date());
      await existing.save();
      return;
    }

    await SystemPlugin.create({
      id,
      enabled: update.enabled ?? false,
      installed: update.installed ?? false,
      lastStep: update.lastStep ?? null,
      system: defaults.system,
      updatedAt: new Date(),
    });
  }

  async updateConfig(id: string, configJson: string): Promise<void> {
    await SystemPlugin.where("id", id).update({
      config: configJson,
      updatedAt: new Date(),
    });
  }
}
